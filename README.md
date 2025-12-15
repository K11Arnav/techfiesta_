# CyberGuard AI - Real-Time Fraud Detection

A full-stack prototype demonstrating real-time financial fraud detection using **XGBoost**, **SHAP**, **FastAPI**, and **React**.

## 🚀 Features

*   **Live Streaming Inference**: Simulates a high-frequency transaction stream directly from test data.
*   **Real-Time Explanability**: Uses SHAP (SHapley Additive exPlanations) to explain *why* a specific transaction was flagged.
*   **Interactive Dashboard**:
    *   **Live Monitor**: Visualizes the current transaction being processed.
    *   **Threat Feed**: Automatically aggregates and alerts on High Risk (Score ≥ 0.8) transactions.
    *   **Stats**: Tracks processed vs. flagged transactions in real-time.

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), Tailwind CSS, Framer Motion, Lucide Icons.
*   **Backend**: FastAPI (Python).
*   **Machine Learning**: XGBoost (Classifier), Scikit-Learn (Preprocessing), SHAP (Explainability).
*   **Data**: Credit Card Fraud Detection dataset (Kaggle).

## 📦 Installation & Setup

### 1. Backend Setup (Python)

Ensure you have Python 3.8+ installed.

```bash
# Install dependencies
pip install -r requirements.txt

# Start the API Server
# Note: This will download the dataset and train the model on startup (~1-2 mins)
uvicorn api:app --reload
```
*   Backend runs at: `http://localhost:8000`
*   Docs: `http://localhost:8000/docs`

### 2. Frontend Setup (Node.js)

Ensure you have Node.js installed.

```bash
# Install dependencies
npm install

# Start the Development Server
npm run dev
```
*   Frontend runs at: `http://localhost:5173`

### 3. Data Generation (Optional)
If you need to regenerate the mock stream data:
```bash
python generate_data.py
```

## 🎮 How to Demo

1.  Open the **Frontend** (`http://localhost:5173`).
2.  Scroll down to the **CyberGuard AI Monitor** section.
3.  Click **"Start Live Stream"**.
4.  Watch as transactions are analyzed in real-time.
5.  Observe "High Risk" transactions appearing in the **Detected Threats** panel with their contributing risk factors.

## ⚠️ Note on Model
The ML pipeline (`financial_transaction_fraud_detection.py`) runs entirely in-memory. The model is retrained every time the backend server restarts. This ensures a stateless and reproducible demo environment.
