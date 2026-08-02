// 📁 src/components/ViolationHistory.jsx
//
// Module: Violation History Tracker
// Features:
//   1. Offense Counter per Student — unique date = one offense
//   2. Warning after 1st Offense
//   3. Escalation after 2nd/3rd Offense
//   4. Admin notified automatically (backend) on 2nd/3rd+ offense
//   Note: Email notifications are sent automatically by the backend
//   the moment a violation is logged — no frontend action needed.

import React, { useMemo } from "react";

const FINE_PER_ALERT = 5000;

function getLevel(count) {
  if (count >= 3)  return "critical";
  if (count === 2) return "escalated";
  if (count === 1) return "warning";
  return null;
}

const LEVEL_CFG = {
  warning: {
    label:    "1st Offense — Written Warning",
    message:  "This is your first recorded offense. A written warning has been sent to your email. Fine of Rs. 5,000 per incident applies.",
    cls:      "vht-banner banner-warning",
    badgeCls: "vht-badge badge-warning",
    badgeTxt: "1st Offense",
  },
  escalated: {
    label:    "2nd Offense — Escalated Status",
    message:  "Your case has been escalated and flagged for review. Administration has been notified. Further violations will result in formal disciplinary proceedings.",
    cls:      "vht-banner banner-escalated",
    badgeCls: "vht-badge badge-escalated",
    badgeTxt: "Escalated",
  },
  critical: {
    label:    "Critical Repeat Offender",
    message:  "You have 3 or more offense days. Administration has been notified and disciplinary proceedings have been initiated. You may be required to appear before the Disciplinary Committee.",
    cls:      "vht-banner banner-critical",
    badgeCls: "vht-badge badge-critical",
    badgeTxt: "Critical",
  },
};

