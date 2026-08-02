from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import csv
import os
from models import User

attendance_bp = Blueprint("attendance_bp", __name__, url_prefix="/api/attendance")

# ------------------- HELPER: CSV PATH -------------------
def get_attendance_csv_path():
    """
    Returns the absolute path to attendance.csv
    located in modules/face_rfid/
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))  # modules/students
    csv_path = os.path.join(base_dir, "../face_rfid/attendance.csv")
    return os.path.abspath(csv_path)


# ------------------- STUDENT ATTENDANCE -------------------
@attendance_bp.route("/student", methods=["GET"])
@jwt_required()
def get_student_attendance():
    try:
        # Get logged-in user
        user_identity = get_jwt_identity()
        user = User.query.filter_by(email=user_identity).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Use reg_no from DB or fallback to email prefix
        reg_no = user.reg_no if hasattr(user, "reg_no") and user.reg_no else user.email.split("@")[0]

        # CSV path
        attendance_file = get_attendance_csv_path()
        current_app.logger.info(f"[Attendance] CSV Path (student): {attendance_file}")

        if not os.path.exists(attendance_file):
            current_app.logger.warning(f"[Attendance] CSV not found at path: {attendance_file}")
            return jsonify({"attendance": []}), 200

        records = []
        with open(attendance_file, newline="") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if str(row.get("RegNo", "")).strip() == str(reg_no):
                    records.append(row)

        return jsonify({"attendance": records}), 200

    except Exception as e:
        current_app.logger.exception("Error fetching student attendance")
        return jsonify({"error": str(e)}), 500


# ------------------- ADMIN: ALL ATTENDANCE -------------------
@attendance_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_attendance():
    try:
        user_identity = get_jwt_identity()
        ADMIN_EMAIL = "admin@example.com"  # replace with your actual admin email

        if user_identity != ADMIN_EMAIL:
            return jsonify({"error": "Access denied"}), 403

        attendance_file = get_attendance_csv_path()
        current_app.logger.info(f"[Attendance] CSV Path (admin): {attendance_file}")

        if not os.path.exists(attendance_file):
            current_app.logger.warning(f"[Attendance] CSV not found at path: {attendance_file}")
            return jsonify({"attendance": []}), 200

        with open(attendance_file, newline="") as csvfile:
            reader = csv.DictReader(csvfile)
            data = list(reader)

        return jsonify({"attendance": data}), 200

    except Exception as e:
        current_app.logger.exception("Error fetching all attendance")
        return jsonify({"error": str(e)}), 500
