import { useState, useEffect } from 'react'
import Navigation from './components/Navigation'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import DashboardPreview from './components/DashboardPreview'
import TechnologyStack from './components/TechnologyStack'
import CTA from './components/CTA'
import Footer from './components/Footer'

function App() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation scrolled={scrolled} />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <TechnologyStack />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

export default App


