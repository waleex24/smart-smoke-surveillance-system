from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from modules.ai_assistant.ai_service import (
    chat_with_ai,
    get_chat_history,
    clear_chat_history,
)
from modules.ai_assistant.notification_service import (
    get_notifications,
    mark_as_read,
    mark_all_read,
    create_notification,
)

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


# ============================================================================
# Helper — logged-in student ka reg_no nikalo
# ============================================================================
def _get_reg_no(user_identity):
    """
    JWT identity string ya dict dono handle karta hai.
    Adjust karo apne auth setup ke mutabiq.
    """
    if isinstance(user_identity, dict):
        email = user_identity.get("email", "")
    else:
        email = str(user_identity)
    return email.split("@")[0]


# ============================================================================
# POST /api/ai/chat  — Student chatbot message bheje
# ============================================================================
@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    """
    Body (JSON):
    {
      "message": "What is my fine amount?",
      "session_id": "optional-uuid",          // optional
      "violation_context": {                   // optional — frontend se pass karo
        "violation_count": 2,
        "offense_status": "Escalated",
        "total_fine": 10000
      }
    }
    """
    identity = get_jwt_identity()
    reg_no   = _get_reg_no(identity)

    data    = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Message is required"}), 400

    result = chat_with_ai(
        user_message=message,
        reg_no=reg_no,
        student_email=data.get("student_email"),
        student_name=data.get("student_name"),
        session_id=data.get("session_id"),
        violation_context=data.get("violation_context"),
    )

    return jsonify({
        "success":    True,
        "reply":      result["reply"],
        "session_id": result["session_id"],
    }), 200


# ============================================================================
# GET /api/ai/chat/history  — Chat history fetch karo
# ============================================================================
@ai_bp.route("/chat/history", methods=["GET"])
@jwt_required()
def chat_history():
    """
    Query params:
      session_id — optional, specific session ki history
      limit      — optional, default 50
    """
    identity   = get_jwt_identity()
    reg_no     = _get_reg_no(identity)
    session_id = request.args.get("session_id")
    limit      = int(request.args.get("limit", 50))

    history = get_chat_history(reg_no=reg_no, session_id=session_id, limit=limit)
    return jsonify({"success": True, "history": history}), 200


# ============================================================================
# DELETE /api/ai/chat/history  — Session history clear karo
# ============================================================================
@ai_bp.route("/chat/history", methods=["DELETE"])
@jwt_required()
def delete_chat_history():
    identity   = get_jwt_identity()
    reg_no     = _get_reg_no(identity)
    data       = request.get_json(silent=True) or {}
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    ok = clear_chat_history(reg_no=reg_no, session_id=session_id)
    return jsonify({"success": ok}), 200 if ok else 500


# ============================================================================
# GET /api/ai/notifications  — Student ki notifications
# ============================================================================
@ai_bp.route("/notifications", methods=["GET"])
@jwt_required()
def notifications():
    """
    Query params:
      unread_only — true/false (default false)
      limit       — default 20
    """
    identity    = get_jwt_identity()
    reg_no      = _get_reg_no(identity)
    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit       = int(request.args.get("limit", 20))

    notifs = get_notifications(reg_no=reg_no, unread_only=unread_only, limit=limit)
    unread_count = sum(1 for n in notifs if not n["is_read"])

    return jsonify({
        "success":      True,
        "notifications": notifs,
        "unread_count":  unread_count,
    }), 200


# ============================================================================
# PATCH /api/ai/notifications/<id>/read  — Single notification read mark karo
# ============================================================================
@ai_bp.route("/notifications/<int:notif_id>/read", methods=["PATCH"])
@jwt_required()
def read_notification(notif_id):
    identity = get_jwt_identity()
    reg_no   = _get_reg_no(identity)

    ok = mark_as_read(notif_id=notif_id, reg_no=reg_no)
    if not ok:
        return jsonify({"error": "Notification not found"}), 404
    return jsonify({"success": True}), 200


# ============================================================================
# PATCH /api/ai/notifications/read-all  — Sab notifications read karo
# ============================================================================
@ai_bp.route("/notifications/read-all", methods=["PATCH"])
@jwt_required()
def read_all_notifications():
    identity = get_jwt_identity()
    reg_no   = _get_reg_no(identity)

    count = mark_all_read(reg_no=reg_no)
    return jsonify({"success": True, "marked_read": count}), 200


# ============================================================================
# POST /api/ai/notifications/send  — Admin: manually notification bhejo
# ============================================================================
@ai_bp.route("/notifications/send", methods=["POST"])
@jwt_required()
def send_notification():
    """
    Admin use kare — manually kisi student ko notification bhejo.
    Body:
    {
      "reg_no": "2212315",
      "student_email": "abc@szabist-isb.pk",
      "title": "Important Notice",
      "message": "Please report to admin office.",
      "notification_type": "info",
      "send_email": true
    }
    """
    data = request.get_json(silent=True) or {}

    required = ["reg_no", "title", "message"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required"}), 400

    notif = create_notification(
        title=data["title"],
        message=data["message"],
        notification_type=data.get("notification_type", "info"),
        reg_no=data["reg_no"],
        student_email=data.get("student_email"),
        send_email=data.get("send_email", False),
    )

    return jsonify({"success": True, "notification": notif.to_dict()}), 201