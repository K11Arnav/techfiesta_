import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import Navigation from './components/Navigation'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import DashboardPreview from './components/DashboardPreview'
import TechnologyStack from './components/TechnologyStack'
import CTA from './components/CTA'
import Footer from './components/Footer'

import InputPage from './components/InputPage'
import ResultsPage from './components/ResultsPage'
import RuleApprovalSection from './components/RuleApprovalSection'
import FeatureSpaceGraph from './components/FeatureSpaceGraph'
import LocationFraudDemo from './components/LocationFraudDemo'
import LoginPage from './components/LoginPage'
import FraudPage from './components/FraudPage'
import AnomalyPage from './components/AnomalyPage'
import GraphPage from './components/GraphPage'
<<<<<<< HEAD
=======
import RiskManagementDashboard from './components/RiskManagementDashboard'
>>>>>>> RMS

// ── Protected Route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <Routes>

      {/* Login Page */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Landing Page */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-zinc-950">
              <Navigation scrolled={scrolled} />
              <main>
                <Hero />
                <StatsBar />
                <Features />
                <HowItWorks />
                <DashboardPreview />
                <FeatureSpaceGraph />
                <RuleApprovalSection />
                <TechnologyStack />
                <CTA />
              </main>
              <Footer />
            </div>
          </ProtectedRoute>
        }
      />

      {/* New Input Page */}
      <Route path="/input" element={<ProtectedRoute><InputPage /></ProtectedRoute>} />

      {/* New Results Page */}
      <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />

      {/* Location Fraud Demo */}
      <Route path="/location-demo" element={<ProtectedRoute><LocationFraudDemo /></ProtectedRoute>} />

      {/* Independent Model Pages */}
      <Route path="/fraud" element={<ProtectedRoute><FraudPage /></ProtectedRoute>} />
      <Route path="/anomaly" element={<ProtectedRoute><AnomalyPage /></ProtectedRoute>} />
      <Route path="/graph" element={<ProtectedRoute><GraphPage /></ProtectedRoute>} />

<<<<<<< HEAD
=======
      {/* Risk Management Dashboard (Admin) */}
      <Route path="/risk-management" element={<ProtectedRoute><RiskManagementDashboard /></ProtectedRoute>} />

>>>>>>> RMS
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
