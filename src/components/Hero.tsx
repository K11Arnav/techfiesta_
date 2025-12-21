import { ArrowRight, Play, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import GradientBlinds from './GradientBlinds'

interface Transaction {
  id: number
  amount: string
  status: 'verified' | 'flagged' | 'review'
  location: string
  time: string
}

const mockTransactions: Transaction[] = [
  { id: 1, amount: '$1,234.56', status: 'verified', location: 'New York, US', time: '2s ago' },
  { id: 2, amount: '$9,876.54', status: 'flagged', location: 'Moscow, RU', time: '5s ago' },
  { id: 3, amount: '$456.78', status: 'verified', location: 'San Francisco, US', time: '8s ago' },
  { id: 4, amount: '$2,345.67', status: 'review', location: 'London, UK', time: '12s ago' },
]

export default function Hero() {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)
  const navigate = useNavigate()

  useEffect(() => {
    const interval = setInterval(() => {
      setTransactions((prev) => {
        const newTx = {
          id: Date.now(),
          amount: `$${(Math.random() * 10000).toFixed(2)}`,
          status: ['verified', 'flagged', 'review'][Math.floor(Math.random() * 3)] as Transaction['status'],
          location: ['New York, US', 'London, UK', 'Tokyo, JP', 'Berlin, DE'][Math.floor(Math.random() * 4)],
          time: 'now',
        }
        return [newTx, ...prev].slice(0, 4)
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'flagged':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />
      case 'review':
        return <Clock className="w-4 h-4 text-amber-400" />
    }
  }

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'verified':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'flagged':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      case 'review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    }
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-950"
    >
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <GradientBlinds
          gradientColors={['#10b981', '#059669', '#047857']}
          angle={0}
          noise={0}
          blindCount={16}
          blindMinWidth={95}
          spotlightRadius={0.5}
          distortAmount={0}
          mouseDampening={0.15}
          mixBlendMode="screen"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 z-10">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl md:text-7xl font-bold tracking-tighter mb-6"
          >
            <span className="bg-gradient-to-br from-zinc-50 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Stop Fraud in
            </span>
            <br />
            <span className="bg-gradient-to-br from-emerald-400 via-cyan-400 to-emerald-300 bg-clip-text text-transparent">
              Real-Time
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            AI-powered transaction analysis that catches suspicious activity in
            milliseconds, not hours.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <button
              onClick={() => scrollToSection('dashboard')}
              className="group px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-lg font-semibold rounded-lg hover:from-emerald-500 hover:to-emerald-400 transition-all hover:scale-105 shadow-xl glow-emerald-hover ripple flex items-center gap-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              View Live Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => scrollToSection('how-it-works')}
              className="group px-8 py-4 bg-transparent text-zinc-400 text-lg font-semibold rounded-lg border border-zinc-800 hover:border-zinc-700 hover:text-zinc-50 transition-all hover:scale-105 flex items-center gap-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </button>

            <button
              onClick={() => scrollToSection('admin-panel')}
              className="group px-8 py-4 bg-zinc-900 border border-zinc-700 text-zinc-300 text-lg font-semibold rounded-lg hover:bg-zinc-800 hover:text-white transition-all hover:scale-105 flex items-center gap-2 min-h-[44px]"
            >
              Admin Panel
            </button>
          </motion.div>

          {/* Floating Transaction Feed */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: 1 }}
            animate={{ opacity: 1, y: 0, rotate: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md mt-32 hidden lg:block"
          >
            <div className="relative backdrop-blur-xl bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-50">Live Transactions</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-zinc-500">Live</span>
                </div>
              </div>
              <div className="space-y-3">
                {transactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(tx.status)}
                      <div>
                        <div className="text-sm font-semibold text-zinc-50">{tx.amount}</div>
                        <div className="text-xs text-zinc-500">{tx.location}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
