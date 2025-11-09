import { CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DashboardPreview() {
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
            Powerful Dashboard
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Monitor and manage fraud detection in real-time
          </p>
        </motion.div>

        {/* Dashboard Preview with macOS-style window */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          {/* macOS Window Chrome */}
          <div className="bg-zinc-800 rounded-t-lg border border-zinc-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs text-zinc-400 font-medium">Fraud Detection Dashboard</span>
            </div>
            <div className="w-12"></div>
          </div>

          {/* Dashboard Content */}
          <div className="bg-zinc-900 rounded-b-2xl border border-zinc-800 overflow-hidden shadow-2xl glow-emerald-hover">
            {/* Dashboard Header */}
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-zinc-50 font-semibold text-lg">Live Transactions</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-zinc-400 text-sm">Live</span>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium border border-emerald-500/20">
                  All Transactions
                </button>
                <button className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-800/50 hover:text-zinc-50 border border-zinc-800 transition-colors">
                  Flagged
                </button>
                <button className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-800/50 hover:text-zinc-50 border border-zinc-800 transition-colors">
                  Verified
                </button>
                <button className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-800/50 hover:text-zinc-50 border border-zinc-800 transition-colors">
                  High Risk
                </button>
              </div>

              {/* Transaction List */}
              <div className="space-y-3 mb-8">
                {[
                  { status: 'verified', amount: '$1,234.56', location: 'New York, US', time: '2s ago', risk: 'Low' },
                  { status: 'flagged', amount: '$9,876.54', location: 'Moscow, RU', time: '5s ago', risk: 'High' },
                  { status: 'verified', amount: '$456.78', location: 'San Francisco, US', time: '8s ago', risk: 'Low' },
                  { status: 'review', amount: '$2,345.67', location: 'London, UK', time: '12s ago', risk: 'Medium' },
                ].map((tx, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      tx.status === 'flagged'
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : tx.status === 'review'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {tx.status === 'verified' && (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      )}
                      {tx.status === 'flagged' && (
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                      )}
                      {tx.status === 'review' && (
                        <Clock className="w-5 h-5 text-amber-400" />
                      )}
                      <div>
                        <div className="font-semibold text-zinc-50">{tx.amount}</div>
                        <div className="text-sm text-zinc-400">{tx.location}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-medium ${
                          tx.risk === 'High'
                            ? 'text-rose-400'
                            : tx.risk === 'Medium'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {tx.risk} Risk
                      </div>
                      <div className="text-xs text-zinc-500">{tx.time}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-zinc-50">Fraud Detection Trends</h4>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="h-32 bg-zinc-900 rounded flex items-end justify-around gap-2 p-2">
                  {[60, 45, 70, 55, 80, 65, 75].map((height, i) => (
                    <div
                      key={i}
                      className="bg-emerald-400 rounded-t flex-1"
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Reflection (non-interactive) */}
          <div className="absolute -bottom-8 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/50 to-transparent opacity-10 transform scale-y-[-1] blur-xl pointer-events-none z-0"></div>
        </motion.div>
      </div>
    </section>
  )
}
