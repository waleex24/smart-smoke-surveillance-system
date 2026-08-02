from flask import Flask, Blueprint, request, jsonify, current_app, redirect
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message
from werkzeug.security import generate_password_hash, check_password_hash
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from datetime import datetime, timedelta
from models import User, db
from extensions import mail
import jwt, re, pyotp, qrcode, io, base64, os
import csv


app = Flask(__name__)



admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/admin")

@admin_bp.route("/summary", methods=["GET"])
def get_summary():
    return jsonify({
        "totalStudents": 128,
        "vapeViolations": 4,
        "camerasOnline": 9,
        "totalFines": 26000
    }), 200


@admin_bp.route("/students", methods=["GET"])
@jwt_required(optional=True)
def get_students():
    try:
        # ✅ Fetch ALL users including admin
        students = User.query.all()

        result = []
        for s in students:
            # Determine user role based on email
            role = "Admin" if s.email == ADMIN_EMAIL else "Student"

            result.append({
                "id": s.id,
                "full_name": s.full_name,
                "email": s.email,
                "is_verified": s.is_verified,
                "is_2fa_enabled": getattr(s, "is_2fa_enabled", False),
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else None,
                "role": role
            })

        return jsonify({"students": result}), 200

    except Exception as e:
        current_app.logger.exception("Error fetching students")
        return jsonify({"error": f"Failed to fetch students: {str(e)}"}), 500



# -------------------------------------------------------------------
# Flask App Initialization
# -------------------------------------------------------------------
app = Flask(__name__)

# JWT Config
app.config["JWT_SECRET_KEY"] = os.getenv("APP_JWT_SECRET", "your_very_secret_key_here")
app.config["JWT_ALGORITHM"] = os.getenv("APP_JWT_ALGORITHM", "HS256")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=int(os.getenv("JWT_EXPIRES_HOURS", "6")))

jwt_manager = JWTManager(app)
# CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)


CORS(
    app,
    resources={r"/*": {"origins": "*"}},  # ✅ Allow all routes and all origins
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)



# -------------------------------------------------------------------
# Blueprints
# -------------------------------------------------------------------
auth_bp = Blueprint("auth_bp", __name__, url_prefix="/api/auth")
students_bp = Blueprint("students_bp", __name__, url_prefix="/api/students")

@auth_bp.route("/google-signup", methods=["POST"])
def google_signup():
    try:
        data = request.get_json() or {}
        token = data.get("token")
        full_name = data.get("full_name", "").strip()
        email = (data.get("email") or "").strip().lower()

        if not token or not email or not full_name:
            return jsonify({"error": "Missing required fields"}), 400

        # ✅ Verify Google token
        idinfo = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), CLIENT_ID
        )
        google_email = idinfo.get("email", "").lower()

        if google_email != email:
            return jsonify({"error": "Email mismatch"}), 400

        # ✅ Allow only SZABIST emails
        if not (google_email.endswith("@szabist-isb.pk") or google_email.endswith("@szabist.edu.pk")):
            return jsonify({"error": "Only SZABIST emails allowed"}), 403

        # ✅ If already registered
        existing_user = User.query.filter_by(email=google_email).first()
        if existing_user:
            return jsonify({"error": "User already registered"}), 409

        # ✅ Create new user
        new_user = User(
            full_name=full_name,
            email=google_email,
            is_verified=True,
            social_provider="google",
        )
        db.session.add(new_user)
        db.session.commit()

        access_token = create_access_token(identity=new_user.email)
        return jsonify({
            "message": "Google signup successful!",
            "access_token": access_token,
            "user_email": google_email,
        }), 201

    except ValueError:
        return jsonify({"error": "Invalid Google token"}), 400
    except Exception as e:
        current_app.logger.exception("Google signup error")
        return jsonify({"error": "Server error during Google signup"}), 500


