from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import json
from dotenv import load_dotenv
import os
import joblib

load_dotenv()

import psycopg2
import psycopg2.extras

# --------------------------------------
# DATABASE CONNECTION
# --------------------------------------
conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
)

def execute_query(query, params=None):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, params)
        conn.commit()
        return cur.fetchall() if cur.description else None


# --------------------------------------
# IMPORT ML PIPELINE (for functions)
# --------------------------------------
import financial_transaction_fraud_detection as ml_pipeline

MODEL_PATH = "model.pkl"
SCALER_PATH = "scaler.pkl"
EXPLAINER_PATH = "explainer.pkl"


# --------------------------------------
# LOAD / TRAIN ARTIFACTS
# --------------------------------------
def load_or_train_artifacts():
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        explainer = joblib.load(EXPLAINER_PATH)
        print("Loaded existing model artifacts.")
        return model, scaler, explainer

    except FileNotFoundError:
        print("Artifacts not found; training pipeline will run.")
        model, scaler, explainer, _ = ml_pipeline.run_full_ml_pipeline()
        joblib.dump(model, MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        joblib.dump(explainer, EXPLAINER_PATH)
        print("Training complete and artifacts saved.")
        return model, scaler, explainer


MODEL, SCALER, EXPLAINER = load_or_train_artifacts()


# --------------------------------------
# FASTAPI + CORS
# --------------------------------------
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------
# INPUT MODEL — ALL FEATURES
# --------------------------------------
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


# --------------------------------------
# SCORE TRANSACTION
# --------------------------------------
@app.post("/score_transaction")
def score_transaction(transaction: Transaction):
    try:
        # Convert input → DataFrame
        data = transaction.model_dump()
        df = pd.DataFrame([data])

        # Enforce correct column order
        cols = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']
        df = df[cols]

        # Components passed to compute_risk_score
        components = {
            "xgb": {"model": MODEL, "scaler": SCALER},
            "iso": {},
            "graph": {},
            "reputation": {},
            "rules": {}
        }

        # Compute unified risk score
        risk_score = float(
            ml_pipeline.compute_risk_score(
                transaction_df=df,
                components=components
            )
        )

        # SHAP explanation
        explanation = ml_pipeline.shap_explain_transaction(
            model=MODEL,
            scaler=SCALER,
            explainer=EXPLAINER,
            transaction_df=df,
            top_k=5
        )

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
            "user_demo",
            "device_demo",
            "127.0.0.1",
            data["Amount"],
            json.dumps(data)
        ))

        # Insert ML scores
        execute_query("""
            INSERT INTO fraud.ml_scores
            (txn_id, xgb_score, iso_score, combined_risk)
            VALUES (%s, %s, %s, %s)
        """, (
            txn_id,
            risk_score,
            None,
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
            "XGBoost-based scoring"
        ))

        return {
            "txn_id": txn_id,
            "risk_score": risk_score,
            "decision": decision,
            "explanation": explanation
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------
# DB VIEW ENDPOINTS
# --------------------------------------
@app.get("/transactions")
def get_transactions():
    return execute_query("""
        SELECT * FROM fraud.transactions_raw
        ORDER BY timestamp DESC
    """)

@app.get("/decisions")
def get_decisions():
    return execute_query("""
        SELECT * FROM fraud.decisions
        ORDER BY decision_time DESC
    """)


# --------------------------------------
# RUN SERVER
# --------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
