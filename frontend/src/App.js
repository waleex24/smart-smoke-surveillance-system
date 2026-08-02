// src/App.js
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";

// 🌐 Public Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import RecoverPassword from "./pages/RecoverPassword";
import EmailVerified from "./pages/EmailVerified";
import VerifyExpired from "./pages/VerifyExpired";
import VerifyFailed from "./pages/VerifyFailed";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./pages/AdminLogin";
import Verify2FA from "./pages/Verify2FA";
import Enable2FA from "./pages/Enable2FA";
import StudentAttendance from "./pages/StudentAttendance";

// 🧑‍💼 Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";

// 🔒 Protected Pages
import StudentDashboard from "./pages/StudentDashboard";
import Profile from "./pages/Profile";

// -----------------------------
// 🧠 Layout Component — hides Navbar on dashboards
// -----------------------------
const Layout = ({ children }) => {
  const location = useLocation();

  // 🧭 Routes where Navbar should be hidden
  const hideNavbarRoutes = ["/dashboard", "/admin-dashboard"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      {children}
    </>
  );
};

// -----------------------------
// 🚀 Main App Component
// -----------------------------
function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* -------- PUBLIC ROUTES -------- */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/recover" element={<RecoverPassword />} />
          <Route path="/email-verified" element={<EmailVerified />} />
          <Route path="/verify-expired" element={<VerifyExpired />} />
          <Route path="/verify-failed" element={<VerifyFailed />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/verify-2fa" element={<Verify2FA />} />
          <Route path="/enable-2fa" element={<Enable2FA />} />
          <Route path="/attendance" element={<StudentAttendance />} />

          {/* -------- ADMIN DASHBOARD (Public for now) -------- */}
          <Route path="/admin-dashboard" element={<AdminDashboard />} />

          {/* -------- STUDENT PROTECTED ROUTES -------- */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <StudentDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
