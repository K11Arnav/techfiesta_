import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import { ShieldCheck, LogIn, AlertCircle } from 'lucide-react'

export default function LoginPage() {
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const result = await login(email, password)
        setLoading(false)
        if (!result.success) {
            setError(result.error || 'Login failed')
        }
        // On success, AuthContext updates → App re-renders → redirect happens
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
            {/* Background glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-md"
            >
                {/* Logo / branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                        <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Fraud Detection System</h1>
                    <p className="text-sm text-zinc-500 mt-1">Sign in to access the dashboard</p>
                </div>

                {/* Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                                placeholder="user@example.com"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    {/* Demo credentials hint */}
                    <div className="mt-6 pt-5 border-t border-zinc-800">
                        <p className="text-[11px] text-zinc-600 text-center uppercase tracking-wider font-semibold mb-3">Demo Accounts</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            {[
                                { role: 'admin', email: 'admin@fraud.io' },
                                { role: 'retail', email: 'retail@fraud.io' },
                                { role: 'corporate', email: 'corp@fraud.io' },
                                { role: 'merchant', email: 'merchant@fraud.io' },
                                { role: 'card', email: 'card@fraud.io' },
                                { role: 'international', email: 'intl@fraud.io' },
                            ].map((d) => (
                                <button
                                    key={d.role}
                                    type="button"
                                    onClick={() => {
                                        setEmail(d.email)
                                        setPassword('demo123')
                                    }}
                                    className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors text-left"
                                >
                                    <span className="text-zinc-400 font-semibold uppercase">{d.role}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-zinc-700 text-center mt-2">Password: demo123</p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
