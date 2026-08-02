import serial
import time
import threading
import os
import csv
from datetime import datetime

# ---------------- CONFIG ----------------
PORT = "/dev/tty.usbserial-14210"
BAUD = 9600
MQ135_THRESHOLD = 300

# ---------------- PATHS ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SENSOR_CSV_PATH = os.path.join(BASE_DIR, "sensor_log.csv")

# ---------------- GLOBAL STATE ----------------
LATEST_SENSOR_VALUE      = 0
LAST_VALID_SENSOR_VALUE  = 0
LATEST_RFID              = None
LAST_LOG_TIME            = 0
LOG_INTERVAL             = 5  # seconds — CSV spam avoid karne ke liye

# ✅ FIX: RFID callback list — worker.py yahan register karega
_rfid_callbacks = []

def on_rfid_detected(callback):
    """
    Koi bhi module yahan apna callback register kar sakta hai.
    Jab bhi RFID scan hoga, yeh callback fire hoga.

    Usage (worker.py mein):
        readarduino.on_rfid_detected(my_handler)
    """
    if callback not in _rfid_callbacks:
        _rfid_callbacks.append(callback)

# ---------------- SERIAL INIT ----------------
try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
    time.sleep(2)
    print("[SERIAL] Arduino connected")
except Exception as e:
    print("[SERIAL ERROR]", e)
    ser = None

# ---------------- CSV LOGGER ----------------
def log_sensor_to_csv(value, location="Room 201"):
    global LAST_LOG_TIME

    now = time.time()
    if now - LAST_LOG_TIME < LOG_INTERVAL:
        return  # duplicate spam avoid

    LAST_LOG_TIME = now

    file_exists = os.path.isfile(SENSOR_CSV_PATH)
    dt = datetime.now()

    try:
        with open(SENSOR_CSV_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Date", "Time", "Location", "Type", "Status"])

            writer.writerow([
                dt.strftime("%Y-%m-%d"),
                dt.strftime("%H:%M:%S"),
                location,
                "Smoke Triggered" if value >= MQ135_THRESHOLD else "Normal",
                "Pending"
            ])

        print(f"[CSV LOGGED] MQ135={value}")

    except Exception as e:
        print("[CSV ERROR]", e)

# ---------------- MAIN READER LOOP ----------------
def _reader_loop():
    global LATEST_SENSOR_VALUE, LAST_VALID_SENSOR_VALUE, LATEST_RFID

    while True:
        try:
            if not ser or not ser.in_waiting:
                time.sleep(0.05)
                continue

            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                continue

            print("[SERIAL RAW]", line)

            # -------- RFID --------
            if line.startswith("REG:"):
                rfid_val = line.replace("REG:", "").strip()
                LATEST_RFID = rfid_val
                print("[RFID]", rfid_val)

                # ✅ Callbacks fire karo — worker.py ko notify karo
                for cb in _rfid_callbacks:
                    try:
                        cb(rfid_val)
                    except Exception as cb_err:
                        print(f"[RFID CALLBACK ERROR] {cb_err}")

                continue

            # -------- MQ135 / Smoke --------
            value = None

            if any(char.isdigit() for char in line):
                if ":" in line:
                    parts = line.split(":")
                    if parts[-1].strip().isdigit():
                        value = int(parts[-1].strip())
                else:
                    digits = "".join(filter(str.isdigit, line))
                    if digits:
                        value = int(digits)

            if value is not None:
                LATEST_SENSOR_VALUE     = value
                LAST_VALID_SENSOR_VALUE = value

                if value >= 100:
                    print(f"[MQ135] {value}")

                if value >= MQ135_THRESHOLD:
                    log_sensor_to_csv(value)

        except Exception as e:
            print("[SERIAL ERROR]", e)
            time.sleep(0.5)

# ---------------- PUBLIC API ----------------
def start_sensor_worker():
    """
    Sirf ek baar call karo — app.py mein.
    Yeh background thread mein serial read karta rehta hai.
    """
    t = threading.Thread(target=_reader_loop, daemon=True)
    t.start()
    print("[SERIAL] Background reader started")

def get_sensor_value():
    return LATEST_SENSOR_VALUE if LATEST_SENSOR_VALUE > 0 else LAST_VALID_SENSOR_VALUE

def get_rfid_value():
    return LATEST_RFID