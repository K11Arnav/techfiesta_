import { useState, useEffect, useRef, useMemo } from 'react'
import { AlertTriangle, Play, Pause, ShieldCheck, ShieldAlert, Activity, Gauge, FileText, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import testTransactions from '../data/test_transactions.json'
import TravelAnomalyPanel, { type TravelAnomaly } from './TravelAnomalyPanel'
import { useAuth } from '../contexts/AuthContext'

interface SHAPFeature {
  feature: string
  impact: number
  direction?: "increased_risk" | "reduced_risk"
  strength?: "weak" | "moderate" | "strong"
  narrative?: string
}

interface ExplainabilityV2 {
  decision_trace: {
    engine: string
    primary_driver: "xgboost" | "anomaly" | "rules"
    rule_triggered: boolean
    override: boolean
    engine_contributions: Record<string, number>
  }
  shap_analysis: SHAPFeature[]
  fraud_boundary?: { distance_to_fraud: number; interpretation: string }
  risk_tier?: string
  confidence_level?: string
  rule_conflict_note?: string
  shap_aggregation?: { total_positive_impact: number; total_negative_impact: number; net_shap_direction: string; summary: string }
  engine_influence_pct?: Record<string, number>
  executive_summary?: string
}

interface AnalysisResult {
  risk_score: number
  base_score: number
  explanation: SHAPFeature[]
  user_id?: string
  user_risk?: number
  location_risk?: number
  geo_distance_km?: number
  risk_tier?: string
  txn_lat?: number
  txn_lon?: number
  prev_lat?: number | null
  prev_lon?: number | null
  txn_region?: string
  direction?: string
  geo?: { distance_km: number; is_impossible: boolean }
  rule_flags?: string[]
  explainability_v2?: ExplainabilityV2
}

interface TransactionRecord {
  id: number
  amount: number
  time: number
  risk_score: number
  status: 'pending' | 'verified' | 'flagged' | 'high_risk'
  explanation: SHAPFeature[]
  explainability_v2?: ExplainabilityV2
}



export default function DashboardPreview() {
  const { authFetch, role } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  // ── DATA FILTERING ──
  const filteredTransactions = useMemo(() => {
    return testTransactions.filter(txn => {
      if (role === 'admin') return true
      // Simple string match for RBAC domain labeling
      return txn.transaction_domain === role
    })
  }, [role])

  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null)

  // High-risk alerts
  const [alerts, setAlerts] = useState<TransactionRecord[]>([])

  // Travel anomalies (location_risk > 0.3)
  const [travelAnomalies, setTravelAnomalies] = useState<TravelAnomaly[]>([])

  // Stats
  const [stats, setStats] = useState({
    processed: 0,
    flagged: 0,
    verified: 0
  })

  const handleExportCsv = async () => {
    try {
      const response = await authFetch('http://localhost:8000/export/fraud-csv')
      if (!response.ok) throw new Error("Export failed")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fraud_${role}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Export error:", error)
      alert("Failed to export fraud cases CSV")
    }
  }

  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const indexRef = useRef(0)
  const isProcessingRef = useRef(false)
  const isStreamingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current)
    }
  }, [])

  // Auto-play logic
  useEffect(() => {
    isStreamingRef.current = isStreaming
    if (isStreaming) {
      streamRef.current = setInterval(() => {
        processNextTransaction()
      }, 1000)
    }

    return () => {
      if (streamRef.current) {
        clearInterval(streamRef.current)
        streamRef.current = null
      }
    }
  }, [isStreaming])


  const processNextTransaction = async () => {
    // Use ref to check live streaming state (avoids stale closure)
    if (!isStreamingRef.current || isProcessingRef.current) return

    if (indexRef.current >= filteredTransactions.length) {
      if (streamRef.current) {
        clearInterval(streamRef.current)
        streamRef.current = null
      }
      setIsStreaming(false)
      alert("End of test stream!")
      return
    }

    isProcessingRef.current = true

    const txn = filteredTransactions[indexRef.current]

    try {
      // Send raw Kaggle txn — backend handles user cycling + location generation
      const response = await authFetch('http://localhost:8000/score_transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txn),
      })

      if (!response.ok) throw new Error('API request failed')

      const result: AnalysisResult = await response.json()
      setCurrentResult(result)

      // Logic: Fraud if risk > 0.8
      let status: 'verified' | 'flagged' | 'high_risk' = 'verified'
      if (result.risk_score >= 0.8) status = 'high_risk'
      else if (result.risk_score >= 0.6) status = 'flagged'

      // Update stats
      setStats(prev => ({
        processed: prev.processed + 1,
        flagged: status === 'high_risk' || status === 'flagged' ? prev.flagged + 1 : prev.flagged,
        verified: status === 'verified' ? prev.verified + 1 : prev.verified
      }))

      // If High Risk, add to Alerts
      if (status === 'high_risk' || status == 'flagged') {
        const newAlert: TransactionRecord = {
          id: indexRef.current + 1,
          amount: txn.Amount,
          time: txn.Time,
          risk_score: result.risk_score,
          status: status,
          explanation: result.explanation,
          explainability_v2: result.explainability_v2
        }
        setAlerts(prev => [newAlert, ...prev])
      }

      // ── Track travel anomalies via rule_flags ──
      const isGeoFraud = result.rule_flags?.includes('IMPOSSIBLE_TRAVEL')
      if (isGeoFraud && result.txn_lat != null && result.txn_lon != null) {
        const anomaly: TravelAnomaly = {
          id: indexRef.current + 1,
          userId: result.user_id || 'unknown',
          direction: result.direction || 'Unknown',
          fromLat: result.prev_lat ?? result.txn_lat,
          fromLon: result.prev_lon ?? result.txn_lon,
          toLat: result.txn_lat,
          toLon: result.txn_lon,
          distanceKm: result.geo?.distance_km || 0,
          isImpossible: true,
          timestamp: new Date().toLocaleTimeString(),
        }
        setTravelAnomalies(prev => [anomaly, ...prev].slice(0, 10))
      }

      indexRef.current += 1
      setCurrentIndex(indexRef.current)

    } catch (error) {
      console.error("Stream error:", error)
      setIsStreaming(false)
    } finally {
      isProcessingRef.current = false
    }
  }

  return (
    <section id="dashboard" className="py-24 md:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-zinc-50 mb-4">
            Live Fraud Detection Stream
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Real-time inference via XGBoost & SHAP
          </p>
        </motion.div>

        {/* Dashboard Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Window Chrome */}
          <div className="bg-zinc-900 rounded-t-lg border border-zinc-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex-1 text-center flex items-center justify-center gap-3">
              <span className="text-xs text-zinc-400 font-medium">CyberGuard AI Monitor</span>
              <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                {role} mode
              </span>
            </div>
            <div className="w-12"></div>
          </div>

          <div className="bg-zinc-900 rounded-b-2xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col">
            {/* Header / Stats */}
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    if (indexRef.current >= filteredTransactions.length) {
                      indexRef.current = 0
                      setCurrentIndex(0)
                      setStats({ processed: 0, flagged: 0, verified: 0 })
                      setAlerts([])
                      setTravelAnomalies([])
                      setCurrentResult(null)
                    }
                    setIsStreaming(!isStreaming)
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isStreaming
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    }`}
                >
                  {isStreaming ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  {isStreaming ? 'Stop Stream' : 'Start Live Stream'}
                </button>

                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Export Fraud CSV
                </button>

                <div className="flex items-center gap-4 text-sm">
                  <div className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700">
                    <span className="text-zinc-400 mr-2">Processed:</span>
                    <span className="text-zinc-50 font-mono font-semibold">{stats.processed}</span>
                  </div>
                  <div className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700">
                    <span className="text-zinc-400 mr-2">Flagged:</span>
                    <span className="text-rose-400 font-mono font-bold">{stats.flagged}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <Activity className={`w-4 h-4 ${isStreaming ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'}`} />
                {isStreaming ? 'System Active' : 'System Standby'}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 flex-1 min-h-0 items-stretch">

              {/* Left Column: Live Transaction Monitor */}
              <div className="lg:col-span-1 p-6 flex flex-col">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Live Feed
                </h4>

                {!currentResult ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
                      <Play className="w-6 h-6 ml-1" />
                    </div>
                    <p className="text-sm">Start stream to analyze</p>
                  </div>
                ) : (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">

                    {/* ═══ HERO RISK BLOCK ═══ */}
                    <div className={`p-5 rounded-2xl border ${currentResult.risk_score >= 0.8
                      ? 'bg-rose-500/10 border-rose-500/20'
                      : currentResult.risk_score >= 0.6
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                      {/* Top Row: Txn # + Icon */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                          Transaction #{currentIndex}
                        </span>
                        {currentResult.risk_score >= 0.8
                          ? <ShieldAlert className="w-7 h-7 text-rose-500" />
                          : currentResult.risk_score >= 0.6
                            ? <AlertTriangle className="w-7 h-7 text-amber-400" />
                            : <ShieldCheck className="w-7 h-7 text-emerald-400" />}
                      </div>

                      {/* Score + Classification Row */}
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <span className="text-5xl font-black text-zinc-50 leading-none tracking-tight">
                            {(currentResult.risk_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold uppercase tracking-wider ${currentResult.risk_score >= 0.8 ? 'text-rose-400' :
                            currentResult.risk_score >= 0.6 ? 'text-amber-400' :
                              'text-emerald-400'
                            }`}>
                            {currentResult.risk_score >= 0.8 ? 'BLOCKED' :
                              currentResult.risk_score >= 0.6 ? 'SUSPICIOUS' : 'SAFE'}
                          </div>
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {currentResult.explainability_v2?.risk_tier && (
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${currentResult.explainability_v2.risk_tier === 'High Risk' ? 'bg-rose-500/20 text-rose-400' :
                            currentResult.explainability_v2.risk_tier === 'Elevated Risk' ? 'bg-amber-500/20 text-amber-400' :
                              currentResult.explainability_v2.risk_tier === 'Moderate Risk' ? 'bg-amber-500/10 text-amber-300' :
                                'bg-emerald-500/10 text-emerald-400'
                            }`}>
                            {currentResult.explainability_v2.risk_tier}
                          </span>
                        )}
                        {currentResult.explainability_v2?.confidence_level && (
                          <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                            {currentResult.explainability_v2.confidence_level}
                          </span>
                        )}
                      </div>

                      {/* Fraud Boundary */}
                      {currentResult.explainability_v2?.fraud_boundary && (
                        <div className={`mt-3 text-xs font-medium ${currentResult.explainability_v2.fraud_boundary.interpretation === 'Comfortably Safe' ? 'text-emerald-400' :
                          currentResult.explainability_v2.fraud_boundary.interpretation === 'Borderline Safe' ? 'text-amber-400' :
                            'text-rose-400'
                          }`}>
                          {currentResult.explainability_v2.fraud_boundary.interpretation} · Δ {currentResult.explainability_v2.fraud_boundary.distance_to_fraud.toFixed(3)}
                        </div>
                      )}
                    </div>

                    {/* ═══ DECISION TRACE — CHIP SYSTEM ═══ */}
                    {currentResult.explainability_v2 && (
                      <div>
                        <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Engine Contributions</h5>
                        <div className="flex flex-wrap gap-2">
                          {currentResult.explainability_v2.engine_influence_pct &&
                            Object.entries(currentResult.explainability_v2.engine_influence_pct).map(([engine, pct]) => {
                              const isPrimary = engine === currentResult.explainability_v2!.decision_trace.primary_driver
                              const chipColor =
                                engine === 'xgboost' ? (isPrimary ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700') :
                                  engine === 'rules' ? (isPrimary ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700') :
                                    (isPrimary ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700')
                              return (
                                <span key={engine} className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${chipColor}`}>
                                  {engine} {pct}%
                                </span>
                              )
                            })
                          }
                          {currentResult.explainability_v2.decision_trace.rule_triggered && (
                            <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              ⚠ Rule Triggered
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ═══ FORENSIC SUMMARY ═══ */}
                    {currentResult.explainability_v2?.executive_summary && (
                      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Forensic Summary</span>
                        </div>
                        <div className="space-y-1.5">
                          {currentResult.explainability_v2.executive_summary.split('. ').filter(Boolean).map((sentence, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className={`mt-0.5 font-bold ${sentence.toLowerCase().includes('below') || sentence.toLowerCase().includes('safe') || sentence.toLowerCase().includes('cleared') || sentence.toLowerCase().includes('legitimate')
                                ? 'text-emerald-400' : sentence.toLowerCase().includes('exceed') || sentence.toLowerCase().includes('fraud') || sentence.toLowerCase().includes('anomaly')
                                  ? 'text-rose-400' : 'text-amber-400'
                                }`}>
                                {sentence.toLowerCase().includes('exceed') || sentence.toLowerCase().includes('fraud') || sentence.toLowerCase().includes('anomaly') ? '⚠' : '✔'}
                              </span>
                              <span className="text-zinc-200 font-medium leading-snug">{sentence.trim().replace(/\.$/, '')}.</span>
                            </div>
                          ))}
                        </div>

                        {/* Rule Conflict Note */}
                        {currentResult.explainability_v2.rule_conflict_note && (
                          <div className="mt-3 text-xs font-semibold text-amber-400 border-t border-zinc-700 pt-2">
                            ⚠ {currentResult.explainability_v2.rule_conflict_note}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ═══ SHAP — TOP RISK DRIVERS ═══ */}
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Top Risk Drivers</h5>
                      <div className="space-y-3">
                        {(currentResult.explainability_v2?.shap_analysis || currentResult.explanation).map((item, idx) => (
                          <div key={idx}>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="w-14 text-zinc-200 font-medium text-xs">{item.feature}</span>
                              <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-zinc-800">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(Math.abs(item.impact) * 20, 100)}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${item.impact > 0 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                                />
                              </div>
                              <span className={`w-12 text-right font-mono font-semibold text-xs ${item.impact > 0 ? 'text-rose-400' : 'text-emerald-400'
                                }`}>
                                {item.impact > 0 ? '+' : ''}{item.impact.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SHAP Aggregation */}
                      {currentResult.explainability_v2?.shap_aggregation && (
                        <div className={`mt-4 text-xs font-semibold px-4 py-2.5 rounded-lg border ${currentResult.explainability_v2.shap_aggregation.net_shap_direction === 'positive'
                          ? 'border-rose-500/20 text-rose-400 bg-rose-500/5'
                          : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                          }`}>
                          {currentResult.explainability_v2.shap_aggregation.net_shap_direction === 'positive' ? '⚠' : '✔'}{' '}
                          {currentResult.explainability_v2.shap_aggregation.summary}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Threat Feed — height locked to left column via absolute positioning */}
              <div className="lg:col-span-2 bg-zinc-900/50 relative">
                <div className="absolute inset-0 p-6 flex flex-col">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      Detected Threats
                    </span>
                    <span className="text-rose-400 font-mono">{alerts.length} Alerts</span>
                  </h4>

                  <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                    {alerts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3 border-2 border-dashed border-zinc-800 rounded-2xl">
                        <ShieldCheck className="w-10 h-10 opacity-50" />
                        <p className="text-sm">No threats detected yet</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {alerts.map((alert) => (
                          <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 rounded-2xl border transition-colors ${alert.status === 'high_risk'
                              ? 'bg-zinc-800/50 border-rose-500/20 hover:border-rose-500/40'
                              : 'bg-zinc-800/50 border-amber-500/20 hover:border-amber-500/40'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${alert.status === 'high_risk'
                                  ? 'bg-rose-500/10'
                                  : 'bg-amber-500/10'
                                  }`}>
                                  {alert.status === 'high_risk'
                                    ? <ShieldAlert className="w-4 h-4 text-rose-500" />
                                    : <AlertTriangle className="w-4 h-4 text-amber-400" />
                                  }
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-zinc-50">
                                    Transaction #{alert.id}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    ${alert.amount.toFixed(2)} · {new Date().toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-lg font-bold ${alert.status === 'high_risk' ? 'text-rose-400' : 'text-amber-400'
                                  }`}>
                                  {(alert.risk_score * 100).toFixed(1)}%
                                </div>
                                <div className={`text-[10px] uppercase font-bold tracking-wider ${alert.status === 'high_risk' ? 'text-rose-500/70' : 'text-amber-500/70'
                                  }`}>
                                  {alert.status === 'high_risk' ? 'High Risk' : 'Suspicious'}
                                </div>
                              </div>
                            </div>

                            {/* Mini SHAP for Alert */}
                            <div className="mt-3 pt-3 border-t border-zinc-700/50 grid grid-cols-2 gap-2">
                              {alert.explanation.slice(0, 2).map((exp, i) => (
                                <div key={i} className="text-xs flex justify-between items-center bg-zinc-900/50 px-2 py-1 rounded">
                                  <span className="text-zinc-400">{exp.feature}</span>
                                  <span className="text-rose-400 font-mono">+{exp.impact.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </div>

              {/* Travel Anomaly Panel */}
            </div>
            <TravelAnomalyPanel anomalies={travelAnomalies} />
          </div>

          <div className="absolute -bottom-8 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/50 to-transparent opacity-10 transform scale-y-[-1] blur-xl"></div>
        </motion.div>
      </div>
    </section>
  )
}
