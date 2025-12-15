import { useState } from 'react'
import { CheckCircle, AlertTriangle, TrendingUp, Play, ShieldCheck, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
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
  risk_score: number | null
  status: 'pending' | 'verified' | 'flagged' | 'high_risk'
}

export default function DashboardPreview() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null)

  // Keep a history of processed transactions for the list
  const [history, setHistory] = useState<TransactionRecord[]>([])

  const processNextTransaction = async () => {
    if (currentIndex >= testTransactions.length) {
      alert("End of test data!")
      return
    }

    setLoading(true)
    const txn = testTransactions[currentIndex]

    try {
      const response = await fetch('http://localhost:8000/score_transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(txn),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const result: AnalysisResult = await response.json()
      setCurrentResult(result)

      // Determine status based on risk score
      let status: 'verified' | 'flagged' | 'high_risk' = 'verified'
      if (result.risk_score > 0.8) status = 'high_risk'
      else if (result.risk_score > 0.5) status = 'flagged'

      // Add to history
      const newRecord: TransactionRecord = {
        id: currentIndex + 1,
        amount: txn.Amount,
        time: txn.Time,
        risk_score: result.risk_score,
        status: status
      }

      setHistory(prev => [newRecord, ...prev].slice(0, 5)) // Keep last 5
      setCurrentIndex(prev => prev + 1)

    } catch (error) {
      console.error("Error processing transaction:", error)
      alert("Failed to process transaction. Is the backend running?")
    } finally {
      setLoading(false)
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
            Live Fraud Detection Demo
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Processing live transactions via XGBoost & SHAP
          </p>
        </motion.div>

        {/* Dashboard Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Window Chrome */}
          <div className="bg-zinc-800 rounded-t-lg border border-zinc-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs text-zinc-400 font-medium">Fraud Detection Engine v1.0</span>
            </div>
            <div className="w-12"></div>
          </div>

          <div className="bg-zinc-900 rounded-b-2xl border border-zinc-800 overflow-hidden shadow-2xl">
            {/* Header / Controls */}
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-zinc-50 font-semibold text-lg">Transaction Feed</h3>
                <span className="px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-400 border border-zinc-700">
                  Buffer: {testTransactions.length - currentIndex} remaining
                </span>
              </div>

              <button
                onClick={processNextTransaction}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${loading
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                  }`}
              >
                <Play className="w-4 h-4 fill-current" />
                {loading ? 'Processing...' : 'Process Next Transaction'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">

              {/* Left Column: Recent Transactions List */}
              <div className="p-6 lg:col-span-1 bg-zinc-900/50 space-y-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                  Recent History
                </h4>
                {history.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-sm">
                    No transactions processed yet.
                    <br />
                    Click the button above to start.
                  </div>
                ) : (
                  history.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border flex items-center justify-between ${tx.status === 'high_risk' ? 'bg-rose-500/10 border-rose-500/20' :
                          tx.status === 'flagged' ? 'bg-amber-500/10 border-amber-500/20' :
                            'bg-emerald-500/10 border-emerald-500/20'
                        }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-zinc-200">
                          Transaction #{tx.id}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Amt: ${tx.amount.toFixed(2)}
                        </div>
                      </div>
                      <div className={`text-xs font-bold ${tx.status === 'high_risk' ? 'text-rose-400' :
                          tx.status === 'flagged' ? 'text-amber-400' :
                            'text-emerald-400'
                        }`}>
                        {(tx.risk_score! * 100).toFixed(1)}% Risk
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Middle/Right Column: Active Analysis */}
              <div className="lg:col-span-2 p-6">
                {!currentResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50 space-y-4 min-h-[300px]">
                    <ShieldCheck className="w-16 h-16" />
                    <p>Ready to analyze transactions</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Risk Score Card */}
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <h4 className="text-sm text-zinc-400 mb-1">Fraud Probability</h4>
                        <div className="text-4xl font-bold text-zinc-50">
                          {(currentResult.risk_score * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${currentResult.risk_score > 0.8 ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' :
                          currentResult.risk_score > 0.5 ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' :
                            'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        }`}>
                        {currentResult.risk_score > 0.8 ? <ShieldAlert className="w-5 h-5" /> :
                          currentResult.risk_score > 0.5 ? <AlertTriangle className="w-5 h-5" /> :
                            <ShieldCheck className="w-5 h-5" />}
                        <span className="font-semibold">
                          {currentResult.risk_score > 0.8 ? 'High Risk' :
                            currentResult.risk_score > 0.5 ? 'Suspicious' : 'Safe'}
                        </span>
                      </div>
                    </div>

                    {/* SHAP Explanation */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-400" />
                          AI Model Explanation (SHAP)
                        </h4>
                        <span className="text-xs text-zinc-500">Top 5 Factors</span>
                      </div>

                      <div className="space-y-3">
                        {currentResult.explanation.map((item, idx) => (
                          <div key={idx} className="group">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                {item.feature}
                              </span>
                              <span className={item.impact > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {item.impact > 0 ? '+' : ''}{item.impact.toFixed(4)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(Math.abs(item.impact) * 20, 100)}%` }}
                                className={`h-full rounded-full ${item.impact > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Reflection Effect */}
          <div className="absolute -bottom-8 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/50 to-transparent opacity-10 transform scale-y-[-1] blur-xl"></div>
        </motion.div>
      </div>
    </section>
  )
}
