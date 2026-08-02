import React from "react";
import { Navigate } from "react-router-dom";

/**
 * 🔒 PrivateRoute Component
 * Protects routes like Dashboard, Profile, etc.
 * Redirects to /login if no valid token found.
 */
const PrivateRoute = ({ children }) => {
  // ✅ Check for access token (used by both normal + Google login)
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token"); // fallback for older sessions

  // 🚫 If token missing → redirect to login
  if (!token || token === "undefined" || token === "null") {
    return <Navigate to="/login" replace />;
  }

  // ✅ Token found → allow access
  return children;
};

export default PrivateRoute;
