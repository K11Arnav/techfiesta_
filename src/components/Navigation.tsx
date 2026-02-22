import { useState } from 'react'
import { Menu, X, MapPin, LogOut, User, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface NavigationProps {
  scrolled: boolean
}

export default function Navigation({ scrolled }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { role, logout, isAuthenticated } = useAuth()

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
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
              onClick={() => navigate('/location-demo')}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-50 transition-colors font-medium text-sm"
            >
              <MapPin className="w-3.5 h-3.5" />
              Location Demo
            </button>
            {role === 'admin' && (
              <button
                onClick={() => navigate('/risk-management')}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-50 transition-colors font-medium text-sm"
              >
                <Shield className="w-3.5 h-3.5" />
                Risk Management
              </button>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-zinc-800">
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <User className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">{role}</span>
                </div>
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="p-2 text-zinc-400 hover:text-rose-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => scrollToSection('cta')}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-500 hover:to-emerald-400 transition-all hover:scale-105 font-medium text-sm glow-emerald-hover ripple"
              >
                Try Demo
              </button>
            )}
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
              onClick={() => { navigate('/location-demo'); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 w-full text-left px-4 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 rounded-lg transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Location Demo
            </button>
            {isAuthenticated ? (
              <button
                onClick={() => { logout(); navigate('/login'); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout ({role})
              </button>
            ) : (
              <button
                onClick={() => scrollToSection('cta')}
                className="block w-full text-left px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-500 hover:to-emerald-400 transition-colors"
              >
                Try Demo
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
