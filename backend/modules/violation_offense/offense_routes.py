# 📁 modules/violation_offense/offense_routes.py
from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required
from flask_mail import Message
import os
import csv

from extensions import mail
from models import User

offense_bp = Blueprint("offense_bp", __name__, url_prefix="/api/alerts")

# alerts.csv asal mein modules/vape/ ke andar hai — yahan se relative path
BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ALERTS_CSV = os.path.join(BASE_DIR, "vape", "alerts.csv")

ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL", "2212315@szabist-isb.pk")
FINE_PER_ALERT = 5000


# ---------------- Fresh offense count from CSV ----------------
def get_offense_info(reg_no):
    """CSV se is student ke unique offense-dates count karta hai
       aur total incidents bhi return karta hai."""
    dates = set()
    total_incidents = 0

    if not os.path.exists(ALERTS_CSV):
        return 0, 0

    try:
        with open(ALERTS_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                row_reg = (
                    row.get("RegNo") or row.get("REG_NO") or row.get("reg_no") or ""
                ).strip()
                if row_reg == str(reg_no).strip():
                    total_incidents += 1
                    date_val = row.get("Date")
                    if date_val:
                        dates.add(date_val)
    except Exception as e:
        current_app.logger.warning(f"Failed reading alerts.csv for offense count: {e}")

    return len(dates), total_incidents


# ---------------- Core: build + send notification ----------------
def send_offense_notification(reg_no):
    """
    Violation CSV mein log hote hi ye call hota hai.
    1st offense  -> sirf student
    2nd offense  -> student + admin
    3rd+ offense -> student + admin (critical)
    """
    if not reg_no or reg_no.upper() == "UNKNOWN":
        return {"success": False, "error": "UNKNOWN reg_no — email skipped."}

    offense_num, total_incidents = get_offense_info(reg_no)
    if offense_num == 0:
        return {"success": False, "error": "No offense record found."}

    total_fine    = total_incidents * FINE_PER_ALERT
    student_email = f"{reg_no}@szabist-isb.pk"

    try:
        student      = User.query.filter_by(email=student_email).first()
        student_name = student.full_name if student else reg_no
    except Exception:
        student_name = reg_no

    notify_admin = offense_num >= 2

    if offense_num >= 3:
        level   = "CRITICAL"
        subject = f"🚨 Critical Disciplinary Notice — {reg_no}"
        student_msg = (
            f"Dear {student_name},\n\n"
            f"You have now recorded {offense_num} offense days for smoking/vaping violations "
            f"on campus, with a total of {total_incidents} incident(s).\n\n"
            f"Total Fine Accrued: Rs. {total_fine:,}\n\n"
            f"Administration has been notified. Your case has been escalated to the "
            f"Disciplinary Committee. You may be required to appear for a formal hearing.\n\n"
            f"Regards,\nSmart Smoke Surveillance System\nSZABIST"
        )
        admin_msg = (
            f"CRITICAL ALERT — Repeat Offender\n\n"
            f"Student RegNo: {reg_no}\nOffense Days: {offense_num}\n"
            f"Total Incidents: {total_incidents}\nTotal Fine: Rs. {total_fine:,}\n\n"
            f"This student has crossed the disciplinary threshold (3+ offense days)."
        )
    elif offense_num == 2:
        level   = "ESCALATED"
        subject = f"🔶 Escalation Notice — {reg_no}"
        student_msg = (
            f"Dear {student_name},\n\n"
            f"This is your 2nd recorded offense day for smoking/vaping violations on campus, "
            f"with {total_incidents} incident(s) recorded so far.\n\n"
            f"Total Fine Accrued: Rs. {total_fine:,}\n\n"
            f"Your case has been escalated and flagged for review. Further violations will "
            f"result in formal disciplinary proceedings.\n\n"
            f"Regards,\nSmart Smoke Surveillance System\nSZABIST"
        )
        admin_msg = (
            f"ESCALATION NOTICE\n\n"
            f"Student RegNo: {reg_no}\nOffense Days: {offense_num}\n"
            f"Total Incidents: {total_incidents}\nTotal Fine: Rs. {total_fine:,}\n\n"
            f"Student has reached 2nd offense day — flagged for review."
        )
    else:
        level   = "WARNING"
        subject = f"⚠️ Written Warning — {reg_no}"
        student_msg = (
            f"Dear {student_name},\n\n"
            f"This is your first recorded offense for smoking/vaping violations on campus.\n\n"
            f"Total Fine: Rs. {total_fine:,}\n\n"
            f"This serves as a written warning. Further violations will lead to escalated "
            f"disciplinary action and administration notification.\n\n"
            f"Regards,\nSmart Smoke Surveillance System\nSZABIST"
        )
        admin_msg = None  # 1st offense par admin ko email nahi jati

    sent_to = []

    # ── Student ko hamesha bhejo ──────────────────────────────
    try:
        mail.send(Message(
            subject=subject,
            sender=current_app.config.get("MAIL_USERNAME"),
            recipients=[student_email],
            body=student_msg,
        ))
        sent_to.append(student_email)
    except Exception as e:
        current_app.logger.warning(f"[OFFENSE EMAIL] Student send failed: {e}")

    # ── Admin ko sirf 2nd/3rd+ par bhejo ──────────────────────
    if notify_admin and admin_msg:
        try:
            mail.send(Message(
                subject=f"[{level}] {subject}",
                sender=current_app.config.get("MAIL_USERNAME"),
                recipients=[ADMIN_EMAIL],
                body=admin_msg,
            ))
            sent_to.append(ADMIN_EMAIL)
        except Exception as e:
            current_app.logger.warning(f"[OFFENSE EMAIL] Admin send failed: {e}")

    result = {
        "success": bool(sent_to),
        "level": level,
        "offense_num": offense_num,
        "total_incidents": total_incidents,
        "total_fine": total_fine,
        "sent_to": sent_to,
    }
    print(f"[OFFENSE EMAIL] {reg_no} → level={level} offense#{offense_num} sent_to={sent_to}")
    return result


# ---------------- Manual resend (frontend button) ----------------
@offense_bp.route("/send-offense-email", methods=["POST", "OPTIONS"])
@jwt_required()
def send_offense_email():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data   = request.get_json() or {}
        reg_no = str(data.get("reg_no") or "").strip()

        if not reg_no:
            return jsonify({"success": False, "error": "reg_no is required"}), 400

        result = send_offense_notification(reg_no)
        status_code = 200 if result["success"] else 500
        return jsonify(result), status_code

    except Exception as e:
        current_app.logger.exception("send_offense_email error")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500