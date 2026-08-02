import os
import sys
import time
import cv2
import threading
import queue
import csv
from datetime import datetime
from collections import deque
from modules.violation_offense.offense_routes import send_offense_notification
from modules.mapping.mapping_routes import log_incident_core

# ---------------- FIX PYTHON PATH ----------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from modules.face_rfid.face_engine import recognize_faces_multi
import modules.sensor.readarduino as readarduino
from modules.vape.inference import infer
from ultralytics import YOLO

# ---------------- SMOKE MODEL ----------------
SMOKE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
smoke_model = YOLO(SMOKE_MODEL_PATH)

# ---------------- GENERIC PERSON MODEL (pose-independent fallback) ----------------
PERSON_MODEL_PATH = os.environ.get("PERSON_MODEL_PATH", "yolov8n.pt")
person_model = YOLO(PERSON_MODEL_PATH)

# ---------------- CONFIG ----------------
FACE_FRAME_SKIP        = 5
YOLO_FRAME_SKIP        = 5
FONT                   = cv2.FONT_HERSHEY_SIMPLEX
SENSOR_THRESHOLD       = 300
RED_HOLD_TIME          = 7
ALERT_INTERVAL         = 5

DISPLAY_CONF_THRESHOLD = 0.50
ALERT_CONF_THRESHOLD   = 0.75

PERSON_CONF_THRESHOLD  = 0.55


# ---------------- SMOKE (CAM) — VERY STRICT RULES ----------------
SMOKE_WINDOW             = 20     # 🔒 bara window — thodi der consistently dikhna chahiye
SMOKE_MIN_HITS           = 16     # 🔒 20 mein se kam-az-kam 16 hits chahiye
SMOKE_MODEL_CONF         = 0.72   # 🔒 model confidence bohot barhai (pehle 0.62 thi)
SMOKE_MIN_BOX_AREA_RATIO = 0.02   # 🔒 box thora bara hona chahiye (2% frame area)
SMOKE_MIN_CONSECUTIVE    = 10     # 🔒 kam-az-kam 10 CONSECUTIVE hits — random noise ye kabhi nahi karega
SMOKE_DEBUG              = True   # 🔍 har detection/rejection ki exact conf/box_ratio terminal par print hogi

# ---------------- CAMERA FIXED LOCATION (for incident mapping) ----------------
CAMERA_LATITUDE  = float(os.environ.get("CAMERA_LATITUDE", 33.7298))
CAMERA_LONGITUDE = float(os.environ.get("CAMERA_LONGITUDE", 74.3382))
CAMERA_ID        = os.environ.get("CAMERA_ID", "CAM-1-LIBRARY")

RTSP_URL = "rtsp://admin:awais123%40@192.168.18.92:554/cam/realmonitor?channel=1&subtype=1"

ALERT_CSV_PATH = os.path.join(os.path.dirname(__file__), "alerts.csv")

# ---------------- PROOF IMAGES ----------------
ALERT_IMAGES_DIR = os.path.join(os.path.dirname(__file__), "alert_images")
os.makedirs(ALERT_IMAGES_DIR, exist_ok=True)

def save_alert_image(display_frame, reg_no):
    """Saves the annotated frame at the moment of violation as proof.
       Returns just the filename (stored in CSV, served via API later)."""
    now = datetime.now()
    safe_reg = "".join(c for c in str(reg_no) if c.isalnum()) or "UNKNOWN"
    filename = f"{safe_reg}_{now.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
    filepath = os.path.join(ALERT_IMAGES_DIR, filename)
    try:
        cv2.imwrite(filepath, display_frame)
        print(f"[VAPE] 📸 Proof image saved: {filename}")
    except Exception as e:
        print(f"[VAPE ERROR] Could not save proof image: {e}")
        return ""
    return filename

# ---------------- CSV LOGGER ----------------
def log_alert_to_csv(reg_no, vape_cig, smoke_cam, smoke_sensor, image_filename=""):
    now = datetime.now()
    file_exists = os.path.isfile(ALERT_CSV_PATH)
    with open(ALERT_CSV_PATH, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["REG_NO", "Date", "Time", "Vape/Cig", "Smoke(CAM)", "Smoke(MQ135)", "Image"])
        writer.writerow([
            reg_no,
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            vape_cig,
            smoke_cam,
            smoke_sensor,
            image_filename
        ])
    print(f"[ALERT CSV] Logged → REG:{reg_no} | Vape:{vape_cig} | SmokeCam:{smoke_cam} | Sensor:{smoke_sensor} | Image:{image_filename}")