# -------------------------------------------------------------------
# 🔐 Admin Login
# -------------------------------------------------------------------
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "2212315@szabist-isb.pk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        # Validate admin credentials
        if email != ADMIN_EMAIL or password != ADMIN_PASSWORD:
            return jsonify({"error": "Invalid admin credentials"}), 401

        # Find or create admin user
        admin_user = User.query.filter_by(email=email).first()
        if not admin_user:
            admin_user = User(
                full_name="System Administrator",
                email=email,
                is_verified=True
            )
            admin_user.set_password(password)
            db.session.add(admin_user)
            db.session.commit()

        # 2FA setup logic
        if not admin_user.is_2fa_enabled or not admin_user.totp_secret:
            return jsonify({
                "must_enable": True,
                "user_email": admin_user.email,
                "role": "admin"
            }), 200

        if admin_user.is_2fa_enabled and admin_user.totp_secret:
            return jsonify({
                "requires_2fa": True,
                "user_email": admin_user.email,
                "role": "admin"
            }), 200

        # Issue access token if already verified
        access_token = create_access_token(
            identity=admin_user.email,
            additional_claims={
                "role": "admin",
                "email": admin_user.email
            },
            expires_delta=timedelta(hours=6)
        )

        return jsonify({
            "message": "Admin login successful",
            "access_token": access_token,
            "user_email": admin_user.email,
            "role": "admin"
        }), 200

    except Exception as e:
        current_app.logger.exception("Admin login error")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# -------------------------------------------------------------------
# 🧑‍🎓 Student Google Login
# -------------------------------------------------------------------
@auth_bp.route("/student/google-login", methods=["POST"])
def student_google_login():
    try:
        data = request.get_json() or {}
        token = data.get("token")
        email_from_frontend = (data.get("email") or "").strip().lower()

        if not token:
            return jsonify({"error": "Missing token"}), 400

        # ✅ Verify Google token
        idinfo = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), CLIENT_ID
        )
        google_email = idinfo.get("email", "").strip().lower()

        # ✅ Double-check frontend & Google email match
        if email_from_frontend and email_from_frontend != google_email:
            return jsonify({"error": "Email mismatch detected"}), 400

        # ✅ Allow only SZABIST student emails
        if not (google_email.endswith("@szabist-isb.pk") or google_email.endswith("@szabist.edu.pk")):
            return jsonify({"error": "Only SZABIST emails allowed"}), 403

        # ✅ Check if student is registered
        user = User.query.filter_by(email=google_email).first()
        if not user:
            return jsonify({"error": "Student not registered"}), 404

        if not user.is_verified:
            return jsonify({"error": "Please verify your email before login"}), 401

        # ✅ If 2FA not set up
        if not user.is_2fa_enabled or not user.totp_secret:
            return jsonify({
                "must_enable": True,
                "user_email": user.email,
                "role": "student"
            }), 200

        # ✅ If 2FA enabled → prompt for verification
        if user.is_2fa_enabled and user.totp_secret:
            return jsonify({
                "requires_2fa": True,
                "user_email": user.email,
                "role": "student"
            }), 200

        # ✅ Otherwise issue JWT token
        access_token = create_access_token(
            identity=user.email,
            additional_claims={"id": user.id, "email": user.email, "role": "student"}
        )

        return jsonify({
            "success": True,
            "access_token": access_token,
            "user_email": user.email,
            "role": "student",
            "message": "Google student login successful"
        }), 200

    except ValueError:
        return jsonify({"error": "Invalid Google token"}), 400
    except Exception as e:
        current_app.logger.exception("Google student login error")
        return jsonify({"error": f"Server error during Google student login: {str(e)}"}), 500



# -------------------------------------------------------------------
# 🔐 Google Admin Login
# -------------------------------------------------------------------
CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "1069705660956-06hri9rqa4rosh8ik508pn0pvo1uclof.apps.googleusercontent.com",
)

