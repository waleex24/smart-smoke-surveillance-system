// 📁 src/components/MapDashboard.jsx
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMapEvents } from "react-leaflet";
import DatePicker from "react-datepicker";
import API from "../api/api";
import "./MapDashboard.css";

import "react-datepicker/dist/react-datepicker.css";
import "leaflet/dist/leaflet.css";

// Small helper component — lets admin click the map to pick zone coordinates
const LocationPicker = ({ active, onPick }) => {
  useMapEvents({
    click(e) {
      if (active) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const toLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ✅ FIX: accepts `regNo`. When isAdmin is false this is the student's own
// registration number, and every fetch below (incidents, range filter,
// heatmap, stats, real-time refresh) is scoped to just that student —
// covering both their historical incidents and any new ones logged while
// this dashboard is open.
const MapDashboard = ({ isAdmin = false, regNo = null }) => {
  const [incidents, setIncidents] = useState([]);
  const [zones, setZones] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7))
  );
  const [endDate, setEndDate] = useState(new Date());

  const [viewMode, setViewMode] = useState("incidents"); // "incidents", "heatmap", "zones"
  const [selectedIncident, setSelectedIncident] = useState(null);

  // ── Heatmap state ─────────────────────────────────────────
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // ── Zone creation state (admin only) ──────────────────────
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    zone_name: "",
    latitude: "",
    longitude: "",
    radius: 50,
    description: "",
  });
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneMessage, setZoneMessage] = useState("");

  // A student-scoped dashboard shouldn't show zone creation UI even if
  // isAdmin were ever accidentally left true without a proper check —
  // but the real gate is isAdmin, kept exactly as the rest of the app expects.
  const scopedRegNo = !isAdmin && regNo ? regNo : null;

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regNo, isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const incRes = await API.getIncidents(null, null, scopedRegNo);
      setIncidents(incRes.data.incidents || []);

      const zoneRes = await API.getZones();
      setZones(zoneRes.data.zones || []);

      const statsRes = await API.getMappingStats(scopedRegNo);
      setStats(statsRes.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeatmap = async (startStr = null, endStr = null) => {
    setHeatmapLoading(true);
    try {
      const res = await API.getHeatmapData(startStr, endStr, scopedRegNo);
      setHeatmapPoints(res.data.heatmap_points || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load heatmap data");
    } finally {
      setHeatmapLoading(false);
    }
  };

  // ── Real-time refresh: quietly re-pull incidents every 15s ──
  useEffect(() => {
    if (viewMode !== "incidents") return;
    const interval = setInterval(() => {
      API.getIncidents(null, null, scopedRegNo)
        .then((res) => setIncidents(res.data.incidents || []))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [viewMode, scopedRegNo]);

  // ── Real-time refresh for heatmap too, so new violations update density ──
  useEffect(() => {
    if (viewMode !== "heatmap") return;
    fetchHeatmap(toLocalDateStr(startDate), toLocalDateStr(endDate));
    const interval = setInterval(() => {
      fetchHeatmap(toLocalDateStr(startDate), toLocalDateStr(endDate));
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, scopedRegNo]);

  // ── Filter by date range (works for whichever view is active) ──────────
  const handleFilter = async () => {
    setLoading(true);
    setError("");
    try {
      const startStr = toLocalDateStr(startDate);
      const endStr = toLocalDateStr(endDate);

      if (viewMode === "heatmap") {
        await fetchHeatmap(startStr, endStr);
      } else {
        const res = await API.getIncidentsByRange(startStr, endStr, scopedRegNo);
        setIncidents(res.data.incidents || []);
      }
    } catch (err) {
      setError("Failed to filter incidents");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const newStart = new Date(new Date().setDate(new Date().getDate() - 7));
    const newEnd = new Date();
    setStartDate(newStart);
    setEndDate(newEnd);
    if (viewMode === "heatmap") {
      fetchHeatmap(toLocalDateStr(newStart), toLocalDateStr(newEnd));
    } else {
      fetchData();
    }
  };

  // ── Zone creation ───────────────────────────────────────────
  const handleMapPick = (lat, lng) => {
    setZoneForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const handleCreateZone = async () => {
    if (!zoneForm.zone_name || !zoneForm.latitude || !zoneForm.longitude) {
      setZoneMessage("Zone name and coordinates are required.");
      return;
    }
    setZoneSaving(true);
    setZoneMessage("");
    try {
      await API.createZone({
        zone_name: zoneForm.zone_name,
        latitude: parseFloat(zoneForm.latitude),
        longitude: parseFloat(zoneForm.longitude),
        radius: parseFloat(zoneForm.radius) || 50,
        description: zoneForm.description,
      });
      setZoneMessage("Zone created successfully.");
      setZoneForm({ zone_name: "", latitude: "", longitude: "", radius: 50, description: "" });
      setPickingLocation(false);

      const zoneRes = await API.getZones();
      setZones(zoneRes.data.zones || []);
    } catch (err) {
      setZoneMessage(err.response?.data?.error || "Failed to create zone.");
    } finally {
      setZoneSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await API.deleteZone(zoneId);
      const zoneRes = await API.getZones();
      setZones(zoneRes.data.zones || []);
    } catch (err) {
      setZoneMessage("Failed to delete zone.");
    }
  };

  const CAMPUS_CENTER = [33.7298, 74.3382];

  // Heatmap color/size scale driven by real intensity from the backend
  const heatColor = (intensity) => {
    if (intensity >= 0.75) return "#B91C1C"; // deep red — hotspot
    if (intensity >= 0.5) return "#EF4444";
    if (intensity >= 0.25) return "#F97316";
    return "#FACC15"; // low density
  };

  return (
    <div className="map-dashboard">
      <div className="map-header">
        <h2>{isAdmin ? "Incident Location Mapping" : "My Incident Map"}</h2>
        <div className="map-stats">
          {stats && (
            <>
              <div className="stat-card">
                <span className="stat-label">{isAdmin ? "Total Incidents" : "My Incidents"}</span>
                <span className="stat-value">{stats.total_incidents}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Today</span>
                <span className="stat-value">{stats.today_incidents}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Zones</span>
                <span className="stat-value">{stats.total_zones}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="map-filters">
        <div className="filter-group">
          <label>Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            dateFormat="yyyy-MM-dd"
            className="date-input"
          />
        </div>

        <div className="filter-group">
          <label>End Date</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            dateFormat="yyyy-MM-dd"
            className="date-input"
          />
        </div>

        <button className="filter-btn" onClick={handleFilter} disabled={loading || heatmapLoading}>
          {loading || heatmapLoading ? "Filtering..." : "Filter"}
        </button>

        <button className="reset-btn" onClick={handleReset}>
          Reset
        </button>

        {isAdmin && (
          <button
            className="filter-btn"
            style={{ marginLeft: "auto", background: "#4A90E2" }}
            onClick={() => setShowZoneForm((v) => !v)}
          >
            {showZoneForm ? "Close Zone Form" : "Create Alert Zone"}
          </button>
        )}
      </div>

      {/* ── Zone Creation Panel (admin only) ── */}
      {isAdmin && showZoneForm && (
        <div style={{
          background: "#101828",
          border: "1px solid #2a3a55",
          borderRadius: "10px",
          padding: "16px",
          marginBottom: "16px",
          color: "#e5e7eb",
        }}>
          <h3 style={{ marginTop: 0 }}>Create New Alert Zone</h3>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
            Enter coordinates manually, or click "Pick on Map" and then click a spot on the map below.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Zone Name (e.g. Library Entrance)"
              value={zoneForm.zone_name}
              onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })}
              style={{ flex: "1 1 220px", padding: "8px", borderRadius: "6px", border: "1px solid #374151", background: "#0b1220", color: "#fff" }}
            />
            <input
              type="text"
              placeholder="Latitude"
              value={zoneForm.latitude}
              onChange={(e) => setZoneForm({ ...zoneForm, latitude: e.target.value })}
              style={{ flex: "1 1 140px", padding: "8px", borderRadius: "6px", border: "1px solid #374151", background: "#0b1220", color: "#fff" }}
            />
            <input
              type="text"
              placeholder="Longitude"
              value={zoneForm.longitude}
              onChange={(e) => setZoneForm({ ...zoneForm, longitude: e.target.value })}
              style={{ flex: "1 1 140px", padding: "8px", borderRadius: "6px", border: "1px solid #374151", background: "#0b1220", color: "#fff" }}
            />
            <input
              type="number"
              placeholder="Radius (meters)"
              value={zoneForm.radius}
              onChange={(e) => setZoneForm({ ...zoneForm, radius: e.target.value })}
              style={{ flex: "1 1 140px", padding: "8px", borderRadius: "6px", border: "1px solid #374151", background: "#0b1220", color: "#fff" }}
            />
          </div>

          <input
            type="text"
            placeholder="Description (optional)"
            value={zoneForm.description}
            onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #374151", background: "#0b1220", color: "#fff", marginBottom: "10px", boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="filter-btn"
              style={{ background: pickingLocation ? "#f59e0b" : "#374151" }}
              onClick={() => setPickingLocation((v) => !v)}
            >
              {pickingLocation ? "Click map now..." : "Pick on Map"}
            </button>
            <button className="filter-btn" onClick={handleCreateZone} disabled={zoneSaving}>
              {zoneSaving ? "Saving..." : "Save Zone"}
            </button>
            {zoneMessage && <span style={{ fontSize: "0.85rem" }}>{zoneMessage}</span>}
          </div>

          {zones.length > 0 && (
            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "6px" }}>Existing Zones</div>
              {zones.map((z) => (
                <div key={z.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px", background: "#0b1220", borderRadius: "6px", marginBottom: "6px"
                }}>
                  <span>{z.zone_name} — {z.radius}m</span>
                  <button
                    onClick={() => handleDeleteZone(z.id)}
                    style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── View Modes ── */}
      <div className="view-modes">
        <button
          className={`mode-btn ${viewMode === "incidents" ? "active" : ""}`}
          onClick={() => setViewMode("incidents")}
        >
          Incident Pins
        </button>
        <button
          className={`mode-btn ${viewMode === "heatmap" ? "active" : ""}`}
          onClick={() => setViewMode("heatmap")}
        >
          Heatmap
        </button>
        <button
          className={`mode-btn ${viewMode === "zones" ? "active" : ""}`}
          onClick={() => setViewMode("zones")}
        >
          Zones
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {(loading || heatmapLoading) && <div className="loading-banner">Loading incidents...</div>}

      {/* ── Map ── */}
      <div className="map-container">
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {isAdmin && <LocationPicker active={pickingLocation} onPick={handleMapPick} />}

          {viewMode === "incidents" &&
            incidents.map((incident) => (
              <CircleMarker
                key={incident.id}
                center={[incident.latitude, incident.longitude]}
                radius={8}
                fillColor={
                  incident.violation_type === "vape"
                    ? "#FF6B6B"
                    : incident.violation_type === "cigarette"
                    ? "#FFA500"
                    : "#FF9999"
                }
                color="#333"
                weight={2}
                opacity={0.8}
                fillOpacity={0.7}
                onClick={() => setSelectedIncident(incident)}
              >
                <Popup>
                  <div className="popup-content">
                    <h4>{incident.student_name || incident.reg_no}</h4>
                    <p><strong>Type:</strong> {incident.violation_type}</p>
                    <p><strong>Date:</strong> {incident.incident_date} {incident.incident_time}</p>
                    <p><strong>Zone:</strong> {incident.zone_name || "Unknown"}</p>
                    {incident.confidence && (
                      <p><strong>Confidence:</strong> {(incident.confidence * 100).toFixed(0)}%</p>
                    )}
                    <p><strong>Sensor:</strong> {incident.smoke_sensor_value}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          {(viewMode === "zones" || viewMode === "incidents") &&
            zones.map((zone) => (
              <Circle
                key={zone.id}
                center={[zone.latitude, zone.longitude]}
                radius={zone.radius}
                fillColor="#4A90E2"
                color="#2E5C8A"
                weight={2}
                opacity={0.5}
                fillOpacity={0.1}
              >
                <Popup>
                  <div className="popup-content">
                    <h4>{zone.zone_name}</h4>
                    <p>{zone.description}</p>
                    <p><strong>Radius:</strong> {zone.radius}m</p>
                  </div>
                </Popup>
              </Circle>
            ))}

          {/* ✅ FIX: real heatmap — density-weighted circles from /mapping/heatmap,
              not a recolored copy of the incident pins */}
          {viewMode === "heatmap" &&
            heatmapPoints.map((point, idx) => (
              <Circle
                key={`heat-${idx}`}
                center={[point.latitude, point.longitude]}
                radius={15 + point.intensity * 35}
                fillColor={heatColor(point.intensity)}
                color={heatColor(point.intensity)}
                weight={1}
                opacity={0.4}
                fillOpacity={0.25 + point.intensity * 0.45}
              >
                <Popup>
                  <div className="popup-content">
                    <h4>Hotspot</h4>
                    <p><strong>Incidents here:</strong> {point.count}</p>
                    <p><strong>Intensity:</strong> {(point.intensity * 100).toFixed(0)}%</p>
                  </div>
                </Popup>
              </Circle>
            ))}

          {isAdmin && pickingLocation && zoneForm.latitude && zoneForm.longitude && (
            <CircleMarker
              center={[parseFloat(zoneForm.latitude), parseFloat(zoneForm.longitude)]}
              radius={6}
              fillColor="#22c55e"
              color="#15803d"
              weight={2}
              fillOpacity={0.9}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Incident Details ── */}
      {selectedIncident && (
        <div className="incident-details">
          <button className="close-btn" onClick={() => setSelectedIncident(null)}>×</button>
          <h3>Incident Details</h3>
          <div className="details-grid">
            <div className="detail-row">
              <span className="label">Student:</span>
              <span className="value">{selectedIncident.student_name || selectedIncident.reg_no}</span>
            </div>
            <div className="detail-row">
              <span className="label">Type:</span>
              <span className="value">{selectedIncident.violation_type}</span>
            </div>
            <div className="detail-row">
              <span className="label">Date & Time:</span>
              <span className="value">{selectedIncident.incident_date} {selectedIncident.incident_time}</span>
            </div>
            <div className="detail-row">
              <span className="label">Zone:</span>
              <span className="value">{selectedIncident.zone_name || "—"}</span>
            </div>
            <div className="detail-row">
              <span className="label">Coordinates:</span>
              <span className="value">
                {selectedIncident.latitude.toFixed(4)}, {selectedIncident.longitude.toFixed(4)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Camera:</span>
              <span className="value">{selectedIncident.camera_id}</span>
            </div>
            {selectedIncident.confidence && (
              <div className="detail-row">
                <span className="label">Confidence:</span>
                <span className="value">{(selectedIncident.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label">Smoke Sensor:</span>
              <span className="value">{selectedIncident.smoke_sensor_value}</span>
            </div>
            {selectedIncident.notes && (
              <div className="detail-row full-width">
                <span className="label">Notes:</span>
                <span className="value">{selectedIncident.notes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Incident List ── */}
      <div className="incident-list">
        <h3>{isAdmin ? "Recent Incidents" : "My Recent Incidents"} ({incidents.length})</h3>
        <div className="list-container">
          {incidents.length === 0 ? (
            <p className="empty-msg">No incidents found</p>
          ) : (
            incidents.slice(0, 10).map((incident) => (
              <div key={incident.id} className="list-item" onClick={() => setSelectedIncident(incident)}>
                <div className="item-middle">
                  <p className="item-name">{incident.student_name || incident.reg_no}</p>
                  <p className="item-details">{incident.incident_date} @ {incident.incident_time}</p>
                  <p className="item-zone">{incident.zone_name || "Unknown Zone"}</p>
                </div>
                <div className="item-right">
                  {incident.confidence && (
                    <span className="confidence-badge">{(incident.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MapDashboard;