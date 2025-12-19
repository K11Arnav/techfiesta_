import joblib
from financial_transaction_fraud_detection import run_full_ml_pipeline

print("🚀 Starting full ML training pipeline...")

# Run the complete pipeline (training + tuning + shap)
model, scaler, explainer, X_test, iso_components, graph_components = run_full_ml_pipeline()

print("✅ Training complete. Saving model artifacts...")

# Save all important artifacts for API inference
joblib.dump(model, "model.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(explainer, "explainer.pkl")

# Save New Artifacts
joblib.dump(iso_components["model"], "iso_forest_model.pkl")
joblib.dump(iso_components["scaler"], "iso_scaler.pkl")
joblib.dump({
    "score_min": iso_components["score_min"],
    "score_max": iso_components["score_max"],
}, "iso_metadata.pkl")

joblib.dump(graph_components["model"], "graph_model.pkl")
joblib.dump(graph_components["reference_data"], "graph_reference.pkl")


print("🎉 All artifacts saved successfully!")
print("📦 Saved files: model.pkl, scaler.pkl, explainer.pkl, iso_forest_model.pkl, iso_scaler.pkl, iso_metadata.pkl, graph_model.pkl, graph_reference.pkl")
