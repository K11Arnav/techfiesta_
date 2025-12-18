import json
import os
import pandas as pd
import financial_transaction_fraud_detection as ml_pipeline

# Ensure data directory exists
os.makedirs("src/data", exist_ok=True)

# 🔹 CALL the pipeline (this is the key fix)
_, _, _, X_test, y_test = ml_pipeline.run_full_ml_pipeline()

# Reconstruct labeled test dataframe
test_df = X_test.copy()
test_df["Class"] = y_test.values

# Split fraud vs normal (TEST SET ONLY)
fraud_df = test_df[test_df["Class"] == 1]
normal_df = test_df[test_df["Class"] == 0]

print(f"Fraud in test set: {len(fraud_df)}")
print(f"Normal in test set: {len(normal_df)}")

# --- DEMO MIX ---
FRAUD_COUNT = 10
TOTAL_TXNS = 500

fraud_sample = fraud_df.sample(
    n=min(FRAUD_COUNT, len(fraud_df)),
    random_state=42
)

normal_sample = normal_df.sample(
    n=TOTAL_TXNS - len(fraud_sample),
    random_state=42
)

# Combine + shuffle
demo_df = (
    pd.concat([fraud_sample, normal_sample])
      .sample(frac=1, random_state=42)
)

# Drop label before frontend
demo_df = demo_df.drop(columns=["Class"])

# Save JSON
output_path = "src/data/test_transactions.json"
demo_df.to_json(output_path, orient="records", indent=2)

print(f"✅ Saved {len(demo_df)} demo transactions")
print(f"🔥 Included fraud cases: {len(fraud_sample)}")
print("Sample record:", demo_df.iloc[0].to_dict())