# ---------------- SENSOR ----------------
def get_sensor_value():
    try:
        raw = readarduino.get_sensor_value()
        if raw is None:
            return 0
        if isinstance(raw, int):
            return raw
        if isinstance(raw, str):
            raw = raw.strip()
            if ":" in raw:
                raw = raw.split(":")[-1].strip()
            if raw.isdigit():
                return int(raw)
    except Exception:
        pass
    return 0

# ---------------- CAMERA READER ----------------
def camera_reader(cap, fq, stop_event):
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue
        if not fq.empty():
            try:
                fq.get_nowait()
            except Exception:
                pass
        fq.put(frame)

def connect_camera():
    rtsp_url = os.environ.get("RTSP_URL", RTSP_URL)
    print(f"\n[VAPE] Connecting to camera...")
    print(f"[VAPE] Host: 192.168.18.41:554\n")

    for attempt in range(1, 4):
        print(f"[VAPE] Attempt {attempt}/3...")
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FPS, 25)
        time.sleep(3)

        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                print(f"[VAPE] ✅ Camera connected on attempt {attempt}!")
                return cap
            print(f"[VAPE] Stream opened but no frame — closing.")
            cap.release()
        else:
            print(f"[VAPE] Stream could not be opened.")
            cap.release()

        if attempt < 3:
            print(f"[VAPE] Waiting 5s before next attempt...")
            time.sleep(5)

    print("[VAPE ERROR] All 3 attempts failed.")
    return None

# ---------------- DRAWING HELPERS ----------------
def color(active):
    return (0, 0, 255) if active else (0, 180, 0)

def draw_face_box(frame, face, person_red):
    x1, y1, x2, y2 = face["box"]
    reg_no  = str(face.get("reg_no") or "UNKNOWN")
    box_clr = color(person_red)
    fw      = x2 - x1
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_clr, 2)
    label      = f"REG:{reg_no}"
    font_scale = 0.55
    while font_scale > 0.25:
        (tw, th), _ = cv2.getTextSize(label, FONT, font_scale, 1)
        if tw <= fw - 6:
            break
        font_scale -= 0.05
    (tw, th), baseline = cv2.getTextSize(label, FONT, font_scale, 1)
    label_h = th + baseline + 6
    cv2.rectangle(frame, (x1, y1), (x1 + fw, y1 + label_h), box_clr, -1)
    cv2.putText(frame, label, (x1 + (fw - tw) // 2, y1 + th + 2),
                FONT, font_scale, (255, 255, 255), 1)

def draw_generic_person_box(frame, box, person_red):
    x1, y1, x2, y2 = box
    box_clr = color(person_red)
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_clr, 2)
    label = "PERSON"
    (tw, th), baseline = cv2.getTextSize(label, FONT, 0.5, 1)
    cv2.rectangle(frame, (x1, y1), (x1 + tw + 10, y1 + th + baseline + 6), box_clr, -1)
    cv2.putText(frame, label, (x1 + 5, y1 + th + 2), FONT, 0.5, (255, 255, 255), 1)

def should_alert(person_red, vape_red, smoke_confirmed, sensor_red):
    return (person_red and vape_red) and (smoke_confirmed or sensor_red)

