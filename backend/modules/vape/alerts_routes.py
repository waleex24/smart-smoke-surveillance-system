# 📁 modules/vape/alerts_routes.py
from flask import Blueprint, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt
import os
import csv
from datetime import datetime

alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

ALERTS_CSV = os.path.join(os.path.dirname(__file__), "alerts.csv")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "alert_images")

CSV_HEADERS = ["RegNo", "Date", "Time", "Vape/Cig", "Smoke(CAM)", "Smoke(MQ135)", "Image"]


def ensure_csv():
    if not os.path.exists(ALERTS_CSV):
        with open(ALERTS_CSV, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(CSV_HEADERS)

ensure_csv()
os.makedirs(IMAGES_DIR, exist_ok=True)


def add_alert(reg_no, vape=False, smoke_cam=False, smoke_mq135=0, image_filename=""):
    now = datetime.now()
    with open(ALERTS_CSV, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([
            reg_no,
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            "YES" if vape else "NO",
            "YES" if smoke_cam else "NO",
            smoke_mq135,
            image_filename
        ])


# ---------------- GET Alerts (Admin / Student) ----------------
@alerts_bp.route("", methods=["GET"])
@jwt_required()
def get_alerts():
    claims = get_jwt()
    role = claims.get("role")
    user_email = claims.get("email")

    alerts = []

    try:
        with open(ALERTS_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                if role == "student":
                    if row["RegNo"] != user_email:
                        continue

                # Image field purani entries mein na ho to empty rakh do
                row["Image"] = row.get("Image", "") or ""
                alerts.append(row)

        return jsonify({
            "count": len(alerts),
            "alerts": alerts
        }), 200

    except Exception as e:
        current_app.logger.exception("Failed to read alerts CSV")
        return jsonify({"error": "Failed to load alerts"}), 500


# ---------------- GET Single Alert Image (proof) ----------------
@alerts_bp.route("/image/<filename>", methods=["GET"])
@jwt_required()
def get_alert_image(filename):
    # Path traversal se bachao
    safe_filename = os.path.basename(filename)
    if not os.path.isfile(os.path.join(IMAGES_DIR, safe_filename)):
        return jsonify({"error": "Image not found"}), 404
    return send_from_directory(IMAGES_DIR, safe_filename)