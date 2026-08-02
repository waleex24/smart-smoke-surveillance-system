from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from extensions import db
from models import User, Appeal
import os

appeals_bp = Blueprint("appeals_bp", __name__, url_prefix="/api/appeals")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "2212315@szabist-isb.pk")

# ========================================================================
# 1️⃣ STUDENT: Submit Appeal
# ========================================================================
@appeals_bp.route("/submit", methods=["POST"])
@jwt_required()
def submit_appeal():
    """Student appeal submission"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        
        current_app.logger.info(f"[Appeal] Submit from: {email}")

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}
        violation_id = data.get("violation_id", "").strip()
        violation_date_str = data.get("violation_date", "").strip()
        violation_type = data.get("violation_type", "vape").lower()
        fine_amount = data.get("fine_amount", 0)
        appeal_reason = data.get("appeal_reason", "").strip()
        evidence_url = data.get("evidence_url", "").strip()

        # Validation
        if not appeal_reason or len(appeal_reason) < 20:
            return jsonify({"error": "Appeal reason must be at least 20 characters"}), 400

        try:
            violation_date = datetime.strptime(violation_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid violation_date format (use YYYY-MM-DD)"}), 400

        # Check duplicate
        existing_appeal = Appeal.query.filter_by(
            student_id=user.id,
            violation_id=violation_id,
            violation_date=violation_date
        ).first()

        if existing_appeal:
            return jsonify({"error": "Appeal already submitted for this violation"}), 409

        # Create appeal
        appeal = Appeal(
            student_id=user.id,
            student_email=email,
            student_name=user.full_name,
            reg_no=getattr(user, "reg_no", email.split("@")[0]),
            violation_id=violation_id,
            violation_date=violation_date,
            violation_type=violation_type,
            fine_amount=fine_amount,
            appeal_reason=appeal_reason,
            evidence_url=evidence_url,
            status="pending",
            submitted_at=datetime.utcnow()
        )

        db.session.add(appeal)
        db.session.commit()

        current_app.logger.info(f"[Appeal] New appeal: ID={appeal.id}, Student={email}")

        return jsonify({
            "message": "Appeal submitted successfully",
            "appeal_id": appeal.id,
            "status": appeal.status
        }), 201

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Submit error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error submitting appeal"}), 500


# ========================================================================
# 2️⃣ STUDENT: View My Appeals
# ========================================================================
@appeals_bp.route("/my-appeals", methods=["GET"])
@jwt_required()
def get_my_appeals():
    """Student views own appeals"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        status_filter = request.args.get("status", "").strip().lower()

        query = Appeal.query.filter_by(student_id=user.id)
        
        if status_filter and status_filter in ["pending", "approved", "rejected", "under_review"]:
            query = query.filter_by(status=status_filter)

        appeals = query.order_by(Appeal.submitted_at.desc()).all()

        return jsonify({
            "count": len(appeals),
            "appeals": [appeal.to_dict() for appeal in appeals]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Get my appeals error: {e}")
        return jsonify({"error": "Server error fetching appeals"}), 500


# ========================================================================
# 3️⃣ STUDENT: Track Appeal Status (Live)
# ========================================================================
@appeals_bp.route("/status/<int:appeal_id>", methods=["GET"])
@jwt_required()
def get_appeal_status(appeal_id):
    """Get real-time status of appeal"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        appeal = Appeal.query.filter_by(id=appeal_id, student_id=user.id).first()
        if not appeal:
            return jsonify({"error": "Appeal not found"}), 404

        return jsonify({
            "appeal_id": appeal.id,
            "status": appeal.status,
            "submitted_at": appeal.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
            "review_date": appeal.review_date.strftime("%Y-%m-%d %H:%M:%S") if appeal.review_date else None,
            "decision": appeal.decision,
            "admin_comments": appeal.admin_comments,
            "appeal": appeal.to_dict()
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Get status error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 4️⃣ ADMIN: View Pending Appeals
# ========================================================================
@appeals_bp.route("/admin/pending", methods=["GET"])
@jwt_required()
def get_pending_appeals():
    """Admin views pending appeals"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            current_app.logger.warning(f"[Appeal] Unauthorized: {email}")
            return jsonify({"error": "Forbidden"}), 403

        pending_appeals = Appeal.query.filter_by(status="pending").order_by(
            Appeal.submitted_at.asc()
        ).all()

        return jsonify({
            "count": len(pending_appeals),
            "appeals": [appeal.to_dict() for appeal in pending_appeals]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Get pending error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 5️⃣ ADMIN: Review Appeal (Approve/Reject)
# ========================================================================
@appeals_bp.route("/admin/review/<int:appeal_id>", methods=["POST"])
@jwt_required()
def review_appeal(appeal_id):
    """Admin reviews appeal"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        appeal = Appeal.query.filter_by(id=appeal_id).first()
        if not appeal:
            return jsonify({"error": "Appeal not found"}), 404

        data = request.get_json() or {}
        decision = data.get("decision", "").strip().lower()
        admin_comments = data.get("admin_comments", "").strip()
        status = data.get("status", "").strip().lower()

        if decision not in ["approved", "rejected"]:
            return jsonify({"error": "Invalid decision"}), 400

        if not admin_comments or len(admin_comments) < 10:
            return jsonify({"error": "Admin comments required (min 10 chars)"}), 400

        appeal.status = status if status in ["approved", "rejected"] else decision
        appeal.decision = decision
        appeal.admin_comments = admin_comments
        appeal.reviewed_by_admin = email
        appeal.review_date = datetime.utcnow()

        db.session.commit()

        current_app.logger.info(f"[Appeal] Reviewed: ID={appeal_id}, Decision={decision}")

        return jsonify({
            "message": f"Appeal {decision}",
            "appeal_id": appeal.id,
            "status": appeal.status,
            "decision": appeal.decision
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Review error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 6️⃣ ADMIN: View All Appeals
# ========================================================================
@appeals_bp.route("/admin/all", methods=["GET"])
@jwt_required()
def get_all_appeals():
    """Admin views all appeals with filters"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        status_filter = request.args.get("status", "").strip().lower()
        email_filter = request.args.get("student_email", "").strip().lower()

        query = Appeal.query

        if status_filter and status_filter in ["pending", "approved", "rejected", "under_review"]:
            query = query.filter_by(status=status_filter)

        if email_filter:
            query = query.filter(Appeal.student_email.ilike(f"%{email_filter}%"))

        appeals = query.order_by(Appeal.submitted_at.desc()).all()

        return jsonify({
            "count": len(appeals),
            "appeals": [appeal.to_dict() for appeal in appeals]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Get all error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 7️⃣ VIEW RESOLVED APPEALS (Student/Admin)
# ========================================================================
@appeals_bp.route("/records/resolved", methods=["GET"])
@jwt_required()
def get_resolved_appeals():
    """View resolved appeals"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity
        claims = get_jwt()
        role = claims.get("role", "student")

        decision_filter = request.args.get("decision", "").strip().lower()

        query = Appeal.query.filter(
            Appeal.status.in_(["approved", "rejected"])
        )

        # Students see only their own
        if role == "student":
            user = User.query.filter_by(email=email).first()
            if not user:
                return jsonify({"error": "User not found"}), 404
            query = query.filter_by(student_id=user.id)

        if decision_filter in ["approved", "rejected"]:
            query = query.filter_by(decision=decision_filter)

        resolved = query.order_by(Appeal.review_date.desc()).all()

        return jsonify({
            "count": len(resolved),
            "records": [appeal.to_dict() for appeal in resolved]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Get resolved error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 8️⃣ ADMIN: Statistics
# ========================================================================
@appeals_bp.route("/admin/stats", methods=["GET"])
@jwt_required()
def get_appeal_statistics():
    """Admin views statistics"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        total = Appeal.query.count()
        pending = Appeal.query.filter_by(status="pending").count()
        approved = Appeal.query.filter_by(decision="approved").count()
        rejected = Appeal.query.filter_by(decision="rejected").count()

        return jsonify({
            "total_appeals": total,
            "pending_appeals": pending,
            "approved_appeals": approved,
            "rejected_appeals": rejected,
            "approval_rate": round((approved / total * 100), 2) if total > 0 else 0
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Appeal] Stats error: {e}")
        return jsonify({"error": "Server error"}), 500