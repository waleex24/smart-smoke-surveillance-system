# routes_admin.py
from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from models import User, db
import pandas as pd
import os
from datetime import timedelta

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "2212315@szabist-isb.pk")


# -----------------------------
# 1️⃣ Admin Dashboard Summary
# -----------------------------
@admin_bp.route("/summary", methods=["GET"])
@jwt_required()
def admin_summary():
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        current_app.logger.info(f"[Admin Summary] Logged-in identity: {email}")

        total_students = User.query.count()
        current_app.logger.debug(f"[Admin Summary] Total students: {total_students}")

        total_vape_violations = 4  # Placeholder
        total_cameras_online = 9   # Placeholder
        total_fines = 26000        # Placeholder

        return jsonify({
            "totalStudents": total_students,
            "vapeViolations": total_vape_violations,
            "camerasOnline": total_cameras_online,
            "totalFines": total_fines
        }), 200
    except Exception as e:
        current_app.logger.exception(f"[Admin Summary] Error: {e}")
        return jsonify({"error": "Server error fetching summary"}), 500


# -----------------------------
# 2️⃣ Manage Students
# -----------------------------
@admin_bp.route("/students", methods=["GET"])
@jwt_required()
def get_students():
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        current_app.logger.info(f"[Admin Students] Logged-in identity: {email}")

        # Optional: allow only admin
        if email != ADMIN_EMAIL:
            current_app.logger.warning(f"[Admin Students] Forbidden access attempt by {email}")
            return jsonify({"error": "Forbidden"}), 403

        students = User.query.all()
        current_app.logger.debug(f"[Admin Students] Total records fetched: {len(students)}")

        result = []
        for s in students:
            role = "Admin" if s.email == ADMIN_EMAIL else "Student"
            student_data = {
                "id": s.id,
                "full_name": s.full_name,
                "email": s.email,
                "is_verified": s.is_verified,
                "is_2fa_enabled": getattr(s, "is_2fa_enabled", False),
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else None,
                "role": role
            }
            current_app.logger.debug(f"[Admin Students] Student: {student_data}")
            result.append(student_data)

        return jsonify({"students": result}), 200
    except Exception as e:
        current_app.logger.exception(f"[Admin Students] Error: {e}")
        return jsonify({"error": "Server error fetching students"}), 500


# -----------------------------
# 3️⃣ Attendance Records
# -----------------------------
@admin_bp.route("/attendance", methods=["GET"])
@jwt_required()
def get_all_attendance():
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        current_app.logger.info(f"[Admin Attendance] Logged-in identity: {email}")

        csv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),  # modules/students
    "../face_rfid/attendance.csv"                # relative path to CSV
)
        csv_path = os.path.abspath(csv_path)

        current_app.logger.debug(f"[Admin Attendance] Looking for CSV at: {csv_path}")

        if not os.path.exists(csv_path):
            current_app.logger.warning(f"[Admin Attendance] CSV not found at {csv_path}")
            return jsonify({"attendance": []}), 200

        df = pd.read_csv(csv_path, header=None)
        current_app.logger.debug(f"[Admin Attendance] CSV loaded, shape: {df.shape}")

        if df.shape[1] == 4:
            df.columns = ["Name", "RegNo", "Date", "Time"]
        elif df.shape[1] == 3:
            df.columns = ["Name", "Date", "Time"]
            df["RegNo"] = ""
        else:
            current_app.logger.warning(f"[Admin Attendance] Unexpected CSV format")
            return jsonify({"attendance": []}), 200

        df["RegNo"] = df["RegNo"].astype(str).str.strip()
        df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")


        records = df.to_dict(orient="records")
        current_app.logger.info(f"[Admin Attendance] Total records returned: {len(records)}")
        for rec in records[:5]:  # log first 5 records only for brevity
            current_app.logger.debug(f"[Admin Attendance] Record: {rec}")

        return jsonify({"attendance": records}), 200
    except Exception as e:
        current_app.logger.exception(f"[Admin Attendance] Error: {e}")
        return jsonify({"error": "Server error fetching attendance"}), 500
