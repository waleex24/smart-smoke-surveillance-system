// 📁 src/components/ViolationReport.jsx
import React, { useEffect, useRef } from "react";

const FINE_PER_ALERT = 5000;

// ── helpers ──────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day} ${months[parseInt(m,10)-1]} ${y}`;
};

// ── main component ────────────────────────────────────────────────────
const ViolationReport = ({ alerts = [], user = {}, regNo = "" }) => {
  const printRef = useRef(null);

  // Filter only this student's alerts (exclude UNKNOWN)
  const myAlerts = alerts.filter((a) => {
  const alertReg =
    a.REG_NO ||
    a.RegNo ||
    a.reg_no ||
    a["REG NO"] ||
    "";

  return alertReg.toString().toLowerCase() === regNo.toString().toLowerCase();
});

  const totalFine = myAlerts.length * FINE_PER_ALERT;
  const today     = new Date().toLocaleDateString("en-PK", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Group by date for summary
  const byDate = myAlerts.reduce((acc, a) => {
    const d = a.Date || a.date || "Unknown";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Violation Report – ${regNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Georgia', serif;
            background: #fff;
            color: #1a1a2e;
            padding: 40px;
          }
          .report-header {
            text-align: center;
            border-bottom: 3px double #1a1a2e;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          .report-header .org {
            font-size: 13px;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: #555;
          }
          .report-header h1 {
            font-size: 26px;
            font-weight: 700;
            margin: 8px 0 4px;
            letter-spacing: 1px;
          }
          .report-header .subtitle {
            font-size: 13px;
            color: #777;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 30px;
            background: #f8f8fb;
            border: 1px solid #dde;
            border-radius: 6px;
            padding: 16px 20px;
            margin-bottom: 24px;
          }
          .meta-item { font-size: 13px; }
          .meta-item .lbl { color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
          .meta-item .val { color: #1a1a2e; font-size: 14px; font-weight: 700; margin-top: 2px; }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #444;
            border-left: 4px solid #0a2540;
            padding-left: 10px;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 28px;
          }
          thead tr { background: #0a2540; color: #fff; }
          thead th { padding: 9px 10px; text-align: left; font-weight: 600; letter-spacing: 0.5px; }
          tbody tr:nth-child(even) { background: #f4f6fb; }
          tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
          }
          .badge-yes { background: #ffe0e0; color: #c00; }
          .badge-no  { background: #e8f5e9; color: #2e7d32; }
          .summary-box {
            background: #0a2540;
            color: #fff;
            border-radius: 8px;
            padding: 20px 24px;
            margin-bottom: 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .summary-box .s-label { font-size: 12px; letter-spacing: 1px; opacity: 0.7; text-transform: uppercase; }
          .summary-box .s-value { font-size: 28px; font-weight: 900; margin-top: 4px; }
          .summary-box .fine-val { color: #00d4ff; font-size: 32px; font-weight: 900; }
          .date-summary table tbody td { font-size: 12px; }
          .footer-note {
            font-size: 11px;
            color: #999;
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 12px;
            margin-top: 20px;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        ${printContents}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="violation-report-wrap">

      {/* ── Action bar ── */}
      <div className="report-action-bar">
        <div className="report-meta-summary">
          <span className="rms-item">
            <span className="rms-label">Total Violations</span>
            <span className="rms-value">{myAlerts.length}</span>
          </span>
          <span className="rms-divider" />
          <span className="rms-item">
            <span className="rms-label">Total Fine</span>
            <span className="rms-value fine">Rs. {totalFine.toLocaleString()}</span>
          </span>
        </div>
        <button className="btn-generate" onClick={handlePrint}>
          <span className="btn-icon">⬇</span> Generate PDF Report
        </button>
      </div>

      {/* ── Preview ── */}
      <div className="report-preview-box">
        <div ref={printRef}>

          {/* Header */}
          <div className="report-header">
            <div className="org">Smart Smoke Surveillance System</div>
            <h1>Violation & Fine Report</h1>
            <div className="subtitle">Confidential — Generated on {today}</div>
          </div>

          {/* Meta */}
          <div className="meta-grid">
            <div className="meta-item">
              <div className="lbl">Student Name</div>
              <div className="val">{user?.full_name || "—"}</div>
            </div>
            <div className="meta-item">
              <div className="lbl">Registration No</div>
              <div className="val">{regNo}</div>
            </div>
            <div className="meta-item">
              <div className="lbl">Email</div>
              <div className="val">{user?.email || "—"}</div>
            </div>
            <div className="meta-item">
              <div className="lbl">Report Date</div>
              <div className="val">{today}</div>
            </div>
          </div>

          {/* Fine Summary */}
          <div className="summary-box">
            <div>
              <div className="s-label">Total Violations Detected</div>
              <div className="s-value">{myAlerts.length} incidents</div>
            </div>
            <div>
              <div className="s-label">Fine per Violation</div>
              <div className="s-value">Rs. {FINE_PER_ALERT.toLocaleString()}</div>
            </div>
            <div>
              <div className="s-label">Total Fine Charged</div>
              <div className="fine-val">Rs. {totalFine.toLocaleString()}</div>
            </div>
          </div>

          {/* Date-wise summary */}
          {Object.keys(byDate).length > 0 && (
            <div className="date-summary" style={{ marginBottom: 24 }}>
              <div className="section-title">Date-wise Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Violations</th>
                    <th>Fine (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byDate).map(([date, count]) => (
                    <tr key={date}>
                      <td>{formatDate(date)}</td>
                      <td>{count}</td>
                      <td>{(count * FINE_PER_ALERT).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed log */}
          <div className="section-title">Detailed Violation Log</div>
          {myAlerts.length === 0 ? (
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
              No violations recorded for this student.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Vape/Cig</th>
                  <th>Smoke (CAM)</th>
                  <th>MQ135 Value</th>
                  <th>Fine</th>
                </tr>
              </thead>
              <tbody>
                {myAlerts.map((a, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{formatDate(a.Date)}</td>
                    <td>{a.Time || "—"}</td>
                    <td>
                      <span className={`badge ${a["Vape/Cig"] === "YES" ? "badge-yes" : "badge-no"}`}>
                        {a["Vape/Cig"] || "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${a["Smoke(CAM)"] === "YES" ? "badge-yes" : "badge-no"}`}>
                        {a["Smoke(CAM)"] || "—"}
                      </span>
                    </td>
                    <td>{a["Smoke(MQ135)"] ?? "—"}</td>
                    <td>Rs. {FINE_PER_ALERT.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div className="footer-note">
            This report was auto-generated by the Smart Smoke Surveillance System.
            Fine of Rs. {FINE_PER_ALERT.toLocaleString()} is charged per detected violation.
            For disputes, contact the administration.
          </div>

        </div>
      </div>
    </div>
  );
};

export default ViolationReport;