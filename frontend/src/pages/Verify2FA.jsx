import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Verify2FA = () => {
  const navigate = useNavigate();

  // 🧠 Load user details from localStorage
  const userEmail = localStorage.getItem("tempUserEmail") || "";
  const userRole = localStorage.getItem("tempUserRole") || "student";

  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔒 Redirect back if email missing (security check)
  useEffect(() => {
    if (!userEmail) {
      navigate("/login");
    }
  }, [userEmail, navigate]);

  // 🚀 Verify 2FA Code
  const handleVerify2FA = async () => {
    if (!code.trim()) {
      setMessage("Please enter the 6-digit authentication code.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post("http://127.0.0.1:5000/api/auth/verify-2fa", {
        email: userEmail,
        code: code.trim(),
      });

      // ✅ Access token handling
      const token = res.data?.access_token || res.data?.token;
      if (!token) {
        setMessage("No access token received from the server.");
        return;
      }

      // 💾 Save token for protected routes
      localStorage.setItem("access_token", token);
      localStorage.removeItem("tempUserEmail");
      localStorage.removeItem("tempUserRole");

      setMessage("✅ Verification successful! Redirecting...");

      // ⏳ Short delay ensures token is saved before redirect
      setTimeout(() => {
        if (userRole === "admin") {
          navigate("/admin-dashboard", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }, 600);
    } catch (err) {
      console.error("2FA Verification Error:", err);

      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Invalid or expired code. Please try again.";

      setMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 🧱 UI
  return (
    <div
      style={{
        maxWidth: 400,
        margin: "60px auto",
        textAlign: "center",
        background: "#111",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 0 16px rgba(0, 212, 255, 0.3)",
        color: "#fff",
      }}
    >
      <h2 style={{ color: "#00d4ff", marginBottom: 12 }}>
        Verify Two-Factor Authentication
      </h2>

      {message && (
        <p
          style={{
            background: message.startsWith("✅") ? "#00ff7f33" : "#ff4d4d33",
            color: message.startsWith("✅") ? "#00ff7f" : "#ff4d4d",
            padding: "8px 10px",
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}

      <input
        type="text"
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        style={{
          textAlign: "center",
          fontSize: 18,
          padding: "10px",
          width: "180px",
          borderRadius: "8px",
          border: "1px solid #00d4ff",
          background: "#0f0f0f",
          color: "#fff",
          marginBottom: 10,
          outline: "none",
        }}
      />

      <br />

      <button
        onClick={handleVerify2FA}
        disabled={loading}
        style={{
          marginTop: 10,
          padding: "10px 16px",
          borderRadius: "8px",
          border: "none",
          background: loading ? "#555" : "#00d4ff",
          color: "#000",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 600,
          transition: "0.2s",
        }}
      >
        {loading ? "Verifying..." : "Verify Code"}
      </button>
    </div>
  );
};

export default Verify2FA;
