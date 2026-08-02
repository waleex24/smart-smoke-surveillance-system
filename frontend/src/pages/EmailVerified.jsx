import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import "./EmailVerified.css";

function EmailVerified() {
  const navigate = useNavigate();

  return (
    <div className="verify-container">
      <div className="verify-card">
        <CheckCircle className="verify-icon" size={80} />
        <h2 className="verify-title">🎉 Email Verified Successfully</h2>
        <p className="verify-text">
          Your email has been verified. You can now log in to your account and
          start exploring.
        </p>

        <button className="btn-login" onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    </div>
  );
}

export default EmailVerified;
