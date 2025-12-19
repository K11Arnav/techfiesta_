import os
import socket
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("DB_HOST")
url = os.getenv("DB_URL")

print("--- Environment Check ---")
if url:
    print(f"Using DB_URL: {url[:15]}... (obfuscated)")
    # Extract host from URL manually for test
    try:
        host_from_url = url.split("@")[1].split(":")[0]
        print(f"Extracted Host: {host_from_url}")
        host = host_from_url
    except:
        pass
else:
    print(f"Using DB_HOST: {host}")

print("\n--- DNS Connectivity Test ---")
if host:
    try:
        ip = socket.gethostbyname(host)
        print(f"✅ DNS Success: {host} resolves to {ip}")
    except socket.gaierror as e:
        print(f"❌ DNS Failure: {host} cannot be resolved. Error: {e}")
        print("\n💡 TIP: If you are on a restricted network (like a school or office), ")
        print("they might be blocking Supabase's direct database port.")
        print("TRY THIS: Use the 'Pooler' URL from the Supabase dashboard (port 6543/5432).")
else:
    print("❌ No host found in .env")
