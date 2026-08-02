from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import pandas as pd
import os
from models import User

# -----------------------------
# Blueprint Setup
# -----------------------------
students_bp = Blueprint("students_bp", __name__, url_prefix="/api/students")

# -----------------------------
# 1️⃣ Get Student Attendance (RegNo only)
# -----------------------------
@students_bp.route("/attendance", methods=["GET"])
@jwt_required()
def get_student_attendance():
    """
    Fetch attendance records for the logged-in student.
    Uses RegNo from database if present, otherwise derives from email.
    Matches only by RegNo. Full name fallback removed.
    Logs every step.
    """
    try:
        # -----------------------------
        # Get logged-in user info
        # -----------------------------
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        current_app.logger.info(f"[Attendance] Logged-in identity: {identity}")

        if not email:
            current_app.logger.warning("[Attendance] No email found in identity")
            return jsonify({"attendance": []}), 200

        user = User.query.filter_by(email=email).first()
        if not user:
            current_app.logger.warning(f"[Attendance] No user found for email: {email}")
            return jsonify({"attendance": []}), 200

        # -----------------------------
        # Determine RegNo
        # -----------------------------
        reg_no = getattr(user, "reg_no", "")
        if not reg_no:
            reg_no = email.split("@")[0].strip()
            current_app.logger.info(f"[Attendance] RegNo derived from email: {reg_no}")
        else:
            reg_no = str(reg_no).strip()
            current_app.logger.info(f"[Attendance] RegNo from DB: {reg_no}")

        # -----------------------------
        # CSV path
        # -----------------------------
        csv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),  # this file's folder: modules/students
    "../face_rfid/attendance.csv"                # relative path to modules/face_rfid
)
        csv_path = os.path.abspath(csv_path)

        current_app.logger.info(f"[Attendance] CSV Path: {csv_path}")

        if not os.path.exists(csv_path):
            current_app.logger.warning(f"[Attendance] CSV not found at path: {csv_path}")
            return jsonify({"attendance": []}), 200

        # -----------------------------
        # Read CSV
        # -----------------------------
        try:
            df = pd.read_csv(csv_path, header=None)
            current_app.logger.info(f"[Attendance] CSV loaded successfully. Shape: {df.shape}")
        except Exception as csv_err:
            current_app.logger.exception(f"[Attendance] CSV read error: {csv_err}")
            return jsonify({"attendance": []}), 200

        # -----------------------------
        # Assign columns
        # -----------------------------
        if df.shape[1] == 4:
            df.columns = ["Name", "RegNo", "Date", "Time"]
        elif df.shape[1] == 3:
            df.columns = ["Name", "Date", "Time"]
            df["RegNo"] = ""
        else:
            current_app.logger.warning(f"[Attendance] Unexpected CSV shape: {df.shape}")
            return jsonify({"attendance": []}), 200

        # -----------------------------
        # Normalize RegNo
        # -----------------------------
        df["RegNo"] = df["RegNo"].astype(str).str.strip()

        # -----------------------------
        # Filter attendance by RegNo only
        # -----------------------------
        records = df[df["RegNo"] == reg_no]
        current_app.logger.info(f"[Attendance] Records found by RegNo '{reg_no}': {len(records)}")

        if records.empty:
            current_app.logger.warning(f"[Attendance] No attendance records found for RegNo '{reg_no}'")

        # -----------------------------
        # Return JSON
        # -----------------------------
        return jsonify({"attendance": records.to_dict(orient="records")}), 200

    except Exception as e:
        current_app.logger.exception(f"[Attendance] Server error fetching attendance: {e}")
        return jsonify({"error": "Server error fetching attendance"}), 500


# -----------------------------
# 2️⃣ Get Student Profile
# -----------------------------
@students_bp.route("/profile", methods=["GET", "OPTIONS"])
def get_student_profile():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight OK"}), 200
    return protected_get_student_profile()


@jwt_required()
def protected_get_student_profile():
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        current_app.logger.info(f"[Profile] Logged-in identity: {identity}")

        if not email:
            current_app.logger.warning("[Profile] No email in identity")
            return jsonify({"error": "Invalid user identity"}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            current_app.logger.warning(f"[Profile] User not found for email: {email}")
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "is_verified": user.is_verified,
            "reg_no": getattr(user, "reg_no", None)
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Profile] Server error fetching profile: {e}")
        return jsonify({"error": "Server error fetching profile"}), 500

@students_bp.route("/attendance_rate", methods=["GET"])
@jwt_required()
def get_attendance_rate():
    try:
        # --- Get logged-in user RegNo ---
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"attendance_rate": 0}), 200

        reg_no = getattr(user, "reg_no", "")
        if not reg_no:
            reg_no = email.split("@")[0].strip()

        # --- Load CSV ---
        csv_path = os.path.join(
            current_app.root_path,
            "Face_detection_with_attendance",
            "face_attendance_project",
            "attendance.csv"
        )
        if not os.path.exists(csv_path):
            return jsonify({"attendance_rate": 0}), 200

        df = pd.read_csv(csv_path, header=None)
        if df.shape[1] == 4:
            df.columns = ["Name", "RegNo", "Date", "Time"]
        elif df.shape[1] == 3:
            df.columns = ["Name", "Date", "Time"]
            df["RegNo"] = ""
        else:
            return jsonify({"attendance_rate": 0}), 200

        df["RegNo"] = df["RegNo"].astype(str).str.strip()
        df["Date"] = pd.to_datetime(df["Date"]).dt.date

        # --- Total sessions (all unique dates) ---
        total_sessions = df["Date"].nunique()

        # --- Student attended sessions (unique dates) ---
        student_sessions = df[df["RegNo"] == reg_no]["Date"].nunique()

        # --- Attendance rate ---
        attendance_rate = (student_sessions / total_sessions * 100) if total_sessions > 0 else 0

        return jsonify({
            "reg_no": reg_no,
            "attendance_rate": round(attendance_rate, 2),
            "total_sessions": total_sessions,
            "attended_sessions": student_sessions
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[AttendanceRate] Error calculating attendance rate: {e}")
        return jsonify({"attendance_rate": 0}), 500
