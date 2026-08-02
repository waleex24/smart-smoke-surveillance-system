import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import "./ResetPassword.css";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState("");

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const checkStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;

    if (score <= 1) return "Weak";
    if (score === 2 || score === 3) return "Medium";
    if (score === 4) return "Strong";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        "http://127.0.0.1:5000/api/auth/reset-password",
        { token, new_password: newPassword }
      );
      setMessage(res.data.message);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Try again!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-card">
        <Lock className="reset-icon" size={70} />
        <h2 className="reset-title">Reset Your Password</h2>
        <p className="reset-text">
          Enter a new password and confirm it to reset your account password.
        </p>

        <form onSubmit={handleSubmit} className="reset-form">
          <div className="password-field">
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setStrength(checkStrength(e.target.value));
              }}
              required
            />
            <span
              className="toggle-eye"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff /> : <Eye />}
            </span>
          </div>

          <div className="password-field">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <span
              className="toggle-eye"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff /> : <Eye />}
            </span>
          </div>

          {newPassword && (
            <p className={`strength ${strength.toLowerCase()}`}>
              Strength: {strength}
            </p>
          )}

          <button type="submit" className="btn-reset" disabled={loading}>
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>

        {message && <p className="reset-message success">{message}</p>}
        {error && <p className="reset-message error">{error}</p>}
      </div>
    </div>
  );
}

export default ResetPassword;
