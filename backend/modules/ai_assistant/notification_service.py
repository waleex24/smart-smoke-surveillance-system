import logging
from datetime import datetime

from extensions import db, mail
from flask_mail import Message
from modules.ai_assistant.models_ai import Notification


# ============================================================================
# Notification Service
# ============================================================================

def create_notification(
    title: str,
    message: str,
    notification_type: str = "info",
    reg_no: str = None,
    student_email: str = None,
    send_email: bool = False,
) -> Notification:
    """
    DB mein notification banao.
    send_email=True karo toh email bhi bhejo.

    notification_type options:
        info | warning | critical | appeal_update | violation | system
    """
    notif = Notification(
        reg_no=reg_no,
        student_email=student_email,
        title=title,
        message=message,
        notification_type=notification_type,
    )
    db.session.add(notif)
    db.session.commit()

    if send_email and student_email:
        _send_notification_email(notif)

    return notif


def _send_notification_email(notif: Notification):
    """Flask-Mail se student ko email bhejo."""
    try:
        msg = Message(
            subject=f"[4S System] {notif.title}",
            recipients=[notif.student_email],
            html=f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;
            border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="background:#1e3a5f;padding:20px;color:#fff;">
    <h2 style="margin:0;">Smart Smoke Surveillance System</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Automated Notification</p>
  </div>
  <div style="padding:24px;">
    <h3 style="color:#1e3a5f;margin-top:0;">{notif.title}</h3>
    <p style="color:#4a5568;line-height:1.6;">{notif.message}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="color:#a0aec0;font-size:12px;">
      This is an automated message from the 4S System.
      Please log in to your dashboard for details.
    </p>
  </div>
</div>
""",
        )
        mail.send(msg)

        notif.email_sent    = True
        notif.email_sent_at = datetime.utcnow()
        db.session.commit()
        logging.info(f"[Notifications] Email sent to {notif.student_email}")

    except Exception as e:
        logging.error(f"[Notifications] Email send failed: {e}")


# ============================================================================
# Violation Alert — jab naya violation detect ho
# ============================================================================
def notify_violation(reg_no: str, student_email: str, student_name: str,
                     violation_date: str, violation_count: int):
    """Violation detect hone par student ko notify karo."""

    if violation_count >= 3:
        ntype  = "critical"
        title  = "🚨 Critical: Repeated Violations Detected"
        msg    = (
            f"Dear {student_name}, this is your {violation_count}rd/th recorded violation "
            f"on {violation_date}. Administration has been notified. "
            "Disciplinary action may follow. Please report to the Dean's office."
        )
    elif violation_count == 2:
        ntype  = "warning"
        title  = "🔶 Escalated: Second Violation Recorded"
        msg    = (
            f"Dear {student_name}, a second violation was recorded on {violation_date}. "
            "Your case is now under review. A further violation will trigger an admin alert. "
            "A fine of Rs. 10,000 is pending."
        )
    else:
        ntype  = "warning"
        title  = "⚠️ Warning: Violation Recorded"
        msg    = (
            f"Dear {student_name}, a smoking/vaping violation was recorded on {violation_date}. "
            "This is your first offense. A fine of Rs. 5,000 has been applied. "
            "Further violations will result in escalated penalties."
        )

    create_notification(
        title=title, message=msg,
        notification_type=ntype,
        reg_no=reg_no, student_email=student_email,
        send_email=True,
    )


# ============================================================================
# Appeal Status Update Notification
# ============================================================================
def notify_appeal_update(reg_no: str, student_email: str, student_name: str,
                          appeal_id: int, new_status: str, admin_comments: str = ""):
    """Appeal ka status change hone par student ko notify karo."""

    status_map = {
        "approved": ("✅ Appeal Approved", "info"),
        "rejected": ("❌ Appeal Rejected", "warning"),
        "under_review": ("🔍 Appeal Under Review", "info"),
    }
    title, ntype = status_map.get(new_status, ("📋 Appeal Update", "info"))

    msg = (
        f"Dear {student_name}, your appeal (ID: {appeal_id}) status has been updated to "
        f"'{new_status.upper()}'."
    )
    if admin_comments:
        msg += f" Admin comments: {admin_comments}"

    create_notification(
        title=title, message=msg,
        notification_type=ntype,
        reg_no=reg_no, student_email=student_email,
        send_email=True,
    )


# ============================================================================
# Get Notifications for a Student
# ============================================================================
def get_notifications(reg_no: str, unread_only: bool = False, limit: int = 20) -> list:
    query = Notification.query.filter_by(reg_no=reg_no)
    if unread_only:
        query = query.filter_by(is_read=False)
    rows = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [r.to_dict() for r in rows]


def mark_as_read(notif_id: int, reg_no: str) -> bool:
    """Notification ko read mark karo."""
    notif = Notification.query.filter_by(id=notif_id, reg_no=reg_no).first()
    if not notif:
        return False
    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.session.commit()
    return True


def mark_all_read(reg_no: str) -> int:
    """Student ki sari unread notifications read mark karo."""
    updated = (
        Notification.query
        .filter_by(reg_no=reg_no, is_read=False)
        .update({"is_read": True, "read_at": datetime.utcnow()})
    )
    db.session.commit()
    return updated