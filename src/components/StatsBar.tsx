import { motion } from 'framer-motion'

export default function StatsBar() {
  const stats = [
    { value: '99.2%', label: 'Accuracy' },
    { value: '<100ms', label: 'Detection' },
    { value: '$50M+', label: 'Protected' },
  ]

  return (
    <section className="py-16 bg-zinc-950 border-y border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`text-center ${
                index < stats.length - 1 ? 'md:border-r md:border-zinc-800' : ''
              }`}
            >
              <div className="text-4xl font-bold text-emerald-400 mb-2">{stat.value}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

