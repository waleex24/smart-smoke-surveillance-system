import os
import uuid
import logging
import google.generativeai as genai

from dotenv import load_dotenv
from extensions import db
from modules.ai_assistant.models_ai import ChatHistory
from config import Config
import google.generativeai as genai

genai.configure(api_key=Config.GEMINI_API_KEY)
# ============================================================================

# ============================================================================
# Gemini Client Setup
# ============================================================================
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("models/gemini-2.5-flash")

# ============================================================================
# System Prompt — Chatbot Personality
# ============================================================================
SYSTEM_PROMPT = """
You are the Smart Smoke Surveillance System (4S) AI Assistant.
You help SZABIST university students understand:

1. Their violation records and fine details
2. How to file an appeal against a violation
3. Smoking/vaping rules and campus policies
4. How the surveillance system works
5. General queries about the student dashboard

Rules:
- Always be polite, clear, and helpful
- Respond in Urdu or English based on user language
- Never share another student's data
- Keep answers concise (3-5 sentences max unless needed)
- Fine amount is Rs. 5,000 per violation
- 1st offense = Warning, 2nd = Escalated, 3rd+ = Admin action
- If unsure, say you don't know
- Guide users to dashboard for specific violation details
"""

# ============================================================================
# Core Chat Function
# ============================================================================
def chat_with_ai(
    user_message: str,
    reg_no: str,
    student_email: str = None,
    student_name: str = None,
    session_id: str = None,
    violation_context: dict = None,
) -> dict:

    # Generate session if not exists
    if not session_id:
        session_id = str(uuid.uuid4())

    # Load chat history (last 10 messages)
    history_rows = (
        ChatHistory.query
        .filter_by(reg_no=reg_no, session_id=session_id)
        .order_by(ChatHistory.created_at.asc())
        .limit(10)
        .all()
    )

    # Convert DB history to text context (Gemini doesn't use roles same way as Claude)
    history_text = ""
    for row in history_rows:
        role = "User" if row.role == "user" else "Assistant"
        history_text += f"{role}: {row.message}\n"

    # Add violation context if available
    context_info = ""
    if violation_context:
        context_info = f"""
Current Student Context:
- Violations: {violation_context.get('violation_count', 0)}
- Status: {violation_context.get('offense_status', 'Clean')}
- Total Fine: Rs. {violation_context.get('total_fine', 0)}
"""

    # Final prompt (Gemini uses single prompt style)
    final_prompt = f"""
{SYSTEM_PROMPT}

{context_info}

Chat History:
{history_text}

User: {user_message}
Assistant:
"""

    try:
        response = model.generate_content(final_prompt)
        ai_reply = response.text

    except Exception as e:
        logging.error(f"[AI Service] Gemini API error: {e}")
        ai_reply = (
            "Sorry, I’m having trouble connecting right now. "
            "Please try again later or contact admin support."
        )

    # Save to database
    try:
        db.session.add(ChatHistory(
            reg_no=reg_no,
            student_email=student_email,
            student_name=student_name,
            role="user",
            message=user_message,
            session_id=session_id,
        ))

        db.session.add(ChatHistory(
            reg_no=reg_no,
            student_email=student_email,
            student_name=student_name,
            role="assistant",
            message=ai_reply,
            session_id=session_id,
        ))

        db.session.commit()

    except Exception as e:
        logging.error(f"[AI Service] DB save error: {e}")
        db.session.rollback()

    return {
        "reply": ai_reply,
        "session_id": session_id,
    }


# ============================================================================
# Chat History Fetch
# ============================================================================
def get_chat_history(reg_no: str, session_id: str = None, limit: int = 50):
    query = ChatHistory.query.filter_by(reg_no=reg_no)

    if session_id:
        query = query.filter_by(session_id=session_id)

    rows = query.order_by(ChatHistory.created_at.asc()).limit(limit).all()

    return [r.to_dict() for r in rows]


# ============================================================================
# Clear Chat History
# ============================================================================
def clear_chat_history(reg_no: str, session_id: str) -> bool:
    try:
        ChatHistory.query.filter_by(
            reg_no=reg_no,
            session_id=session_id
        ).delete()

        db.session.commit()
        return True

    except Exception as e:
        logging.error(f"[AI Service] Clear history error: {e}")
        db.session.rollback()
        return False