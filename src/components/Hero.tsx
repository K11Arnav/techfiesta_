import { ArrowRight, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import GradientBlinds from './GradientBlinds'

interface HeroProps {
  onNavigate?: (to: string) => void
}

export default function Hero({ onNavigate }: HeroProps) {
  const scrollToSection = (id: string) => {
    if (id === 'dashboard' && onNavigate) {
      onNavigate('/dashboard')
      return
    }
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-950"
    >
      {/* Background: GradientBlinds - Full screen background */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <GradientBlinds
          gradientColors={['#34d399', '#22d3ee']}
          angle={0}
          noise={0.2}
          blindCount={12}
          blindMinWidth={50}
          spotlightRadius={0.5}
          spotlightSoftness={1}
          spotlightOpacity={0.8}
          mouseDampening={0.15}
          distortAmount={0}
          shineDirection="left"
          mixBlendMode="lighten"
        />
      </div>

      {/* Existing Hero Content - All content preserved */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl md:text-7xl font-bold tracking-tighter mb-6 pointer-events-none"
          >
            <span className="bg-gradient-to-br from-zinc-50 via-zinc-200 to-zinc-400 bg-clip-text text-transparent pointer-events-none">
              Stop Fraud in
            </span>
            <br />
            <span className="bg-gradient-to-br from-emerald-400 via-cyan-400 to-emerald-300 bg-clip-text text-transparent pointer-events-none">
              Real-Time
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed pointer-events-none"
          >
            AI-powered transaction analysis that catches suspicious activity in
            milliseconds, not hours.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={() => scrollToSection('dashboard')}
              className="glass-button glass-button--primary group px-8 py-4 text-lg font-semibold flex items-center gap-2 min-h-[44px] focus:outline-none"
            >
              View Live Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => scrollToSection('how-it-works')}
              className="glass-button glass-button--ghost group px-8 py-4 text-lg font-semibold flex items-center gap-2 min-h-[44px] focus:outline-none"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
