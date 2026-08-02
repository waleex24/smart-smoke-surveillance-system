// 📁 src/api/api.js
import axios from "axios";

const BASE_URL = "http://127.0.0.1:5000/api";

const instance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token && token !== "undefined" && token !== "null") {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const API = {
  // ================= AUTH =================
  signup: (full_name, email, password, confirm_password) =>
    instance.post("/auth/signup", { full_name, email, password, confirm_password }),

  googleSignup: (full_name, email, token) =>
    instance.post("/auth/google-signup", { full_name, email, token }),

  signin: (email, password) =>
    instance.post("/auth/signin", { email, password }),

  verify2FA: (email, code) =>
    instance.post("/auth/verify-2fa", { email, code }),

  recoverPassword: (email) =>
    instance.post("/auth/recover-password", { email }),

  resetPassword: (token, new_password) =>
    instance.post("/auth/reset-password", { token, new_password }),

  // ================= APPEALS =================
  submitAppeal: (data)    => instance.post("/appeals/submit", data),
  getMyAppeals: ()        => instance.get("/appeals/my-appeals"),
  getAppealStatus: (id)   => instance.get(`/appeals/status/${id}`),
  getAllAppealsAdmin: ()   => instance.get("/appeals/admin/all"),
  getPendingAppeals: ()   => instance.get("/appeals/admin/pending"),
  reviewAppeal: (id, data)=> instance.post(`/appeals/admin/review/${id}`, data),
  getAppealStats: ()      => instance.get("/appeals/admin/stats"),

  // ================= STUDENT =================
  getStudentProfile:   () => instance.get("/students/profile"),
  getStudentAttendance:() => instance.get("/students/attendance"),
  getAttendanceRate:   () => instance.get("/students/attendance_rate"),
  getViolations:       () => instance.get("/students/violations"),
  getFines:            () => instance.get("/students/fines"),

  // ================= ADMIN =================
  getAllStudents:         () => instance.get("/admin/students"),
  getAllAdminAttendance:  () => instance.get("/admin/attendance"),

  // ================= ATTENDANCE =================
  getAllStudentAttendance: () => instance.get("/attendance/all"),
  addAttendanceRecord: (data) => instance.post("/attendance/add", data),

  // ================= SENSOR =================
  getSensorData: () => instance.get("/sensor/all"),

  // ================= ALERTS =================
  getAlerts: (reg_no = null) =>
    instance.get("/alerts", { params: reg_no ? { reg_no } : {} }),

sendOffenseEmail: (payload) =>
    instance.post("/alerts/send-offense-email", payload),
  // ================= MODULE 11: MAPPING =================
  // ✅ FIX: every read endpoint below now accepts an optional regNo.
  //    Admin dashboard calls these with regNo = null → sees everything.
  //    Student dashboard passes its own regNo → sees only its own
  //    incidents/heatmap/stats, both historical and newly logged ones.
  logIncident: (data) =>
    instance.post("/mapping/incident/log", data),

  getIncidents: (startDate = null, endDate = null, regNo = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;
    if (regNo)     params.reg_no     = regNo;
    return instance.get("/mapping/incidents", { params });
  },

  getIncidentsByRange: (startDate, endDate, regNo = null) =>
    instance.get("/mapping/incidents/range", {
      params: {
        start_date: startDate,
        end_date: endDate,
        ...(regNo ? { reg_no: regNo } : {}),
      },
    }),

  getZoneIncidents: (zoneId, regNo = null) =>
    instance.get(`/mapping/zone/${zoneId}/incidents`, {
      params: regNo ? { reg_no: regNo } : {},
    }),

  getHeatmapData: (startDate = null, endDate = null, regNo = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;
    if (regNo)     params.reg_no     = regNo;
    return instance.get("/mapping/heatmap", { params });
  },

  createZone:   (data)         => instance.post("/mapping/zone/create", data),
  getZones:     ()             => instance.get("/mapping/zones"),
  updateZone:   (zoneId, data) => instance.post(`/mapping/zone/${zoneId}/update`, data),
  deleteZone:   (zoneId)       => instance.post(`/mapping/zone/${zoneId}/delete`),
  getMappingStats: (regNo = null) =>
    instance.get("/mapping/stats", { params: regNo ? { reg_no: regNo } : {} }),

  // ================= MODULE 12: AI ASSISTANT =================

  // Send message to AI chatbot
  aiChat: (data) =>
    instance.post("/ai/chat", data),
  // data = { message, session_id?, student_email?, student_name?, violation_context? }

  // Get chat history
  aiChatHistory: (sessionId = null, limit = 50) =>
    instance.get("/ai/chat/history", {
      params: {
        ...(sessionId ? { session_id: sessionId } : {}),
        limit,
      },
    }),

  // Clear a chat session
  aiClearHistory: (sessionId) =>
    instance.delete("/ai/chat/history", {
      data: { session_id: sessionId },
    }),

  // ─── Notifications ───────────────────────────────────────
  // Get student notifications
  getNotifications: (unreadOnly = false, limit = 20) =>
    instance.get("/ai/notifications", {
      params: { unread_only: unreadOnly, limit },
    }),

  // Mark single notification as read
  markNotificationRead: (notifId) =>
    instance.patch(`/ai/notifications/${notifId}/read`),

  // Mark all notifications as read
  markAllNotificationsRead: () =>
    instance.patch("/ai/notifications/read-all"),

  // Admin: send manual notification
  sendNotification: (data) =>
    instance.post("/ai/notifications/send", data),
  // data = { reg_no, student_email?, title, message, notification_type?, send_email? }
};

export default API;