from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
import csv
import io
from pydantic import BaseModel
from typing import List, Any
import pandas as pd
import numpy as np
import json
from dotenv import load_dotenv
import os
import joblib

load_dotenv()

import psycopg2
import psycopg2.extras

 
def execute_query(query, params=None):
    """Establishes a new DB connection for each query to prevent InterfaceError."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            return cur.fetchall() if cur.description else None
    finally:
        conn.close()





import financial_transaction_fraud_detection as ml_pipeline
from fraud_rules import RuleEngine
from explainability_v2 import build_explainability_v2
from email_notifier import EmailNotifier
import user_risk
import auth as auth_module

MODEL_PATH = "model.pkl"
SCALER_PATH = "scaler.pkl"
EXPLAINER_PATH = "explainer.pkl"



ISO_MODEL_PATH = "iso_forest_model.pkl"
ISO_SCALER_PATH = "iso_scaler.pkl"
ISO_META_PATH = "iso_metadata.pkl"
GRAPH_MODEL_PATH = "graph_model.pkl"
GRAPH_REF_PATH = "graph_reference.pkl"

RULE_ENGINE = RuleEngine()



def load_or_train_artifacts():
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        explainer = joblib.load(EXPLAINER_PATH)

        iso_model = joblib.load(ISO_MODEL_PATH)
        iso_scaler = joblib.load(ISO_SCALER_PATH)
        iso_meta = joblib.load(ISO_META_PATH)

        graph_model = joblib.load(GRAPH_MODEL_PATH)
        graph_ref = joblib.load(GRAPH_REF_PATH)

        print("Loaded existing model artifacts.")
        return model, scaler, explainer, iso_model, iso_scaler, iso_meta, graph_model, graph_ref

    except FileNotFoundError:
        print("Artifacts not found; training pipeline will run.")
        model, scaler, explainer, _, iso_components, graph_components = ml_pipeline.run_full_ml_pipeline()

        joblib.dump(model, MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        joblib.dump(explainer, EXPLAINER_PATH)

        joblib.dump(iso_components["model"], ISO_MODEL_PATH)
        joblib.dump(iso_components["scaler"], ISO_SCALER_PATH)
        joblib.dump({
            "score_min": iso_components["score_min"],
            "score_max": iso_components["score_max"],
        }, ISO_META_PATH)

        joblib.dump(graph_components["model"], GRAPH_MODEL_PATH)
        joblib.dump(graph_components["reference_data"], GRAPH_REF_PATH)

        return (
            model,
            scaler,
            explainer,
            iso_components["model"],
            iso_components["scaler"],
            {
                "score_min": iso_components["score_min"],
                "score_max": iso_components["score_max"],
            },
            graph_components["model"],
            graph_components["reference_data"]
        )



MODEL, SCALER, EXPLAINER, ISO_MODEL, ISO_SCALER, ISO_META, GRAPH_MODEL, GRAPH_REF = load_or_train_artifacts()

# --- LRU CACHING FOR ML RESULTS ---
from functools import lru_cache

FEATURE_COLS = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']

# SAFE: only for debugging hit/miss
_cache_seen_keys = set() 

def get_feature_key(data: dict) -> str:
    """Creates a stable JSON string for LRU cache key."""
    try:
        filtered = {k: float(data[k]) for k in FEATURE_COLS}
        return json.dumps(filtered, sort_keys=True)
    except (KeyError, ValueError, TypeError):
        return None

@lru_cache(maxsize=200)
def _get_ml_results_cached(feature_key: str):
    """Heavy ML + SHAP computation, cached by JSON feature set."""
    print("🔥 CACHE MISS → running ML + SHAP")
    # Reconstruct dict from JSON key
    feature_dict = json.loads(feature_key)
    df = pd.DataFrame([feature_dict])
    df = df[FEATURE_COLS] # Fix order mismatch for XGBoost/SHAP

    
    components = {
        "xgb": {"model": MODEL, "scaler": SCALER},
        "iso": {"model": ISO_MODEL, "scaler": ISO_SCALER, "score_min": ISO_META["score_min"], "score_max": ISO_META["score_max"]},
        "graph": {"model": GRAPH_MODEL, "reference_data": GRAPH_REF},
        "reputation": {},
        "rules": {}
    }

    # 1. Primary ML Scoring
    ml_results = ml_pipeline.compute_risk_score(
        transaction_df=df,
        components=components,
        weights={"xgb": 0.8, "iso": 0.1, "graph": 0.1}
    )

    # 2. SHAP Explanation
    explanation = ml_pipeline.shap_explain_transaction(
        model=MODEL,
        scaler=SCALER,
        explainer=EXPLAINER,
        transaction_df=df,
        top_k=5
    )
    
    return ml_results, explanation




from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class Transaction(BaseModel):
    Time: float
    Amount: float
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    # --- User Profiling (optional, backwards-compatible) ---
    user_id: str = "user_demo"
    latitude: float | None = None
    longitude: float | None = None




def get_user_last_txn_time(user_id):
    """Fetches the timestamp of the last transaction for the user."""
    res = execute_query("""
        SELECT timestamp FROM fraud.transactions_raw
        WHERE user_id = %s
        ORDER BY timestamp DESC
        LIMIT 1
    """, (user_id,))
    
    if res and res[0]['timestamp']:
        return res[0]['timestamp'].timestamp() 
    return None


# ── RUNTIME USER GEO STATE (in-memory, never persisted) ──────────────────────
import numpy as np

_user_geo_state: dict = {}
_user_ids = ["user_1", "user_2", "user_3", "user_4"]
_user_counter = 0

def _init_user(user_id: str):
    """Initialize user with a random starting position (Pune area)."""
    if user_id not in _user_geo_state:
        _user_geo_state[user_id] = {
            "lat": float(np.random.uniform(18.4, 18.7)),
            "lon": float(np.random.uniform(73.7, 74.0)),
        }

def _cycle_user_id() -> str:
    """Rotate through fixed user IDs."""
    global _user_counter
    uid = _user_ids[_user_counter % len(_user_ids)]
    _user_counter += 1
    return uid

def _generate_runtime_location(user_id: str) -> tuple:
    """
    Generate runtime location for a user.
    Returns (prev_lat, prev_lon, new_lat, new_lon).
    Early-bias: ~15% anomaly rate for first 10 txns, decays to ~5%.
    Anomaly jump: 8-12 degrees (~900-1300 km) — guaranteed to cross 800km threshold.
    """
    _init_user(user_id)
    prev = _user_geo_state[user_id]

    # Smooth early bias (higher anomaly rate at start for demo impact)
    progress = min(_user_counter / 10.0, 1.0)
    anomaly_prob = 0.15 * (1 - progress) + 0.05

    if np.random.rand() < anomaly_prob:
        # BIG jump (guaranteed anomaly)
        delta_lat = float(np.random.uniform(8.0, 12.0))
        delta_lon = float(np.random.uniform(8.0, 12.0))
    else:
        # Normal: tiny Gaussian drift
        delta_lat = float(np.random.normal(0, 0.002))
        delta_lon = float(np.random.normal(0, 0.002))

    new_lat = prev["lat"] + delta_lat
    new_lon = prev["lon"] + delta_lon

    _user_geo_state[user_id] = {
        "lat": new_lat,
        "lon": new_lon,
    }
    return prev["lat"], prev["lon"], new_lat, new_lon

def compute_geo_anomaly(prev_lat, prev_lon, curr_lat, curr_lon) -> dict:
    """Rule-based impossible travel check. Threshold: 800 km."""
    dist = float(np.sqrt((curr_lat - prev_lat)**2 + (curr_lon - prev_lon)**2))
    km = dist * 111  # approximate degrees-to-km
    return {
        "distance_km": round(km, 2),
        "is_impossible": km > 800,
    }

def _derive_region(lat: float, _lon: float) -> str:
    """Lightweight region label."""
    if lat > 45: return "Northern Europe / Asia"
    if lat > 20: return "North Region"
    if lat > -20: return "Equatorial Region"
    if lat > -45: return "South Region"
    return "Southern Hemisphere"

def _compute_direction(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Compass direction of travel from (lat1,lon1) to (lat2,lon2)."""
    import math
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    angle = math.degrees(math.atan2(dlon, dlat))
    if -22.5 <= angle < 22.5:
        return "North"
    elif 22.5 <= angle < 67.5:
        return "North-East"
    elif 67.5 <= angle < 112.5:
        return "East"
    elif 112.5 <= angle < 157.5:
        return "South-East"
    elif angle >= 157.5 or angle < -157.5:
        return "South"
    elif -157.5 <= angle < -112.5:
        return "South-West"
    elif -112.5 <= angle < -67.5:
        return "West"
    else:
        return "North-West"
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/score_transaction")
def score_transaction(transaction: Transaction, background_tasks: BackgroundTasks):
    try:
       
        data = transaction.model_dump()

        # ===== STRICT SEPARATION: ML FEATURES vs USER CONTEXT =====
        # Extract user context FIRST — these NEVER touch ML models
        data.pop("user_id", None)
        data.pop("latitude", None)
        data.pop("longitude", None)

        # ── Runtime enrichment: cycle user + generate location ──
        txn_user_id = _cycle_user_id()
        prev_lat, prev_lon, txn_lat, txn_lon = _generate_runtime_location(txn_user_id)

        # Rule-based geo anomaly detection
        geo = compute_geo_anomaly(prev_lat, prev_lon, txn_lat, txn_lon)
        rule_flags = []
        if geo["is_impossible"]:
            rule_flags.append("IMPOSSIBLE_TRAVEL")
        direction = _compute_direction(prev_lat, prev_lon, txn_lat, txn_lon)
        # ───────────────────────────────────────────────────────────────────

        # ML DataFrame — only V1-V28, Amount, Time (LOCKED)
        df = pd.DataFrame([data])
        cols = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']
        df = df[cols]
        # =============================================================

        # Components passed to compute_risk_score
        components = {
            "xgb": {"model": MODEL, "scaler": SCALER},
            "iso": {"model": ISO_MODEL , "scaler": ISO_SCALER, "score_min" : ISO_META["score_min"]
            , "score_max": ISO_META["score_max"]},
            "graph": {"model": GRAPH_MODEL, "reference_data": GRAPH_REF},
            "reputation": {},
            "rules": {}
        }

        # Compute unified risk score
        
        # 1. Get history for Rules
        last_txn_time = get_user_last_txn_time(txn_user_id)

        # 2. Evaluate Rules (Dynamic - UNCACHED)
        rule_score, rule_details = RULE_ENGINE.evaluate(data, last_txn_time)

        # 3. ML Models (Cached Computation)
        import time
        start_ml = time.time()
        
        feature_key = get_feature_key(data)
        if feature_key:
            if feature_key in _cache_seen_keys:
                print(f"⚡ CACHE HIT | Key: {feature_key[:30]}...")
            else:
                print(f"❌ CACHE MISS (first time) | Key: {feature_key[:30]}...")
                _cache_seen_keys.add(feature_key)
            
            ml_results, explanation = _get_ml_results_cached(feature_key)
            print(f"📦 Cache size: {len(_cache_seen_keys)} / 200")
        else:
            print("⚠️ CACHE BYPASSED (invalid key)")
            # Fallback if key generation fails (e.g. missing fields)
            df = pd.DataFrame([data])
            df = df[['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']]
            components = {
                "xgb": {"model": MODEL, "scaler": SCALER},
                "iso": {"model": ISO_MODEL, "scaler": ISO_SCALER, "score_min": ISO_META["score_min"], "score_max": ISO_META["score_max"]},
                "graph": {"model": GRAPH_MODEL, "reference_data": GRAPH_REF},
                "reputation": {},
                "rules": {}
            }
            ml_results = ml_pipeline.compute_risk_score(
                transaction_df=df,
                components=components,
                weights={"xgb": 0.8, "iso": 0.1, "graph": 0.1}
            )
            explanation = ml_pipeline.shap_explain_transaction(
                model=MODEL,
                scaler=SCALER,
                explainer=EXPLAINER,
                transaction_df=df,
                top_k=5
            )

        xgb_score = float(ml_results["xgb"])
        iso_score = float(ml_results["iso"])
        graph_score = float(ml_results["graph"])
        neighbors = ml_results["neighbors"]

        end_ml = time.time()
        print(f"⏱ ML compute time: {end_ml - start_ml:.4f}s")

        # 4. Combine ML + Rules (UNCHANGED)
        final_risk = (
            0.5 * ml_results["final"] +
            0.5 * rule_score
        )

        # Clip to [0, 1]
        risk_score = min(max(final_risk, 0.0), 1.0)
        base_score = risk_score  # preserve original ML+Rules score

        # ----- USER PROFILING + LOCATION INTELLIGENCE (SEPARATE CONTEXT LAYER - UNCACHED) -----
        user_data = user_risk.get_user_risk(
            user_id=txn_user_id,
            amount=data["Amount"],
            latitude=txn_lat,
            longitude=txn_lon,
        )

        # Blend: 75% ML base + 25% behavioral user risk
        risk_score = base_score * 0.75 + user_data["user_risk"] * 0.25
        risk_score = min(max(risk_score, 0.0), 1.0)
        # ----- END USER PROFILING -----

        # Generate transaction ID
        from uuid import uuid4
        txn_id = f"txn_{uuid4().hex}"

        # Insert into raw table
        execute_query("""
            INSERT INTO fraud.transactions_raw
            (txn_id, user_id, device_id, ip, amount, timestamp, raw_payload)
            VALUES (%s, %s, %s, %s, %s, NOW(), %s)
        """, (
            txn_id,
            txn_user_id,
            "device_demo",
            "127.0.0.1",
            data["Amount"],
            json.dumps(data)
        ))

        # Insert ML scores
        execute_query("""
            INSERT INTO fraud.ml_scores
            (txn_id, xgb_score, iso_score, graph_score, combined_risk)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            txn_id,
            xgb_score,
            iso_score,
            graph_score,
            risk_score
        ))

        # Decision logic
        if risk_score > 0.8:
            decision = "BLOCK"
        elif risk_score > 0.6:
            decision = "REVIEW"
        else:
            decision = "ALLOW"

        # Insert decision
        execute_query("""
            INSERT INTO fraud.decisions
            (txn_id, final_risk, decision, reason)
            VALUES (%s, %s, %s, %s)
        """, (
            txn_id,
            risk_score,
            decision,
            "XGBoost-based scoring + User Profiling"
        ))

        # Email Notification (Background Task)
        if decision in ["BLOCK", "REVIEW"]:
            background_tasks.add_task(EmailNotifier.send_fraud_alert, txn_id, risk_score, decision)

        # Explainability v2 (Observation Layer)
        rule_triggered = any(v == 1 for v in rule_details.values()) if rule_details else False
        explainability_v2 = build_explainability_v2(
            xgb_score=xgb_score,
            iso_score=iso_score,
            rule_score=rule_score,
            rule_triggered=rule_triggered,
            shap_explanation=explanation,
            risk_score=risk_score,
            decision=decision,
            override=False
        )

        return {
            "txn_id": txn_id,
            "risk_score": risk_score,
            "base_score": base_score,
            "user_id": txn_user_id,
            "user_risk": user_data["user_risk"],
            "location_risk": user_data["location_risk"],
            "geo_distance_km": user_data["geo_distance_km"],
            "risk_tier": user_data["risk_tier"],
            "txn_lat": txn_lat,
            "txn_lon": txn_lon,
            "prev_lat": prev_lat,
            "prev_lon": prev_lon,
            "direction": direction,
            "geo": geo,
            "rule_flags": rule_flags,
            "decision": decision,
            "explanation": explanation,
            "rule_details": rule_details,
            "scores": {
                "xgb": xgb_score,
                "iso": iso_score,
                "graph": graph_score
            },
            "neighbors": neighbors,
            "explainability_v2": explainability_v2
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



# --------------------------------------
# AUTHENTICATION
# --------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
def login(req: LoginRequest):
    """Authenticate user and return JWT + role."""
    rows = execute_query(
        "SELECT id, email, password_hash, role FROM fraud.users WHERE email = %s",
        (req.email,),
    )
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = rows[0]
    if req.password != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = auth_module.create_token(user["id"], user["role"])
    return {"access_token": token, "role": user["role"]}

@app.get("/me")
def get_me(user: dict = Depends(auth_module.get_current_user)):
    """Return current authenticated user info."""
    return {"user_id": user["user_id"], "role": user["role"]}


@app.get("/transactions")
def get_transactions(user: dict = Depends(auth_module.get_current_user)):
    data = execute_query("""
        SELECT * FROM fraud.transactions_raw
        ORDER BY timestamp DESC
    """)
    if not data:
        # Fallback to test data for visual demo if DB is empty
        try:
            with open("src/data/test_transactions.json", "r") as f:
                raw_test = json.load(f)
                # Ensure domain is flattened to top level for RBAC check
                data = [
                    {
                        "txn_id": f"mock_{i}", 
                        "amount": x["Amount"], 
                        "timestamp": "2024-01-01", 
                        "transaction_domain": x.get("transaction_domain", "retail"),
                        "raw_payload": x
                    } 
                    for i, x in enumerate(raw_test[:100])
                ]
        except Exception as e:
            print(f"Fallback error: {e}")
            data = []

    # RBAC: filter by allowed domains (admin sees all)
    allowed = auth_module.get_allowed_domains(user["role"])
    if user["role"] != "admin" and data:
        data = [r for r in data if r.get("transaction_domain") in allowed]
    return data

@app.get("/decisions")
def get_decisions(user: dict = Depends(auth_module.get_current_user)):
    data = execute_query("""
        SELECT * FROM fraud.decisions
        ORDER BY decision_time DESC
    """)
    if not data:
        # Fallback to test data for visual demo if DB is empty
        try:
            with open("src/data/test_transactions.json", "r") as f:
                raw_test = json.load(f)
                # Map mock decisions and include domain for filtering
                data = [
                    {
                        "txn_id": f"mock_{i}", 
                        "final_risk": 0.1 + (i % 10) * 0.1, 
                        "decision": "ALLOW" if (i % 10) < 8 else "BLOCK", 
                        "transaction_domain": raw_test[i % len(raw_test)].get("transaction_domain", "retail"),
                        "decision_time": "2024-01-01"
                    } 
                    for i in range(100)
                ]
        except:
            data = []

    # RBAC: filter by allowed domains (admin sees all)
    allowed = auth_module.get_allowed_domains(user["role"])
    if user["role"] != "admin" and data:
        data = [r for r in data if r.get("transaction_domain") in allowed]
    return data

@app.get("/transaction_details/{txn_id}")
def get_transaction_details(txn_id: str):
    res = execute_query("""
        SELECT d.*, m.xgb_score, m.iso_score, m.graph_score 
        FROM fraud.decisions d
        JOIN fraud.ml_scores m ON d.txn_id = m.txn_id
        WHERE d.txn_id = %s
    """, (txn_id,))
    
    if not res:
        if txn_id.startswith("mock_"):
            # Return plausible mock details for demo
            try:
                idx = int(txn_id.split("_")[1])
                risk = 0.1 + (idx % 10) * 0.1
                return {
                    "txn_id": txn_id,
                    "final_risk": risk,
                    "decision": "ALLOW" if (idx % 10) < 8 else "BLOCK",
                    "reason": "Simulated behavior based on feature-space similarity",
                    "xgb_score": risk * 0.85,
                    "iso_score": risk * 0.78,
                    "graph_score": risk * 0.92,
                    "decision_time": "2024-01-01"
                }
            except:
                pass
        raise HTTPException(status_code=404, detail="Transaction not found")
    return res[0]


# --------------------------------------
# ADMIN / RULE MANAGEMENT
# --------------------------------------
@app.get("/suggestions")
def get_suggestions():
    try:
        if not os.path.exists("suggestions.json"):
            return []
        with open("suggestions.json", "r") as f:
            return json.load(f)
    except Exception as e:
        return []

class ApprovedSuggestion(BaseModel):
    target_rule: str
    parameter: str
    proposed_value: Any

@app.post("/apply_rules")
def apply_rules(approved_list: List[ApprovedSuggestion], user: dict = Depends(auth_module.get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        # 1. Load current rules
        with open("fraud_rules.json", "r") as f:
            rules = json.load(f)
        
        # 2. Apply updates
        changes_applied = 0
        for item in approved_list:
            if item.target_rule in rules:
                if item.parameter in rules[item.target_rule]:
                    rules[item.target_rule][item.parameter] = item.proposed_value
                    changes_applied += 1
        
        # 3. Save back to file
        with open("fraud_rules.json", "w") as f:
            json.dump(rules, f, indent=2)
            
        # 4. Reload Engine
        RULE_ENGINE.reload_config()
        
        # 5. Clear suggestions (assuming recognized API workflow: approve -> clear)
        # Or we could only remove applied ones, but clearing all for a clean slate is safer for this demo.
        with open("suggestions.json", "w") as f:
            json.dump([], f)
            
        return {"status": "success", "message": f"Applied {changes_applied} rule changes and reloaded engine."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------
# RUN OPTIMIZER
# --------------------------------------
from optimize_rules import run_optimization

@app.post("/run_optimizer")
def run_optimizer(user: dict = Depends(auth_module.get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    run_optimization()
    return {"status": "success"}



# --------------------------------------
# DEMO: IMPOSSIBLE TRAVEL DETECTION
# --------------------------------------
import time as _time

class LocationFraudRequest(BaseModel):
    amount: float = 500.0
    user_id: str = "user_mumbai"
    lat1: float = 19.076
    lon1: float = 72.877
    lat2: float = 51.507
    lon2: float = -0.127
    time_gap_seconds: float = 3.0   # configurable time between transactions

@app.post("/demo/location_fraud")
def demo_location_fraud(req: LocationFraudRequest):
    """
    Demonstrates impossible travel detection with configurable time gap.
    No actual sleeping — timestamps are simulated instantly.
    """
    now = _time.time()
    gap = max(req.time_gap_seconds, 0.001)  # avoid div/0

    # --- Transaction 1: set location at (now - gap) ---
    user_risk.set_last_location(req.user_id, req.lat1, req.lon1, now - gap)

    txn1_result = user_risk.get_user_risk(
        user_id=req.user_id,
        amount=req.amount,
        latitude=req.lat1,
        longitude=req.lon1,
    )
    # Restore the timestamp to the simulated past time (get_user_risk overwrites it)
    user_risk.set_last_location(req.user_id, req.lat1, req.lon1, now - gap)

    # --- Transaction 2: at current time ---
    txn2_result = user_risk.get_user_risk(
        user_id=req.user_id,
        amount=req.amount,
        latitude=req.lat2,
        longitude=req.lon2,
    )

    # --- Travel Analysis ---
    distance_km = user_risk.haversine_km(req.lat1, req.lon1, req.lat2, req.lon2)
    time_hours = gap / 3600.0
    implied_speed_kmh = distance_km / time_hours if time_hours > 0 else float('inf')

    # Transport feasibility
    transport_modes = [
        {"mode": "car",   "emoji": "🚗", "label": "Car (~120 km/h)",           "max_speed": 120,  "feasible": implied_speed_kmh <= 120},
        {"mode": "train", "emoji": "🚄", "label": "High-Speed Rail (~300 km/h)", "max_speed": 300, "feasible": implied_speed_kmh <= 300},
        {"mode": "plane", "emoji": "✈️",  "label": "Commercial Flight (~900 km/h)", "max_speed": 900, "feasible": implied_speed_kmh <= 900},
    ]

    if implied_speed_kmh > 900:
        verdict = "IMPOSSIBLE"
    elif implied_speed_kmh > 300:
        verdict = "SUSPICIOUS"
    elif implied_speed_kmh > 120:
        verdict = "UNLIKELY"
    else:
        verdict = "FEASIBLE"

    fraud_detected = txn2_result["location_risk"] >= 0.3

    return {
        "txn_1": {
            "location": {"lat": req.lat1, "lon": req.lon1},
            **txn1_result,
        },
        "txn_2": {
            "location": {"lat": req.lat2, "lon": req.lon2},
            **txn2_result,
        },
        "travel_analysis": {
            "distance_km": round(distance_km, 2),
            "time_gap_seconds": gap,
            "time_gap_display": _format_time(gap),
            "implied_speed_kmh": round(implied_speed_kmh, 1),
            "transport_modes": transport_modes,
            "verdict": verdict,
        },
        "fraud_detected": fraud_detected,
    }


def _format_time(seconds: float) -> str:
    """Human-readable time display."""
    if seconds < 60:
        return f"{seconds:.0f} seconds"
    elif seconds < 3600:
        return f"{seconds / 60:.1f} minutes"
    else:
        return f"{seconds / 3600:.1f} hours"


# --------------------------------------
# USER PROFILES ENDPOINT (for frontend)
# --------------------------------------
@app.get("/user_profiles")
def get_user_profiles():
    return user_risk.USER_PROFILES


# --------------------------------------
# EXPORT FRAUD CSV (with RBAC)
# --------------------------------------
@app.get("/export/fraud-csv")
def export_fraud_csv():
    try:
        query = """
        SELECT
            t.txn_id,
            t.user_id,
            t.amount,
            t.timestamp,
            d.final_risk,
            d.decision,
            t.raw_payload ->> 'transaction_domain' AS transaction_domain
        FROM fraud.transactions_raw t
        JOIN fraud.decisions d ON t.txn_id = d.txn_id
        WHERE d.decision IN ('BLOCK', 'REVIEW')
        ORDER BY t.timestamp DESC;
        """
        rows = execute_query(query)
        
        if not rows:
            # Create empty DF with columns if no data
            cols = ["txn_id", "user_id", "amount", "timestamp", "final_risk", "decision", "transaction_domain"]
            df = pd.DataFrame(columns=cols)
        else:
            df = pd.DataFrame(rows)

        stream = io.StringIO()
        df.to_csv(stream, index=False)
        
        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=fraud_report.csv"
            }
        )
    except Exception as e:
        print(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


# --------------------------------------
# RUN SERVER
# --------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
