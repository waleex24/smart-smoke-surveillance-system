from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db  # initialized in app.py

class User(db.Model):
    __tablename__ = "users"

    # Primary Fields
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Security & 2FA
    totp_secret = db.Column(db.String(64), nullable=True)
    is_2fa_enabled = db.Column(db.Boolean, default=False)
    last_2fa_dismissed_at = db.Column(db.DateTime, nullable=True)

    # Social Login
    social_provider = db.Column(db.String(50), nullable=True)

    # Email Verification
    is_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(512), nullable=True)

    # Password Reset
    last_reset_token = db.Column(db.String(512), nullable=True)

    # Password Methods
    def set_password(self, password: str):
        """Hash and store the password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Check password against the stored hash."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)


# ============================================================================
# ✅ MODULE 10: APPEALS & REVIEWS MODEL
# ============================================================================
class Appeal(db.Model):
    """Appeal model - student appeals against violations"""
    __tablename__ = "appeals"

    id = db.Column(db.Integer, primary_key=True)
    
    # Student info
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    student_email = db.Column(db.String(120), nullable=False)
    student_name = db.Column(db.String(100), nullable=False)
    reg_no = db.Column(db.String(50), nullable=False)
    
    # Violation being appealed
    violation_id = db.Column(db.String(100), nullable=True)
    violation_date = db.Column(db.Date, nullable=False)
    violation_type = db.Column(db.String(50), default="vape")
    fine_amount = db.Column(db.Integer, default=0)
    
    # Appeal details
    appeal_reason = db.Column(db.Text, nullable=False)
    evidence_url = db.Column(db.String(500), nullable=True)
    
    # Status
    status = db.Column(db.String(20), default="pending", nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Admin review
    reviewed_by_admin = db.Column(db.String(120), nullable=True)
    admin_comments = db.Column(db.Text, nullable=True)
    review_date = db.Column(db.DateTime, nullable=True)
    decision = db.Column(db.String(50), nullable=True)
    
    # Relationship
    student = db.relationship('User', backref='appeals', foreign_keys=[student_id])

    def to_dict(self):
        return {
            "id": self.id,
            "student_email": self.student_email,
            "student_name": self.student_name,
            "reg_no": self.reg_no,
            "violation_id": self.violation_id,
            "violation_date": self.violation_date.strftime("%Y-%m-%d") if self.violation_date else None,
            "violation_type": self.violation_type,
            "fine_amount": self.fine_amount,
            "appeal_reason": self.appeal_reason,
            "evidence_url": self.evidence_url,
            "status": self.status,
            "submitted_at": self.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if self.submitted_at else None,
            "reviewed_by_admin": self.reviewed_by_admin,
            "admin_comments": self.admin_comments,
            "review_date": self.review_date.strftime("%Y-%m-%d %H:%M:%S") if self.review_date else None,
            "decision": self.decision
        }


# ============================================================================
# ✅ MODULE 11: LOCATION & INCIDENT MAPPING MODELS
# ============================================================================

class Zone(db.Model):
    """Alert zones - define areas to monitor (Library, Lab, etc.)"""
    __tablename__ = "zones"

    id = db.Column(db.Integer, primary_key=True)
    
    # Zone info
    zone_name = db.Column(db.String(100), nullable=False, unique=True)  # e.g., "Library", "Lab A"
    description = db.Column(db.Text, nullable=True)
    
    # Location (center point)
    latitude = db.Column(db.Float, nullable=False)   # e.g., 33.7298
    longitude = db.Column(db.Float, nullable=False)  # e.g., 74.3382
    
    # Zone radius in meters
    radius = db.Column(db.Float, default=50)  # 50 meters default
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "zone_name": self.zone_name,
            "description": self.description,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "radius": self.radius,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        }


class Incident(db.Model):
    """Incidents - violations with location data for mapping"""
    __tablename__ = "incidents"

    id = db.Column(db.Integer, primary_key=True)
    
    # Violation info
    reg_no = db.Column(db.String(50), nullable=False)  # Student reg number
    student_name = db.Column(db.String(100), nullable=True)
    violation_type = db.Column(db.String(50), nullable=False)  # vape, cigarette, smoke
    
    # Location
    latitude = db.Column(db.Float, nullable=False)   # GPS/Map coordinates
    longitude = db.Column(db.Float, nullable=False)
    zone_id = db.Column(db.Integer, db.ForeignKey('zones.id'), nullable=True)
    zone = db.relationship('Zone', backref='incidents')
    
    # Timestamps
    incident_date = db.Column(db.Date, nullable=False)
    incident_time = db.Column(db.String(8), nullable=False)  # HH:MM:SS
    incident_datetime = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Violation details
    vape_detected = db.Column(db.Boolean, default=False)
    smoke_cam_detected = db.Column(db.Boolean, default=False)
    smoke_sensor_value = db.Column(db.Integer, default=0)  # MQ135 value
    confidence = db.Column(db.Float, nullable=True)  # Vape detection confidence
    
    # Source (which camera)
    camera_id = db.Column(db.String(50), nullable=True)  # "camera_1", "camera_2", "mac_camera"
    
    # Status
    is_verified = db.Column(db.Boolean, default=False)  # Admin verified?
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "reg_no": self.reg_no,
            "student_name": self.student_name,
            "violation_type": self.violation_type,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "zone_id": self.zone_id,
            "zone_name": self.zone.zone_name if self.zone else None,
            "incident_date": self.incident_date.strftime("%Y-%m-%d"),
            "incident_time": self.incident_time,
            "incident_datetime": self.incident_datetime.strftime("%Y-%m-%d %H:%M:%S"),
            "vape_detected": self.vape_detected,
            "smoke_cam_detected": self.smoke_cam_detected,
            "smoke_sensor_value": self.smoke_sensor_value,
            "confidence": self.confidence,
            "camera_id": self.camera_id,
            "is_verified": self.is_verified,
            "notes": self.notes
        }