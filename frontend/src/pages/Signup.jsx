import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import "./Signup.css";

function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  // NEW: per-field live errors
  const [fieldErrors, setFieldErrors] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");

  // -----------------------------
  // Validators (same rules, reused)
  // -----------------------------
  const validatePassword = (password) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };

  const validateName = (name) => {
    return /^[A-Za-z\s]{3,}$/.test(name);
  };

  const validateSzabistEmail = (email) => {
    const parts = email.split("@");
    if (parts.length !== 2)
      return { valid: false, error: "Invalid email format." };

    const [beforeAt, afterAt] = parts;

    if (afterAt !== "szabist-isb.pk") {
      return { valid: false, error: "Email must be '@szabist-isb.pk'." };
    }

    if (!/^\d{7}$/.test(beforeAt)) {
      return {
        valid: false,
        error: "Before '@' Reg no must be exactly 7 digits (e.g. 2212315).",
      };
    }

    return { valid: true };
  };

  const evaluatePassword = (password) => {
    let strength = "";
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const number = /\d/.test(password);
    const length = password.length >= 8;
    const score = [upper, lower, number, length].filter(Boolean).length;

    if (score <= 2) strength = "Weak";
    else if (score === 3) strength = "Medium";
    else strength = "Strong";

    setPasswordStrength(strength);
  };

  // -----------------------------
  // Field-level live validation
  // -----------------------------
  const validateField = (name, value, currentFormData) => {
    let error = "";

    if (name === "full_name") {
      if (value && !validateName(value)) {
        error = "Name must be at least 3 letters, letters only.";
      }
    }

    if (name === "email") {
      if (value) {
        const check = validateSzabistEmail(value.trim());
        if (!check.valid) error = check.error;
      }
    }

    if (name === "password") {
      if (value && !validatePassword(value)) {
        error = "8+ chars, with uppercase, lowercase & a number.";
      }
      // re-check confirm_password too, since it depends on password
      if (currentFormData.confirm_password) {
        setFieldErrors((prev) => ({
          ...prev,
          confirm_password:
            currentFormData.confirm_password !== value
              ? "Passwords do not match."
              : "",
        }));
      }
    }

    if (name === "confirm_password") {
      if (value && value !== currentFormData.password) {
        error = "Passwords do not match.";
      }
    }

    return error;
  };

  // -----------------------------
  // Input Handling
  // -----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    setFormData(updatedFormData);

    if (name === "password") evaluatePassword(value);

    const error = validateField(name, value, updatedFormData);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  // -----------------------------
  // Manual Signup
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    const { full_name, email, password, confirm_password } = formData;
    const trimmedEmail = email.trim();

    if (!full_name || !trimmedEmail || !password || !confirm_password) {
      setMessage({ text: "All fields are required!", type: "error" });
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
      const response = await API.signup(
        full_name,
        trimmedEmail,
        password,
        confirm_password
      );

      setMessage({ text: response.data.message, type: "success" });
      setTimeout(() => navigate("/login"), 2000);
    } catch (error) {
      const errMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Signup failed. Please try again later.";

      setMessage({ text: errMsg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Google Signup (unchanged)
  // -----------------------------
  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      const decoded = jwtDecode(response.credential);
      const userEmail = decoded.email;
      const userName = decoded.name;

      if (!userEmail.endsWith("@szabist-isb.pk")) {
        setMessage({ text: "Only SZABIST emails allowed!", type: "error" });
        return;
      }

      const res = await API.googleSignup(userName, userEmail, response.credential);

      localStorage.setItem("access_token", res.data.access_token);
      setMessage({ text: "Signup successful!", type: "success" });
      navigate("/dashboard");
    } catch (err) {
      setMessage({
        text: "SZABIST email already registered! Please go to Login page.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () =>
    setMessage({ text: "Google signup failed!", type: "error" });

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2 className="signup-title">Create Account</h2>

        {message.text && (
          <div className={`signup-message ${message.type}`}>{message.text}</div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="full_name"
            placeholder="Full Name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
          {fieldErrors.full_name && (
            <div className="field-error">{fieldErrors.full_name}</div>
          )}

          <input
            type="email"
            name="email"
            placeholder="SZABIST Email (e.g. 2212315@szabist-isb.pk)"
            value={formData.email}
            onChange={handleChange}
            required
          />
          {fieldErrors.email && (
            <div className="field-error">{fieldErrors.email}</div>
          )}

          {/* Password */}
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span className="toggle-eye" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff /> : <Eye />}
            </span>
          </div>
          {fieldErrors.password && (
            <div className="field-error">{fieldErrors.password}</div>
          )}

          {formData.password && (
            <div className={`password-strength ${passwordStrength.toLowerCase()}`}>
              Password Strength: {passwordStrength}
            </div>
          )}

          {/* Confirm Password */}
          <div className="password-field">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirm_password"
              placeholder="Confirm Password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
            />
            <span className="toggle-eye" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff /> : <Eye />}
            </span>
          </div>
          {fieldErrors.confirm_password && (
            <div className="field-error">{fieldErrors.confirm_password}</div>
          )}

          <button type="submit" className="btn-signup" disabled={loading}>
            {loading ? "Signing Up..." : "Sign Up"}
          </button>
        </form>

        <div className="divider">OR</div>

        <div className="google-login">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            text="signup_with"
          />
        </div>

        <p className="signup-footer">
          Already have an account? <span onClick={() => navigate("/login")}>Sign In</span>
        </p>
      </div>
    </div>
  );
}

export default Signup;