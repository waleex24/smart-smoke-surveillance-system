// 📁 src/components/NotificationBell.jsx
import React, { useState, useEffect, useRef } from "react";
import API from "../api/api.js";
import "./NotificationBell.css";

const typeIcon = {
  critical:       "🚨",
  warning:        "🔶",
  violation:      "⚠️",
  appeal_update:  "📋",
  info:           "ℹ️",
  system:         "🔧",
};

const NotificationBell = ({ regNo }) => {
  const [open, setOpen]           = useState(false);
  const [notifs, setNotifs]       = useState([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const dropdownRef               = useRef(null);

  // ── Fetch notifications ──
  const fetchNotifs = async () => {
    if (!regNo || regNo === "—") return;
    setLoading(true);
    try {
      const res = await API.getNotifications();
      const list = res.data?.notifications || [];
      setNotifs(list);
      setUnread(list.filter((n) => !n.is_read).length);
    } catch {
      // silently fail — bell stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Poll every 60s for new notifications
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [regNo]);

  // ── Close on outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Mark single as read ──
  const markRead = async (id) => {
    try {
      await API.markNotificationRead(id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {}
  };

  // ── Mark all read ──
  const markAllRead = async () => {
    try {
      await API.markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const handleOpen = () => {
    setOpen((p) => !p);
  };

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        className={`notif-bell ${unread > 0 ? "bell-active" : ""}`}
        onClick={handleOpen}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="notif-count">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={markAllRead}>
                Sab read karein
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Loading...</div>
            ) : notifs.length === 0 ? (
              <div className="notif-empty">
                <span>🔕</span>
                <p>Koi notification nahi</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.is_read ? "unread" : ""}`}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <span className="notif-icon">
                    {typeIcon[n.notification_type] || "ℹ️"}
                  </span>
                  <div className="notif-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-msg">{n.message}</div>
                    <div className="notif-item-time">{n.created_at}</div>
                  </div>
                  {!n.is_read && <span className="unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;