const fmt = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day} ${months[parseInt(m,10)-1]} ${y}`;
};

const ViolationHistory = ({ alerts = [], regNo = "", user = {} }) => {

  const myAlerts = useMemo(
    () => alerts.filter(
      (a) => String(a.REG_NO || a.RegNo || a.reg_no || "").trim() === String(regNo).trim()
    ),
    [alerts, regNo]
  );

  const offenseDates = useMemo(() => {
    const seen = new Set();
    myAlerts.forEach((a) => { if (a.Date) seen.add(a.Date); });
    return Array.from(seen).sort();
  }, [myAlerts]);

  const offenseCount  = offenseDates.length;
  const totalFine     = myAlerts.length * FINE_PER_ALERT;
  const level         = getLevel(offenseCount);
  const cfg           = level ? LEVEL_CFG[level] : null;
  const adminNotified = offenseCount >= 2;

  const byDate = useMemo(
    () => offenseDates.map((date) => ({
      date,
      rows: myAlerts.filter((a) => a.Date === date),
    })),
    [offenseDates, myAlerts]
  );

  return (
    <div className="vht-wrap">

      {/* ── Stat Strip ── */}
      <div className="vht-stat-strip">

        <div className={`vht-stat ${
          offenseCount >= 3 ? "stat-critical" :
          offenseCount === 2 ? "stat-escalated" :
          offenseCount === 1 ? "stat-warning" : "stat-clean"
        }`}>
          <div>
            <div className="vht-stat-label">Offense Days</div>
            <div className="vht-stat-value">{offenseCount}</div>
          </div>
          {cfg && <span className={cfg.badgeCls}>{cfg.badgeTxt}</span>}
        </div>

        <div className="vht-stat">
          <div>
            <div className="vht-stat-label">Total Incidents</div>
            <div className="vht-stat-value">{myAlerts.length}</div>
          </div>
        </div>

        <div className="vht-stat stat-fine">
          <div>
            <div className="vht-stat-label">Total Fine</div>
            <div className="vht-stat-value fine">Rs. {totalFine.toLocaleString()}</div>
          </div>
        </div>

        <div className={`vht-stat ${adminNotified ? (offenseCount >= 3 ? "stat-admin-crit" : "stat-admin-esc") : "stat-clean"}`}>
          <div>
            <div className="vht-stat-label">Admin Status</div>
            <div className="vht-stat-value">{adminNotified ? "Notified" : "Not Required"}</div>
          </div>
        </div>
      </div>

      {/* ── Warning / Escalation / Critical Banner ── */}
      {cfg && (
        <div className={cfg.cls}>
          <div className="vht-banner-title">{cfg.label}</div>
          <div className="vht-banner-msg">{cfg.message}</div>
        </div>
      )}

      {/* ── Clean record ── */}
      {offenseCount === 0 && (
        <div className="vht-clean">
          <div>
            <strong>No Violations on Record</strong>
            <p>Keep it up — your record is clean.</p>
          </div>
        </div>
      )}

      {/* ── Offense Timeline ── */}
      {byDate.length > 0 && (
        <div className="vht-timeline">
          <div className="vht-timeline-title">Offense Timeline</div>
          {byDate.map(({ date, rows }, idx) => {
            const num    = idx + 1;
            const dotCls = num === 1 ? "dot-warning" : num === 2 ? "dot-escalated" : "dot-critical";
            const fine   = rows.length * FINE_PER_ALERT;
            return (
              <div key={date} className="vht-offense-block">
                <div className="vht-offense-header">
                  <div className={`vht-dot ${dotCls}`} />
                  <div className="vht-offense-meta">
                    <span className="vht-offense-num">Offense #{num}</span>
                    <span className="vht-offense-date">{fmt(date)}</span>
                    <span className="vht-offense-count">{rows.length} incident{rows.length !== 1 ? "s" : ""}</span>
                    <span className="vht-offense-fine">Fine: Rs. {fine.toLocaleString()}</span>
                    {num === 1 && <span className="vht-badge badge-warning"   style={{position:"static",marginLeft:"auto"}}>Warning</span>}
                    {num === 2 && <span className="vht-badge badge-escalated" style={{position:"static",marginLeft:"auto"}}>Escalated</span>}
                    {num >= 3  && <span className="vht-badge badge-critical"  style={{position:"static",marginLeft:"auto"}}>Critical</span>}
                  </div>
                </div>
                <div className="vht-incident-table-wrap">
                  <table className="vht-table">
                    <thead>
                      <tr><th>#</th><th>Time</th><th>Vape/Cig</th><th>Smoke (CAM)</th><th>MQ135</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => (
                        <tr key={ri}>
                          <td>{ri + 1}</td>
                          <td>{r.Time || "—"}</td>
                          <td><span className={`vht-pill ${r["Vape/Cig"] === "YES" ? "pill-yes" : "pill-no"}`}>{r["Vape/Cig"] || "—"}</span></td>
                          <td><span className={`vht-pill ${r["Smoke(CAM)"] === "YES" ? "pill-yes" : "pill-no"}`}>{r["Smoke(CAM)"] || "—"}</span></td>
                          <td>{r["Smoke(MQ135)"] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Escalation Ladder ── */}
      <div className="vht-ladder">
        <div className="vht-ladder-title">Offense Escalation Policy</div>
        <div className="vht-ladder-steps">
          <div className={`vht-step ${offenseCount >= 1 ? "step-active-warn" : ""}`}>
            <div className="step-num">1</div>
            <div className="step-info">
              <div className="step-label">1st Offense</div>
              <div className="step-desc">Written warning sent to student. Fine: Rs. 5,000/incident.</div>
            </div>
          </div>
          <div className="vht-step-arrow">→</div>
          <div className={`vht-step ${offenseCount >= 2 ? "step-active-esc" : ""}`}>
            <div className="step-num">2</div>
            <div className="step-info">
              <div className="step-label">2nd Offense</div>
              <div className="step-desc">Escalated status. Case flagged. Admin notified.</div>
            </div>
          </div>
          <div className="vht-step-arrow">→</div>
          <div className={`vht-step ${offenseCount >= 3 ? "step-active-crit" : ""}`}>
            <div className="step-num">3+</div>
            <div className="step-info">
              <div className="step-label">3rd+ Offense</div>
              <div className="step-desc">Disciplinary committee. Admin notified. Academic action.</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ViolationHistory;