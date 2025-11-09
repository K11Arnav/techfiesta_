import { Github, Mail } from 'lucide-react'

interface FooterProps {
  onNavigate?: (to: string) => void
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-zinc-600 text-sm font-medium">FraudGuard</div>
          <div className="flex items-center gap-6 text-zinc-600 text-sm">
            <button
              onClick={() => {
                const element = document.getElementById('features')
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="hover:text-zinc-400 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => {
                const element = document.getElementById('how-it-works')
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="hover:text-zinc-400 transition-colors"
            >
              How It Works
            </button>
            <button
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
              className="hover:text-zinc-400 transition-colors"
            >
              Dashboard
            </button>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="mailto:contact@fraudguard.com"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
              aria-label="Email"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
