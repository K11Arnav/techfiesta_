import { useState } from 'react'
import { Menu, X } from 'lucide-react'

interface NavigationProps {
  scrolled: boolean
  onNavigate?: (to: string) => void
}

export default function Navigation({ scrolled, onNavigate }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (id: string) => {
    // If navigating to the dashboard route, prefer client-side navigation
    if (id === 'dashboard' && onNavigate) {
      onNavigate('/dashboard')
      setMobileMenuOpen(false)
      return
    }

    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setMobileMenuOpen(false)
      return
    }

    // If we're on another page (eg /dashboard) and element isn't present,
    // use client-side navigation back to home and scroll to the section.
    if (onNavigate) {
      onNavigate(`/#${id}`)
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-xl font-bold tracking-tight text-zinc-50 hover:text-emerald-400 transition-colors"
            >
              FraudGuard
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-zinc-400 hover:text-zinc-50 transition-colors font-medium text-sm"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-zinc-400 hover:text-zinc-50 transition-colors font-medium text-sm"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('dashboard')}
              className="text-zinc-400 hover:text-zinc-50 transition-colors font-medium text-sm"
            >
              Dashboard
            </button>
            <button
              onClick={() => scrollToSection('cta')}
              className="glass-button glass-button--primary px-6 py-2 text-sm font-medium"
            >
              Try Demo
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-zinc-400 hover:text-zinc-50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800">
          <div className="px-4 pt-2 pb-4 space-y-2">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left px-4 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 rounded-lg transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left px-4 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 rounded-lg transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('dashboard')}
              className="block w-full text-left px-4 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 rounded-lg transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => scrollToSection('cta')}
              className="glass-button glass-button--primary w-full text-left px-4 py-2 text-sm font-medium"
            >
              Try Demo
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