def draw_confidence_panel(frame, predictions, conf_threshold, w, h):
    panel_w = 220
    panel_h = 90
    margin  = 14
    px      = w - panel_w - margin
    py      = h - panel_h - 38
    valid   = [p for p in predictions if p.get("confidence", 0) >= conf_threshold]
    overlay = frame.copy()
    cv2.rectangle(overlay, (px, py), (px + panel_w, py + panel_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    if not valid:
        cv2.putText(frame, "Vape Confidence", (px + 8, py + 22), FONT, 0.5, (160, 160, 160), 1)
        cv2.putText(frame, "No Detection",    (px + 8, py + 55), FONT, 0.65, (120, 120, 120), 2)
        cv2.rectangle(frame, (px + 8, py + 65), (px + panel_w - 8, py + 77), (60, 60, 60), -1)
        return
    best_conf = max(p["confidence"] for p in valid)
    pct       = int(best_conf * 100)
    bar_color = (0, 0, 255) if best_conf >= ALERT_CONF_THRESHOLD else (0, 140, 255) if best_conf >= 0.65 else (0, 200, 100)
    cv2.putText(frame, "Vape Confidence", (px + 8, py + 20), FONT, 0.5, (200, 200, 200), 1)
    pct_str = f"{pct}%"
    (pw, ph), _ = cv2.getTextSize(pct_str, FONT, 1.4, 3)
    cv2.putText(frame, pct_str, (px + panel_w - pw - 10, py + 62), FONT, 1.4, bar_color, 3)
    bar_x, bar_y, bar_w = px + 8, py + panel_h - 18, panel_w - 16
    filled = int(bar_w * best_conf)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + 10), (60, 60, 60), -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + filled, bar_y + 10), bar_color, -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + 10), (100, 100, 100), 1)
    if len(valid) > 1:
        cv2.putText(frame, f"{len(valid)} objects", (px + 8, py + 62), FONT, 0.5, (180, 180, 180), 1)

def draw_gui(frame, last_predictions, last_face_results, last_generic_boxes, person_red, vape_red,
             smoke_hits, smoke_confirmed, sensor_red, sensor_value, frame_count):
    display = frame.copy()
    h, w    = display.shape[:2]
    x_ratio = w / 640
    y_ratio = h / 480

    for pred in last_predictions:
        if pred.get("confidence", 0) < DISPLAY_CONF_THRESHOLD:
            continue
        cx, cy = int(pred["x"] * x_ratio), int(pred["y"] * y_ratio)
        bw, bh = int(pred["width"] * x_ratio), int(pred["height"] * y_ratio)
        x1v, y1v = cx - bw // 2, cy - bh // 2
        x2v, y2v = cx + bw // 2, cy + bh // 2
        conf = pred["confidence"]
        confirmed = conf >= ALERT_CONF_THRESHOLD
        lbl  = f"VAPE  {conf:.0%}" + ("" if confirmed else "  (unconfirmed)")
        box_clr = (0, 0, 255) if confirmed else (0, 140, 255)
        cv2.rectangle(display, (x1v, y1v), (x2v, y2v), box_clr, 3)
        lw, lh = cv2.getTextSize(lbl, FONT, 0.75, 2)[0]
        cv2.rectangle(display, (x1v, y1v - lh - 14), (x1v + lw + 8, y1v), box_clr, -1)
        cv2.putText(display, lbl, (x1v + 4, y1v - 5), FONT, 0.75, (255, 255, 255), 2)

    for face in last_face_results:
        draw_face_box(display, face, person_red)

    for box in last_generic_boxes:
        draw_generic_person_box(display, box, person_red)

    smoke_lbl  = f"SMOKE (CAM)  {smoke_hits}/{SMOKE_WINDOW}"
    indicators = [
        ("PERSON",        person_red,     ""),
        ("VAPE / CIG",    vape_red,       ""),
        (smoke_lbl,       smoke_confirmed,""),
        ("SMOKE (MQ135)", sensor_red,     str(sensor_value)),
    ]
    y_ind = 10
    for lbl, active, val in indicators:
        text = f"{lbl}  {val}".strip()
        (tw, th), _ = cv2.getTextSize(text, FONT, 0.52, 1)
        rw, rh = tw + 22, th + 14
        cv2.rectangle(display, (10, y_ind), (10 + rw, y_ind + rh), color(active), -1)
        cv2.putText(display, text, (18, y_ind + rh - 5), FONT, 0.52, (255, 255, 255), 1)
        y_ind += rh + 6

    draw_confidence_panel(display, last_predictions, DISPLAY_CONF_THRESHOLD, w, h)

    alert_active = should_alert(person_red, vape_red, smoke_confirmed, sensor_red)
    a_text  = ("STRONG ALERT!" if (smoke_confirmed and sensor_red) else "ALERT!") if alert_active else "MONITORING"
    a_color = (0, 0, 180) if alert_active else (0, 140, 0)
    (aw, ah), _ = cv2.getTextSize(a_text, FONT, 0.75, 2)
    cv2.rectangle(display, (w - aw - 22, 10), (w - 5, 10 + ah + 16), a_color, -1)
    cv2.putText(display, a_text, (w - aw - 12, 10 + ah + 6), FONT, 0.75, (255, 255, 255), 2)

    border_clr = (0, 0, 255) if alert_active else (0, 180, 0)
    cv2.rectangle(display, (0, 0), (w - 1, h - 1), border_clr, 12)
    cv2.rectangle(display, (0, h - 28), (w, h), (30, 30, 30), -1)
    info = (f"Frame:{frame_count}  |  vape-detector/2 + best.pt  |  "
            f"Sensor:{sensor_value}  |  Smoke:{smoke_hits}/{SMOKE_WINDOW}  |  Q=Quit")
    cv2.putText(display, info, (8, h - 8), FONT, 0.4, (180, 180, 180), 1)
    return display

