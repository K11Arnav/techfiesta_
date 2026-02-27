# 🛡️ FraudWatch — Real-Time Fraud Detection System

FraudWatch is a full-stack system for detecting financial fraud in real time using a combination of machine learning models, anomaly detection, and rule-based analysis. It processes streaming transaction data, assigns risk scores, and provides human-readable explanations for each decision.

---

## 🚀 Features

### Real-Time Transaction Scoring
Processes a continuous stream of transactions and assigns fraud risk instantly.

### Ensemble Detection Pipeline
Combines multiple approaches:
- XGBoost (supervised classification)
- Isolation Forest (anomaly detection)
- KNN / Graph-based behavioral scoring
- Rule-based engine

### Explainable AI (SHAP)
Generates feature-level explanations for every prediction.

### Geospatial Analysis
Detects suspicious patterns like impossible travel between transactions.

### Live Dashboard
- Transaction monitor  
- Threat feed (high-risk transactions)  
- Real-time statistics and charts  
- Map-based visualization of activity  

### Asynchronous Alerting
Flags high-risk transactions without blocking the main pipeline.

### Persistent Storage
Logs transactions, model outputs, and final decisions in PostgreSQL.

---

## 🛠️ Tech Stack

### Backend
- FastAPI (Python)
- PostgreSQL
- psycopg2
- joblib

### Machine Learning
- XGBoost
- Isolation Forest (Scikit-learn)
- Nearest Neighbors (KNN)
- SHAP (Explainability)

### Frontend
- React (Vite)
- Tailwind CSS
- Framer Motion
- Recharts
- React-Leaflet

### Data
- Credit Card Fraud Detection Dataset (Kaggle)

---

## 📁 Project Structure

```bash
fraudwatch/
│
├── backend/
│   ├── api.py
│   ├── models/
│   ├── services/
│   ├── utils/
│   ├── financial_transaction_fraud_detection.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── package.json
│
├── data/
├── generate_data.py
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Backend Setup

Make sure Python 3.8+ is installed.

```bash
cd backend
pip install -r requirements.txt
uvicorn api:app --reload
```

- Backend: http://localhost:8000  
- API Docs: http://localhost:8000/docs  

---

### 2. Frontend Setup

Make sure Node.js is installed.

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173  

---

### 3. Database Setup (PostgreSQL)

Create a PostgreSQL database and update connection credentials in your backend config.

Example tables:
- `transactions_raw`
- `ml_scores`
- `decisions`

---

### 4. Data Generation (Optional)

To regenerate mock transaction stream data:

```bash
python generate_data.py
```

---

## 🎮 Usage

1. Start backend and frontend servers  
2. Open the frontend in your browser  
3. Start the live transaction stream  

Monitor:
- Incoming transactions  
- Fraud scores  
- High-risk alerts  
- SHAP explanations  

---

## 🧠 Model Details

### XGBoost
- Handles class imbalance using `scale_pos_weight`  
- Optimized using precision-recall metrics  

### Isolation Forest
- Detects outliers in transaction behavior  

### KNN / Graph Model
- Evaluates similarity with historical transactions  
- Uses fraud density and distance metrics  

### SHAP
- Explains contribution of each feature to prediction  

---

## ⚠️ Notes

- Models are loaded in-memory using pre-trained artifacts  
- If artifacts are missing, training is triggered on startup  
- LRU caching is used to optimize repeated inference calls  
