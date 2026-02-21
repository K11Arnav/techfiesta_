import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthState {
    token: string | null
    role: string | null
    isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    authFetch: (url: string, opts?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
    const [role, setRole] = useState<string | null>(() => localStorage.getItem('auth_role'))

    const isAuthenticated = !!token

    // Sync to localStorage
    useEffect(() => {
        if (token) {
            localStorage.setItem('auth_token', token)
            localStorage.setItem('auth_role', role || '')
        } else {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_role')
        }
    }, [token, role])

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Login failed' }))
                return { success: false, error: err.detail || 'Login failed' }
            }
            const data = await res.json()
            setToken(data.access_token)
            setRole(data.role)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e.message || 'Network error' }
        }
    }

    const logout = () => {
        setToken(null)
        setRole(null)
    }

    const authFetch = async (url: string, opts: RequestInit = {}) => {
        const headers: Record<string, string> = {
            ...(opts.headers as Record<string, string> || {}),
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const res = await fetch(url, { ...opts, headers })
        // Auto-logout on 401
        if (res.status === 401) {
            logout()
        }
        return res
    }

    return (
        <AuthContext.Provider value={{ token, role, isAuthenticated, login, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}

export default AuthContext
