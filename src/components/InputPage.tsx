import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function InputPage() {
  const [time, setTime] = useState("");
  const [amount, setAmount] = useState("");
  const navigate = useNavigate();

  const submitTransaction = async () => {
    if (!time || !amount) {
      alert("Please fill both fields.");
      return;
    }

    const response = await fetch("http://localhost:8000/score_transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Time: parseFloat(time),
        Amount: parseFloat(amount),
      }),
    });

    const result = await response.json();

    navigate("/results", {
      state: {
        risk: result.risk_score,
        explanation: result.explanation,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-zinc-950 text-white p-6">
      <h1 className="text-3xl font-semibold mb-6">Enter Transaction Details</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="number"
          placeholder="Time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="p-3 rounded bg-zinc-800 border border-zinc-700"
        />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="p-3 rounded bg-zinc-800 border border-zinc-700"
        />

        <button
          onClick={submitTransaction}
          className="p-3 bg-indigo-600 rounded hover:bg-indigo-700 transition-all"
        >
          Predict Fraud Risk
        </button>
      </div>
    </div>
  );
}
