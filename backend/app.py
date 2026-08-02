from flask import Flask, jsonify
from flask_cors import CORS
import threading
import logging
from datetime import datetime
import os
import csv
import time

# ============================================================================
# Extensions
# ============================================================================
from extensions import db, jwt, migrate, mail

# ============================================================================
# Blueprints
# ============================================================================
from modules.auth.routes_auth         import auth_bp
from modules.students.routes_students import students_bp
from modules.auth.attendance_routes   import attendance_bp
from modules.admin.routes_admin       import admin_bp
from modules.sensor.sensor_routes     import sensor_bp
from modules.vape.alerts_routes       import alerts_bp
from modules.appeals.appeals_routes   import appeals_bp
from modules.mapping.mapping_routes   import mapping_bp
from modules.ai_assistant.ai_routes   import ai_bp          # ✅ MODULE 12
from modules.violation_offense.offense_routes import offense_bp

# ============================================================================
# Background Workers
# ============================================================================
from modules.face_rfid.worker    import start_face_rfid_worker
from modules.sensor.readarduino  import start_sensor_worker
from modules.vape.run            import start_vape

# ============================================================================
# Logging
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(asctime)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# ============================================================================
# Attendance CSV
# ============================================================================
ATTENDANCE_CSV = os.path.join(
    os.path.dirname(__file__), "modules", "face_rfid", "attendance.csv"
)

def attendance_done_flag():
    if not os.path.exists(ATTENDANCE_CSV):
        return False
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        with open(ATTENDANCE_CSV, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if len(row) >= 3 and row[2] == today:
                    return True
    except Exception as e:
        logging.error(f"Attendance flag check failed: {e}")
    return False


# ============================================================================
# App Factory
# ============================================================================
def create_app():
    app = Flask(__name__)

    try:
        from config import Config
        app.config.from_object(Config)
        logging.info("Loaded app configuration")
    except ModuleNotFoundError:
        logging.warning("Config not found, using defaults")

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)

    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # ── Blueprints ─────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(students_bp,   url_prefix="/api/students")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(admin_bp,      url_prefix="/api/admin")
    app.register_blueprint(sensor_bp,     url_prefix="/api/sensor")
    app.register_blueprint(alerts_bp)
    app.register_blueprint(appeals_bp)
    app.register_blueprint(mapping_bp)
    app.register_blueprint(ai_bp)         # ✅ MODULE 12
    app.register_blueprint(offense_bp)

    @app.route("/")
    def home():
        return jsonify({
            "status":  "OK",
            "message": "Smart Smoke Surveillance Backend is running",
            "modules": [
                "Authentication",
                "Students",
                "Attendance",
                "Admin Dashboard",
                "Sensor Integration",
                "Vape Detection",
                "Alerts & Violations",
                "Appeals & Reviews",
                "Location & Incident Mapping",
                "AI Assistant & Notifications",  # ✅ NEW
            ]
        }), 200

    return app


# ============================================================================
# Main
# ============================================================================
if __name__ == "__main__":
    app = create_app()
    logging.info("Flask app created successfully")

    def start_workers():
        with app.app_context():
            try:
                start_sensor_worker()
                logging.info("Sensor worker started")
            except Exception as e:
                logging.error(f"Sensor worker failed: {e}")
            try:
                start_face_rfid_worker()
                logging.info("Face + RFID worker started")
            except Exception as e:
                logging.error(f"Face + RFID worker failed: {e}")

    threading.Thread(target=start_workers, daemon=True).start()

    def run_flask():
        logging.info("Starting Flask server on 0.0.0.0:5000")
        app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

    threading.Thread(target=run_flask, daemon=True, name="FlaskThread").start()
    time.sleep(2)

    print("[APP] ⏳ Waiting for today's first attendance...")
    deadline = time.time() + 300
    while time.time() < deadline:
        if attendance_done_flag():
            print("[APP] ✅ Attendance confirmed — opening camera GUI.")
            break
        time.sleep(3)
    else:
        print("[APP] ⚠️  Attendance timeout — starting camera anyway.")

    try:
        with app.app_context():
            start_vape(show_gui=True)
    except KeyboardInterrupt:
        print("\n[APP] Ctrl-C — shutting down.")
    except Exception as e:
        logging.error(f"[APP] start_vape crashed: {e}")
        print(f"[APP] ⚠️ Vape detection crashed: {e}")
        print("[APP] Flask server will keep running. Camera detection stopped.")

    print("[APP] Keeping Flask server alive (Ctrl-C to stop)...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[APP] Shutting down completely.")

    print("[APP] Done.")