from datetime import datetime
from extensions import db


# ============================================================================
# MODULE 12: AI ASSISTANT & NOTIFICATIONS — DATABASE MODELS
# ============================================================================

class ChatHistory(db.Model):
    """
    Har student ki chatbot conversation history store karta hai.
    Student apne purane questions/answers dekh sakta hai.
    """
    __tablename__ = "chat_history"

    id            = db.Column(db.Integer, primary_key=True)

    # Kis student ka chat hai
    reg_no        = db.Column(db.String(50),  nullable=False, index=True)
    student_email = db.Column(db.String(120), nullable=True)
    student_name  = db.Column(db.String(100), nullable=True)

    # Conversation
    role          = db.Column(db.String(10),  nullable=False)   # "user" ya "assistant"
    message       = db.Column(db.Text,        nullable=False)

    # Session grouping — ek session = ek continuous chat
    session_id    = db.Column(db.String(64),  nullable=True, index=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":            self.id,
            "reg_no":        self.reg_no,
            "student_email": self.student_email,
            "student_name":  self.student_name,
            "role":          self.role,
            "message":       self.message,
            "session_id":    self.session_id,
            "created_at":    self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }


class Notification(db.Model):
    """
    System notifications — violations, appeals updates, admin alerts.
    Student dashboard mein bell icon se dikhenge.
    """
    __tablename__ = "notifications"

    id              = db.Column(db.Integer, primary_key=True)

    # Target
    reg_no          = db.Column(db.String(50),  nullable=True,  index=True)   # None = broadcast
    student_email   = db.Column(db.String(120), nullable=True)

    # Content
    title           = db.Column(db.String(200), nullable=False)
    message         = db.Column(db.Text,        nullable=False)
    notification_type = db.Column(
        db.String(30), default="info"
    )
    # Types: info | warning | critical | appeal_update | violation | system

    # Read status
    is_read         = db.Column(db.Boolean, default=False)
    read_at         = db.Column(db.DateTime, nullable=True)

    # Email bheji ya nahi
    email_sent      = db.Column(db.Boolean, default=False)
    email_sent_at   = db.Column(db.DateTime, nullable=True)

    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":                self.id,
            "reg_no":            self.reg_no,
            "student_email":     self.student_email,
            "title":             self.title,
            "message":           self.message,
            "notification_type": self.notification_type,
            "is_read":           self.is_read,
            "read_at":           self.read_at.strftime("%Y-%m-%d %H:%M:%S") if self.read_at else None,
            "email_sent":        self.email_sent,
            "created_at":        self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }