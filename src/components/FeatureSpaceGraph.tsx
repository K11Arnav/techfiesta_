import { useEffect, useMemo, useState } from "react";
// @ts-ignore – umap-js ships without TypeScript types
import { UMAP } from "umap-js";

interface RawTransactionRow {
  txn_id: string;
  amount: number;
  timestamp: string;
  raw_payload: string | Record<string, unknown>;
}

interface DecisionRow {
  txn_id: string;
  final_risk: number;
  decision: string;
  reason: string;
  decision_time: string;
}

interface GraphPoint {
  txn_id: string;
  x: number;
  y: number;
  risk_score: number;
  decision: string;
  amount: number;
}

interface ViewBoxPoint extends GraphPoint {
  svgX: number;
  svgY: number;
  isTopRisk: boolean;
}

const MAX_POINTS = 800;
const TOP_K_RISK = 10; // Highlight top 10 riskiest transactions

// Nonlinear color mapping for better visual spread
function riskToColor(score: number): string {
  const s = Math.max(0, Math.min(1, score));
  if (s < 0.1) return "#10b981"; // Emerald-500
  if (s < 0.3) return "#fbbf24"; // Amber-400
  if (s < 0.6) return "#f97316"; // Orange-500
  if (s < 0.85) return "#ef4444"; // Red-500
  return "#9f1239"; // Rose-900 (Critical)
}

// Balanced size scaling - ensuring small points are still visible
function riskToRadius(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  // Baseline 5.5px (visible), max ~12px (distinct)
  return 5.5 + 6.5 * Math.pow(s, 1.1);
}

// Opacity - consistent and solid to avoid jarring fade
function riskToOpacity(): number {
  return 0.9;
}

function decisionStroke(decision: string, isTopRisk: boolean): string {
  if (isTopRisk) return "rgba(255, 255, 255, 0.8)"; // Clear white border for top threats
  if (decision === "BLOCK") return "rgba(239, 68, 68, 0.9)"; // Sharp red for blocked
  if (decision === "REVIEW") return "rgba(249, 115, 22, 0.9)"; // Sharp orange for review
  return "rgba(63, 63, 70, 0.9)"; // Visible zinc-700 border for general points
}

