from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
from extensions import db
from models import Incident, Zone
import os

mapping_bp = Blueprint("mapping_bp", __name__, url_prefix="/api/mapping")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "2212315@szabist-isb.pk")


# ========================================================================
# CORE LOGIC — used by BOTH the HTTP route and direct backend calls
# (e.g. from modules/vape/run.py when a violation is detected)
# ========================================================================
def log_incident_core(reg_no, latitude, longitude, violation_type="vape",
                       student_name="", vape_detected=False, smoke_cam=False,
                       smoke_sensor=0, confidence=0.0, camera_id="unknown", notes=""):
    """Creates an Incident row + auto-matches it to a Zone if within radius.
       Returns (incident, zone)."""
    zone = None
    zones = Zone.query.filter_by(is_active=True).all()
    for z in zones:
        dist = calculate_distance(
            (z.latitude, z.longitude),
            (float(latitude), float(longitude))
        )
        if dist <= z.radius:
            zone = z
            break

    incident = Incident(
        reg_no=reg_no,
        student_name=student_name,
        violation_type=violation_type,
        latitude=float(latitude),
        longitude=float(longitude),
        zone_id=zone.id if zone else None,
        incident_date=datetime.now().date(),
        incident_time=datetime.now().strftime("%H:%M:%S"),
        incident_datetime=datetime.utcnow(),
        vape_detected=vape_detected,
        smoke_cam_detected=smoke_cam,
        smoke_sensor_value=int(smoke_sensor),
        confidence=float(confidence) if confidence else None,
        camera_id=camera_id,
        notes=notes
    )

    db.session.add(incident)
    db.session.commit()

    return incident, zone


