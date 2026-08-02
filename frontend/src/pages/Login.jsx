import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // NEW: live field errors
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 🎓 SZABIST Email Validator
  const validateSzabistEmail = (email) => {
    const parts = email.split("@");
    if (parts.length !== 2) return { valid: false, error: "Invalid email format." };

    const [beforeAt, afterAt] = parts;
    if (!["szabist.edu.pk", "szabist-isb.pk"].includes(afterAt))
      return { valid: false, error: "Email must be a SZABIST address." };
    if (!/^\d+$/.test(beforeAt))
      return { valid: false, error: "Email must start with your registration number." };

    return { valid: true };
  };

  // -----------------------------
  // Live field validation
  // -----------------------------
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    let error = "";
    const trimmed = value.trim();
    if (trimmed) {
      const check = validateSzabistEmail(trimmed);
      if (!check.valid) error = check.error;
    }
    setFieldErrors((prev) => ({ ...prev, email: error }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);

    let error = "";
    if (value && value.length < 8) {
      error = "Password must be at least 8 characters long.";
    }
    setFieldErrors((prev) => ({ ...prev, password: error }));
  };

  // 💡 Common Login Success Handler
  const handleLoginSuccess = (data, emailFallback) => {
    const userEmail = data.user_email || emailFallback;
    localStorage.setItem("tempUserRole", "student");

    if (data.must_enable) {
      localStorage.setItem("tempUserEmail", userEmail);
      navigate("/enable-2fa");
      return;
    }

    if (data.requires_2fa) {
      localStorage.setItem("tempUserEmail", userEmail);
      navigate("/verify-2fa");
      return;
    }

    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.removeItem("tempUserEmail");
      navigate("/dashboard");
      return;
    }

    setMessage({ text: "Unexpected login response. Please try again.", type: "error" });
  };

  // 🔐 Email + Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage({ text: "Both fields are required!", type: "error" });
      return;
    }

    // Final safety check: block submit if any live error still present
    const hasErrors = Object.values(fieldErrors).some((err) => err);
    if (hasErrors) {
      setMessage({ text: "Please fix the highlighted fields.", type: "error" });
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post(
        "http://127.0.0.1:5000/api/auth/signin",
        { email: trimmedEmail, password }
      );

      handleLoginSuccess(data, trimmedEmail);
    } catch (err) {
      const errorMsg = err.response?.data?.error;
      if (errorMsg?.includes("not registered")) {
        setMessage({ text: "This email is not registered.", type: "error" });
      } else {
        setMessage({
          text: errorMsg || "Login failed. Please try again.",
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // 🌐 Google Login (unchanged)
  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      const decoded = jwtDecode(response.credential);
      const email = decoded.email;

      if (
        !email.endsWith("@szabist.edu.pk") &&
        !email.endsWith("@szabist-isb.pk")
      ) {
        alert("Only SZABIST emails are allowed!");
        setLoading(false);
        return;
      }

      const res = await axios.post(
        "http://127.0.0.1:5000/api/auth/student/google-login",
        {
          token: response.credential,
          email,
        }
      );

      const data = res.data;

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

      const token = data.access_token || data.token;
      if (token) {
        localStorage.setItem("access_token", token);
        localStorage.removeItem("tempUserEmail");
        navigate("/dashboard");
      } else if (data.error?.includes("not registered")) {
        setMessage({ text: "This email is not registered.", type: "error" });
      } else {
        setMessage({ text: "No access token received.", type: "error" });
      }
    } catch (err) {
      console.error("Google login error:", err);
      const errorMsg = err.response?.data?.error;
      if (errorMsg?.includes("not registered")) {
        setMessage({ text: "This email is not registered.", type: "error" });
      } else {
        setMessage({ text: "Google login failed!", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () =>
    setMessage({ text: "Google login failed!", type: "error" });

  // 🧱 JSX Layout
  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Welcome Back</h2>

        {message.text && (
          <div className={`login-message ${message.type}`}>{message.text}</div>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="SZABIST Email (e.g., 2212315@szabist-isb.pk)"
            value={email}
            onChange={handleEmailChange}
            required
          />
          {fieldErrors.email && (
            <div className="field-error">{fieldErrors.email}</div>
          )}

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
            />
            <span
              className="toggle-eye"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </span>
          </div>
          {fieldErrors.password && (
            <div className="field-error">{fieldErrors.password}</div>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="divider">OR</div>

        <div className="google-login">
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
        </div>

        <div className="login-footer-links">
          <p className="login-footer-left">
            Don’t have an account?{" "}
            <span onClick={() => navigate("/signup")}>Sign Up</span>
          </p>
          <p className="login-footer-right">
            <span onClick={() => navigate("/recover")}>Recover Password</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;