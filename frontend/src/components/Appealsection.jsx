// 📁 src/components/AppealSection.jsx
//
// Student side — 3 features:
//   1. Submit Appeal
//   2. My Appeals (with live status)
//   3. Resolved Appeals record

import React, { useState, useEffect } from "react";
import API from "../api/api.js";

// ── Status badge helper ───────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:      { label: "⏳ Pending",     cls: "badge-pending"  },
    under_review: { label: "🔍 Under Review", cls: "badge-review"   },
    approved:     { label: "✅ Approved",     cls: "badge-approved" },
    rejected:     { label: "❌ Rejected",     cls: "badge-rejected" },
  };
  const s = map[status] || { label: status, cls: "badge-pending" };
  return <span className={`appeal-badge ${s.cls}`}>{s.label}</span>;
};

// ── Format date ───────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });
};

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════
const AppealSection = ({ regNo = "", alerts = [] }) => {
  const [view, setView] = useState("list"); // "list" | "submit" | "detail"

  // ── Submit form state ─────────────────────────────────────────────
  const [form, setForm] = useState({
    violation_id:   "",
    violation_date: "",
    violation_type: "vape",
    fine_amount:    5000,
    appeal_reason:  "",
    evidence_url:   "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg,     setSubmitMsg]     = useState(null); // {type, text}

  // ── My appeals state ──────────────────────────────────────────────
  const [myAppeals,     setMyAppeals]     = useState([]);
  const [appealsLoading,setAppealsLoading]= useState(false);
  const [appealsError,  setAppealsError]  = useState("");

  // ── Detail / live tracking ────────────────────────────────────────
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [trackLoading,   setTrackLoading]   = useState(false);

  // ── Resolved appeals ──────────────────────────────────────────────
  const [resolved,       setResolved]       = useState([]);
  const [resolvedLoading,setResolvedLoading]= useState(false);

  // ── Tab inside list view ──────────────────────────────────────────
  const [listTab, setListTab] = useState("active"); // "active" | "resolved"

  // ── Fetch my appeals ──────────────────────────────────────────────
  const fetchMyAppeals = async () => {
    setAppealsLoading(true);
    setAppealsError("");
    try {
      const res = await API.getMyAppeals();
      setMyAppeals(res.data.appeals || []);
    } catch {
      setAppealsError("Failed to load appeals.");
    } finally {
      setAppealsLoading(false);
    }
  };

  // ── Fetch resolved ────────────────────────────────────────────────
  const fetchResolved = async () => {
    setResolvedLoading(true);
    try {
      const res = await API.getMyAppeals();
      const all = res.data.appeals || [];
      setResolved(all.filter((a) => ["approved","rejected"].includes(a.status)));
    } catch {}
    finally { setResolvedLoading(false); }
  };

  useEffect(() => {
    fetchMyAppeals();
    fetchResolved();
  }, []);

  // ── Live status refresh ───────────────────────────────────────────
  const handleTrack = async (appeal) => {
    setSelectedAppeal(appeal);
    setView("detail");
    setTrackLoading(true);
    try {
      const res = await API.getAppealStatus(appeal.id);
      setSelectedAppeal(res.data.appeal || res.data);
    } catch {}
    finally { setTrackLoading(false); }
  };

  // ── Submit handler ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.appeal_reason.trim().length < 20) {
      setSubmitMsg({ type: "error", text: "Appeal reason must be at least 20 characters." });
      return;
    }
    setSubmitLoading(true);
    setSubmitMsg(null);
    try {
      await API.submitAppeal({ ...form, fine_amount: Number(form.fine_amount) });
      setSubmitMsg({ type: "success", text: "✅ Appeal submitted successfully! You can track its status below." });
      setForm({ violation_id:"", violation_date:"", violation_type:"vape", fine_amount:5000, appeal_reason:"", evidence_url:"" });
      fetchMyAppeals();
      fetchResolved();
      setTimeout(() => setView("list"), 1800);
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to submit appeal.";
      setSubmitMsg({ type: "error", text: `❌ ${msg}` });
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Unique offense dates for quick-select ─────────────────────────
  const offenseDates = [...new Set(alerts.map((a) => a.Date).filter(Boolean))].sort();

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="appeal-wrap">

      {/* ── Top nav ── */}
      <div className="appeal-topnav">
        <button
          className={`appeal-nav-btn ${view === "list" ? "active" : ""}`}
          onClick={() => setView("list")}
        >📋 My Appeals</button>
        <button
          className={`appeal-nav-btn ${view === "submit" ? "active" : ""}`}
          onClick={() => { setView("submit"); setSubmitMsg(null); }}
        >➕ Submit New Appeal</button>
      </div>

      {/* ══════════ LIST VIEW ══════════ */}
      {view === "list" && (
        <div className="appeal-list-wrap">

          {/* Sub-tabs */}
          <div className="appeal-subtabs">
            <button
              className={`appeal-subtab ${listTab === "active" ? "active" : ""}`}
              onClick={() => setListTab("active")}
            >Active Appeals ({myAppeals.filter(a => !["approved","rejected"].includes(a.status)).length})</button>
            <button
              className={`appeal-subtab ${listTab === "resolved" ? "active" : ""}`}
              onClick={() => setListTab("resolved")}
            >Resolved ({resolved.length})</button>
          </div>

          {/* ── Active appeals ── */}
          {listTab === "active" && (
            <>
              {appealsLoading ? (
                <div className="appeal-placeholder">Loading appeals...</div>
              ) : appealsError ? (
                <div className="appeal-error">{appealsError}</div>
              ) : myAppeals.filter(a => !["approved","rejected"].includes(a.status)).length === 0 ? (
                <div className="appeal-empty">
                  <span>📭</span>
                  <p>No active appeals. Submit one if you believe a violation was incorrect.</p>
                  <button className="appeal-cta" onClick={() => setView("submit")}>Submit Appeal</button>
                </div>
              ) : (
                <div className="appeal-cards">
                  {myAppeals
                    .filter(a => !["approved","rejected"].includes(a.status))
                    .map((a) => (
                    <div key={a.id} className="appeal-card">
                      <div className="appeal-card-top">
                        <div className="appeal-card-id">Appeal #{a.id}</div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="appeal-card-body">
                        <div className="appeal-meta-row">
                          <span className="aml">Violation Date</span>
                          <span className="amv">{fmt(a.violation_date)}</span>
                        </div>
                        <div className="appeal-meta-row">
                          <span className="aml">Type</span>
                          <span className="amv" style={{textTransform:"capitalize"}}>{a.violation_type || "—"}</span>
                        </div>
                        <div className="appeal-meta-row">
                          <span className="aml">Fine</span>
                          <span className="amv">Rs. {Number(a.fine_amount||0).toLocaleString()}</span>
                        </div>
                        <div className="appeal-meta-row">
                          <span className="aml">Submitted</span>
                          <span className="amv">{fmt(a.submitted_at)}</span>
                        </div>
                        <div className="appeal-reason-preview">
                          <span className="aml">Reason</span>
                          <p>{a.appeal_reason?.slice(0,120)}{a.appeal_reason?.length > 120 ? "..." : ""}</p>
                        </div>
                      </div>
                      <button className="appeal-track-btn" onClick={() => handleTrack(a)}>
                        🔍 Track Live Status
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Resolved appeals (Feature 4) ── */}
          {listTab === "resolved" && (
            <>
              {resolvedLoading ? (
                <div className="appeal-placeholder">Loading...</div>
              ) : resolved.length === 0 ? (
                <div className="appeal-empty">
                  <span>📂</span>
                  <p>No resolved appeals yet.</p>
                </div>
              ) : (
                <div className="appeal-resolved-table-wrap">
                  <table className="appeal-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Violation Date</th>
                        <th>Type</th>
                        <th>Fine</th>
                        <th>Decision</th>
                        <th>Review Date</th>
                        <th>Admin Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolved.map((a) => (
                        <tr key={a.id}>
                          <td>#{a.id}</td>
                          <td>{fmt(a.violation_date)}</td>
                          <td style={{textTransform:"capitalize"}}>{a.violation_type||"—"}</td>
                          <td>Rs. {Number(a.fine_amount||0).toLocaleString()}</td>
                          <td><StatusBadge status={a.decision||a.status} /></td>
                          <td>{fmt(a.review_date)}</td>
                          <td className="appeal-comment-cell">{a.admin_comments||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════ SUBMIT VIEW ══════════ */}
      {view === "submit" && (
        <div className="appeal-form-wrap">
          <h3 className="appeal-form-title">Submit a Violation Appeal</h3>
          <p className="appeal-form-sub">
            If you believe a recorded violation was incorrect, provide your reason below.
            Your appeal will be reviewed by the administration.
          </p>

          {submitMsg && (
            <div className={`appeal-submit-msg ${submitMsg.type}`}>
              {submitMsg.text}
            </div>
          )}

          <form className="appeal-form" onSubmit={handleSubmit}>

            {/* Violation date — quick select from known offenses */}
            <div className="af-group">
              <label>Violation Date *</label>
              {offenseDates.length > 0 ? (
                <select
                  value={form.violation_date}
                  onChange={(e) => setForm({ ...form, violation_date: e.target.value })}
                  required
                >
                  <option value="">— Select offense date —</option>
                  {offenseDates.map((d) => (
                    <option key={d} value={d}>{fmt(d)}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={form.violation_date}
                  onChange={(e) => setForm({ ...form, violation_date: e.target.value })}
                  required
                />
              )}
            </div>

            {/* Violation type */}
            <div className="af-group">
              <label>Violation Type *</label>
              <select
                value={form.violation_type}
                onChange={(e) => setForm({ ...form, violation_type: e.target.value })}
              >
                <option value="vape">Vaping / E-Cigarette</option>
                <option value="smoke">Smoking</option>
                <option value="sensor">Sensor False Alarm</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Fine amount */}
            <div className="af-group">
              <label>Fine Amount (Rs.)</label>
              <input
                type="number"
                value={form.fine_amount}
                onChange={(e) => setForm({ ...form, fine_amount: e.target.value })}
                min={0}
              />
            </div>

            {/* Appeal reason */}
            <div className="af-group">
              <label>Appeal Reason * <span className="af-hint">(min 20 characters)</span></label>
              <textarea
                rows={5}
                placeholder="Explain clearly why you believe this violation was recorded in error. Include any relevant context, location, or circumstances."
                value={form.appeal_reason}
                onChange={(e) => setForm({ ...form, appeal_reason: e.target.value })}
                required
              />
              <div className="af-charcount">
                {form.appeal_reason.length} chars
                {form.appeal_reason.length < 20 && (
                  <span className="af-min"> — {20 - form.appeal_reason.length} more needed</span>
                )}
              </div>
            </div>

            {/* Evidence URL (optional) */}
            <div className="af-group">
              <label>Evidence URL <span className="af-hint">(optional — link to image/doc)</span></label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={form.evidence_url}
                onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
              />
            </div>

            <div className="af-actions">
              <button type="button" className="af-cancel" onClick={() => setView("list")}>
                Cancel
              </button>
              <button type="submit" className="af-submit" disabled={submitLoading}>
                {submitLoading ? "⏳ Submitting..." : "📤 Submit Appeal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════ DETAIL / LIVE TRACKING VIEW ══════════ */}
      {view === "detail" && selectedAppeal && (
        <div className="appeal-detail-wrap">
          <button className="appeal-back-btn" onClick={() => setView("list")}>
            ← Back to My Appeals
          </button>

          <h3 className="appeal-detail-title">
            Appeal #{selectedAppeal.id} — Live Status
          </h3>

          {trackLoading ? (
            <div className="appeal-placeholder">Fetching latest status...</div>
          ) : (
            <>
              {/* Status tracker */}
              <div className="appeal-tracker">
                {["pending","under_review","approved"].map((step, i) => {
                  const current = selectedAppeal.status;
                  const isRejected = current === "rejected";
                  const stepOrder = { pending:0, under_review:1, approved:2, rejected:2 };
                  const currentOrder = stepOrder[current] ?? 0;
                  const done = isRejected
                    ? i < 2
                    : i <= currentOrder;
                  return (
                    <React.Fragment key={step}>
                      <div className={`tracker-step ${done ? "done" : ""} ${current === step && !isRejected ? "current" : ""}`}>
                        <div className="tracker-dot">
                          {done ? "✓" : i + 1}
                        </div>
                        <div className="tracker-label">
                          {step === "pending" ? "Submitted" : step === "under_review" ? "Under Review" : isRejected ? "Rejected" : "Approved"}
                        </div>
                      </div>
                      {i < 2 && <div className={`tracker-line ${i < currentOrder ? "done" : ""}`} />}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Decision banner */}
              {selectedAppeal.status === "approved" && (
                <div className="appeal-decision approved">
                  ✅ Your appeal has been <strong>approved</strong>. The fine may be waived or reduced.
                </div>
              )}
              {selectedAppeal.status === "rejected" && (
                <div className="appeal-decision rejected">
                  ❌ Your appeal has been <strong>rejected</strong>. The original fine stands.
                </div>
              )}

              {/* Detail grid */}
              <div className="appeal-detail-grid">
                <div className="adg-item">
                  <div className="adg-label">Current Status</div>
                  <div className="adg-value"><StatusBadge status={selectedAppeal.status} /></div>
                </div>
                <div className="adg-item">
                  <div className="adg-label">Violation Date</div>
                  <div className="adg-value">{fmt(selectedAppeal.violation_date)}</div>
                </div>
                <div className="adg-item">
                  <div className="adg-label">Violation Type</div>
                  <div className="adg-value" style={{textTransform:"capitalize"}}>{selectedAppeal.violation_type||"—"}</div>
                </div>
                <div className="adg-item">
                  <div className="adg-label">Fine Amount</div>
                  <div className="adg-value">Rs. {Number(selectedAppeal.fine_amount||0).toLocaleString()}</div>
                </div>
                <div className="adg-item">
                  <div className="adg-label">Submitted</div>
                  <div className="adg-value">{fmt(selectedAppeal.submitted_at)}</div>
                </div>
                <div className="adg-item">
                  <div className="adg-label">Reviewed On</div>
                  <div className="adg-value">{fmt(selectedAppeal.review_date) || "Pending"}</div>
                </div>
              </div>

              {/* Appeal reason */}
              <div className="appeal-reason-box">
                <div className="arb-label">Your Appeal Reason</div>
                <p>{selectedAppeal.appeal_reason || "—"}</p>
              </div>

              {/* Admin comments */}
              {selectedAppeal.admin_comments && (
                <div className="appeal-admin-comment">
                  <div className="aac-label">🏛️ Admin Comments</div>
                  <p>{selectedAppeal.admin_comments}</p>
                </div>
              )}

              <button
                className="appeal-refresh-btn"
                onClick={() => handleTrack(selectedAppeal)}
              >
                🔄 Refresh Status
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AppealSection;