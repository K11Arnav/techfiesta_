import { useState, useEffect, useCallback } from 'react'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import TechnologyStack from './components/TechnologyStack'
import CTA from './components/CTA'
import Footer from './components/Footer'
import DashboardPage from './pages/DashboardPage'

function App() {
  const [scrolled, setScrolled] = useState(false)
  const [path, setPath] = useState<string>(() => window.location.pathname || '/')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    // supports hashes like '/#features' or full paths
    const [pathnamePart, hashPart] = to.split('#')
    const pathname = pathnamePart || '/'
    const hash = hashPart || ''

    const targetUrl = hash ? `${pathname}#${hash}` : pathname
    const currentUrl = window.location.pathname + (window.location.hash || '')
    if (targetUrl === currentUrl) return

    window.history.pushState({}, '', targetUrl)
    setPath(pathname)

    // scroll to top for page transitions
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // if a hash was provided, scroll to that element after render
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 80)
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation scrolled={scrolled} onNavigate={navigate} />
      <main>
        {path === '/dashboard' ? (
          <DashboardPage onBack={() => navigate('/')} onNavigate={navigate} />
        ) : (
          <>
            <Hero onNavigate={navigate} />
            <StatsBar />
            <Features />
            <HowItWorks />
            <TechnologyStack />
            <CTA onNavigate={navigate} />
          </>
        )}
      </main>
      <Footer onNavigate={navigate} />
    </div>
  )
}

export default App


