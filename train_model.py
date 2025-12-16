import joblib
from financial_transaction_fraud_detection import run_full_ml_pipeline

print("🚀 Starting full ML training pipeline...")

# Run the complete pipeline (training + tuning + shap)
model, scaler, explainer, X_test = run_full_ml_pipeline()

print("✅ Training complete. Saving model artifacts...")

# Save all important artifacts for API inference
joblib.dump(model, "model.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(explainer, "explainer.pkl")

print("🎉 All artifacts saved successfully!")
print("📦 Saved files: model.pkl, scaler.pkl, explainer.pkl")
