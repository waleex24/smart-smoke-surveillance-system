import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react"; // failed icon
import "./VerifyFailed.css";

function VerifyFailed() {
  const navigate = useNavigate();

  return (
    <div className="failed-container">
      <div className="failed-card">
        <XCircle className="failed-icon" size={80} />
        <h2 className="failed-title">❌ Verification Failed</h2>
        <p className="failed-text">
          Something went wrong during email verification. Please try again.
        </p>

        <button className="btn-failed" onClick={() => navigate("/signup")}>
          Go to Signup
        </button>
      </div>
    </div>
  );
}

export default VerifyFailed;
