import DashboardPreview from '../components/DashboardPreview'
import { ArrowLeft } from 'lucide-react'

interface DashboardPageProps {
  onBack?: () => void
  onNavigate?: (to: string) => void
}

export default function DashboardPage({ onBack, onNavigate }: DashboardPageProps) {
  const goHome = () => (onBack ? onBack() : window.history.back())

  return (
    <section className="min-h-screen py-8 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => goHome()}
                className="glass-button glass-button--ghost group px-4 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800/30"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to home
              </button>
            </div>

            {/* Quick-nav to home sections */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate ? onNavigate('/#features') : goHome()}
                className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800/30"
              >
                Features
              </button>
              <button
                onClick={() => onNavigate ? onNavigate('/#how-it-works') : goHome()}
                className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800/30"
              >
                How It Works
              </button>
            </div>
          </div>
        </div>

        <DashboardPreview />
      </div>
    </section>
  )
}
