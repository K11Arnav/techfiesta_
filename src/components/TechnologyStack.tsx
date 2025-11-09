import { motion } from 'framer-motion'
import { Code2, Database, Box } from 'lucide-react'

const technologies = [
  { name: 'Python', icon: Code2 },
  { name: 'TensorFlow', icon: Box },
  { name: 'React', icon: Code2 },
  { name: 'PostgreSQL', icon: Database },
  { name: 'Docker', icon: Box },
  { name: 'FastAPI', icon: Code2 },
]

export default function TechnologyStack() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold tracking-tight text-zinc-50 mb-4">
            Built with Modern Technology
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Powered by industry-leading tools and frameworks
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 overflow-x-auto pb-4 md:pb-0">
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="group px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 font-medium hover:border-zinc-700 hover:text-zinc-50 transition-all flex items-center gap-2 min-w-fit"
            >
              <tech.icon className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
              {tech.name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
