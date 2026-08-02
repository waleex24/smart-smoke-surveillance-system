import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react"; // expired icon
import "./VerifyExpired.css";

function VerifyExpired() {
  const navigate = useNavigate();

  return (
    <div className="expired-container">
      <div className="expired-card">
        <AlertCircle className="expired-icon" size={80} />
        <h2 className="expired-title">⏳ Verification Link Expired</h2>
        <p className="expired-text">
          Your verification link has expired. Please sign up again to continue.
        </p>

        <button className="btn-expired" onClick={() => navigate("/signup")}>
          Go to Signup
        </button>
      </div>
    </div>
  );
}

export default VerifyExpired;
