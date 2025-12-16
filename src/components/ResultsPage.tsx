import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// @ts-ignore – umap-js graph component is JS-only but safe to import
import FeatureSpaceGraph from "./FeatureSpaceGraph";

interface DecisionRow {
  txn_id: string;
  final_risk: number;
  decision: string;
  reason: string;
  decision_time: string;
}

export default function ResultsPage() {
  const [results, setResults] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:8000/decisions")
      .then((res) => res.json())
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <h1 className="text-4xl font-bold mb-6 text-indigo-400">
        Fraud Detection Results
      </h1>

      <p className="text-zinc-400 mb-8">
        Below are all transactions that were processed through your fraud engine.
      </p>

      {loading ? (
        <p className="text-zinc-400">Loading results...</p>
      ) : results.length === 0 ? (
        <p className="text-zinc-500">No results yet. Submit a transaction first.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border border-zinc-800 rounded-lg overflow-hidden">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left">Txn ID</th>
                  <th className="px-4 py-3 text-left">Risk Score</th>
                  <th className="px-4 py-3 text-left">Decision</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Time</th>
                </tr>
              </thead>

              <tbody>
                {results.map((row) => (
                  <tr key={row.txn_id} className="border-t border-zinc-800 hover:bg-zinc-900/40">
                    <td className="px-4 py-3">{row.txn_id}</td>

                    <td className="px-4 py-3 text-indigo-300 font-semibold">
                      {row.final_risk.toFixed(4)}
                    </td>

                    <td
                      className={`px-4 py-3 font-bold ${
                        row.decision === "BLOCK"
                          ? "text-red-400"
                          : row.decision === "REVIEW"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {row.decision}
                    </td>

                    <td className="px-4 py-3 text-zinc-400">{row.reason}</td>

                    <td className="px-4 py-3 text-zinc-500 text-sm">
                      {new Date(row.decision_time).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <FeatureSpaceGraph />
        </>
      )}

      <button
        onClick={() => navigate("/input")}
        className="mt-10 px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all"
      >
        Submit Another Transaction
      </button>
    </div>
  );
}
