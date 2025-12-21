import os
import smtplib
import traceback
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

class EmailNotifier:

    @staticmethod
    def send_fraud_alert(txn_id, risk_score, decision):
        """
        Sends a fraud alert email synchronously.
        Intended to be run via FastAPI BackgroundTasks.
        Includes extensive debugging for SMTP diagnosis.
        """
        try:
            smtp_server = os.getenv("SMTP_SERVER")
            smtp_port = os.getenv("SMTP_PORT")
            sender = os.getenv("SENDER_EMAIL")
            password = os.getenv("SENDER_PASSWORD")
            recipient = os.getenv("RECIPIENT_EMAIL")

            # --- DEBUG: CHECK CONFIG PRESENCE ---
            print(f"[EmailNotifier][DEBUG] SMTP_SERVER present: {bool(smtp_server)} ({smtp_server})")
            print(f"[EmailNotifier][DEBUG] SMTP_PORT present: {bool(smtp_port)} ({smtp_port})")
            print(f"[EmailNotifier][DEBUG] SENDER_EMAIL present: {bool(sender)} ({sender})")
            print(f"[EmailNotifier][DEBUG] SENDER_PASSWORD present: {bool(password)}")
            print(f"[EmailNotifier][DEBUG] RECIPIENT_EMAIL present: {bool(recipient)} ({recipient})")

            if not all([smtp_server, smtp_port, sender, password, recipient]):
                print("[EmailNotifier] Missing SMTP config. Skipping email.")
                return

            msg = EmailMessage()
            msg["Subject"] = f"🚨 FRAUD ALERT: {txn_id}"
            msg["From"] = sender
            msg["To"] = recipient
            msg.set_content(
                f"""
Dear Customer,

We have detected unusual activity associated with a recent transaction on your account. Based on our automated risk assessment systems, this transaction has been classified as high risk and has been temporarily blocked to protect your account.

No funds have been debited as a result of this action. We recommend that you review your recent activity immediately and confirm whether this transaction was authorized by you.

For further assistance, contact our support team promptly.

Transaction ID: {txn_id}
Risk Score: {round(risk_score * 100, 2)} %
Decision: {decision}

Please review immediately.

Sincerely,
FraudWatch Team
"""
            )

            print(f"[EmailNotifier][DEBUG] Connecting to {smtp_server}:{smtp_port} (timeout=10s)...")
            # Explicit timeout for visibility
            with smtplib.SMTP(smtp_server, int(smtp_port), timeout=10) as server:
                server.set_debuglevel(1) # Extra low-level SMTP debug
                
                print("[EmailNotifier][DEBUG] Starting TLS...")
                server.starttls()
                
                print(f"[EmailNotifier][DEBUG] Logging in as {sender}...")
                server.login(sender, password)
                
                print(f"[EmailNotifier][DEBUG] Sending message to {recipient}...")
                server.send_message(msg)

            print(f"[EmailNotifier] Email sent for txn {txn_id} successfully.")

        except Exception as e:
            print(f"[EmailNotifier][ERROR] Email failed for txn {txn_id}.")
            print(f"[EmailNotifier][ERROR] Exception Type: {type(e).__name__}")
            print(f"[EmailNotifier][ERROR] Exception Message: {e}")
            traceback.print_exc()
