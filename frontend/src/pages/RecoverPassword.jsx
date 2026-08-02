import React, { useState } from "react";
import axios from "axios";
import "./RecoverPassword.css";

function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW: live field error
  const [fieldError, setFieldError] = useState("");

  // Validation function
  const validateSzabistEmail = (email) => {
    const szabistRegex = /^[0-9]+@szabist-isb\.pk$/;
    return szabistRegex.test(email);
  };

  // -----------------------------
  // Live validation on change
  // -----------------------------
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    const trimmed = value.trim();
    if (trimmed && !validateSzabistEmail(trimmed)) {
      setFieldError("Please enter a valid SZABIST email (2212315@szabist-isb.pk).");
    } else {
      setFieldError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const trimmedEmail = email.trim();

    if (!validateSzabistEmail(trimmedEmail)) {
      setFieldError("Please enter a valid SZABIST email (2212315@szabist-isb.pk).");
      return;
    }

    setLoading(true);

    try {
      await axios.post("http://127.0.0.1:5000/api/auth/recover-password", {
        email: trimmedEmail,
      });
      setMessage("Password reset link sent to your szabist email!");
    } catch (err) {
      setError("We couldn’t find this email in our records. Please sign up to get started.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recover-container">
      <div className="recover-card">
        <h2 className="recover-title">Recover Password</h2>
        <form onSubmit={handleSubmit} className="recover-form">
          <input
            type="email"
            placeholder="Enter your szabist email (regno@szabist.pk)"
            value={email}
            onChange={handleEmailChange}
            required
          />
          {fieldError && <div className="field-error">{fieldError}</div>}

          <button type="submit" className="btn-recover" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        {message && <p className="recover-message success">{message}</p>}
        {error && <p className="recover-message error">{error}</p>}
      </div>
    </div>
  );
}

export default RecoverPassword;