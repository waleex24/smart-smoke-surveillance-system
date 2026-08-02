# 📁 modules/vape/vape_worker.py

import threading
import time
from modules.vape.run import start_vape

# ---------------- INTERNAL STATE ----------------
_worker_thread  = None
_worker_running = False

# ---------------- Vape Worker Loop ----------------
def vape_worker_loop(attendance_done_flag=None):
    global _worker_running

    print("[VAPE WORKER] Worker loop started...")

    if attendance_done_flag is None:
        attendance_done_flag = lambda: True   # testing ke liye default True

    _worker_running = True

    # -------- STEP 1: Attendance ka wait karo --------
    print("[VAPE WORKER] Waiting for today's first attendance...")
    while _worker_running and not attendance_done_flag():
        time.sleep(2)   # har 2 second mein check karo

    if not _worker_running:
        print("[VAPE WORKER] Stopped before starting.")
        return

    print("[VAPE WORKER] ✅ Attendance confirmed! Starting vape detection camera...")

    # -------- STEP 2: Vape detection loop --------
    # Agar start_vape kisi wajah se band ho jaye → restart karo
    while _worker_running:
        try:
            start_vape(
                attendance_done_flag=attendance_done_flag,
                sensor_threshold_flag=lambda: True   # sensor flag hamesha True
            )
            # start_vape ne exit kiya — thoda ruk ke restart
            if _worker_running:
                print("[VAPE WORKER] Detection stopped. Restarting in 3 seconds...")
                time.sleep(3)

        except Exception as e:
            print(f"[VAPE WORKER ERROR] Crash: {e}")
            time.sleep(3)

    print("[VAPE WORKER] Worker loop exited.")


# ---------------- Start Worker ----------------
def start_vape_worker(attendance_done_flag=None):
    global _worker_thread, _worker_running

    if _worker_running:
        print("[VAPE WORKER] Already running — skipping.")
        return

    _worker_thread = threading.Thread(
        target=vape_worker_loop,
        args=(attendance_done_flag,),
        daemon=True
    )
    _worker_thread.start()
    print("[VAPE WORKER] Background thread started.")


# ---------------- Stop Worker ----------------
def stop_vape_worker():
    global _worker_running
    _worker_running = False
    print("[VAPE WORKER] Stop signal sent.")