import json
import os
import pandas as pd
import financial_transaction_fraud_detection as ml_pipeline

# Ensure data directory exists
os.makedirs("src/data", exist_ok=True)

# Get X_test from the pipeline
X_test = ml_pipeline.X_test

# Select 50 random samples or just the first 50
# Let's take first 50 to be deterministic
# Select 500 random samples or just the first 500
# Let's take first 500 to be deterministic
df_sample = X_test.head(500).copy()

# Convert to records (list of dicts)
records = df_sample.to_dict(orient="records")

# Save to JSON
output_path = "src/data/test_transactions.json"
with open(output_path, "w") as f:
    json.dump(records, f, indent=2)

print(f"✅ Saved {len(records)} transactions to {output_path}")
print("Sample record:", records[0])
