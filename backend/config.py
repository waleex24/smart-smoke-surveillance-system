import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ---------------- Security ----------------
    SECRET_KEY                  = os.getenv("SECRET_KEY", "smoke@123!secure")
    JWT_SECRET_KEY              = os.getenv("JWT_SECRET_KEY", "jwt@smoke_secret123")
    JWT_ACCESS_TOKEN_EXPIRES    = timedelta(hours=6)

    # ---------------- Database ----------------
    SQLALCHEMY_DATABASE_URI     = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:awais123%40@127.0.0.1:5432/smoke_auth_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ---------------- Mail ----------------
    MAIL_SERVER         = os.getenv("MAIL_SERVER",   "smtp.gmail.com")
    MAIL_PORT           = int(os.getenv("MAIL_PORT", 587))
    MAIL_USERNAME       = os.getenv("MAIL_USERNAME", "2212315@szabist-isb.pk")
    MAIL_PASSWORD       = os.getenv("MAIL_PASSWORD", "ybtt rytq mkpx bxne")
    MAIL_USE_TLS        = True
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "2212315@szabist-isb.pk")

    # ---------------- Frontend ----------------
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # ---------------- Vape / Roboflow ----------------
    ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "Fnis87OsOD6X0oR1d0Ul")
    MODEL_ID         = os.getenv("MODEL_ID",         "cigarette-vape-smoke/1")

    # ---------------- AI Assistant (Module 12) ----------------  ✅ NEW
    # AI Assistant (Gemini)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    # .env mein yeh line add karo:
    # ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx