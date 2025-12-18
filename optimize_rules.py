import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# --------------------------------------
# CONFIGURATION
# --------------------------------------
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

# OpenRouter / Cerebras Configuration
# Using OpenRouter as default example, can serve Cerebras too
LLM_BASE_URL = os.getenv("LLM_BASE_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL")

CONFIG_PATH = "fraud_rules.json"
SUGGESTIONS_PATH = "suggestions.json"

# --------------------------------------
# DB CONNECTION
# --------------------------------------
def get_flagged_transactions():
    """Fetches details of recent transactions flagged as BLOCK or REVIEW."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Fetch flagged transactions with their details
            # Increased limit to 100 to capture more data context
            cur.execute("""
                SELECT 
                    t.txn_id,
                    t.amount,
                    t.timestamp,
                    d.decision,
                    d.final_risk,
                    d.reason
                FROM fraud.decisions d
                JOIN fraud.transactions_raw t ON d.txn_id = t.txn_id
                WHERE d.decision IN ('BLOCK', 'REVIEW')
                ORDER BY d.decision_time DESC
                LIMIT 100
            """)
            txns = cur.fetchall()
            return txns if txns else []
    except Exception as e:
        print(f"Error fetching flagged transactions: {e}")
        return []
    finally:
        if 'conn' in locals() and conn:
            conn.close()

# --------------------------------------
# LLM OPTIMIZER
# --------------------------------------
def run_optimization():
    print("🤖 Starting LLM Optimization Run...")
    
    # 1. Load Current Rules
    with open(CONFIG_PATH, 'r') as f:
        current_rules = json.load(f)
        
    # 2. Get Performance Data
    flagged_txns = get_flagged_transactions()
    print(f"📊 Processed {len(flagged_txns)} flagged transactions.")
    
    # 3. Construct Prompt
    # Convert dates to string to make them JSON serializable for prompt
    safe_txns = []
    for t in flagged_txns:
        t_copy = dict(t)
        t_copy['timestamp'] = str(t_copy['timestamp'])
        safe_txns.append(t_copy)

    prompt = f"""
    You are a Fraud Risk Manager AI. Your goal is to optimize fraud detection rules by analyzing RECENT FLAGGED TRANSACTIONS.
    
    CURRENT RULES (JSON):
    {json.dumps(current_rules, indent=2)}
    
    RECENT SUSPICIOUS ACTIVITY (Limit 100 flagged txns):
    {json.dumps(safe_txns, indent=2)}
    
    TASK:
    Analyze these flagged transactions. 
    1. If you see many False Positives (e.g. valid users getting blocked), suggest LOOSENING the thresholds.
    2. If you see valid Fraud (high amounts, rapid transactions) being efficiently caught, you might suggest tightening to catch more similar patterns or keeping as is.
    
    Provide your response as a JSON object containing a list of suggestions.
    
    RESPONSE FORMAT:
    {{
        "suggestions": [
            {{
                "target_rule": "velocity", 
                "parameter": "time_window_sec",
                "current_value": 5, 
                "proposed_value": 3, 
                "reasoning": "Block rate is low, tightening velocity check."
            }}
        ]
    }}
    
    Return ONLY valid JSON.
    """
    
    # 4. Call LLM
    client = OpenAI(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY
    )
    
    try:
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON only."},
                {"role": "user", "content": prompt}
            ]
        )
        
        response_text = completion.choices[0].message.content
        print(f"🧠 LLM Response: {response_text}")
        
        # Parse JSON (naive parsing, could be improved)
        # Attempt to find JSON start/end if there is extra text
        try:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            json_str = response_text[start:end]
            suggestion_data = json.loads(json_str)
        except:
             print("Failed to parse LLM JSON")
             return

        # 5. append to Suggestions File
        if 'suggestions' in suggestion_data and suggestion_data['suggestions']:
            # Load existing
            try:
                with open(SUGGESTIONS_PATH, 'r') as f:
                    existing = json.load(f)
            except:
                existing = []
                
            # Append new
            existing.extend(suggestion_data['suggestions'])
            
            # Save
            with open(SUGGESTIONS_PATH, 'w') as f:
                json.dump(existing, f, indent=2)
                
            print(f"✅ Saved {len(suggestion_data['suggestions'])} new suggestions to {SUGGESTIONS_PATH}")
        else:
            print("No changes suggested by LLM.")
            
    except Exception as e:
        print(f"❌ LLM Call Failed: {e}")

if __name__ == "__main__":
    run_optimization()
