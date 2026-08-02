import threading
import time
import csv
import os
from datetime import datetime
import serial  # Arduino serial port

from modules.face_rfid.face_engine import recognize_face_once

CSV_FILE = os.path.join(os.path.dirname(__file__), "attendance.csv")
CARD_REMOVE_TIMEOUT = 2  # seconds

# ---------------- CSV ----------------
def ensure_csv():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, "w", newline="") as f:
            csv.writer(f).writerow(["Name", "RegNo", "Date", "Time"])

def already_marked(reg_no, date_str):
    if not os.path.exists(CSV_FILE):
        return False
    with open(CSV_FILE, newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if row[1] == reg_no and row[2] == date_str:
                return True
    return False

def mark_attendance(name, reg_no):
    now = datetime.now()
    with open(CSV_FILE, "a", newline="") as f:
        csv.writer(f).writerow([
            name,
            reg_no,
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S")
        ])
    print(f"[ATTENDANCE SUCCESS] {name} ({reg_no})")

# ---------------- Worker ----------------
def face_rfid_worker(serial_port="/dev/tty.usbserial-14210", baudrate=9600):
    print("[INFO] Face + RFID + Sensor worker running")

    ser = serial.Serial(serial_port, baudrate, timeout=0.1)
    active_card = None
    face_verified_for_card = False
    last_seen_time = 0

    while True:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            now = time.time()
            if not line:
                # Card removal timeout
                if active_card and (now - last_seen_time) > CARD_REMOVE_TIMEOUT:
                    active_card = None
                    face_verified_for_card = False
                    # print("[INFO] Card removed, ready for next detection")
                time.sleep(0.05)
                continue

            # ---------------- RFID ----------------
            if line.startswith("REG:"):
                reg_no = line.split(":")[1].strip()
                last_seen_time = now

                if active_card != reg_no:
                    active_card = reg_no
                    face_verified_for_card = False
                    print(f"[RFID DETECTED] {reg_no}")

                if face_verified_for_card:
                    continue

                today = datetime.now().strftime("%Y-%m-%d")

                if already_marked(reg_no, today):
                    print(f"[INFO] Attendance already marked for {reg_no}")
                    face_verified_for_card = True
                    continue

                # Run face verification
                print("[INFO] Starting face verification...")
                time.sleep(0.5)
                name, face_reg = recognize_face_once()
                face_verified_for_card = True

                if face_reg is None:
                    print("[WARNING] No face detected.")
                elif str(face_reg) != str(reg_no):
                    print("[WARNING] Face mismatch.")
                else:
                    mark_attendance(name, reg_no)

            # ---------------- Smoke Sensor ----------------
            elif line.startswith("SMOKE:"):
                smoke_value = line.split(":")[1].strip()
                print(f"[SMOKE SENSOR] {smoke_value}")

        except KeyboardInterrupt:
            print("[INFO] Worker stopped")
            break
        except Exception as e:
            print("[ERROR]", e)
            time.sleep(0.2)

# ---------------- Starter ----------------
def start_face_rfid_worker():
    ensure_csv()
    t = threading.Thread(target=face_rfid_worker, daemon=True)
    t.start()
    print("[INFO] Face + RFID + Sensor worker started")