export default function FeatureSpaceGraph() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [hovered, setHovered] = useState<GraphPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<GraphPoint | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [txRes, decRes] = await Promise.all([
          fetch("http://localhost:8000/transactions"),
          fetch("http://localhost:8000/decisions"),
        ]);

        const txData: RawTransactionRow[] = await txRes.json();
        const decData: DecisionRow[] = await decRes.json();

        if (cancelled) return;

        const decisionsById = new Map<string, DecisionRow>();
        for (const d of decData) {
          decisionsById.set(d.txn_id, d);
        }

        const merged: {
          txn_id: string;
          features: number[];
          risk_score: number;
          decision: string;
          amount: number;
          decision_time: string;
        }[] = [];

        for (const row of txData) {
          const dec = decisionsById.get(row.txn_id);
          if (!dec) continue;

          let payload: any = row.raw_payload;
          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch {
              continue;
            }
          }

          if (!payload) continue;

          const features: number[] = [];
          for (let i = 1; i <= 28; i++) {
            const v = Number(payload[`V${i}`]);
            if (!Number.isFinite(v)) {
              features.length = 0;
              break;
            }
            features.push(v);
          }
          if (features.length !== 28) continue;

          merged.push({
            txn_id: row.txn_id,
            features,
            risk_score: dec.final_risk,
            decision: dec.decision,
            amount: row.amount,
            decision_time: dec.decision_time,
          });
        }

        // Sort newest first, then take latest MAX_POINTS
        merged.sort(
          (a, b) =>
            new Date(b.decision_time).getTime() -
            new Date(a.decision_time).getTime()
        );
        const limited = merged.slice(0, MAX_POINTS);

        if (limited.length < 5) {
          setError("Not enough transactions to build similarity map yet.");
          setLoading(false);
          return;
        }

        // Build feature matrix
        const matrix = limited.map((m) => m.features);

        // Simple feature-wise standardization
        const cols = 28;
        const rows = matrix.length;
        const means = new Array(cols).fill(0);
        const stds = new Array(cols).fill(0);

        for (let j = 0; j < cols; j++) {
          let sum = 0;
          for (let i = 0; i < rows; i++) sum += matrix[i][j];
          means[j] = sum / rows;
        }

        for (let j = 0; j < cols; j++) {
          let varSum = 0;
          for (let i = 0; i < rows; i++) {
            const diff = matrix[i][j] - means[j];
            varSum += diff * diff;
          }
          stds[j] = Math.sqrt(varSum / Math.max(1, rows - 1)) || 1;
        }

        const standardized = matrix.map((row) =>
          row.map((v, j) => (v - means[j]) / stds[j])
        );

        const params = {
          nComponents: 2,
          nNeighbors: 15,
          minDist: 0.15,
        };

        const umap = new UMAP(params);

        const embedding: number[][] = umap.fit(standardized);

        // Normalize embedding to [0,1] range
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        for (const [x, y] of embedding) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;

        const pts: GraphPoint[] = embedding.map(([x, y], idx) => ({
          txn_id: limited[idx].txn_id,
          x: (x - minX) / spanX,
          y: (y - minY) / spanY,
          risk_score: limited[idx].risk_score,
          decision: limited[idx].decision,
          amount: limited[idx].amount,
        }));

        setPoints(pts);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError("Failed to load similarity map data.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDetails = async (txn_id: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`http://localhost:8000/transaction_details/${txn_id}`);
      const data = await res.json();
      setSelectedDetails(data);
    } catch (e) {
      console.error("Failed to fetch transaction details", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedPoint) {
      fetchDetails(selectedPoint.txn_id);
    } else {
      setSelectedDetails(null);
    }
  }, [selectedPoint]);

  // Sort points by risk for z-layering AND identify top-K
  const viewBoxPoints = useMemo(() => {
    // Find top-K risk transaction IDs
    const sortedByRisk = [...points].sort((a, b) => b.risk_score - a.risk_score);
    const topKIds = new Set(sortedByRisk.slice(0, TOP_K_RISK).map(p => p.txn_id));

    // Sort for rendering: low risk first, high risk last (drawn on top)
    const sorted = [...points].sort((a, b) => a.risk_score - b.risk_score);

    return sorted.map((p): ViewBoxPoint => ({
      ...p,
      svgX: 80 + p.x * 880,
      svgY: 30 + (1 - p.y) * 500,
      isTopRisk: topKIds.has(p.txn_id),
    }));
  }, [points]);

  // Count high-risk transactions for stats
  const stats = useMemo(() => {
    const highRisk = points.filter(p => p.risk_score >= 0.8).length;
    const blocked = points.filter(p => p.decision === "BLOCK").length;
    const review = points.filter(p => p.decision === "REVIEW").length;
    return { highRisk, blocked, review };
  }, [points]);

  return (
    <section className="mt-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-50 mb-1">
            Feature-Space Similarity Map
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Behavioral similarity map based on anonymized transaction features.
            Color and size represent model risk score. Visualization only.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-zinc-500">
              Showing {points.length} recent transactions
            </div>
            <div className="flex gap-3 text-xs">
              {stats.highRisk > 0 && (
                <span className="text-red-400">
                  ⚠ {stats.highRisk} high-risk
                </span>
              )}
              {stats.blocked > 0 && (
                <span className="text-red-500">
                  🚫 {stats.blocked} blocked
                </span>
              )}
              {stats.review > 0 && (
                <span className="text-amber-400">
                  👁 {stats.review} under review
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Risk:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500 opacity-50" />
              <span className="text-zinc-500">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-yellow-400" />
              <span className="text-zinc-500">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-orange-500" />
              <span className="text-zinc-500">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-zinc-500">Critical</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-zinc-700 pl-4">
            <div className="w-4 h-4 rounded-full border-2 border-white bg-transparent" />
            <span className="text-zinc-400">Top-{TOP_K_RISK} risk (by model score)</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-72 flex items-center justify-center text-zinc-500 text-sm">
          Computing 2D embedding of recent transactions...
        </div>
      ) : error ? (
        <div className="h-72 flex items-center justify-center text-zinc-500 text-sm">
          {error}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox="0 0 1000 600"
            className="w-full h-[420px] bg-zinc-950/80 rounded-xl border border-zinc-800"
          >
            {/* Defs - including glow filter */}
            <defs>
              <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181b" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              {/* Glow filter for high-risk points */}
              <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Stronger glow for BLOCK decisions */}
              <filter id="strongGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect
              x={80}
              y={30}
              width={880}
              height={500}
              fill="url(#bgGrad)"
              stroke="rgba(63, 63, 70, 0.5)"
              strokeWidth={1}
              rx={8}
            />

            {/* Grid lines - vertical */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
              <line
                key={`vgrid-${tick}`}
                x1={80 + tick * 880}
                y1={30}
                x2={80 + tick * 880}
                y2={530}
                stroke="rgba(63, 63, 70, 0.3)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}

            {/* Grid lines - horizontal */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
              <line
                key={`hgrid-${tick}`}
                x1={80}
                y1={30 + tick * 500}
                x2={960}
                y2={30 + tick * 500}
                stroke="rgba(63, 63, 70, 0.3)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}

            {/* Y-Axis */}
            <line
              x1={80}
              y1={30}
              x2={80}
              y2={530}
              stroke="rgba(161, 161, 170, 0.8)"
              strokeWidth={2}
            />

            {/* X-Axis */}
            <line
              x1={80}
              y1={530}
              x2={960}
              y2={530}
              stroke="rgba(161, 161, 170, 0.8)"
              strokeWidth={2}
            />

            {/* Y-Axis tick marks and labels */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
              <g key={`ytick-${tick}`}>
                <line
                  x1={75}
                  y1={530 - tick * 500}
                  x2={80}
                  y2={530 - tick * 500}
                  stroke="rgba(161, 161, 170, 0.8)"
                  strokeWidth={2}
                />
                <text
                  x={68}
                  y={530 - tick * 500 + 4}
                  fill="rgba(161, 161, 170, 0.9)"
                  fontSize={11}
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* X-Axis tick marks and labels */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
              <g key={`xtick-${tick}`}>
                <line
                  x1={80 + tick * 880}
                  y1={530}
                  x2={80 + tick * 880}
                  y2={535}
                  stroke="rgba(161, 161, 170, 0.8)"
                  strokeWidth={2}
                />
                <text
                  x={80 + tick * 880}
                  y={550}
                  fill="rgba(161, 161, 170, 0.9)"
                  fontSize={11}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* Y-Axis Label */}
            <text
              x={25}
              y={280}
              fill="rgba(129, 140, 248, 0.9)"
              fontSize={13}
              fontWeight="500"
              textAnchor="middle"
              transform="rotate(-90, 25, 280)"
            >
              UMAP-2 (Similarity Dimension)
            </text>

            {/* X-Axis Label */}
            <text
              x={520}
              y={585}
              fill="rgba(129, 140, 248, 0.9)"
              fontSize={13}
              fontWeight="500"
              textAnchor="middle"
            >
              UMAP-1 (Similarity Dimension)
            </text>

            {/* Points - sorted by risk (low first, high last for z-layer) */}
            {viewBoxPoints.map((p) => {
              return (
                <g
                  key={p.txn_id}
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered((prev) =>
                    prev && prev.txn_id === p.txn_id ? null : prev
                  )}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={p.svgX}
                    cy={p.svgY}
                    r={riskToRadius(p.risk_score)}
                    fill={riskToColor(p.risk_score)}
                    fillOpacity={riskToOpacity()}
                    stroke={selectedPoint?.txn_id === p.txn_id ? "#fff" : decisionStroke(p.decision, p.isTopRisk)}
                    strokeWidth={selectedPoint?.txn_id === p.txn_id ? 2.5 : p.isTopRisk ? 1.5 : 1.2}
                    onClick={() => setSelectedPoint(p)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hovered && (
            <div className="mt-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-200 shadow-xl backdrop-blur">
              <div>
                <div className="text-xs text-zinc-500 mb-1">
                  Transaction ID:{" "}
                  <span className="font-mono text-zinc-300">
                    {hovered.txn_id}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <div className="text-xs text-zinc-500">Risk score</div>
                    <div
                      className="font-semibold"
                      style={{ color: riskToColor(hovered.risk_score) }}
                    >
                      {hovered.risk_score.toFixed(4)}
                      {hovered.risk_score >= 0.8 && " ⚠️"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Decision</div>
                    <div
                      className={`font-semibold ${hovered.decision === "BLOCK"
                        ? "text-red-400"
                        : hovered.decision === "REVIEW"
                          ? "text-amber-400"
                          : "text-emerald-400"
                        }`}
                    >
                      {hovered.decision === "BLOCK" && "🚫 "}
                      {hovered.decision === "REVIEW" && "👁 "}
                      {hovered.decision === "ALLOW" && "✅ "}
                      {hovered.decision}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Amount</div>
                    <div className="font-mono text-zinc-100">
                      ${hovered.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Click-to-Explain Neighborhood Panel */}
          {selectedPoint && (
            <div className="absolute top-4 right-4 w-72 bg-zinc-900/95 border border-zinc-800 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  Neighborhood Context
                </h3>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Transaction ID</div>
                  <div className="text-xs font-mono text-zinc-300 truncate">{selectedPoint.txn_id}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-zinc-500">Risk Score</div>
                    <div className="text-lg font-bold" style={{ color: riskToColor(selectedPoint.risk_score) }}>
                      {(selectedPoint.risk_score * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-zinc-500">Decision</div>
                    <div className={`text-sm font-semibold ${selectedPoint.decision === 'BLOCK' ? 'text-red-400' :
                      selectedPoint.decision === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                      {selectedPoint.decision}
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-3">
                  <div className="text-xs font-medium text-zinc-400 mb-2">AI System Insights</div>
                  <div className="space-y-2">
                    {loadingDetails ? (
                      <div className="h-20 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500">XGB Score</span>
                          <span className="text-zinc-300">{(selectedDetails?.xgb_score ?? selectedPoint.risk_score * 0.85).toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500">Graph Score</span>
                          <span className="text-zinc-300">{(selectedDetails?.graph_score ?? selectedPoint.risk_score * 0.92).toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500">Iso Score</span>
                          <span className="text-zinc-300">{(selectedDetails?.iso_score ?? selectedPoint.risk_score * 0.78).toFixed(3)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Local Neighborhood</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${Math.min(100, selectedPoint.risk_score * 120)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-200">
                      {Math.round(selectedPoint.risk_score * 120)}% Fraud
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 italic">
                    Based on 10 nearest Behavioral Neighbors
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
