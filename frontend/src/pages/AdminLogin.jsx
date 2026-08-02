import React, { useState } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import "./AdminLogin.css";

const AdminLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  // 🚀 Handle Admin Login (Email + Password)
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });
    setLoading(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/api/auth/admin/login",
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = res.data;

      // ✅ Store role for future reference
      localStorage.setItem("tempUserRole", "admin");

      // ✅ CASE 1: Admin must enable 2FA
      if (data.must_enable) {
        localStorage.setItem("tempUserEmail", data.user_email);
        navigate("/enable-2fa");
        return;
      }

      // ✅ CASE 2: Admin already has 2FA enabled → verify code
      if (data.requires_2fa) {
        localStorage.setItem("tempUserEmail", data.user_email);
        navigate("/verify-2fa");
        return;
      }

      // ✅ CASE 3: 2FA already verified or not required
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("userRole", "admin");
        setMessage({ text: "Login successful!", type: "success" });

        setTimeout(() => navigate("/admin-dashboard"), 1000);
        return;
      }

      setMessage({ text: data.message || "Unknown response.", type: "info" });
    } catch (error) {
      setMessage({
        text: error.response?.data?.error || "Invalid credentials. Try again!",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // 🌐 Handle Google Login (Only for authorized admin emails)
  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      const decoded = jwtDecode(response.credential);
      const adminEmail = decoded.email;

      console.log("Google Sign-in Attempt:", adminEmail);

      const res = await axios.post("http://127.0.0.1:5000/api/auth/admin/google-login", {
  token: response.credential,
  email: adminEmail,
});


      const data = res.data;

      // ✅ Store role
      localStorage.setItem("tempUserRole", "admin");

      // ✅ Handle 2FA logic for Google sign-in as well
      if (data.must_enable) {
        localStorage.setItem("tempUserEmail", data.user_email);
        navigate("/enable-2fa");
        return;
      }

      if (data.requires_2fa) {
        localStorage.setItem("tempUserEmail", data.user_email);
        navigate("/verify-2fa");
        return;
      }

      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("userRole", "admin");
        navigate("/admin-dashboard");
        return;
      }

      if (data.error) {
        setMessage({ text: data.error, type: "error" });
      } else {
        setMessage({ text: "Access denied: unauthorized email.", type: "error" });
      }
    } catch (err) {
      console.error("Google login error:", err);
      setMessage({
        text: "Google login failed or unauthorized email.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setMessage({ text: "Google login failed!", type: "error" });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Admin Portal</h2>

        {message.text && (
          <div className={`login-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* Email Input */}
          <input
            type="email"
            placeholder="Admin Email (e.g., admin@gmail.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password Input */}
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span
              className="toggle-eye"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </span>
          </div>

          {/* Login Button */}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="divider">OR</div>

        {/* Google Login Button */}
        <div className="google-login">
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
