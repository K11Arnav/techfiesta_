from typing import List, Dict, Any


# =====================================================================
#  EXISTING FUNCTIONS (unchanged)
# =====================================================================

def get_decision_trace(xgb_score: float, iso_score: float, rule_score: float, rule_triggered: bool, override: bool = False) -> Dict[str, Any]:
    """
    Calculates which engine contributed most to the final decision using existing weights.
    Weights: 60% XGBoost, 20% Isolation Forest, 20% Rules.
    """
    weights = {
        "xgboost": 0.6,
        "anomaly": 0.2,
        "rules": 0.2
    }

    contributions = {
        "xgboost": float(xgb_score * weights["xgboost"]),
        "anomaly": float(iso_score * weights["anomaly"]),
        "rules": float(rule_score * weights["rules"])
    }

    # Determine the primary driver (highest weighted contribution)
    primary_driver = max(contributions, key=contributions.get)

    return {
        "engine": "ensemble",
        "primary_driver": primary_driver,
        "rule_triggered": rule_triggered,
        "override": override,
        "engine_contributions": contributions
    }

def get_enhanced_shap(shap_explanation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enhances existing SHAP output with direction, strength, and narrative.
    """
    enhanced = []
    for item in shap_explanation:
        impact = item.get("impact", 0.0)
        abs_impact = abs(impact)

        # Direction
        direction = "increased_risk" if impact > 0 else "reduced_risk"

        # Strength
        if abs_impact >= 0.5:
            strength = "strong"
        elif abs_impact >= 0.2:
            strength = "moderate"
        else:
            strength = "weak"

        # Narrative
        if direction == "increased_risk":
            if strength == "strong":
                narrative = "Primary statistical driver increasing fraud probability."
            else:
                narrative = "Feature contributed to elevated fraud likelihood."
        else:
            narrative = "Feature aligns with historical legitimate transaction patterns."

        enhanced.append({
            **item,
            "direction": direction,
            "strength": strength,
            "narrative": narrative
        })

    return enhanced


# =====================================================================
#  NEW INTERPRETIVE FUNCTIONS (additive, derived-only)
# =====================================================================

# Fraud classification thresholds (read from existing api.py decision logic)
FRAUD_THRESHOLD_BLOCK = 0.8
FRAUD_THRESHOLD_REVIEW = 0.6


def get_fraud_boundary(risk_score: float) -> Dict[str, Any]:
    """Fraud boundary context: distance to threshold and interpretation."""
    distance = risk_score - FRAUD_THRESHOLD_BLOCK
    if risk_score >= FRAUD_THRESHOLD_BLOCK:
        interpretation = "Fraud Confirmed"
    elif risk_score >= FRAUD_THRESHOLD_REVIEW:
        interpretation = "Near Fraud Threshold"
    elif risk_score >= (FRAUD_THRESHOLD_REVIEW - 0.15):
        interpretation = "Borderline Safe"
    else:
        interpretation = "Comfortably Safe"

    return {
        "distance_to_fraud": round(distance, 4),
        "interpretation": interpretation
    }


def get_risk_tier(risk_score: float) -> str:
    """Risk tier classification based on risk bands."""
    pct = risk_score * 100
    if pct >= 80:
        return "High Risk"
    elif pct >= 60:
        return "Elevated Risk"
    elif pct >= 30:
        return "Moderate Risk"
    else:
        return "Low Risk"


def get_confidence(risk_score: float) -> str:
    """Confidence indicator based on distance from fraud threshold."""
    distance = risk_score - FRAUD_THRESHOLD_BLOCK
    if distance >= 0:
        return "High Confidence Fraud"
    elif distance >= -0.1:
        return "Low Confidence"
    elif distance >= -0.3:
        return "Moderate Confidence"
    else:
        return "High Confidence Safe"


def get_rule_conflict_note(rule_triggered: bool, decision: str) -> str:
    """Clarification when rules triggered but decision is safe."""
    if rule_triggered and decision == "ALLOW":
        return (
            "Rule threshold was exceeded, however weighted ensemble "
            "contribution did not cross fraud classification boundary."
        )
    return ""


def get_shap_aggregation(shap_explanation: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate SHAP impacts without recalculating."""
    total_positive = sum(item.get("impact", 0.0) for item in shap_explanation if item.get("impact", 0.0) > 0)
    total_negative = sum(item.get("impact", 0.0) for item in shap_explanation if item.get("impact", 0.0) < 0)
    net = total_positive + total_negative

    if net > 0:
        summary = "Majority of feature contributions increased fraud probability."
    else:
        summary = "Majority of feature contributions reduced fraud probability."

    return {
        "total_positive_impact": round(total_positive, 4),
        "total_negative_impact": round(total_negative, 4),
        "net_shap_direction": "positive" if net > 0 else "negative",
        "summary": summary
    }


def get_engine_influence_pct(engine_contributions: Dict[str, float]) -> Dict[str, float]:
    """Engine weight transparency — percentage breakdown of contributions."""
    total = sum(abs(v) for v in engine_contributions.values())
    if total == 0:
        return {k: 0.0 for k in engine_contributions}
    return {k: round((abs(v) / total) * 100, 1) for k, v in engine_contributions.items()}


def get_executive_summary(
    risk_tier: str,
    fraud_boundary: Dict[str, Any],
    primary_driver: str,
    rule_triggered: bool,
    shap_aggregation: Dict[str, Any],
    confidence_level: str,
    decision: str
) -> str:
    """Generate 2-3 sentence forensic risk narrative from existing metadata."""
    parts = []

    # Sentence 1: Risk tier + primary driver
    driver_labels = {"xgboost": "statistical model analysis", "anomaly": "anomaly detection", "rules": "rule-based evaluation"}
    driver_label = driver_labels.get(primary_driver, primary_driver)
    parts.append(f"Transaction classified as {risk_tier}, primarily driven by {driver_label}.")

    # Sentence 2: Threshold context + SHAP direction
    boundary_interp = fraud_boundary.get("interpretation", "")
    shap_dir = shap_aggregation.get("net_shap_direction", "negative")

    if rule_triggered and decision == "ALLOW":
        parts.append(
            f"Rule-based anomaly detected; however, "
            f"{'statistical feature contributions strongly aligned with legitimate transaction patterns' if shap_dir == 'negative' else 'statistical feature contributions elevated fraud indicators'}. "
            f"Final ensemble score remained below fraud threshold with {confidence_level.lower().replace('confidence ', '')} confidence."
        )
    elif decision in ("BLOCK", "REVIEW"):
        parts.append(
            f"Ensemble score crossed the fraud classification boundary ({boundary_interp.lower()}). "
            f"{'Feature analysis confirms elevated fraud indicators.' if shap_dir == 'positive' else 'Feature analysis shows mixed signals; manual review recommended.'}"
        )
    else:
        parts.append(
            f"Score is {boundary_interp.lower()} relative to the fraud threshold. "
            f"{'Feature contributions lean towards legitimate patterns.' if shap_dir == 'negative' else 'Some features elevated fraud likelihood, but insufficient to trigger classification.'}"
        )

    # Sentence 3: Final disposition
    disposition_map = {"BLOCK": "Transaction blocked.", "REVIEW": "Transaction flagged for manual review.", "ALLOW": "Transaction cleared."}
    parts.append(disposition_map.get(decision, ""))

    return " ".join(parts)


# =====================================================================
#  MASTER BUILDER (updated)
# =====================================================================

def build_explainability_v2(
    xgb_score: float,
    iso_score: float,
    rule_score: float,
    rule_triggered: bool,
    shap_explanation: List[Dict[str, Any]],
    risk_score: float,
    decision: str,
    override: bool = False
) -> Dict[str, Any]:
    """
    Master builder function for Explainability v2.
    Combines decision trace, enhanced SHAP, and all interpretive layers.
    """
    # Existing layers
    trace = get_decision_trace(xgb_score, iso_score, rule_score, rule_triggered, override)
    shap_enhanced = get_enhanced_shap(shap_explanation)

    # New interpretive layers
    fraud_boundary = get_fraud_boundary(risk_score)
    risk_tier = get_risk_tier(risk_score)
    confidence_level = get_confidence(risk_score)
    rule_conflict = get_rule_conflict_note(rule_triggered, decision)
    shap_agg = get_shap_aggregation(shap_explanation)
    engine_pct = get_engine_influence_pct(trace["engine_contributions"])
    exec_summary = get_executive_summary(
        risk_tier=risk_tier,
        fraud_boundary=fraud_boundary,
        primary_driver=trace["primary_driver"],
        rule_triggered=rule_triggered,
        shap_aggregation=shap_agg,
        confidence_level=confidence_level,
        decision=decision
    )

    result = {
        "decision_trace": trace,
        "shap_analysis": shap_enhanced,
        "fraud_boundary": fraud_boundary,
        "risk_tier": risk_tier,
        "confidence_level": confidence_level,
        "shap_aggregation": shap_agg,
        "engine_influence_pct": engine_pct,
        "executive_summary": exec_summary
    }

    if rule_conflict:
        result["rule_conflict_note"] = rule_conflict

    return result
