from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np

# Import EVERYTHING from the ML script
# This will execute the training pipeline on import!
import financial_transaction_fraud_detection as ml_pipeline
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

@app.post("/score_transaction")
def score_transaction(transaction: Transaction):
    try:
        # 1. Convert incoming JSON -> pd.DataFrame (single row)
        # We must maintain the exact column order expected by the model
        data = transaction.model_dump()
        df = pd.DataFrame([data])
        
        # Ensure column order matches training data (except 'Class')
        # The ML script defines X = df.drop('Class', axis=1)
        # We can inspect one of the scaled dataframes or just enforce the list locally.
        # However, since we imported the module, we can access the column names if needed.
        # But for now, standard V1-V28 + Time + Amount is the standard content.
        # The DataFrame created from dict might not preserve order if python < 3.7 (unlikely)
        # but let's be safe and reorder to standard Kaggle dataset order:
        # Time, V1...V28, Amount. 
        # Wait, let's check the ML script's X columns.
        # In the script: X_train, X_test...
        # Let's trust the dataframe creation or reorder explicitly.
        
        cols = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']
        df = df[cols]

        # 2. Call compute_risk_score
        # The function signature is: compute_risk_score(transaction_df, components, weights=None)
        # We need to construct 'components' dict
        
        components = {
            "xgb": {
                "model": ml_pipeline.model,
                "scaler": ml_pipeline.scaler
            }
        }
        
        risk_score = ml_pipeline.compute_risk_score(
            transaction_df=df,
            components=components
        )

        # 3. Call shap_explain_transaction
        # Signature: shap_explain_transaction(model, scaler, explainer, transaction_df, top_k=5)
        
        explanation = ml_pipeline.shap_explain_transaction(
            model=ml_pipeline.model,
            scaler=ml_pipeline.scaler,
            explainer=ml_pipeline.explainer,
            transaction_df=df,
            top_k=5
        )

        # 4. Return JSON response
        return {
            "risk_score": float(risk_score),
            "explanation": explanation
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # The user can run this file directly
    uvicorn.run(app, host="0.0.0.0", port=8000)
