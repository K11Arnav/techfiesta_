import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("DB_HOST", "localhost")
database = os.getenv("DB_NAME", "postgres")
user = os.getenv("DB_USER", "postgres")
password = os.getenv("DB_PASSWORD", "")
port = os.getenv("DB_PORT", "5432")

print(f"DEBUG: Attempting to connect to {host}:{port}/{database} as {user}")

try:
    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=port,
        sslmode="require",
        connect_timeout=10
    )
    print("✅ SUCCESS: Connected to Supabase!")
    conn.close()
except Exception as e:
    print(f"❌ FAILURE: {e}")