@auth_bp.route("/admin/google-login", methods=["POST"])
def google_login():
    try:
        data = request.get_json() or {}
        token = data.get("token")
        email_from_frontend = (data.get("email") or "").strip().lower()

        if not token:
            return jsonify({"error": "Missing token"}), 400

        # 🔍 Verify Google Token
        idinfo = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), CLIENT_ID
        )
        google_email = idinfo.get("email", "").strip().lower()

        # ✅ Security: Double-check frontend & Google email match
        if email_from_frontend and email_from_frontend != google_email:
            return jsonify({"error": "Email mismatch detected"}), 400

        # ✅ Allow only admin email
        if google_email != ADMIN_EMAIL:
            return jsonify({"error": "Access denied: unauthorized admin email"}), 403

        # ✅ Create Admin Access Token
        access_token = create_access_token(
            identity=google_email,
            additional_claims={"role": "admin", "email": google_email}
        )

        return jsonify({
            "success": True,
            "access_token": access_token,
            "user_email": google_email,
            "message": "Google admin login successful"
        }), 200

    except ValueError as e:
        current_app.logger.warning(f"Invalid Google token: {e}")
        return jsonify({"error": "Invalid Google token"}), 400
    except Exception as e:
        current_app.logger.exception("Google admin login error")
        return jsonify({"error": "Login failed"}), 500




