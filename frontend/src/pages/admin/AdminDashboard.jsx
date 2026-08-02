// 📁 src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import API from "../../api/api.js";
import AdminAppeals from "../../components/Adminappeals.jsx";
import "../../components/Appeals.css";
import MapDashboard from "../../components/MapDashboard.jsx";    // ✅ NEW
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [sensorRecords, setSensorRecords] = useState([]);
  const [violationRecords, setViolationRecords] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState("");

  const [violationLoading, setViolationLoading] = useState(false);
  const [violationError, setViolationError] = useState("");

  const tabs = [
    { key: "overview",   label: "Overview"              },
    { key: "students",   label: "Registered Students"   },
    { key: "attendance", label: "Attendance Records"    },
    { key: "sensor",     label: "Sensor Alert"          },
    { key: "violation",  label: "Violation Alert"       },
    { key: "appeals",    label: "Appeals & Reviews"     },
    { key: "map",        label: "📍 Incident Map"       }, // ✅ NEW
    { key: "cameras",    label: "Camera Management"     },
    { key: "reports",    label: "Reports & Analytics"   },
    { key: "settings",   label: "Settings"              },
  ];

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/admin-login";
  };

  // ---------------- FETCH STUDENTS ----------------
  const fetchStudents = async () => {
    try {
      const res = await API.getAllStudents();
      setStudents(Array.isArray(res.data.students) ? res.data.students : []);
    } catch {
      setStudents([]);
    }
  };

  useEffect(() => {
    if (activeTab === "overview" || activeTab === "students") {
      fetchStudents();
    }
  }, [activeTab]);

  // ---------------- FETCH ATTENDANCE ----------------
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const res = await API.getAllAdminAttendance();
      setAttendanceRecords(
        Array.isArray(res.data.attendance) ? res.data.attendance : []
      );
    } catch {
      setAttendanceError("Failed to load attendance records.");
      setAttendanceRecords([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "attendance") {
      fetchAttendance();
    }
  }, [activeTab]);

  // ---------------- FETCH SENSOR ALERTS ----------------
  const fetchSensorData = async () => {
    setSensorLoading(true);
    setSensorError("");
    try {
      const res = await API.getSensorData();
      setSensorRecords(
        Array.isArray(res.data.sensor_log) ? res.data.sensor_log : []
      );
    } catch {
      setSensorError("Failed to load sensor alerts.");
      setSensorRecords([]);
    } finally {
      setSensorLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sensor") {
      fetchSensorData();
    }
  }, [activeTab]);

  // ---------------- FETCH VIOLATION ALERTS ----------------
  const fetchViolationAlerts = async () => {
    setViolationLoading(true);
    setViolationError("");
    try {
      const res = await API.getAlerts();
      setViolationRecords(Array.isArray(res.data.alerts) ? res.data.alerts : []);
    } catch {
      setViolationError("Failed to load violation alerts.");
      setViolationRecords([]);
    } finally {
      setViolationLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "violation") {
      fetchViolationAlerts();
    }
  }, [activeTab]);

  // ---------------- FILTER STUDENTS ----------------
  const filteredStudents = students.filter((s) =>
    [s.full_name, s.email, s.id].some((field) =>
      String(field).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className={`admin-shell ${sidebarOpen ? "sidebar-open" : ""}`}>

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-logo">4S</div>
            <div className="brand-title">Admin Panel</div>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="nav">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`nav-item ${activeTab === t.key ? "active" : ""}`}
              onClick={() => {
                setActiveTab(t.key);
                setSidebarOpen(false);
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="topbar">
          <div className="top-left">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 className="app-title">
              Smart Smoke Surveillance System
            </h1>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </header>

        {/* ---------------- OVERVIEW ---------------- */}
        {activeTab === "overview" && (
          <section className="fade-in">
            <h2 className="section-title center">Dashboard Overview</h2>
            <div className="overview-cards">
              <div className="card">
                <div className="card-title">Total Students</div>
                <div className="card-value">{students.length}</div>
                <div className="card-foot">Registered in the system</div>
              </div>
              <div className="card">
                <div className="card-title">Active Cameras</div>
                <div className="card-value">1</div>
                <div className="card-foot">Currently online</div>
              </div>
              <div className="card">
                <div className="card-title">Detected Violations</div>
                <div className="card-value">{sensorRecords.length || "--"}</div>
                <div className="card-foot">Total detections</div>
              </div>
              <div className="card">
                <div className="card-title">Violation Alerts</div>
                <div className="card-value">{violationRecords.length || "--"}</div>
                <div className="card-foot">Recent activity</div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- STUDENTS ---------------- */}
        {activeTab === "students" && (
          <section className="fade-in">
            <h2 className="section-title center">Registered Students</h2>
            <div className="panel-header center-content">
              <input
                type="text"
                className="search"
                placeholder="Search by name, ID, or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Verified</th>
                  <th>2FA</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.full_name}</td>
                      <td>{s.email}</td>
                      <td>{s.is_verified ? "✔" : "✘"}</td>
                      <td>{s.is_2fa_enabled ? "✔" : "✘"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="placeholder">
                      {students.length === 0
                        ? "No students found in database."
                        : "No match found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* ---------------- ATTENDANCE ---------------- */}
        {activeTab === "attendance" && (
          <section className="fade-in">
            <h2 className="section-title center">Attendance Records</h2>
            {attendanceLoading ? (
              <div className="placeholder">Loading attendance...</div>
            ) : attendanceError ? (
              <div className="error">{attendanceError}</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="placeholder">No attendance records found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Reg No</th>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((rec, i) => (
                    <tr key={i}>
                      <td>{rec.RegNo || "-"}</td>
                      <td>{rec.Name || "-"}</td>
                      <td>{rec.Date || "-"}</td>
                      <td>{rec.Time || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ---------------- SENSOR ALERT ---------------- */}
        {activeTab === "sensor" && (
          <section className="fade-in">
            <h2 className="section-title center">Sensor Alert</h2>
            {sensorLoading ? (
              <div className="placeholder">Loading sensor alerts...</div>
            ) : sensorError ? (
              <div className="error">{sensorError}</div>
            ) : sensorRecords.length === 0 ? (
              <div className="placeholder">No sensor alerts found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorRecords.map((rec, i) => (
                    <tr key={i}>
                      <td>{rec.Date || "-"}</td>
                      <td>{rec.Time || "-"}</td>
                      <td>{rec.Location || "-"}</td>
                      <td>{rec.Type || "-"}</td>
                      <td>{rec.Status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ---------------- VIOLATION ALERT ---------------- */}
        {activeTab === "violation" && (
          <section className="fade-in">
            <h2 className="section-title center">Violation Alert</h2>
            {violationLoading ? (
              <div className="placeholder">Loading violation alerts...</div>
            ) : violationError ? (
              <div className="error">{violationError}</div>
            ) : violationRecords.length === 0 ? (
              <div className="placeholder">No violation alerts found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Reg No</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Vape/Cig</th>
                    <th>Smoke(CAM)</th>
                    <th>Smoke(MQ135)</th>
                  </tr>
                </thead>
                <tbody>
                  {violationRecords.map((rec, i) => (
                    <tr key={i}>
                      <td>{rec.RegNo || "-"}</td>
                      <td>{rec.Date || "-"}</td>
                      <td>{rec.Time || "-"}</td>
                      <td>{rec["Vape/Cig"] || "-"}</td>
                      <td>{rec["Smoke(CAM)"] || "-"}</td>
                      <td>{rec["Smoke(MQ135)"] || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ---------------- APPEALS & REVIEWS ---------------- */}
        {activeTab === "appeals" && (
          <section className="fade-in">
            <h2 className="section-title center">Appeals & Reviews</h2>
            <AdminAppeals />
          </section>
        )}

        {/* ---------------- INCIDENT MAP ---------------- */}
        {activeTab === "map" && (                                   // ✅ NEW
          <section className="fade-in">
            <MapDashboard isAdmin={true} />
          </section>
        )}

        {/* ---------------- COMING SOON ---------------- */}
        {["cameras", "reports", "settings"].includes(activeTab) && (
          <section className="coming-soon fade-in">
            <h2 className="section-title center">
              {tabs.find((t) => t.key === activeTab)?.label}
            </h2>
            <p className="center">
              This module is under development and will be available soon.
            </p>
          </section>
        )}

        <footer className="admin-footer">
          © {new Date().getFullYear()} Smart Smoke Surveillance System
        </footer>
      </main>
    </div>
  );
}