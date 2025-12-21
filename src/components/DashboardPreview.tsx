import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, TrendingUp, Play, Pause, ShieldCheck, ShieldAlert, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import testTransactions from '../data/test_transactions.json'

interface SHAPFeature {
  feature: string
  impact: number
}

interface AnalysisResult {
  risk_score: number
  explanation: SHAPFeature[]
}

interface TransactionRecord {
  id: number
  amount: number
  time: number
  risk_score: number
  status: 'pending' | 'verified' | 'flagged' | 'high_risk'
  explanation: SHAPFeature[]
}

export default function DashboardPreview() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null)

  // High-risk alerts
  const [alerts, setAlerts] = useState<TransactionRecord[]>([])

  // Stats
  const [stats, setStats] = useState({
    processed: 0,
    flagged: 0,
    verified: 0
  })

  const streamRef = useRef<NodeJS.Timeout | null>(null)
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

    if (indexRef.current >= testTransactions.length) {
      if (streamRef.current) {
        clearInterval(streamRef.current)
        streamRef.current = null
      }
      setIsStreaming(false)
      alert("End of test stream!")
      return
    }

    isProcessingRef.current = true

    const txn = testTransactions[indexRef.current]

    try {
      const response = await fetch('http://localhost:8000/score_transaction', {
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
          explanation: result.explanation
        }
        setAlerts(prev => [newAlert, ...prev])
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
    <section id="dashboard" className="py-24 md:py-32 bg-zinc-900">
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
          <div className="bg-zinc-800 rounded-t-lg border border-zinc-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs text-zinc-400 font-medium">CyberGuard AI Monitor</span>
            </div>
            <div className="w-12"></div>
          </div>

          <div className="bg-zinc-900 rounded-b-2xl border border-zinc-800 overflow-hidden shadow-2xl">
            {/* Header / Stats */}
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    if (indexRef.current >= testTransactions.length) {
                      indexRef.current = 0
                      setCurrentIndex(0)
                      setStats({ processed: 0, flagged: 0, verified: 0 })
                      setAlerts([])
                      setCurrentResult(null)
                    }
                    setIsStreaming(!isStreaming)
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isStreaming
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    }`}
                >
                  {isStreaming ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  {isStreaming ? 'Stop Stream' : 'Start Live Stream'}
                </button>

                <div className="flex items-center gap-4 text-sm">
                  <div className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700">
                    <span className="text-zinc-500 mr-2">Processed:</span>
                    <span className="text-zinc-200 font-mono">{stats.processed}</span>
                  </div>
                  <div className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700">
                    <span className="text-zinc-500 mr-2">Flagged:</span>
                    <span className="text-rose-400 font-mono font-bold">{stats.flagged}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Activity className={`w-4 h-4 ${isStreaming ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'}`} />
                {isStreaming ? 'System Active' : 'System Standby'}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 min-h-[500px]">

              {/* Left Column: Live Transaction Monitor */}
              <div className="lg:col-span-1 p-6 flex flex-col">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Live Feed
                </h4>

                {!currentResult ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
                      <Play className="w-6 h-6 ml-1" />
                    </div>
                    <p>Start stream to analyze</p>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Status Card */}
                    <div className={`p-6 rounded-2xl border ${currentResult.risk_score >= 0.8 ? 'bg-rose-500/10 border-rose-500/30' :
                      currentResult.risk_score >= 0.6 ? 'bg-amber-500/10 border-amber-500/30' :
                        'bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-70">
                          Transaction #{currentIndex}
                        </span>
                        {currentResult.risk_score >= 0.8 ? <ShieldAlert className="w-6 h-6 text-rose-500" /> :
                          currentResult.risk_score >= 0.6 ? <AlertTriangle className="w-6 h-6 text-amber-500" /> :
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />}
                      </div>

                      <div className="mb-2">
                        <span className="text-3xl font-bold text-zinc-100">
                          {(currentResult.risk_score * 100).toFixed(1)}%
                        </span>
                        <span className="text-sm ml-2 opacity-80">Risk Score</span>
                      </div>

                      <div className={`text-sm font-medium ${currentResult.risk_score >= 0.8 ? 'text-rose-400' :
                        currentResult.risk_score >= 0.6 ? 'text-amber-400' :
                          'text-emerald-400'
                        }`}>
                        {currentResult.risk_score >= 0.8 ? 'CRITICAL THREAT DETECTED' :
                          currentResult.risk_score >= 0.6 ? 'Suspicious Activity' :
                            'Transaction Verified Safe'}
                      </div>
                    </div>

                    {/* SHAP Chart */}
                    <div>
                      <h5 className="text-sm font-semibold text-zinc-400 mb-4">Risk Factors (SHAP)</h5>
                      <div className="space-y-2">
                        {currentResult.explanation.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-sm">
                            <span className="w-16 text-zinc-500">{item.feature}</span>
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(Math.abs(item.impact) * 20, 100)}%` }}
                                className={`h-full ${item.impact > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              />
                            </div>
                            <span className={`w-12 text-right font-mono text-xs ${item.impact > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {item.impact > 0 ? '+' : ''}{item.impact.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Threat Feed */}
              <div className="lg:col-span-2 p-6 bg-zinc-900/50">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-6 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Detected Threats
                  </span>
                  <span className="text-rose-400">{alerts.length} Alerts</span>
                </h4>

                <div className="space-y-3 h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {alerts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 border-2 border-dashed border-zinc-800 rounded-lg">
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
                          className={`p-4 rounded-lg border transition-colors group ${alert.status === 'high_risk'
                            ? 'bg-zinc-800/80 border-rose-500/20 hover:border-rose-500/40'
                            : 'bg-zinc-800/80 border-amber-500/20 hover:border-amber-500/40'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-md ${alert.status === 'high_risk'
                                ? 'bg-rose-500/10'
                                : 'bg-amber-500/10'
                                }`}>
                                {alert.status === 'high_risk'
                                  ? <ShieldAlert className="w-4 h-4 text-rose-500" />
                                  : <AlertTriangle className="w-4 h-4 text-amber-500" />
                                }
                              </div>
                              <div>
                                <div className="text-sm font-bold text-zinc-200">
                                  Transaction #{alert.id}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  ${alert.amount.toFixed(2)} • {new Date().toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${alert.status === 'high_risk' ? 'text-rose-400' : 'text-amber-400'
                                }`}>
                                {(alert.risk_score * 100).toFixed(1)}%
                              </div>
                              <div className={`text-xs uppercase font-bold tracking-wider ${alert.status === 'high_risk' ? 'text-rose-500/70' : 'text-amber-500/70'
                                }`}>
                                {alert.status === 'high_risk' ? 'High Risk' : 'Suspicious'}
                              </div>
                            </div>
                          </div>

                          {/* Mini SHAP for Alert */}
                          <div className="mt-3 pt-3 border-t border-zinc-700/50 grid grid-cols-2 gap-2">
                            {alert.explanation.slice(0, 2).map((exp, i) => (
                              <div key={i} className="text-xs flex justify-between items-center bg-zinc-900/50 px-2 py-1 rounded">
                                <span className="text-zinc-500">{exp.feature}</span>
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
          </div>

          <div className="absolute -bottom-8 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/50 to-transparent opacity-10 transform scale-y-[-1] blur-xl"></div>
        </motion.div>
      </div>
    </section>
  )
}
