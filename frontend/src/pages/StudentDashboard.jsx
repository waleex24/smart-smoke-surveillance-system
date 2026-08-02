// 📁 src/pages/StudentDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api.js";
import ViolationReport from "../components/ViolationReport.jsx";
import ViolationHistory from "../components/ViolationHistory.jsx";
import AppealSection from "../components/Appealsection.jsx";
import MapDashboard from "../components/MapDashboard.jsx";
import AIChatbot from "../components/AIChatbot.jsx";                // ✅ NEW
import NotificationBell from "../components/NotificationBell.jsx";  // ✅ NEW
import "../components/Appeals.css";
import "./StudentDashboard.css";

// ============================================================
// Embedded Chat Component (used in AI tab)
// ============================================================
const AIChatbotEmbed = ({ user, myAlerts }) => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Assalam o Alaikum! 👋 Yahan apna koi bhi sawal poochh saktay hain — violations, fines, appeals, ya kuch aur.",
    },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const violationContext = {
    violation_count: myAlerts?.length || 0,
    offense_status:
      (myAlerts?.length || 0) >= 3 ? "Critical" :
      (myAlerts?.length || 0) === 2 ? "Escalated" :
      (myAlerts?.length || 0) === 1 ? "Warning" : "Clean",
    total_fine: (myAlerts?.length || 0) * 5000,
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((p) => [...p, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await API.aiChat({
        message: text,
        session_id: sessionId,
        student_email: user?.email,
        student_name: user?.full_name,
        violation_context: violationContext,
      });
      if (res.data.session_id && !sessionId) setSessionId(res.data.session_id);
      setMessages((p) => [...p, { role: "assistant", text: res.data.reply }]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", text: "Sorry, kuch masla aa gaya. Dobara try karein." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggestions = [
    "Meri violations kitni hain?",
    "Fine kaise pay karoon?",
    "Appeal kaise file karoon?",
    "System kaise kaam karta hai?",
  ];

  return (
    <div className="ai-embed-box">
      <div className="ai-embed-body">
        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            {msg.role === "assistant" && <div className="msg-avatar">🤖</div>}
            <div className={`msg-bubble ${msg.role}`}>
              {msg.text.split("\n").map((line, j) => (
                <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-row assistant">
            <div className="msg-avatar">🤖</div>
            <div className="msg-bubble assistant typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggestions">
          {suggestions.map((s, i) => (
            <button key={i} className="suggestion-chip"
              onClick={() => { setInput(s); inputRef.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="ai-embed-footer">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Apna sawal likhein..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button
          className={`chat-send ${loading || !input.trim() ? "disabled" : ""}`}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >➤</button>
      </div>
    </div>
  );
};


// ============================================================
// Main Dashboard
// ============================================================
const StudentDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarActive, setSidebarActive] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [totalAttendance, setTotalAttendance] = useState(null);

  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");

  // Auth + Profile
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }
    const fetchProfile = async () => {
      try {
        const res = await API.getStudentProfile();
        const profile = res.data?.user || res.data || {};
        setUser(profile);
      } catch {
        localStorage.removeItem("access_token");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const regNo = user?.reg_no || (user?.email ? user.email.split("@")[0] : "—");

  const myAlerts = alerts.filter(
    (a) =>
      String(a.REG_NO || a.RegNo || a.reg_no || "").trim() ===
      String(regNo).trim()
  );

  const offenseDates  = [...new Set(myAlerts.map((a) => a.Date).filter(Boolean))];
  const offenseCount  = offenseDates.length;
  const overviewBadge =
    offenseCount >= 3 ? { txt: "🚨 Critical",  cls: "badge-critical"   } :
    offenseCount === 2 ? { txt: "🔶 Escalated", cls: "badge-escalated"  } :
    offenseCount === 1 ? { txt: "⚠️ Warning",   cls: "badge-warning"    } : null;

  // Attendance
  useEffect(() => {
    if (activeTab !== "attendance") return;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      setAttendanceError("");
      try {
        const res = await API.getStudentAttendance();
        const data = res.data?.attendance || [];
        setAttendanceRecords(data);
        setTotalAttendance(data.length);
      } catch {
        setAttendanceError("Unable to load attendance records.");
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchAttendance();
  }, [activeTab]);

  // Violations
  useEffect(() => {
    if (
      activeTab !== "violations" &&
      activeTab !== "report" &&
      activeTab !== "history"
    ) return;
    if (alerts.length > 0) return;
    const fetchAlerts = async () => {
      setAlertsLoading(true);
      setAlertsError("");
      try {
        const res = await API.getAlerts(regNo);
        setAlerts(res.data.alerts || []);
      } catch {
        setAlertsError("Unable to load alerts.");
      } finally {
        setAlertsLoading(false);
      }
    };
    fetchAlerts();
  }, [activeTab, regNo]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  if (loading) return <div className="dashboard-loading">Loading Dashboard...</div>;

  const tabs = [
    { key: "overview",   label: "Overview"         },
    { key: "attendance", label: "Attendance"        },
    { key: "violations", label: "Violation Record"        },
    { key: "history",    label: "Violation Offense" },
    { key: "report",     label: "Fine Status & Report"       },
    { key: "appeals",    label: "Appeals"           },
    { key: "map",        label: "Incident Map"      },
    { key: "ai",         label: "AI Assistant"  },
  ];

  return (
    <div className="student-shell">

      {/* Sidebar */}
      <aside className={`student-sidebar ${sidebarActive ? "active" : ""}`}>
        <div className="brand">
          <div className="brand-logo">4S</div>
          <div className="brand-title">Student Panel</div>
        </div>
        <button className="sidebar-close" onClick={() => setSidebarActive(false)} aria-label="Close Menu">✕</button>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-item
                ${activeTab === tab.key ? "active" : ""}
                ${tab.key === "report"  ? "nav-report"  : ""}
                ${tab.key === "history" ? "nav-history" : ""}
                ${tab.key === "appeals" ? "nav-appeals" : ""}
                ${tab.key === "ai"      ? "nav-ai"      : ""}
              `}
              onClick={() => { setActiveTab(tab.key); setSidebarActive(false); }}
            >
              {tab.label}
              {tab.key === "history" && overviewBadge && (
                <span className={`nav-offense-dot ${overviewBadge.cls}`} />
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="student-main">
        <header className="topbar">
          <button className="mobile-menu-toggle" onClick={() => setSidebarActive((p) => !p)} aria-label="Toggle Menu">
            {sidebarActive ? "✕" : "☰"}
          </button>
          <h1>Smart Smoke Surveillance System</h1>
          {/* ✅ NEW: topbar-right contains bell + logout */}
          <div className="topbar-right">
            <NotificationBell regNo={regNo} />
            <button className="logout-pill" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {/* Overview */}
        {activeTab === "overview" && (
          <section className="fade-in">
            <h2 className="section-title">Overview</h2>
            <div className="profile-card compact">
              <div className="profile-left">
                <div className="avatar-placeholder">{(user?.full_name || "S").charAt(0)}</div>
              </div>
              <div className="profile-right">
                <h3 className="profile-name">{user?.full_name || "Student"}</h3>
                <div className="profile-row"><span className="label">Registration</span><span className="value">{regNo}</span></div>
                <div className="profile-row"><span className="label">Email</span><span className="value">{user?.email || "—"}</span></div>
                <div className="profile-row"><span className="label">Verified</span><span className="value">{user?.is_verified ? "Yes" : "No"}</span></div>
              </div>
            </div>

            {offenseCount >= 1 && (
              <div className={`ov-offense-banner ${offenseCount >= 3 ? "ov-critical" : offenseCount === 2 ? "ov-escalated" : "ov-warning"}`}>
                <span className="ov-icon">{offenseCount >= 3 ? "🚨" : offenseCount === 2 ? "🔶" : "⚠️"}</span>
                <div className="ov-text">
                  <strong>
                    {offenseCount >= 3 ? "Administration has been notified of repeated violations."
                      : offenseCount === 2 ? "Escalated status — your case is under review."
                      : "Warning: Your first offense has been recorded."}
                  </strong>
                  <span>
                    {offenseCount >= 3 ? "Disciplinary action may follow. All incidents are permanently logged."
                      : offenseCount === 2 ? "Further violations will trigger an admin alert."
                      : "Further violations will result in escalated penalties."}
                  </span>
                </div>
                <button className="ov-link" onClick={() => setActiveTab("history")}>View History →</button>
              </div>
            )}

            <div className="overview-cards">
              <div className="card">
                <div className="card-title">Total Attendance</div>
                <div className="card-value">{totalAttendance ?? "--"}</div>
                <div className="card-foot">Total days present</div>
              </div>
              <div className="card">
                <div className="card-title">Violations</div>
                <div className="card-value">{myAlerts.length}</div>
                <div className="card-foot">Detected incidents</div>
              </div>
              <div className="card">
                <div className="card-title">Total Fine</div>
                <div className="card-value card-fine">Rs. {(myAlerts.length * 5000).toLocaleString()}</div>
                <div className="card-foot">Rs. 5,000 per violation</div>
              </div>
              <div className="card">
                <div className="card-title">Monitored By</div>
                <div className="card-value">Mac Camera</div>
                <div className="card-foot">Library coverage</div>
              </div>
            </div>

            <div className="report-shortcut" onClick={() => setActiveTab("report")}>
              <span>📄 View & Download Fine Report</span>
              <span className="arrow">→</span>
            </div>
            {/* ✅ AI shortcut */}
            <div className="report-shortcut ai-shortcut" onClick={() => setActiveTab("ai")}>
              <span>🤖 Ask AI Assistant — violations, fines, appeals</span>
              <span className="arrow">→</span>
            </div>
          </section>
        )}

        {/* Attendance */}
        {activeTab === "attendance" && (
          <section className="fade-in">
            <h2 className="section-title">Attendance Record</h2>
            {attendanceLoading ? <div className="placeholder">Loading attendance...</div>
              : attendanceError ? <div className="error">{attendanceError}</div>
              : attendanceRecords.length === 0 ? <div className="placeholder">No attendance records found.</div>
              : (
                <table className="table">
                  <thead><tr><th>Reg No</th><th>Name</th><th>Date</th><th>Time</th></tr></thead>
                  <tbody>
                    {attendanceRecords.map((rec, i) => (
                      <tr key={i}>
                        <td>{rec.RegNo || regNo}</td><td>{rec.Name || "—"}</td>
                        <td>{rec.Date || "—"}</td><td>{rec.Time || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>
        )}

        {/* Violations */}
        {activeTab === "violations" && (
          <section className="fade-in">
            <h2 className="section-title">Violations & Alerts</h2>
            {alertsLoading ? <div className="placeholder">Loading alerts...</div>
              : alertsError ? <div className="error">{alertsError}</div>
              : myAlerts.length === 0 ? <div className="placeholder">No violations detected.</div>
              : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Time</th><th>Vape/Cig</th><th>Smoke (CAM)</th><th>Smoke (MQ135)</th></tr></thead>
                  <tbody>
                    {myAlerts.map((alert, i) => (
                      <tr key={i}>
                        <td>{alert.Date}</td><td>{alert.Time}</td>
                        <td>{alert["Vape/Cig"]}</td><td>{alert["Smoke(CAM)"]}</td>
                        <td>{alert["Smoke(MQ135)"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>
        )}

        {/* History */}
        {activeTab === "history" && (
          <section className="fade-in">
            <h2 className="section-title">Violation History Tracker</h2>
            {alertsLoading ? <div className="placeholder">Loading history...</div>
              : alertsError ? <div className="error">{alertsError}</div>
              : <ViolationHistory alerts={myAlerts} regNo={regNo} user={user} />}
          </section>
        )}

        {/* Fine Report */}
        {activeTab === "report" && (
          <section className="fade-in">
            <h2 className="section-title">Fine Report</h2>
            {alertsLoading ? <div className="placeholder">Loading report data...</div>
              : alertsError ? <div className="error">{alertsError}</div>
              : <ViolationReport alerts={myAlerts} user={user} regNo={regNo} />}
          </section>
        )}

        {/* Appeals */}
        {activeTab === "appeals" && (
          <section className="fade-in">
            <h2 className="section-title">Appeals</h2>
            <AppealSection regNo={regNo} alerts={myAlerts} />
          </section>
        )}

        {/* Map */}
        {activeTab === "map" && (
          <section className="fade-in">
            <MapDashboard isAdmin={false} regNo={regNo} />
          </section>
        )}

        {/* ✅ AI Assistant Tab */}
        {activeTab === "ai" && (
          <section className="fade-in ai-tab-section">
            <h2 className="section-title">🤖 AI Assistant</h2>
            <p className="ai-tab-desc">
              Apni violations, fines, appeals ya system ke baare mein koi bhi sawal
              poochh saktay hain. AI Urdu aur English dono samajhta hai.
            </p>
            <AIChatbotEmbed user={user} myAlerts={myAlerts} />
          </section>
        )}

        {/* Coming Soon */}
        {activeTab === "soon" && (
          <section className="coming-soon fade-in">
            <h2 className="section-title">Upcoming Features</h2>
            <p>Fines, camera access, and settings coming soon.</p>
          </section>
        )}

        <footer className="footer">
          © {new Date().getFullYear()} Smart Smoke Surveillance System
        </footer>
      </main>

      {/* ✅ Floating Chatbot Bubble — har tab pe visible */}
      <AIChatbot user={user} myAlerts={myAlerts} regNo={regNo} />

    </div>
  );
};

export default StudentDashboard;