# ========================================================================
# 1️⃣ LOG INCIDENT (HTTP route — kept exactly as before, now uses core fn)
# ========================================================================
@mapping_bp.route("/incident/log", methods=["POST"])
def log_incident():
    """Log a violation with location coordinates"""
    try:
        data = request.get_json() or {}

        reg_no = data.get("reg_no", "").strip()
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        violation_type = data.get("violation_type", "vape").strip()

        if not reg_no or latitude is None or longitude is None:
            return jsonify({"error": "Missing required fields"}), 400

        student_name = data.get("student_name", "")
        vape_detected = data.get("vape_detected", False)
        smoke_cam = data.get("smoke_cam_detected", False)
        smoke_sensor = data.get("smoke_sensor_value", 0)
        confidence = data.get("confidence", 0.0)
        camera_id = data.get("camera_id", "unknown")
        notes = data.get("notes", "")

        incident, zone = log_incident_core(
            reg_no=reg_no,
            latitude=latitude,
            longitude=longitude,
            violation_type=violation_type,
            student_name=student_name,
            vape_detected=vape_detected,
            smoke_cam=smoke_cam,
            smoke_sensor=smoke_sensor,
            confidence=confidence,
            camera_id=camera_id,
            notes=notes
        )

        current_app.logger.info(f"[Mapping] Incident logged: ID={incident.id}, "
                               f"RegNo={reg_no}, Lat={latitude}, Lon={longitude}")

        return jsonify({
            "message": "Incident logged successfully",
            "incident_id": incident.id,
            "zone_name": zone.zone_name if zone else None
        }), 201

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Log incident error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 2️⃣ GET ALL INCIDENTS (for map pins)
#     ✅ FIX: supports ?reg_no= so the student dashboard only ever pulls
#        that student's own incidents (old + new). Admin omits reg_no
#        and gets everything, exactly as before.
# ========================================================================
@mapping_bp.route("/incidents", methods=["GET"])
@jwt_required()
def get_incidents():
    """Get all incidents with optional date + reg_no filtering"""
    try:
        start_date_str = request.args.get("start_date", "")
        end_date_str = request.args.get("end_date", "")
        reg_no = request.args.get("reg_no", "").strip()

        query = Incident.query

        if reg_no:
            query = query.filter(Incident.reg_no == reg_no)

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                query = query.filter(Incident.incident_date >= start_date)
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                query = query.filter(Incident.incident_date <= end_date)
            except ValueError:
                pass

        incidents = query.order_by(Incident.incident_datetime.desc()).all()

        return jsonify({
            "count": len(incidents),
            "incidents": [inc.to_dict() for inc in incidents]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get incidents error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 3️⃣ GET INCIDENTS BY DATE RANGE (time-based filtering)
#     ✅ FIX: also supports ?reg_no= for student-scoped filtering
# ========================================================================
@mapping_bp.route("/incidents/range", methods=["GET"])
@jwt_required()
def get_incidents_by_range():
    """Get incidents within a specific date/time range, optionally scoped to one student"""
    try:
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        reg_no = request.args.get("reg_no", "").strip()

        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date required"}), 400

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400

        query = Incident.query.filter(
            Incident.incident_date >= start_date,
            Incident.incident_date <= end_date
        )

        if reg_no:
            query = query.filter(Incident.reg_no == reg_no)

        incidents = query.order_by(Incident.incident_datetime.desc()).all()

        return jsonify({
            "count": len(incidents),
            "start_date": start_date_str,
            "end_date": end_date_str,
            "incidents": [inc.to_dict() for inc in incidents]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get range error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 4️⃣ GET INCIDENTS IN ZONE
# ========================================================================
@mapping_bp.route("/zone/<int:zone_id>/incidents", methods=["GET"])
@jwt_required()
def get_zone_incidents(zone_id):
    """Get all incidents within a specific zone"""
    try:
        zone = Zone.query.get(zone_id)
        if not zone:
            return jsonify({"error": "Zone not found"}), 404

        reg_no = request.args.get("reg_no", "").strip()
        query = Incident.query.filter_by(zone_id=zone_id)
        if reg_no:
            query = query.filter(Incident.reg_no == reg_no)
        incidents = query.all()

        return jsonify({
            "zone_id": zone_id,
            "zone_name": zone.zone_name,
            "count": len(incidents),
            "incidents": [inc.to_dict() for inc in incidents]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get zone incidents error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 5️⃣ GET HEATMAP DATA (violation density)
#     ✅ FIX: supports ?reg_no= so a student's heatmap only reflects
#        their own violation locations, not the whole campus.
# ========================================================================
@mapping_bp.route("/heatmap", methods=["GET"])
@jwt_required()
def get_heatmap_data():
    """Get heatmap data - incidents grouped by location density"""
    try:
        start_date_str = request.args.get("start_date", "")
        end_date_str = request.args.get("end_date", "")
        reg_no = request.args.get("reg_no", "").strip()

        query = Incident.query

        if reg_no:
            query = query.filter(Incident.reg_no == reg_no)

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                query = query.filter(Incident.incident_date >= start_date)
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                query = query.filter(Incident.incident_date <= end_date)
            except ValueError:
                pass

        incidents = query.all()

        # Group by rounded coordinates so overlapping incidents show higher
        # intensity — gives a real "density" feel for the heatmap.
        grid = {}
        for inc in incidents:
            key = (round(inc.latitude, 4), round(inc.longitude, 4))
            grid[key] = grid.get(key, 0) + 1

        max_count = max(grid.values()) if grid else 1
        heatmap_points = []
        for (lat, lon), count in grid.items():
            heatmap_points.append({
                "latitude": lat,
                "longitude": lon,
                "count": count,
                "intensity": min(1.0, count / max_count)
            })

        return jsonify({
            "total_incidents": len(incidents),
            "heatmap_points": heatmap_points
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get heatmap error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 6️⃣ CREATE ZONE (Admin only)
# ========================================================================
@mapping_bp.route("/zone/create", methods=["POST"])
@jwt_required()
def create_zone():
    """Create a new alert zone"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        data = request.get_json() or {}

        zone_name = data.get("zone_name", "").strip()
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        radius = data.get("radius", 50)
        description = data.get("description", "").strip()

        if not zone_name or latitude is None or longitude is None:
            return jsonify({"error": "Missing required fields"}), 400

        existing = Zone.query.filter_by(zone_name=zone_name).first()
        if existing:
            return jsonify({"error": "Zone already exists"}), 409

        zone = Zone(
            zone_name=zone_name,
            latitude=float(latitude),
            longitude=float(longitude),
            radius=float(radius),
            description=description,
            is_active=True
        )

        db.session.add(zone)
        db.session.commit()

        current_app.logger.info(f"[Mapping] Zone created: {zone_name}")

        return jsonify({
            "message": "Zone created successfully",
            "zone_id": zone.id,
            "zone": zone.to_dict()
        }), 201

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Create zone error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 7️⃣ GET ALL ZONES
# ========================================================================
@mapping_bp.route("/zones", methods=["GET"])
@jwt_required()
def get_zones():
    """Get all alert zones"""
    try:
        zones = Zone.query.filter_by(is_active=True).all()

        return jsonify({
            "count": len(zones),
            "zones": [zone.to_dict() for zone in zones]
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get zones error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 8️⃣ UPDATE ZONE (Admin only)
# ========================================================================
@mapping_bp.route("/zone/<int:zone_id>/update", methods=["POST"])
@jwt_required()
def update_zone(zone_id):
    """Update an alert zone"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        zone = Zone.query.get(zone_id)
        if not zone:
            return jsonify({"error": "Zone not found"}), 404

        data = request.get_json() or {}

        if "zone_name" in data:
            zone.zone_name = data["zone_name"]
        if "latitude" in data:
            zone.latitude = float(data["latitude"])
        if "longitude" in data:
            zone.longitude = float(data["longitude"])
        if "radius" in data:
            zone.radius = float(data["radius"])
        if "description" in data:
            zone.description = data["description"]
        if "is_active" in data:
            zone.is_active = bool(data["is_active"])

        zone.updated_at = datetime.utcnow()
        db.session.commit()

        current_app.logger.info(f"[Mapping] Zone updated: {zone.zone_name}")

        return jsonify({
            "message": "Zone updated successfully",
            "zone": zone.to_dict()
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Update zone error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 9️⃣ DELETE ZONE (Admin only)
# ========================================================================
@mapping_bp.route("/zone/<int:zone_id>/delete", methods=["POST"])
@jwt_required()
def delete_zone(zone_id):
    """Delete (deactivate) a zone"""
    try:
        identity = get_jwt_identity()
        email = identity.get("email") if isinstance(identity, dict) else identity

        if email != ADMIN_EMAIL:
            return jsonify({"error": "Forbidden"}), 403

        zone = Zone.query.get(zone_id)
        if not zone:
            return jsonify({"error": "Zone not found"}), 404

        zone.is_active = False
        db.session.commit()

        return jsonify({"message": "Zone deleted successfully"}), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Delete zone error: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# 🔟 GET INCIDENT STATISTICS
#     ✅ FIX: supports ?reg_no= so the student's stat cards (total,
#        today, zones touched) reflect only their own record.
# ========================================================================
@mapping_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Get incident statistics, optionally scoped to one student"""
    try:
        reg_no = request.args.get("reg_no", "").strip()

        base_query = Incident.query
        if reg_no:
            base_query = base_query.filter(Incident.reg_no == reg_no)

        total_incidents = base_query.count()
        today = datetime.now().date()
        today_incidents = base_query.filter(Incident.incident_date == today).count()

        by_type = {}
        incidents = base_query.all()
        for inc in incidents:
            vtype = inc.violation_type
            by_type[vtype] = by_type.get(vtype, 0) + 1

        zones = Zone.query.all()
        zone_count = {}
        for zone in zones:
            zq = Incident.query.filter_by(zone_id=zone.id)
            if reg_no:
                zq = zq.filter(Incident.reg_no == reg_no)
            count = zq.count()
            if count > 0:
                zone_count[zone.zone_name] = count

        return jsonify({
            "total_incidents": total_incidents,
            "today_incidents": today_incidents,
            "by_type": by_type,
            "zone_counts": zone_count,
            "total_zones": len(zones)
        }), 200

    except Exception as e:
        current_app.logger.exception(f"[Mapping] Get stats error: {e}")
        return jsonify({"error": "Server error"}), 500


# ========================================================================
# HELPER FUNCTION: Calculate distance between two coordinates
# ========================================================================
def calculate_distance(coord1, coord2):
    from math import radians, cos, sin, asin, sqrt

    lon1, lat1 = coord1[1], coord1[0]
    lon2, lat2 = coord2[1], coord2[0]

    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371000
    return c * r