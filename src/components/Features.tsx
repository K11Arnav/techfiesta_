import { Brain, Shield, TrendingUp, BarChart3, Bell, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Activity,
    title: 'Real-Time Analysis',
    description:
      'Ingest and analyze transactions instantly as they occur, providing immediate fraud detection without delays.',
    hero: true,
    visualization: 'transaction-flow',
  },
  {
    icon: Brain,
    title: 'ML Anomaly Detection',
    description:
      'Advanced machine learning models detect unusual patterns and behaviors that traditional rules miss.',
    visualization: 'risk-gauge',
  },
  {
    icon: Shield,
    title: 'Rule-Based Logic',
    description:
      'Customizable rules engine for known fraud patterns, location checks, and transaction limits.',
    visualization: 'rule-builder',
  },
  {
    icon: TrendingUp,
    title: 'Risk Scoring',
    description:
      'Intelligent 0-100 risk assessment for every transaction with explainable AI insights.',
    visualization: 'score-bar',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description:
      'Real-time notifications with context and recommended actions for flagged transactions.',
    visualization: 'alert-preview',
  },
  {
    icon: BarChart3,
    title: 'Visual Dashboard',
    description:
      'Comprehensive analytics dashboard with filters, charts, and transaction monitoring.',
    visualization: 'mini-chart',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-zinc-50 mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Everything you need to detect and prevent fraud in real-time
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`group bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 glow-emerald-hover shine-effect ${
                feature.hero ? 'md:col-span-2' : ''
              }`}
            >
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-6 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <feature.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-50 mb-3">
                {feature.title}
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                {feature.description}
              </p>

              {/* Visualizations */}
              {feature.visualization === 'transaction-flow' && (
                <div className="space-y-2">
                  {[
                    { amount: '$1,234', status: 'verified', time: '< 50ms' },
                    { amount: '$5,678', status: 'review', time: '< 80ms' },
                    { amount: '$9,012', status: 'verified', time: '< 45ms' },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-zinc-800/50 rounded border border-zinc-800"
                    >
                      <span className="text-xs text-zinc-400">{tx.amount}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          tx.status === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{tx.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {feature.visualization === 'risk-gauge' && (
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="transform -rotate-90 w-24 h-24">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-zinc-800"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${0.75 * 251.2} 251.2`}
                      className="text-emerald-400"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-emerald-400">75</span>
                  </div>
                </div>
              )}

              {feature.visualization === 'rule-builder' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-zinc-800/50 rounded border border-zinc-800 text-zinc-400 font-mono">
                    if amount &gt; $10,000
                  </div>
                  <div className="p-2 bg-zinc-800/50 rounded border border-zinc-800 text-zinc-400 font-mono">
                    if location != user.location
                  </div>
                  <div className="p-2 bg-zinc-800/50 rounded border border-zinc-800 text-zinc-400 font-mono">
                    if velocity &gt; 5/min
                  </div>
                </div>
              )}

              {feature.visualization === 'score-bar' && (
                <div className="space-y-2">
                  {[
                    { label: 'Low', value: 25, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-400' },
                    { label: 'Medium', value: 60, colorClass: 'text-amber-400', bgClass: 'bg-amber-400' },
                    { label: 'High', value: 85, colorClass: 'text-rose-400', bgClass: 'bg-rose-400' },
                  ].map((score, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">{score.label}</span>
                        <span className={score.colorClass}>{score.value}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${score.bgClass} rounded-full`}
                          style={{ width: `${score.value}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {feature.visualization === 'alert-preview' && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-rose-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-rose-400">Alert</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    High-value transaction detected: $9,876.54
                  </p>
                </div>
              )}

              {feature.visualization === 'mini-chart' && (
                <div className="h-20 bg-zinc-800/50 rounded border border-zinc-800 flex items-end justify-around gap-1 p-2">
                  {[60, 45, 70, 55, 80, 65, 75].map((height, i) => (
                    <div
                      key={i}
                      className="bg-emerald-400 rounded-t flex-1"
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
