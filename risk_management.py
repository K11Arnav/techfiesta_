"""
risk_management.py — Bank-Grade Operational Risk Management Router
──────────────────────────────────────────────────────────────────
Self-contained FastAPI APIRouter for the Risk Management dashboard.
All data is derived from existing PostgreSQL fraud schema tables.

Endpoints:
    GET  /risk/kri-summary
    GET  /risk/appetite-status
    GET  /risk/exposure-trend
    GET  /risk/geographic-concentration
    POST /risk/stress-test
    GET  /risk/model-performance
"""

import json
import os
import math
import random
import numpy as np
from typing import Optional
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

load_dotenv()

# ── Router ────────────────────────────────────────────────────────────────────
risk_router = APIRouter(prefix="/risk", tags=["Risk Management"])

# ── DB Helper (self-contained, avoids importing api.py and triggering ML load) ─
def _execute_query(query, params=None):
    """Establishes a new DB connection for each query."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            return cur.fetchall() if cur.description else None
    finally:
        conn.close()


# ── Config ────────────────────────────────────────────────────────────────────
_APPETITE_PATH = os.path.join(os.path.dirname(__file__), "risk_appetite.json")
_PROFILES_PATH = os.path.join(os.path.dirname(__file__), "user_profiles.json")


def _load_appetite():
    if os.path.exists(_APPETITE_PATH):
        with open(_APPETITE_PATH, "r") as f:
            return json.load(f)
    return {}


def _load_profiles():
    if os.path.exists(_PROFILES_PATH):
        with open(_PROFILES_PATH, "r") as f:
            return json.load(f)
    return {}


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 1: KRI SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

def _compute_kri_summary() -> dict:
    """
    Core KRI computation. Extracted so stress-test can reuse it.
    All queries are scoped to today (CURRENT_DATE).
    FDR/FPR use proxy-based TP/FP/FN/TN logic since the Kaggle dataset
    has no post-decision ground truth.
    """
    appetite = _load_appetite()
    inr_rate = appetite.get("usd_to_inr_rate", 83)
    score_high = appetite.get("score_threshold_high", 0.7)
    score_low = appetite.get("score_threshold_low", 0.5)

    # 1. Gross Fraud Loss (GFL) — sum of amount for BLOCK decisions today × INR rate
    gfl_row = _execute_query("""
        SELECT COALESCE(SUM(t.amount), 0) AS gfl
        FROM fraud.transactions_raw t
        JOIN fraud.decisions d ON t.txn_id = d.txn_id
        WHERE d.decision = 'BLOCK'
          AND t.timestamp >= CURRENT_DATE
    """)
    gross_fraud_loss = float(gfl_row[0]["gfl"]) * inr_rate if gfl_row else 0.0

    # 2 & 3. FDR / FPR — Proxy-based TP/FP/FN/TN classification
    #   TP = BLOCK AND final_risk >= score_high
    #   FP = REVIEW AND final_risk < score_low
    #   FN = ALLOW AND final_risk >= score_high
    #   TN = ALLOW AND final_risk < score_low
    confusion_row = _execute_query("""
        SELECT
            COUNT(*) FILTER (WHERE d.decision = 'BLOCK'  AND d.final_risk >= %s) AS tp,
            COUNT(*) FILTER (WHERE d.decision = 'REVIEW' AND d.final_risk < %s)  AS fp,
            COUNT(*) FILTER (WHERE d.decision = 'ALLOW'  AND d.final_risk >= %s) AS fn,
            COUNT(*) FILTER (WHERE d.decision = 'ALLOW'  AND d.final_risk < %s)  AS tn
        FROM fraud.decisions d
        JOIN fraud.transactions_raw t ON d.txn_id = t.txn_id
        WHERE t.timestamp >= CURRENT_DATE
    """, (score_high, score_low, score_high, score_low))
    tp = int(confusion_row[0]["tp"]) if confusion_row else 0
    fp = int(confusion_row[0]["fp"]) if confusion_row else 0
    fn = int(confusion_row[0]["fn"]) if confusion_row else 0
    tn = int(confusion_row[0]["tn"]) if confusion_row else 0

    fdr = (tp / (tp + fn) * 100) if (tp + fn) > 0 else 0.0
    fpr = (fp / (fp + tn) * 100) if (fp + tn) > 0 else 0.0

    # 4. SAR Filing Latency — avg(decision_time - timestamp) in milliseconds
    latency_row = _execute_query("""
        SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (d.decision_time - t.timestamp)) * 1000),
            0
        ) AS avg_latency_ms
        FROM fraud.decisions d
        JOIN fraud.transactions_raw t ON d.txn_id = t.txn_id
        WHERE t.timestamp >= CURRENT_DATE
    """)
    avg_sar_latency_ms = float(latency_row[0]["avg_latency_ms"]) if latency_row else 0.0

    # 5. Operational Risk Exposure (ORE) — sum(amount × final_risk) × INR rate
    ore_row = _execute_query("""
        SELECT COALESCE(SUM(t.amount * d.final_risk), 0) AS ore
        FROM fraud.transactions_raw t
        JOIN fraud.decisions d ON t.txn_id = d.txn_id
        WHERE d.decision != 'ALLOW'
          AND t.timestamp >= CURRENT_DATE
    """)
    ore = float(ore_row[0]["ore"]) * inr_rate if ore_row else 0.0

    # 6. Transactions Screened Today
    screened_row = _execute_query("""
        SELECT COUNT(*) AS cnt
        FROM fraud.transactions_raw
        WHERE timestamp >= CURRENT_DATE
    """)
    screened = int(screened_row[0]["cnt"]) if screened_row else 0

    return {
        "gross_fraud_loss_inr": round(gross_fraud_loss, 2),
        "fraud_detection_rate": round(fdr, 2),
        "false_positive_rate": round(fpr, 2),
        "avg_sar_latency_ms": round(avg_sar_latency_ms, 2),
        "operational_risk_exposure": round(ore, 2),
        "transactions_screened_today": screened,
    }


@risk_router.get("/kri-summary")
def kri_summary():
    """Key Risk Indicators — Gross Fraud Loss, FDR, FPR, SAR Latency, ORE."""
    return _compute_kri_summary()


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 2: RISK APPETITE STATUS (RAG)
# ══════════════════════════════════════════════════════════════════════════════

def _compute_rag(kri_key: str, current_value: float, threshold: float) -> dict:
    """
    Compute RAG (Red-Amber-Green) status for a KRI.
    - For upper-bound KRIs (fraud loss, FPR, latency, ORE): breach = current > threshold
    - For lower-bound KRIs (FDR): breach = current < threshold
    AMBER zone = within 20% of threshold.
    """
    is_lower_bound = kri_key == "fraud_detection_rate_min"

    if is_lower_bound:
        breach = current_value < threshold
        amber_zone = current_value < threshold * 1.2  # within 20% above min
        if breach:
            status = "RED"
        elif amber_zone:
            status = "AMBER"
        else:
            status = "GREEN"
    else:
        breach = current_value > threshold
        amber_zone = current_value > threshold * 0.8  # within 20% of max
        if breach:
            status = "RED"
        elif amber_zone:
            status = "AMBER"
        else:
            status = "GREEN"

    return {
        "current_value": round(current_value, 2),
        "threshold": threshold,
        "status": status,
        "breach": breach,
    }


# Map from KRI summary keys → appetite config keys
_KRI_TO_APPETITE = {
    "gross_fraud_loss_inr": "gross_fraud_loss_inr",
    "false_positive_rate": "false_positive_rate",
    "fraud_detection_rate": "fraud_detection_rate_min",
    "avg_sar_latency_ms": "sar_latency_ms",
    "operational_risk_exposure": "operational_risk_exposure",
}

# Human-readable labels for KRIs
_KRI_LABELS = {
    "gross_fraud_loss_inr": "Gross Fraud Loss (GFL)",
    "false_positive_rate": "False Positive Rate (FPR)",
    "fraud_detection_rate": "Fraud Detection Rate (FDR)",
    "avg_sar_latency_ms": "SAR Filing Latency",
    "operational_risk_exposure": "Operational Risk Exposure (ORE)",
}


@risk_router.get("/appetite-status")
def appetite_status():
    """Risk Appetite Framework — Board Approved Thresholds vs Live KRIs."""
    kris = _compute_kri_summary()
    appetite = _load_appetite()

    results = []
    for kri_key, appetite_key in _KRI_TO_APPETITE.items():
        threshold = appetite.get(appetite_key, 0)
        current = kris.get(kri_key, 0)
        rag = _compute_rag(appetite_key, current, threshold)
        rag["kri_name"] = _KRI_LABELS.get(kri_key, kri_key)
        rag["kri_key"] = kri_key
        results.append(rag)

    return results


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 3: INTRADAY EXPOSURE TREND
# ══════════════════════════════════════════════════════════════════════════════

@risk_router.get("/exposure-trend")
def exposure_trend():
    """Intraday ORE Trend — Hourly Buckets for today."""
    appetite = _load_appetite()
    inr_rate = appetite.get("usd_to_inr_rate", 83)

    rows = _execute_query("""
        SELECT
            EXTRACT(HOUR FROM t.timestamp)::int AS hour,
            COALESCE(SUM(t.amount * d.final_risk), 0) AS ore_value,
            COUNT(*) AS transaction_count
        FROM fraud.transactions_raw t
        JOIN fraud.decisions d ON t.txn_id = d.txn_id
        WHERE d.decision != 'ALLOW'
          AND t.timestamp >= CURRENT_DATE
        GROUP BY EXTRACT(HOUR FROM t.timestamp)
        ORDER BY hour
    """)

    # Build full 24-hour timeline with zeros for empty hours
    hourly_data = {h: {"hour": h, "ore_value": 0.0, "transaction_count": 0} for h in range(24)}
    if rows:
        for row in rows:
            h = int(row["hour"])
            hourly_data[h] = {
                "hour": h,
                "ore_value": round(float(row["ore_value"]) * inr_rate, 2),
                "transaction_count": int(row["transaction_count"]),
            }

    return {
        "trend": list(hourly_data.values()),
        "ore_threshold": appetite.get("operational_risk_exposure", 1000000),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 4: GEOGRAPHIC CONCENTRATION RISK
# ══════════════════════════════════════════════════════════════════════════════

@risk_router.get("/geographic-concentration")
def geographic_concentration():
    """Geographic Concentration Risk — Fraud Loss by Region (BCBS 239)."""
    appetite = _load_appetite()
    inr_rate = appetite.get("usd_to_inr_rate", 83)

    rows = _execute_query("""
        SELECT
            t.user_id,
            SUM(t.amount) AS fraud_amount,
            COUNT(*) AS fraud_count
        FROM fraud.transactions_raw t
        JOIN fraud.decisions d ON t.txn_id = d.txn_id
        WHERE d.decision = 'BLOCK'
        GROUP BY t.user_id
        ORDER BY fraud_amount DESC
    """)

    profiles = _load_profiles()

    # Import city assignment data from user_risk for unknown users
    from user_risk import DEMO_CITIES, _user_city_cache, _DEMO_WEIGHTS

    # Map user_id → city, aggregate by city
    city_map: dict = {}
    if rows:
        for row in rows:
            uid = row["user_id"]
            profile = profiles.get(uid, {})
            city = profile.get("city", None)
            # For unknown users, check user_risk's cache or assign a new city
            if city is None:
                if uid in _user_city_cache:
                    city = _user_city_cache[uid]["city"]
                else:
                    chosen = random.choices(DEMO_CITIES, weights=_DEMO_WEIGHTS, k=1)[0]
                    _user_city_cache[uid] = chosen
                    city = chosen["city"]
            if city not in city_map:
                city_map[city] = {"region": city, "fraud_loss": 0.0, "transaction_count": 0}
            city_map[city]["fraud_loss"] += float(row["fraud_amount"]) * inr_rate
            city_map[city]["transaction_count"] += int(row["fraud_count"])

    # Sort by fraud_loss descending, top 10
    sorted_cities = sorted(city_map.values(), key=lambda x: x["fraud_loss"], reverse=True)[:10]

    # Add percentage of total
    total_loss = sum(c["fraud_loss"] for c in sorted_cities)
    for c in sorted_cities:
        c["fraud_loss"] = round(c["fraud_loss"], 2)
        c["percentage"] = round((c["fraud_loss"] / total_loss * 100) if total_loss > 0 else 0, 2)

    return sorted_cities


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 5: SCENARIO STRESS TEST
# ══════════════════════════════════════════════════════════════════════════════

class StressTestRequest(BaseModel):
    scenario: str  # "volume_spike" | "geo_anomaly" | "model_drift"
    multiplier: float = 2.0


@risk_router.post("/stress-test")
def stress_test(req: StressTestRequest):
    """
    Scenario Analysis — Stress Testing.
    Applies multiplier to relevant KRIs and recomputes RAG statuses.
    Read-only projection — no DB writes.
    """
    base_kris = _compute_kri_summary()
    appetite = _load_appetite()

    # Deep copy for projection
    projected = dict(base_kris)

    if req.scenario == "volume_spike":
        projected["transactions_screened_today"] = int(projected["transactions_screened_today"] * req.multiplier)
        projected["operational_risk_exposure"] = projected["operational_risk_exposure"] * req.multiplier
        projected["gross_fraud_loss_inr"] = projected["gross_fraud_loss_inr"] * req.multiplier
    elif req.scenario == "geo_anomaly":
        projected["gross_fraud_loss_inr"] = projected["gross_fraud_loss_inr"] * req.multiplier
        projected["operational_risk_exposure"] = projected["operational_risk_exposure"] * req.multiplier
        projected["false_positive_rate"] = min(projected["false_positive_rate"] * req.multiplier, 100.0)
    elif req.scenario == "model_drift":
        projected["fraud_detection_rate"] = max(projected["fraud_detection_rate"] / req.multiplier, 0.0)
        projected["false_positive_rate"] = min(projected["false_positive_rate"] * req.multiplier, 100.0)
        projected["avg_sar_latency_ms"] = projected["avg_sar_latency_ms"] * req.multiplier

    # Round projected values
    for k in projected:
        if isinstance(projected[k], float):
            projected[k] = round(projected[k], 2)

    # Compute projected RAG statuses
    projected_rag = []
    for kri_key, appetite_key in _KRI_TO_APPETITE.items():
        threshold = appetite.get(appetite_key, 0)
        current = projected.get(kri_key, 0)
        rag = _compute_rag(appetite_key, current, threshold)
        rag["kri_name"] = _KRI_LABELS.get(kri_key, kri_key)
        rag["kri_key"] = kri_key
        rag["base_value"] = base_kris.get(kri_key, 0)
        projected_rag.append(rag)

    return {
        "scenario": req.scenario,
        "multiplier": req.multiplier,
        "base_kris": base_kris,
        "projected_kris": projected,
        "projected_rag": projected_rag,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINT 6: MODEL RISK MANAGEMENT (MRM)
# ══════════════════════════════════════════════════════════════════════════════

def _compute_gini_ks(block_scores: list, allow_scores: list) -> dict:
    """
    Compute Gini Coefficient and KS Statistic from score distributions.
    Gini = 2 * AUC - 1 (model discrimination power).
    KS   = max separation between CDFs of fraud vs non-fraud scores.
    """
    if not block_scores or not allow_scores:
        return {"gini_coefficient": 0.0, "ks_statistic": 0.0}

    # Combine into labels + scores
    labels = [1] * len(block_scores) + [0] * len(allow_scores)
    scores = block_scores + allow_scores

    # Sort by score descending for AUC computation
    paired = sorted(zip(scores, labels), key=lambda x: -x[0])

    n_pos = sum(labels)
    n_neg = len(labels) - n_pos
    if n_pos == 0 or n_neg == 0:
        return {"gini_coefficient": 0.0, "ks_statistic": 0.0}

    # AUC via trapezoidal (Mann-Whitney U formulation)
    tp_cum = 0
    fp_cum = 0
    auc = 0.0
    for score, label in paired:
        if label == 1:
            tp_cum += 1
        else:
            fp_cum += 1
            auc += tp_cum  # each FP contributes the number of TPs above it

    auc = auc / (n_pos * n_neg) if (n_pos * n_neg) > 0 else 0.0
    gini = 2 * auc - 1

    # KS Statistic — max |CDF_fraud - CDF_legit|
    all_sorted = sorted(scores)
    ks_max = 0.0
    for threshold in all_sorted:
        tpr = sum(1 for s in block_scores if s >= threshold) / n_pos
        fpr_val = sum(1 for s in allow_scores if s >= threshold) / n_neg
        ks_max = max(ks_max, abs(tpr - fpr_val))

    return {
        "gini_coefficient": round(gini, 4),
        "ks_statistic": round(ks_max, 4),
    }


def _compute_psi(current_scores: list, reference_scores: list, bins: int = 10) -> float:
    """
    Population Stability Index — compares score distribution of current vs reference period.
    PSI < 0.1  → Stable
    PSI 0.1–0.25 → Moderate Shift
    PSI > 0.25 → Significant Drift
    """
    if not current_scores or not reference_scores:
        return 0.0

    # Create bin edges from combined data
    combined = current_scores + reference_scores
    min_val = min(combined)
    max_val = max(combined)
    if min_val == max_val:
        return 0.0

    bin_edges = np.linspace(min_val, max_val, bins + 1)

    # Compute histograms (proportions)
    curr_hist, _ = np.histogram(current_scores, bins=bin_edges)
    ref_hist, _ = np.histogram(reference_scores, bins=bin_edges)

    # Convert to proportions with epsilon to avoid log(0)
    eps = 1e-4
    curr_prop = (curr_hist + eps) / (sum(curr_hist) + eps * bins)
    ref_prop = (ref_hist + eps) / (sum(ref_hist) + eps * bins)

    # PSI = Σ (P_i - Q_i) * ln(P_i / Q_i)
    psi = float(np.sum((curr_prop - ref_prop) * np.log(curr_prop / ref_prop)))
    return round(psi, 4)


@risk_router.get("/model-performance")
def model_performance():
    """Model Risk Management (MRM) — SR 11-7 Compliance Metrics."""

    # Fetch BLOCK scores (fraud)
    block_rows = _execute_query("""
        SELECT m.combined_risk
        FROM fraud.ml_scores m
        JOIN fraud.decisions d ON m.txn_id = d.txn_id
        WHERE d.decision = 'BLOCK'
    """)
    block_scores = [float(r["combined_risk"]) for r in block_rows] if block_rows else []

    # Fetch ALLOW scores (legitimate)
    allow_rows = _execute_query("""
        SELECT m.combined_risk
        FROM fraud.ml_scores m
        JOIN fraud.decisions d ON m.txn_id = d.txn_id
        WHERE d.decision = 'ALLOW'
    """)
    allow_scores = [float(r["combined_risk"]) for r in allow_rows] if allow_rows else []

    # Gini + KS
    gini_ks = _compute_gini_ks(block_scores, allow_scores)

    # PSI — this week vs last week
    current_week_rows = _execute_query("""
        SELECT m.combined_risk
        FROM fraud.ml_scores m
        JOIN fraud.transactions_raw t ON m.txn_id = t.txn_id
        WHERE t.timestamp >= DATE_TRUNC('week', CURRENT_DATE)
    """)
    current_week_scores = [float(r["combined_risk"]) for r in current_week_rows] if current_week_rows else []

    last_week_rows = _execute_query("""
        SELECT m.combined_risk
        FROM fraud.ml_scores m
        JOIN fraud.transactions_raw t ON m.txn_id = t.txn_id
        WHERE t.timestamp >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
          AND t.timestamp < DATE_TRUNC('week', CURRENT_DATE)
    """)
    last_week_scores = [float(r["combined_risk"]) for r in last_week_rows] if last_week_rows else []

    psi = _compute_psi(current_week_scores, last_week_scores)

    # Average risk scores
    avg_fraud = round(np.mean(block_scores), 4) if block_scores else 0.0
    avg_legit = round(np.mean(allow_scores), 4) if allow_scores else 0.0

    # PSI interpretation
    if psi < 0.1:
        psi_status = "Stable"
    elif psi < 0.25:
        psi_status = "Moderate Shift"
    else:
        psi_status = "Significant Drift — Review Required"

    return {
        "gini_coefficient": gini_ks["gini_coefficient"],
        "ks_statistic": gini_ks["ks_statistic"],
        "psi": psi,
        "psi_status": psi_status,
        "avg_risk_score_fraud": float(avg_fraud),
        "avg_risk_score_legit": float(avg_legit),
        "sample_size_fraud": len(block_scores),
        "sample_size_legit": len(allow_scores),
    }