# =====================================================================
# MAIN DETECTION FUNCTION
# =====================================================================
def start_vape(attendance_done_flag=lambda: True,
               sensor_threshold_flag=lambda: True,
               show_gui=False):

    last_face_results        = []
    last_person_time         = 0.0
    last_generic_person_time = 0.0
    last_generic_boxes       = []
    last_vape_time           = 0.0
    last_smoke_time          = 0.0
    smoke_history            = deque(maxlen=SMOKE_WINDOW)
    last_predictions         = []
    last_alert_time          = 0.0
    frame_count              = 0

    print("[VAPE] Starting smart smoke surveillance...")

    cap = connect_camera()
    if cap is None:
        print("[VAPE ERROR] Could not connect to camera. Worker will retry.")
        return

    fq         = queue.Queue(maxsize=1)
    stop_event = threading.Event()
    threading.Thread(
        target=camera_reader, args=(cap, fq, stop_event), daemon=True
    ).start()

    print("[VAPE] Low-latency camera reader started")
    print(f"[VAPE] Detection running... show_gui={show_gui}")

    try:
        while True:
            now = time.time()

            try:
                frame = fq.get(timeout=2.0)
            except queue.Empty:
                print("[VAPE] ⚠️  No frame for 2s — camera may have dropped.")
                continue

            frame_count += 1
            h, w = frame.shape[:2]
            frame_area = h * w

            # ── FACE + GENERIC PERSON (pose-independent) ────────────────
            if frame_count % FACE_FRAME_SKIP == 0:
                try:
                    current_faces = recognize_faces_multi(frame)
                    if current_faces:
                        last_face_results = current_faces
                        last_person_time  = now
                        names = [str(f.get("reg_no", "?")) for f in current_faces]
                        print(f"[FACE] Detected: {names}")
                    elif now - last_person_time > RED_HOLD_TIME:
                        last_face_results = []
                except Exception as e:
                    print(f"[FACE ERROR] {e}")

                try:
                    person_results = person_model.predict(
                        frame, conf=PERSON_CONF_THRESHOLD, classes=[0], verbose=False
                    )
                    generic_boxes = []
                    for r in person_results:
                        for box in r.boxes:
                            x1p, y1p, x2p, y2p = map(int, box.xyxy[0])
                            generic_boxes.append((x1p, y1p, x2p, y2p))

                    if generic_boxes:
                        last_generic_person_time = now
                        last_generic_boxes = generic_boxes
                    elif now - last_generic_person_time > RED_HOLD_TIME:
                        last_generic_boxes = []
                except Exception as e:
                    print(f"[PERSON ERROR] {e}")

            person_red = (
                (now - last_person_time <= RED_HOLD_TIME) or
                (now - last_generic_person_time <= RED_HOLD_TIME)
            )

            # ── VAPE + SMOKE ───────────────────────────────────────────
            vape_detected = False
            smoke_raw     = False

            if frame_count % YOLO_FRAME_SKIP == 0:
                try:
                    small = cv2.resize(frame, (640, 480))
                    cv2.imwrite("frame.jpg", small)
                    result           = infer("frame.jpg")
                    last_predictions = result.get("predictions", [])

                    for pred in last_predictions:
                        conf = pred.get("confidence", 0)
                        if conf >= ALERT_CONF_THRESHOLD:
                            vape_detected = True
                            print(f"[VAPE DETECT] conf={conf:.0%} (confirmed ≥{int(ALERT_CONF_THRESHOLD*100)}%)")
                            break

                    # 🔒 Smoke camera detection — VERY strict, with full debug visibility
                    smoke_results = smoke_model.predict(frame, conf=0.20, verbose=False)
                    frame_had_any_smoke_box = False

                    for r in smoke_results:
                        for box in r.boxes:
                            cls_name = smoke_model.names[int(box.cls[0])].lower()
                            if cls_name != "smoke":
                                continue

                            frame_had_any_smoke_box = True
                            conf_val = float(box.conf[0]) if hasattr(box, "conf") else 0.0
                            x1s, y1s, x2s, y2s = map(int, box.xyxy[0])
                            box_area = max(0, (x2s - x1s)) * max(0, (y2s - y1s))
                            box_ratio = box_area / frame_area if frame_area else 0

                            passes_conf = conf_val >= SMOKE_MODEL_CONF
                            passes_size = box_ratio >= SMOKE_MIN_BOX_AREA_RATIO

                            if SMOKE_DEBUG:
                                status = "✅ ACCEPTED" if (passes_conf and passes_size) else "❌ rejected"
                                print(f"[SMOKE CHECK] {status} | conf={conf_val:.2%} "
                                      f"(need ≥{SMOKE_MODEL_CONF:.0%}) | box_ratio={box_ratio:.4f} "
                                      f"(need ≥{SMOKE_MIN_BOX_AREA_RATIO:.4f})")

                            if passes_conf and passes_size:
                                smoke_raw = True

                    if SMOKE_DEBUG and not frame_had_any_smoke_box:
                        if frame_count % 25 == 0:
                            print("[SMOKE CHECK] No smoke box returned by model this frame.")

                except Exception as e:
                    print(f"[DETECTION ERROR] {e}")

                smoke_history.append(smoke_raw)

            if vape_detected:
                last_vape_time = now
            if smoke_raw:
                last_smoke_time = now

            vape_red   = (now - last_vape_time) <= RED_HOLD_TIME
            smoke_hits = sum(smoke_history)

            def has_consecutive_hits(history, min_consecutive):
                streak = 0
                for val in history:
                    if val:
                        streak += 1
                        if streak >= min_consecutive:
                            return True
                    else:
                        streak = 0
                return False

            smoke_confirmed = (
                len(smoke_history) >= SMOKE_WINDOW and
                smoke_hits >= SMOKE_MIN_HITS and
                has_consecutive_hits(smoke_history, SMOKE_MIN_CONSECUTIVE)
            )

            sensor_value = get_sensor_value()
            sensor_red   = sensor_value >= SENSOR_THRESHOLD

            if frame_count % 50 == 0:
                print(f"[VAPE ❤️ ] frame={frame_count} | "
                      f"person={'Y' if person_red else 'N'} | "
                      f"vape={'Y' if vape_red else 'N'} | "
                      f"smoke={smoke_hits}/{SMOKE_WINDOW} | "
                      f"sensor={sensor_value}")

            # ── ALERT ─────────────────────────────────────────────────
            if should_alert(person_red, vape_red, smoke_confirmed, sensor_red):
                if now - last_alert_time >= ALERT_INTERVAL:
                    both_optional = smoke_confirmed and sensor_red
                    strength      = "STRONG" if both_optional else "ALERT"
                    best_conf     = max((p["confidence"] for p in last_predictions), default=0)

                    proof_frame = draw_gui(
                        frame, last_predictions, last_face_results, last_generic_boxes,
                        person_red, vape_red, smoke_hits, smoke_confirmed,
                        sensor_red, sensor_value, frame_count
                    )

                    if last_face_results:
                        primary_reg = last_face_results[0].get("reg_no") or "UNKNOWN"
                    else:
                        primary_reg = "UNKNOWN"

                    image_filename = save_alert_image(proof_frame, primary_reg)

                    if last_face_results:
                        for face in last_face_results:
                            reg_no_val = face.get("reg_no") or "UNKNOWN"

                            # 1) CSV log
                            log_alert_to_csv(
                                reg_no_val, "YES",
                                "YES" if smoke_confirmed else "NO", sensor_value,
                                image_filename
                            )

                            # 2) Offense email — student/admin, based on offense count
                            try:
                                send_offense_notification(reg_no_val)
                            except Exception as email_err:
                                print(f"[OFFENSE EMAIL ERROR] {email_err}")

                            # 3) Map pin — real-time incident location logging
                            try:
                                log_incident_core(
                                    reg_no=reg_no_val,
                                    latitude=CAMERA_LATITUDE,
                                    longitude=CAMERA_LONGITUDE,
                                    violation_type="vape" if vape_red else "smoke",
                                    student_name="",
                                    vape_detected=vape_red,
                                    smoke_cam=smoke_confirmed,
                                    smoke_sensor=sensor_value,
                                    confidence=best_conf,
                                    camera_id=CAMERA_ID,
                                    notes=f"Auto-detected: {strength}"
                                )
                                print(f"[MAPPING] Incident pinned for {reg_no_val} at "
                                      f"({CAMERA_LATITUDE}, {CAMERA_LONGITUDE})")
                            except Exception as map_err:
                                print(f"[MAPPING ERROR] {map_err}")
                    else:
                        # UNKNOWN face — still log CSV + map pin (no email, no valid reg_no)
                        log_alert_to_csv("UNKNOWN", "YES",
                                         "YES" if smoke_confirmed else "NO", sensor_value,
                                         image_filename)
                        try:
                            log_incident_core(
                                reg_no="UNKNOWN",
                                latitude=CAMERA_LATITUDE,
                                longitude=CAMERA_LONGITUDE,
                                violation_type="vape" if vape_red else "smoke",
                                student_name="",
                                vape_detected=vape_red,
                                smoke_cam=smoke_confirmed,
                                smoke_sensor=sensor_value,
                                confidence=best_conf,
                                camera_id=CAMERA_ID,
                                notes=f"Auto-detected (unidentified person): {strength}"
                            )
                            print(f"[MAPPING] Incident pinned for UNKNOWN at "
                                  f"({CAMERA_LATITUDE}, {CAMERA_LONGITUDE})")
                        except Exception as map_err:
                            print(f"[MAPPING ERROR] {map_err}")

                    print("\n" + "🚨 " * 15)
                    print(f"  {strength} ALERT LOGGED!")
                    print(f"  Vape Confidence : {best_conf:.0%}")
                    print(f"  Person : {'YES' if person_red else 'NO'}  "
                          f"Vape : {'YES' if vape_red else 'NO'}  "
                          f"Smoke(CAM) : {'YES' if smoke_confirmed else 'NO'} ({smoke_hits}/{SMOKE_WINDOW})  "
                          f"Sensor : {'YES' if sensor_red else 'NO'} ({sensor_value})")
                    print("🚨 " * 15 + "\n")
                    last_alert_time = now

            # ── GUI — only on main thread ──────────────────────────────
            if show_gui:
                try:
                    display = draw_gui(
                        frame, last_predictions, last_face_results, last_generic_boxes,
                        person_red, vape_red, smoke_hits, smoke_confirmed,
                        sensor_red, sensor_value, frame_count
                    )
                    cv2.imshow("Smart Smoke Surveillance", display)
                    key = cv2.waitKey(1) & 0xFF
                    if key in [ord('q'), 27]:
                        print("[VAPE] Stopped by user (Q/ESC).")
                        break
                except Exception as gui_err:
                    print(f"[VAPE GUI ERROR] {gui_err} — GUI disabled, detection continues.")
                    show_gui = False

            time.sleep(0.002)

    except Exception as fatal:
        print(f"[VAPE FATAL] {fatal}")
        raise

    finally:
        print("[VAPE] Cleaning up...")
        stop_event.set()
        cap.release()
        if show_gui:
            cv2.destroyAllWindows()
        print("[VAPE] Detection stopped.")


if __name__ == "__main__":
    start_vape(show_gui=True)