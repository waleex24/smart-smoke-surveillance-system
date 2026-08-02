# 📁 modules/sensor/sensor_routes.py
from flask import Blueprint, jsonify, current_app, request
import threading
import csv
import os
import modules.sensor.readarduino as readarduino
from modules.sensor.readarduino import get_sensor_value

# ------------------- BLUEPRINT -------------------
sensor_bp = Blueprint("sensor_bp", __name__, url_prefix="/api/sensor")

# ------------------- SENSOR VALUE ROUTE -------------------
@sensor_bp.route("/value", methods=["GET"])
def sensor_value_route():
    """
    Returns the latest sensor value as JSON.
    """
    try:
        value = get_sensor_value()
        return jsonify({"value": value}), 200
    except Exception as e:
        current_app.logger.exception(f"[Sensor] Error getting sensor value: {e}")
        return jsonify({"value": None, "error": str(e)}), 500

# ------------------- MQ135 DATA ROUTE -------------------
@sensor_bp.route("/mq135", methods=["POST"])
def mq135_data():
    """
    Accepts MQ135 value via POST JSON and logs it (if needed).
    """
    data = request.get_json()

    if not data or "value" not in data:
        return jsonify({"error": "MQ135 value missing"}), 400

    try:
        mq135_value = int(data["value"])
        # Optional: add logging to CSV or process further here
        return jsonify({"value": mq135_value}), 200
    except ValueError:
        return jsonify({"error": "Invalid MQ135 value"}), 400

# ------------------- CSV PATH -------------------
def get_sensor_csv_path():
    """
    Returns absolute path to sensor_log.csv located in modules/sensor/
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "sensor_log.csv")
    return os.path.abspath(csv_path)

# ------------------- GET ALL SENSOR RECORDS -------------------
@sensor_bp.route("/all", methods=["GET"])
def get_all_sensor_records():
    """
    Fetch all sensor records from CSV and return as JSON.
    Columns: Date, Time, Location, Type, Status
    """
    try:
        sensor_file = get_sensor_csv_path()
        current_app.logger.info(f"[Sensor] CSV Path: {sensor_file}")
        current_app.logger.info(f"[Sensor] File exists: {os.path.exists(sensor_file)}")

        if not os.path.exists(sensor_file):
            current_app.logger.warning(f"[Sensor] CSV not found at path: {sensor_file}")
            return jsonify({"sensor_log": []}), 200

        records = []
        with open(sensor_file, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                records.append({
                    "Date": row.get("Date", ""),
                    "Time": row.get("Time", ""),
                    "Location": row.get("Location", ""),
                    "Type": row.get("Type", ""),
                    "Status": row.get("Status", "")
                })

        current_app.logger.info(f"[Sensor] Records fetched: {len(records)}")
        return jsonify({"sensor_log": records}), 200

    except Exception as e:
        current_app.logger.exception(f"[Sensor] Error fetching sensor records: {e}")
        return jsonify({"sensor_log": []}), 500

# ------------------- START SENSOR WORKER -------------------
def start_sensor_worker():
    """
    Start the sensor reading loop in a background thread.
    Safe to call multiple times; will not block app startup.
    """
    thread = threading.Thread(target=readarduino.start_sensor_worker, daemon=True)
    thread.start()
    print("[INFO] Sensor worker started in background thread.")
