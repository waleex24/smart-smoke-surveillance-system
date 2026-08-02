// 📁 src/components/AdminAppeals.jsx
//
// Admin side — 3 features:
//   1. Pending appeals — review + approve/reject
//   2. All appeals with filter
//   3. Stats overview

import React, { useState, useEffect } from "react";
import API from "../api/api.js";

// ── Status badge ──────────────────────────────────────────────────────
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

const fmt = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });
};

// ═══════════════════════════════════════════════════════════════════════
const AdminAppeals = () => {
  const [adminTab, setAdminTab] = useState("pending"); // pending | all | stats

  // ── Pending state ─────────────────────────────────────────────────
  const [pending,        setPending]        = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError,   setPendingError]   = useState("");

  // ── All appeals state ─────────────────────────────────────────────
  const [allAppeals,     setAllAppeals]     = useState([]);
  const [allLoading,     setAllLoading]     = useState(false);
  const [allError,       setAllError]       = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");

  // ── Stats state ───────────────────────────────────────────────────
  const [stats,          setStats]          = useState(null);
  const [statsLoading,   setStatsLoading]   = useState(false);

  // ── Review modal state ────────────────────────────────────────────
  const [reviewAppeal,   setReviewAppeal]   = useState(null);
  const [reviewForm,     setReviewForm]     = useState({ decision: "approved", admin_comments: "" });
  const [reviewLoading,  setReviewLoading]  = useState(false);
  const [reviewMsg,      setReviewMsg]      = useState(null);

  // ── Fetch helpers ─────────────────────────────────────────────────
  const fetchPending = async () => {
    setPendingLoading(true); setPendingError("");
    try {
      const res = await API.getPendingAppeals();
      setPending(res.data.appeals || []);
    } catch { setPendingError("Failed to load pending appeals."); }
    finally { setPendingLoading(false); }
  };

  const fetchAll = async (status = "") => {
    setAllLoading(true); setAllError("");
    try {
      const res = await API.getAllAppealsAdmin();
      let data = res.data.appeals || [];
      if (status) data = data.filter((a) => a.status === status);
      setAllAppeals(data);
    } catch { setAllError("Failed to load appeals."); }
    finally { setAllLoading(false); }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await API.getAppealStats();
      setStats(res.data);
    } catch {}
    finally { setStatsLoading(false); }
  };

  useEffect(() => {
    if (adminTab === "pending") fetchPending();
    if (adminTab === "all")     fetchAll(filterStatus);
    if (adminTab === "stats")   fetchStats();
  }, [adminTab]);

  useEffect(() => {
    if (adminTab === "all") fetchAll(filterStatus);
  }, [filterStatus]);

  // ── Review submit ─────────────────────────────────────────────────
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.admin_comments || reviewForm.admin_comments.trim().length < 10) {
      setReviewMsg({ type: "error", text: "Admin comments must be at least 10 characters." });
      return;
    }
    setReviewLoading(true); setReviewMsg(null);
    try {
      await API.reviewAppeal(reviewAppeal.id, {
        decision:       reviewForm.decision,
        status:         reviewForm.decision,
        admin_comments: reviewForm.admin_comments,
      });
      setReviewMsg({ type: "success", text: `✅ Appeal #${reviewAppeal.id} has been ${reviewForm.decision}.` });
      setTimeout(() => {
        setReviewAppeal(null);
        setReviewMsg(null);
        fetchPending();
        if (adminTab === "all") fetchAll(filterStatus);
      }, 1500);
    } catch (err) {
      const msg = err?.response?.data?.error || "Review failed.";
      setReviewMsg({ type: "error", text: `❌ ${msg}` });
    } finally {
      setReviewLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="admin-appeal-wrap">

      {/* ── Tab nav ── */}
      <div className="admin-appeal-tabs">
        <button
          className={`aat-btn ${adminTab === "pending" ? "active" : ""}`}
          onClick={() => setAdminTab("pending")}
        >
          ⏳ Pending Review
          {pending.length > 0 && <span className="aat-count">{pending.length}</span>}
        </button>
        <button
          className={`aat-btn ${adminTab === "all" ? "active" : ""}`}
          onClick={() => setAdminTab("all")}
        >📋 All Appeals</button>
        <button
          className={`aat-btn ${adminTab === "stats" ? "active" : ""}`}
          onClick={() => setAdminTab("stats")}
        >📊 Statistics</button>
      </div>

      {/* ══════════ PENDING TAB ══════════ */}
      {adminTab === "pending" && (
        <div>
          {pendingLoading ? (
            <div className="appeal-placeholder">Loading pending appeals...</div>
          ) : pendingError ? (
            <div className="appeal-error">{pendingError}</div>
          ) : pending.length === 0 ? (
            <div className="appeal-empty">
              <span>✅</span>
              <p>No pending appeals. All caught up!</p>
            </div>
          ) : (
            <div className="admin-appeal-cards">
              {pending.map((a) => (
                <div key={a.id} className="admin-appeal-card">
                  <div className="aac-top">
                    <div>
                      <div className="aac-id">Appeal #{a.id}</div>
                      <div className="aac-student">
                        <strong>{a.student_name || a.reg_no}</strong>
                        <span className="aac-email">{a.student_email}</span>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>

                  <div className="aac-meta">
                    <div className="aac-meta-row">
                      <span>Violation Date</span><span>{fmt(a.violation_date)}</span>
                    </div>
                    <div className="aac-meta-row">
                      <span>Type</span><span style={{textTransform:"capitalize"}}>{a.violation_type||"—"}</span>
                    </div>
                    <div className="aac-meta-row">
                      <span>Fine</span><span>Rs. {Number(a.fine_amount||0).toLocaleString()}</span>
                    </div>
                    <div className="aac-meta-row">
                      <span>Submitted</span><span>{fmt(a.submitted_at)}</span>
                    </div>
                  </div>

                  <div className="aac-reason">
                    <div className="aac-reason-label">Student's Reason</div>
                    <p>{a.appeal_reason}</p>
                  </div>

                  {a.evidence_url && (
                    <a href={a.evidence_url} target="_blank" rel="noopener noreferrer" className="aac-evidence">
                      🔗 View Evidence
                    </a>
                  )}

                  <button
                    className="aac-review-btn"
                    onClick={() => { setReviewAppeal(a); setReviewForm({ decision:"approved", admin_comments:"" }); setReviewMsg(null); }}
                  >
                    📝 Review Appeal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ALL APPEALS TAB ══════════ */}
      {adminTab === "all" && (
        <div>
          {/* Filter */}
          <div className="appeal-filter-row">
            <label>Filter by Status:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {allLoading ? (
            <div className="appeal-placeholder">Loading...</div>
          ) : allError ? (
            <div className="appeal-error">{allError}</div>
          ) : allAppeals.length === 0 ? (
            <div className="appeal-empty"><span>📂</span><p>No appeals found.</p></div>
          ) : (
            <div className="appeal-all-table-wrap">
              <table className="appeal-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Student</th>
                    <th>Reg No</th>
                    <th>Violation Date</th>
                    <th>Type</th>
                    <th>Fine</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allAppeals.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td>{a.student_name||"—"}</td>
                      <td>{a.reg_no||"—"}</td>
                      <td>{fmt(a.violation_date)}</td>
                      <td style={{textTransform:"capitalize"}}>{a.violation_type||"—"}</td>
                      <td>Rs. {Number(a.fine_amount||0).toLocaleString()}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>{fmt(a.submitted_at)}</td>
                      <td>
                        {["pending","under_review"].includes(a.status) ? (
                          <button
                            className="aac-review-btn-sm"
                            onClick={() => { setReviewAppeal(a); setReviewForm({ decision:"approved", admin_comments:"" }); setReviewMsg(null); setAdminTab("pending"); }}
                          >Review</button>
                        ) : (
                          <span className="aac-done">Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ STATS TAB ══════════ */}
      {adminTab === "stats" && (
        <div>
          {statsLoading ? (
            <div className="appeal-placeholder">Loading stats...</div>
          ) : !stats ? (
            <div className="appeal-placeholder">No stats available.</div>
          ) : (
            <div className="appeal-stats-grid">
              <div className="ast-card ast-total">
                <div className="ast-icon">📋</div>
                <div className="ast-val">{stats.total_appeals}</div>
                <div className="ast-label">Total Appeals</div>
              </div>
              <div className="ast-card ast-pending">
                <div className="ast-icon">⏳</div>
                <div className="ast-val">{stats.pending_appeals}</div>
                <div className="ast-label">Pending</div>
              </div>
              <div className="ast-card ast-approved">
                <div className="ast-icon">✅</div>
                <div className="ast-val">{stats.approved_appeals}</div>
                <div className="ast-label">Approved</div>
              </div>
              <div className="ast-card ast-rejected">
                <div className="ast-icon">❌</div>
                <div className="ast-val">{stats.rejected_appeals}</div>
                <div className="ast-label">Rejected</div>
              </div>
              <div className="ast-card ast-rate">
                <div className="ast-icon">📈</div>
                <div className="ast-val">{stats.approval_rate}%</div>
                <div className="ast-label">Approval Rate</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ REVIEW MODAL ══════════ */}
      {reviewAppeal && (
        <div className="appeal-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setReviewAppeal(null); }}>
          <div className="appeal-modal">
            <div className="modal-header">
              <h3>Review Appeal #{reviewAppeal.id}</h3>
              <button className="modal-close" onClick={() => setReviewAppeal(null)}>✕</button>
            </div>

            <div className="modal-student-info">
              <strong>{reviewAppeal.student_name}</strong> &nbsp;|&nbsp;
              {reviewAppeal.student_email} &nbsp;|&nbsp;
              Violation: {fmt(reviewAppeal.violation_date)} &nbsp;|&nbsp;
              Fine: Rs. {Number(reviewAppeal.fine_amount||0).toLocaleString()}
            </div>

            <div className="modal-reason">
              <div className="modal-reason-label">Student's Appeal Reason</div>
              <p>{reviewAppeal.appeal_reason}</p>
            </div>

            {reviewMsg && (
              <div className={`appeal-submit-msg ${reviewMsg.type}`}>{reviewMsg.text}</div>
            )}

            <form onSubmit={handleReviewSubmit} className="modal-form">
              <div className="af-group">
                <label>Decision *</label>
                <div className="decision-toggle">
                  <button
                    type="button"
                    className={`dt-btn dt-approve ${reviewForm.decision === "approved" ? "selected" : ""}`}
                    onClick={() => setReviewForm({ ...reviewForm, decision: "approved" })}
                  >✅ Approve</button>
                  <button
                    type="button"
                    className={`dt-btn dt-reject ${reviewForm.decision === "rejected" ? "selected" : ""}`}
                    onClick={() => setReviewForm({ ...reviewForm, decision: "rejected" })}
                  >❌ Reject</button>
                </div>
              </div>

              <div className="af-group">
                <label>Admin Comments * <span className="af-hint">(min 10 chars)</span></label>
                <textarea
                  rows={4}
                  placeholder={
                    reviewForm.decision === "approved"
                      ? "Explain why the appeal is approved and any fine reduction..."
                      : "Explain why the appeal is rejected and the original fine stands..."
                  }
                  value={reviewForm.admin_comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, admin_comments: e.target.value })}
                  required
                />
              </div>

              <div className="af-actions">
                <button type="button" className="af-cancel" onClick={() => setReviewAppeal(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`af-submit ${reviewForm.decision === "rejected" ? "af-reject" : ""}`}
                  disabled={reviewLoading}
                >
                  {reviewLoading ? "⏳ Submitting..." : `Submit ${reviewForm.decision === "approved" ? "Approval" : "Rejection"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAppeals;