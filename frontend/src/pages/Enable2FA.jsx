import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Enable2FA = () => {
  const navigate = useNavigate();

  // 🧠 Load stored user info
  const [userEmail] = useState(localStorage.getItem("tempUserEmail") || "");
  const [userRole] = useState(localStorage.getItem("tempUserRole") || "student");
  const [secretKey, setSecretKey] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🚨 Redirect if no email found
  useEffect(() => {
    if (!userEmail) navigate("/login");
  }, [userEmail, navigate]);

  // 🔐 Generate QR + Secret
  const generate2FA = async () => {
    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post("http://127.0.0.1:5000/api/auth/setup-2fa", {
        email: userEmail,
      });

      setSecretKey(res.data.secret);
      setQrCode(res.data.qr_code);
      setMessage("📱 Scan the QR code using Google Authenticator or enter the key manually.");
    } catch (err) {
      console.error("2FA setup error:", err);
      setMessage(err.response?.data?.error || "Failed to generate 2FA details.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Verify Code
  const verify2FA = async () => {
    if (!code.trim()) return setMessage("Enter the 6-digit code from your Authenticator app.");

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post("http://127.0.0.1:5000/api/auth/confirm-2fa", {
        email: userEmail,
        code,
      });

      localStorage.setItem("access_token", res.data.access_token);
      localStorage.removeItem("tempUserEmail");
      localStorage.removeItem("tempUserRole");

      setMessage("✅ Two-Factor Authentication enabled successfully! Redirecting...");

      // ⏩ Redirect based on role
      setTimeout(() => {
        if (userRole === "admin") navigate("/admin-dashboard");
        else navigate("/dashboard");
      }, 1200);
    } catch (err) {
      console.error("2FA verification error:", err);
      setMessage(err.response?.data?.error || "❌ Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🚫 Dismiss setup
  const handleDismiss = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/api/auth/dismiss-2fa", { email: userEmail });

      if (res.data.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
      }

      setMessage("⚠️ 2FA dismissed for now. Redirecting...");
      setTimeout(() => {
        if (userRole === "admin") navigate("/admin-dashboard");
        else navigate("/dashboard");
      }, 1000);
    } catch (err) {
      console.warn("Dismiss 2FA request failed:", err.message);
    } finally {
      localStorage.removeItem("tempUserEmail");
      localStorage.removeItem("tempUserRole");
    }
  };

  // 🧱 UI
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>🔐 Enable Two-Factor Authentication</h2>
      {message && <p style={styles.message}>{message}</p>}

      {!secretKey ? (
        <>
          <button onClick={generate2FA} disabled={loading} style={styles.button}>
            {loading ? "Generating..." : "Enable 2FA"}
          </button>

          <button onClick={handleDismiss} style={styles.dismissBtn}>
            Dismiss
          </button>
        </>
      ) : (
        <div style={styles.card}>
          {qrCode && (
            <div style={{ textAlign: "center" }}>
              <img src={qrCode} alt="2FA QR Code" style={styles.qr} />
              <p style={{ marginBottom: 8 }}>Or enter this key manually:</p>
              <div style={styles.secretWrapper}>
                <p style={styles.secret}>{secretKey}</p>
              </div>
            </div>
          )}

          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            style={styles.input}
          />

          <div style={{ marginTop: 15 }}>
            <button onClick={verify2FA} disabled={loading} style={styles.button}>
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 💅 Styles
const styles = {
  container: { maxWidth: 420, margin: "60px auto", textAlign: "center", padding: 20 },
  heading: { fontSize: 22, marginBottom: 10 },
  message: { color: "#444", fontSize: 15, marginBottom: 10 },
  card: {
    background: "#fafafa",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 0 10px #ddd",
  },
  qr: { width: 220, height: 220, marginBottom: 10 },
  secretWrapper: { display: "flex", justifyContent: "center", alignItems: "center" },
  secret: {
    fontFamily: "monospace",
    fontSize: 18,
    background: "#000",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    letterSpacing: 1,
  },
  input: {
    marginTop: 10,
    padding: "8px 12px",
    width: 180,
    fontSize: 16,
    textAlign: "center",
    borderRadius: 6,
    border: "1px solid #ccc",
  },
  button: {
    margin: "10px 5px",
    padding: "8px 16px",
    background: "#00d4ff",
    color: "#000000ff", 
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  dismissBtn: {
    margin: "10px 5px",
    padding: "8px 16px",
    background: "#ccc",
    color: "#000",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
};

export default Enable2FA;
