import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

interface CTAProps {
  onNavigate?: (to: string) => void
}

export default function CTA({ onNavigate }: CTAProps) {
  return (
    <section
      id="cta"
      className="py-24 md:py-32 bg-gradient-to-br from-emerald-600 to-cyan-600"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            Ready to stop fraud?
          </h2>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (onNavigate) {
                onNavigate('/dashboard')
                return
              }
              const element = document.getElementById('dashboard')
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' })
              }
            }}
            className="glass-button glass-button--primary group px-8 py-4 text-zinc-900 text-lg font-semibold flex items-center gap-2 min-h-[44px] mx-auto"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
}
