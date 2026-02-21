"""
User Profiling + Location Intelligence Module
----------------------------------------------
Post-processing layer that augments the existing ML ensemble with
behavioral user risk and geolocation-based anomaly detection.

Public API:
    get_user_risk(user_id, amount, latitude, longitude) -> dict
"""

import json
import os
import time
import math

# ---------------------------------------------------------------------------
# PROFILE DATA (loaded once at import)
# ---------------------------------------------------------------------------
_PROFILES_PATH = os.path.join(os.path.dirname(__file__), "user_profiles.json")

def _load_profiles():
    if os.path.exists(_PROFILES_PATH):
        with open(_PROFILES_PATH, "r") as f:
            return json.load(f)
    return {}

USER_PROFILES = _load_profiles()

# ---------------------------------------------------------------------------
# IN-MEMORY CACHES
# ---------------------------------------------------------------------------
_recent_transactions: dict[str, list[float]] = {}   # user_id → list of timestamps
_last_location: dict[str, tuple[float, float, float]] = {}  # user_id → (lat, lon, timestamp)

VELOCITY_WINDOW_SEC = 300  # 5 minutes

# ---------------------------------------------------------------------------
# GEODESIC DISTANCE  (Haversine — no external deps needed)
# ---------------------------------------------------------------------------
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points on Earth in km."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# DEMO HELPERS (for cache manipulation without sleeping)
# ---------------------------------------------------------------------------
def set_last_location(user_id: str, lat: float, lon: float, timestamp: float):
    """Set a user's last known location at a specific timestamp.
    Used by /demo/location_fraud to simulate time gaps without sleeping."""
    _last_location[user_id] = (lat, lon, timestamp)


# ---------------------------------------------------------------------------
# RISK COMPONENTS
# ---------------------------------------------------------------------------
def _amount_deviation_risk(amount: float, profile: dict) -> float:
    """How far the amount deviates from user's typical spending."""
    avg = profile.get("avg_amount", 200.0)
    std = profile.get("std_amount", 100.0)
    if std <= 0:
        std = 1.0
    deviation = abs(amount - avg) / (3 * std)
    return min(deviation, 1.0)


def _fraud_history_risk(profile: dict) -> float:
    """Historical fraud rate for this user."""
    return min(profile.get("fraud_rate", 0.0), 1.0)


def _velocity_risk(user_id: str) -> float:
    """Number of transactions in the last 5 minutes → risk score."""
    now = time.time()
    cutoff = now - VELOCITY_WINDOW_SEC

    # Clean old entries
    if user_id in _recent_transactions:
        _recent_transactions[user_id] = [
            t for t in _recent_transactions[user_id] if t > cutoff
        ]
    else:
        _recent_transactions[user_id] = []

    # Record this transaction
    _recent_transactions[user_id].append(now)

    count = len(_recent_transactions[user_id])
    if count <= 2:
        return 0.0
    if count >= 5:
        return 0.5
    # Linear scale between 2 and 5
    return (count - 2) / (5 - 2) * 0.5


def _location_risk(
    user_id: str,
    lat: float,
    lon: float,
    profile: dict,
) -> tuple[float, float]:
    """
    Returns (location_risk_score, geo_distance_km).

    Checks:
        A. Base distance from user's usual location
        B. Impossible travel (speed check vs. last known location)
    """
    now = time.time()
    usual_lat = profile.get("usual_lat", 0.0)
    usual_lon = profile.get("usual_lon", 0.0)

    # --- A. Base Distance Risk (from usual location) ---
    dist_from_home = haversine_km(lat, lon, usual_lat, usual_lon)

    base_dist_risk = 0.0
    if dist_from_home > 5000:
        base_dist_risk = 0.4
    elif dist_from_home > 2000:
        base_dist_risk = 0.3
    elif dist_from_home > 500:
        base_dist_risk = 0.15

    # --- B. Impossible Travel Risk ---
    impossible_risk = 0.0
    geo_distance_km = dist_from_home  # default to distance from home

    if user_id in _last_location:
        prev_lat, prev_lon, prev_time = _last_location[user_id]
        travel_dist = haversine_km(lat, lon, prev_lat, prev_lon)
        geo_distance_km = travel_dist
        time_diff_hours = max((now - prev_time) / 3600.0, 0.001)  # avoid div/0
        speed_kmh = travel_dist / time_diff_hours

        if speed_kmh > 900:
            # Faster than commercial jet — physically impossible
            impossible_risk = 0.5
        elif speed_kmh > 300:
            # Very fast (high-speed rail max) — suspicious
            impossible_risk = 0.3

    # Update last known location
    _last_location[user_id] = (lat, lon, now)

    # Take the higher of base distance vs impossible travel
    location_risk = max(base_dist_risk, impossible_risk)
    return location_risk, geo_distance_km


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------
def get_user_risk(
    user_id: str,
    amount: float,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    """
    Compute user-level behavioral risk.

    Parameters
    ----------
    user_id : str
        Identifier for the user (e.g. "user_mumbai").
    amount : float
        Transaction amount.
    latitude, longitude : float | None
        Transaction origin coordinates.  If None, falls back to user's
        usual location (no location anomaly triggered).

    Returns
    -------
    dict with keys: user_risk, location_risk, geo_distance_km, risk_tier
    """
    profile = USER_PROFILES.get(user_id)

    # Unknown user → zero risk (safe default)
    if profile is None:
        return {
            "user_name": "Unknown",
            "user_city": "Unknown",
            "user_risk": 0.0,
            "location_risk": 0.0,
            "geo_distance_km": 0.0,
            "risk_tier": "LOW",
        }

    # --- Resolve coordinates ---
    used_fallback = False
    if latitude is None or longitude is None:
        latitude = profile.get("usual_lat", 0.0)
        longitude = profile.get("usual_lon", 0.0)
        used_fallback = True

    # --- Compute individual components ---
    amt_risk = _amount_deviation_risk(amount, profile)       # 0-1
    fraud_hist = _fraud_history_risk(profile)                 # 0-1
    vel_risk = _velocity_risk(user_id)                        # 0-0.5

    if used_fallback:
        # Don't trigger location risk for Kaggle data without real coords
        loc_risk = 0.0
        geo_dist = 0.0
        # Still update cache so next real-coord txn can compare
        _last_location[user_id] = (latitude, longitude, time.time())
    else:
        loc_risk, geo_dist = _location_risk(user_id, latitude, longitude, profile)

    # --- Weighted combination ---
    user_risk = (
        0.3 * amt_risk
        + 0.2 * fraud_hist
        + 0.2 * vel_risk
        + 0.3 * loc_risk
    )
    user_risk = min(max(user_risk, 0.0), 1.0)

    # --- Risk tier ---
    if user_risk >= 0.5:
        tier = "CRITICAL"
    elif user_risk >= 0.3:
        tier = "HIGH"
    elif user_risk >= 0.15:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    return {
        "user_name": profile.get("name", "Unknown"),
        "user_city": profile.get("city", "Unknown"),
        "user_risk": round(user_risk, 4),
        "location_risk": round(loc_risk, 4),
        "geo_distance_km": round(geo_dist, 2),
        "risk_tier": tier,
    }
