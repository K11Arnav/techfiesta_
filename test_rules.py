from fraud_rules import RuleEngine
import json

# Create a dummy config if not exists (it should exist)
# Initialize Engine
engine = RuleEngine()
print("✅ RuleEngine initialized.")

# Test Case 1: Normal Transaction
txn_normal = {
    "Time": 1000,
    "Amount": 50.0,
    "V4": 0.1, "V10": 0.1, "V12": 0.1, "V14": 0.1
}
score, details = engine.evaluate(txn_normal, last_txn_time=900)
print(f"Test 1 (Normal): Score={score}, Details={details}")
assert score == 0, "Normal txn should have 0 score"

# Test Case 2: Velocity Violation (Time diff 2s < 5s)
txn_velocity = {
    "Time": 1002,
    "Amount": 50.0,
    "V4": 0.1, "V10": 0.1, "V12": 0.1, "V14": 0.1
}
score, details = engine.evaluate(txn_velocity, last_txn_time=1000)
print(f"Test 2 (Velocity): Score={score}, Details={details}")
assert details['r1_velocity'] == 1, "Velocity should trigger"

# Test Case 3: High Amount ( > 1000)
txn_large = {
    "Time": 2000,
    "Amount": 5000.0,
    "V4": 0.1, "V10": 0.1, "V12": 0.1, "V14": 0.1
}
score, details = engine.evaluate(txn_large, last_txn_time=1000)
print(f"Test 3 (Large Amt): Score={score}, Details={details}")
assert details['r3_amount_anomaly'] == 1, "Large Amount should trigger"

print("\n🎉 All Rule Engine tests passed!")