# -------------------------------------------------------------------
# 🧑‍🎓 User Signup (Email Verification)
# -------------------------------------------------------------------
@auth_bp.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json() or {}
        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        confirm_password = data.get("confirm_password") or ""

        if not all([full_name, email, password, confirm_password]):
            return jsonify({"error": "All fields are required"}), 400
        if not re.match(r"^[^@]+@szabist(-isb)?\.pk$", email):
            return jsonify({"error": "Only SZABIST emails are allowed"}), 400
        if password != confirm_password:
            return jsonify({"error": "Passwords do not match"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            if existing_user.is_verified:
                return jsonify({"error": "Email already registered"}), 400
            db.session.delete(existing_user)
            db.session.commit()

        user = User(full_name=full_name, email=email)
        user.set_password(password)
        user.is_verified = False

        payload = {"email": email, "exp": datetime.utcnow() + timedelta(hours=24)}
        token = jwt.encode(payload, app.config["JWT_SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])
        user.verification_token = token
        db.session.add(user)
        db.session.commit()

        # Email sending (optional if mail configured)
        try:
            verification_link = f"http://127.0.0.1:5000/api/auth/verify-email?token={token}"
            msg = Message(
                subject="Verify Your SZABIST Email - Smart Smoke Surveillance System",
                sender=current_app.config.get("MAIL_USERNAME"),
                recipients=[email],
                body=f"Hello {user.full_name},\n\nClick below to verify your email:\n{verification_link}\n\nIf you didn’t sign up, ignore this email.",
            )
            mail.send(msg)
        except Exception:
            current_app.logger.warning("Verification email send failed")

        return jsonify({"message": "Registered successfully. Verify your email!"}), 201
    except Exception:
        current_app.logger.exception("Signup error")
        return jsonify({"error": "Server error during signup"}), 500


# -------------------------------------------------------------------
# 📧 Email Verification
# -------------------------------------------------------------------
@auth_bp.route("/verify-email", methods=["GET"])
def verify_email():
    token = request.args.get("token")
    if not token:
        return redirect("http://localhost:3000/verify-failed")
    try:
        decoded = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=[app.config["JWT_ALGORITHM"]])
        email = decoded.get("email")
        user = User.query.filter_by(email=email, verification_token=token).first()
        if not user:
            return redirect("http://localhost:3000/verify-failed")

        user.is_verified = True
        user.verification_token = None
        db.session.commit()
        return redirect("http://localhost:3000/email-verified")
    except jwt.ExpiredSignatureError:
        return redirect("http://localhost:3000/verify-expired")
    except Exception:
        current_app.logger.exception("Verify email error")
        return redirect("http://localhost:3000/verify-failed")




# -------------------------------------------------------------------
# 🔑 Signin (2FA Flow) — email/password
# -------------------------------------------------------------------
@auth_bp.route("/signin", methods=["POST"])
def signin():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        # 🧱 Step 1: Basic validation
        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        # 🧩 Step 2: Check if user exists
        user = User.query.filter_by(email=email).first()
        if not user:
            # 🔴 Specific message for unregistered email
            return jsonify({"error": "This email is not registered"}), 404

        # 🔐 Step 3: Check if password matches
        if not user.check_password(password):
            return jsonify({"error": "Invalid password"}), 401

        # ⚠️ Step 4: Check if email is verified
        if not user.is_verified:
            return jsonify({"error": "Please verify your email first"}), 401

        # 🧠 Step 5: Handle 2FA logic
        if not user.is_2fa_enabled or not user.totp_secret:
            must_enable = (not user.is_2fa_enabled or not user.totp_secret)

            if must_enable:
                access_token = create_access_token(
                identity=user.email,
                additional_claims={"id": user.id, "email": user.email}
            )
            # Must enable 2FA
            return jsonify({
                "must_enable": True,
                "access_token": access_token,
                "user_email": user.email
            }), 200

        if user.is_2fa_enabled and user.totp_secret:
            # Require 2FA verification
            return jsonify({
                "requires_2fa": True,
                "user_email": user.email
            }), 200

        # 🟢 Step 6: Normal login → issue access token
        access_token = create_access_token(
            identity=user.email,
            additional_claims={"id": user.id, "email": user.email}
        )

        return jsonify({
            "access_token": access_token,
            "user_email": user.email
        }), 200

    except Exception as e:
        current_app.logger.exception("Signin error")
        return jsonify({"error": f"Server error during signin: {str(e)}"}), 500


# -------------------------------------------------------------------
# 🔒 2FA Setup, Confirmation & Verification
# -------------------------------------------------------------------
@auth_bp.route("/setup-2fa", methods=["POST"])
def setup_2fa():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()

        if not email:
            return jsonify({"error": "Email required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        secret = pyotp.random_base32()
        user.totp_secret = secret
        db.session.commit()

        otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=email, issuer_name="Smart Smoke Surveillance System"
        )

        qr_img = qrcode.make(otp_uri)
        buffer = io.BytesIO()
        qr_img.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return jsonify({"secret": secret, "qr_code": f"data:image/png;base64,{qr_base64}"}), 200
    except Exception:
        current_app.logger.exception("2FA setup error")
        return jsonify({"error": "Server error during setup"}), 500


@auth_bp.route("/confirm-2fa", methods=["POST"])
def confirm_2fa():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        code = (data.get("code") or "").strip()

        if not email or not code:
            return jsonify({"error": "Email and 2FA code required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not user.totp_secret:
            return jsonify({"error": "User or 2FA setup not found"}), 404

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code):
            return jsonify({"error": "Invalid or expired 2FA code"}), 400

        # ✅ Mark 2FA as enabled
        user.is_2fa_enabled = True
        db.session.commit()

        # ✅ Determine role
        user_role = "admin" if user.email == ADMIN_EMAIL else "student"

        # ✅ Create access token
        access_token = create_access_token(
            identity=user.email,
            additional_claims={"id": user.id, "email": user.email, "role": user_role}
        )

        return jsonify({
            "message": "2FA verified successfully",
            "access_token": access_token,
            "user_email": user.email,
            "role": user_role
        }), 200

    except Exception as e:
        current_app.logger.exception("Confirm 2FA error")
        return jsonify({"error": f"Server error during confirm 2FA: {str(e)}"}), 500


@auth_bp.route("/verify-2fa", methods=["POST"])
def verify_2fa():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        code = (data.get("code") or "").strip()

        if not email or not code:
            return jsonify({"error": "Email and code required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.totp_secret or not user.is_2fa_enabled:
            return jsonify({"error": "2FA not configured"}), 400

        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(code, valid_window=1):
            user_role = "admin" if user.email == ADMIN_EMAIL else "student"

            access_token = create_access_token(
                identity=user.email,
                additional_claims={"id": user.id, "email": user.email, "role": user_role}
            )

            return jsonify({
                "access_token": access_token,
                "user_email": user.email,
                "role": user_role
            }), 200
        else:
            return jsonify({"error": "Invalid 2FA code"}), 400

    except Exception:
        current_app.logger.exception("Verify 2FA error")
        return jsonify({"error": "Server error during 2FA verification"}), 500



# -------------------------------------------------------------------
# 🚫 Dismiss 2FA (user chose "remind me later") — records a timestamp
# -------------------------------------------------------------------
@auth_bp.route("/dismiss-2fa", methods=["POST"])
def dismiss_2fa():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        if not email:
            return jsonify({"error": "Email required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Mark 2FA dismissed temporarily
        user.last_2fa_dismissed_at = datetime.utcnow()
        db.session.commit()

        # 🔑 Generate access token (so user can continue)
        access_token = create_access_token(
            identity=user.email,
            additional_claims={"id": user.id, "email": user.email}
        )

        return jsonify({
            "message": "2FA dismissed for now",
            "access_token": access_token,
            "user_email": user.email
        }), 200

    except Exception:
        current_app.logger.exception("Dismiss 2FA error")
        return jsonify({"error": "Server error during dismiss"}), 500




# -------------------------------------------------------------------
# 🔁 Optional Dev: Reset 2FA for testing
# Only active if env ALLOW_RESET_2FA == "1"
# -------------------------------------------------------------------
@auth_bp.route("/reset-2fa", methods=["POST"])
def reset_2fa():
    try:
        if os.getenv("ALLOW_RESET_2FA", "0") != "1":
            return jsonify({"error": "Not allowed"}), 403

        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        if not email:
            return jsonify({"error": "Email required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        user.is_2fa_enabled = False
        user.totp_secret = None
        user.last_2fa_dismissed_at = None
        db.session.commit()
        return jsonify({"message": "2FA reset for testing"}), 200
    except Exception:
        current_app.logger.exception("Reset 2FA error")
        return jsonify({"error": "Server error during reset"}), 500


# -------------------------------------------------------------------
# 🔁 Password Recovery
# -------------------------------------------------------------------
@auth_bp.route("/recover-password", methods=["POST"])
def recover_password():
    try:
        email = (request.json or {}).get("email", "").strip().lower()
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "Email not found"}), 404

        payload = {"email": email, "exp": datetime.utcnow() + timedelta(hours=1)}
        token = jwt.encode(
            payload, app.config["JWT_SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"]
        )
        reset_link = f"http://localhost:3000/reset-password?token={token}"

        msg = Message(
            subject="Password Reset - Smart Smoke Surveillance System",
            sender=current_app.config.get("MAIL_USERNAME"),
            recipients=[email],
            body=f"Hello {user.full_name},\n\nClick below to reset your password:\n{reset_link}\n\nThis link expires in 1 hour.",
        )
        mail.send(msg)
        return jsonify({"message": "Password reset email sent"}), 200
    except Exception:
        current_app.logger.exception("Recover password error")
        return jsonify({"error": "Server error during password recovery"}), 500


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        data = request.get_json() or {}
        token = data.get("token")
        new_password = data.get("new_password")
        if not token or not new_password:
            return jsonify({"error": "Token and new password required"}), 400

        decoded = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=[app.config["JWT_ALGORITHM"]])
        user = User.query.filter_by(email=decoded.get("email")).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        user.set_password(new_password)
        db.session.commit()
        return jsonify({"message": "Password reset successful"}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Reset link expired"}), 400
    except Exception:
        current_app.logger.exception("Reset password error")
        return jsonify({"error": "Server error during reset"}), 500



# -------------------------------------------------------------------
# Register Blueprints & Run
# -------------------------------------------------------------------
app.register_blueprint(auth_bp)
app.register_blueprint(students_bp)
app.register_blueprint(admin_bp)


if __name__ == "__main__":
    debug_flag = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug_flag)
