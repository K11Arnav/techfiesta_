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
  // Apply sqrt for nonlinear spread - makes high risk more visually distinct
  const adjusted = Math.sqrt(s);

  if (adjusted < 0.2) {
    // Dark green for very low risk
    return "rgb(34, 197, 94)"; // green-500
  } else if (adjusted < 0.5) {
    // Green to Yellow transition
    const t = (adjusted - 0.2) / 0.3;
    const r = Math.round(34 + t * (250 - 34));
    const g = Math.round(197 + t * (204 - 197));
    const b = Math.round(94 + t * (21 - 94));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (adjusted < 0.7) {
    // Yellow to Orange transition
    const t = (adjusted - 0.5) / 0.2;
    const r = Math.round(250 + t * (249 - 250));
    const g = Math.round(204 + t * (115 - 204));
    const b = Math.round(21 + t * (22 - 21));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Orange to Red transition for high risk
    const t = (adjusted - 0.7) / 0.3;
    const r = Math.round(249 + t * (239 - 249));
    const g = Math.round(115 + t * (68 - 115));
    const b = Math.round(22 + t * (68 - 22));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// Aggressive size scaling - fraud points become VERY visible
function riskToRadius(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  // size = 4 + 20 * Math.pow(riskScore, 1.5)
  return 4 + 20 * Math.pow(s, 1.5);
}

// Opacity dimming - low risk fades into background
function riskToOpacity(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  if (s < 0.2) return 0.25;
  if (s < 0.5) return 0.5;
  return 0.9;
}

// Check if point needs glow effect
function needsGlow(score: number, decision: string): boolean {
  return score >= 0.7 || decision === "BLOCK";
}

function decisionStroke(decision: string, isTopRisk: boolean): string {
  if (isTopRisk) return "rgba(255, 255, 255, 0.95)"; // White outline for top-K
  if (decision === "BLOCK") return "rgba(239, 68, 68, 0.95)"; // red-500
  if (decision === "REVIEW") return "rgba(249, 115, 22, 0.95)"; // orange-500
  return "rgba(24, 24, 27, 0.6)"; // neutral dark outline
}

export default function FeatureSpaceGraph() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [hovered, setHovered] = useState<GraphPoint | null>(null);

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
    const highRisk = points.filter(p => p.risk_score >= 0.7).length;
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
              const hasGlow = needsGlow(p.risk_score, p.decision);
              const isBlocked = p.decision === "BLOCK";

              return (
                <g
                  key={p.txn_id}
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered((prev) =>
                    prev && prev.txn_id === p.txn_id ? null : prev
                  )}
                  style={{ cursor: "pointer" }}
                  filter={isBlocked ? "url(#strongGlowFilter)" : hasGlow ? "url(#glowFilter)" : undefined}
                >
                  <circle
                    cx={p.svgX}
                    cy={p.svgY}
                    r={riskToRadius(p.risk_score)}
                    fill={riskToColor(p.risk_score)}
                    fillOpacity={riskToOpacity(p.risk_score)}
                    stroke={decisionStroke(p.decision, p.isTopRisk)}
                    strokeWidth={p.isTopRisk ? 3 : p.decision === "BLOCK" ? 2.5 : p.decision === "REVIEW" ? 2 : 1}
                  />
                  {/* Extra ring for top-K risk transactions */}
                  {p.isTopRisk && (
                    <circle
                      cx={p.svgX}
                      cy={p.svgY}
                      r={riskToRadius(p.risk_score) + 5}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                  )}
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
                      {hovered.risk_score >= 0.7 && " ⚠️"}
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
        </div>
      )}
    </section>
  );
}
