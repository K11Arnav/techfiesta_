import { Database, Cpu, Bell } from 'lucide-react'
import { motion } from 'framer-motion'

const steps = [
  {
    number: 1,
    icon: Database,
    title: 'Ingest',
    description: 'Real-time data streaming from multiple sources with instant normalization.',
  },
  {
    number: 2,
    icon: Cpu,
    title: 'Analyze',
    description: 'ML + Rules processing detects anomalies and calculates risk scores.',
  },
  {
    number: 3,
    icon: Bell,
    title: 'Alert',
    description: 'Dashboard + Notifications for immediate review and action.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-zinc-50 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            A simple three-step process to protect your business
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting Lines - Desktop Only */}
          <div className="hidden lg:block absolute top-12 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-zinc-800 animate-dash"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative text-center"
              >
                {/* Step Number Circle */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 text-2xl font-bold mb-6 relative z-10 border border-emerald-500/20">
                  {step.number}
                </div>

                {/* Icon */}
                <motion.div
                  whileHover={{ rotate: 5 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6 flex justify-center"
                >
                  <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center text-emerald-400 border border-zinc-800">
                    <step.icon className="w-10 h-10" aria-hidden="true" />
                  </div>
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-zinc-50 mb-3">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
