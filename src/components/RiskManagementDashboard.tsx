import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Shield, RefreshCw, AlertTriangle, TrendingUp, Activity, Info,
    MapPin, Zap, BarChart3, Target, FileText, Clock, Database,
    CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Gauge
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────
interface KRISummary {
    gross_fraud_loss_inr: number
    fraud_detection_rate: number
    false_positive_rate: number
    avg_sar_latency_ms: number
    operational_risk_exposure: number
    transactions_screened_today: number
}

interface AppetiteItem {
    kri_name: string
    kri_key: string
    current_value: number
    threshold: number
    status: 'GREEN' | 'AMBER' | 'RED'
    breach: boolean
}

interface ExposureTrend {
    trend: { hour: number; ore_value: number; transaction_count: number }[]
    ore_threshold: number
}

interface GeoConcentration {
    region: string
    fraud_loss: number
    transaction_count: number
    percentage: number
}

interface StressTestResult {
    scenario: string
    multiplier: number
    base_kris: KRISummary
    projected_kris: KRISummary
    projected_rag: (AppetiteItem & { base_value: number })[]
}

interface ModelPerformance {
    gini_coefficient: number
    ks_statistic: number
    psi: number
    psi_status: string
    avg_risk_score_fraud: number
    avg_risk_score_legit: number
    sample_size_fraud: number
    sample_size_legit: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8000/risk'

function formatINR(value: number): string {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(2)} K`
    return `₹${value.toFixed(2)}`
}

function formatNumber(value: number): string {
    return value.toLocaleString('en-IN')
}

const ragColors = {
    GREEN: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    AMBER: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
    RED: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400' },
}

// ── Tooltip Component ────────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false)
    return (
        <div className="relative inline-block">
            <button
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                <Info className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
                {show && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 w-56 shadow-xl"
                    >
                        {text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Skeleton Components ──────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse">
            <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
            <div className="h-8 w-32 bg-zinc-800 rounded mb-2" />
            <div className="h-2 w-16 bg-zinc-800 rounded" />
        </div>
    )
}

function SkeletonTable() {
    return (
        <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800/50 rounded-lg" />
            ))}
        </div>
    )
}

function SkeletonChart() {
    return (
        <div className="h-64 bg-zinc-800/30 rounded-2xl animate-pulse flex items-center justify-center">
            <Activity className="w-8 h-8 text-zinc-700" />
        </div>
    )
}

// ── KRI Card Metadata ────────────────────────────────────────────────────────
const kriMeta: Record<string, { label: string; icon: any; tooltip: string; format: (v: number) => string }> = {
    gross_fraud_loss_inr: {
        label: 'Gross Fraud Loss (GFL)',
        icon: AlertTriangle,
        tooltip: 'Total monetary value of transactions blocked as confirmed fraud today. A key metric under RBI Master Circular on Fraud.',
        format: formatINR,
    },
    fraud_detection_rate: {
        label: 'Fraud Detection Rate (FDR)',
        icon: Target,
        tooltip: 'Percentage of flagged transactions that were confirmed fraud (BLOCK / total flagged). Target: ≥85% per Basel III operational risk standards.',
        format: (v: number) => `${v.toFixed(1)}%`,
    },
    false_positive_rate: {
        label: 'False Positive Rate (FPR)',
        icon: XCircle,
        tooltip: 'Percentage of flagged transactions that were not confirmed fraud (REVIEW / total flagged). Lower is better — high FPR increases operational cost.',
        format: (v: number) => `${v.toFixed(1)}%`,
    },
    avg_sar_latency_ms: {
        label: 'SAR Filing Latency',
        icon: Clock,
        tooltip: 'Average time between transaction ingestion and risk decision in milliseconds. SAR = Suspicious Activity Report. Under FinCEN guidelines, delays in filing increase regulatory risk.',
        format: (v: number) => `${v.toFixed(0)} ms`,
    },
    operational_risk_exposure: {
        label: 'Operational Risk Exposure (ORE)',
        icon: TrendingUp,
        tooltip: 'Sum of amount × risk score for all non-ALLOW transactions today. Represents potential loss under Basel III Pillar 2 capital charge calculations.',
        format: formatINR,
    },
    transactions_screened_today: {
        label: 'Transactions Screened',
        icon: Activity,
        tooltip: 'Total number of transactions processed through the fraud detection pipeline today.',
        format: (v: number) => formatNumber(v),
    },
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function RiskManagementDashboard() {
    const { authFetch } = useAuth()

    // ── State ──
    const [kris, setKris] = useState<KRISummary | null>(null)
    const [appetite, setAppetite] = useState<AppetiteItem[] | null>(null)
    const [trend, setTrend] = useState<ExposureTrend | null>(null)
    const [geo, setGeo] = useState<GeoConcentration[] | null>(null)
    const [model, setModel] = useState<ModelPerformance | null>(null)
    const [stressResult, setStressResult] = useState<StressTestResult | null>(null)
    const [stressLoading, setStressLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

    // ── Data fetching ──
    const fetchAll = useCallback(async () => {
        setRefreshing(true)
        try {
            const [kriRes, appRes, trendRes, geoRes, modelRes] = await Promise.all([
                authFetch(`${API_BASE}/kri-summary`),
                authFetch(`${API_BASE}/appetite-status`),
                authFetch(`${API_BASE}/exposure-trend`),
                authFetch(`${API_BASE}/geographic-concentration`),
                authFetch(`${API_BASE}/model-performance`),
            ])

            if (kriRes.ok) setKris(await kriRes.json())
            if (appRes.ok) setAppetite(await appRes.json())
            if (trendRes.ok) setTrend(await trendRes.json())
            if (geoRes.ok) setGeo(await geoRes.json())
            if (modelRes.ok) setModel(await modelRes.json())

            setLastRefresh(new Date())
        } catch (e) {
            console.error('Risk dashboard fetch error:', e)
        } finally {
            setRefreshing(false)
        }
    }, [authFetch])

    useEffect(() => { fetchAll() }, [fetchAll])

    // ── Stress Test Handler ──
    const runStressTest = async (scenario: string, multiplier: number) => {
        setStressLoading(true)
        try {
            const res = await authFetch(`${API_BASE}/stress-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario, multiplier }),
            })
            if (res.ok) setStressResult(await res.json())
        } catch (e) {
            console.error('Stress test error:', e)
        } finally {
            setStressLoading(false)
        }
    }

    // ── RAG status for a KRI key ──
    const getRag = (key: string): 'GREEN' | 'AMBER' | 'RED' => {
        if (!appetite) return 'GREEN'
        const item = appetite.find(a => a.kri_key === key)
        return item?.status || 'GREEN'
    }

    // ── Render ──
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Shield className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Operational Risk Management</h1>
                            <p className="text-xs text-zinc-500">Basel III Pillar 2 · RBI Master Circular on Fraud</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchAll}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 text-sm font-medium text-zinc-300 hover:text-zinc-50 hover:border-white/20 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh KRIs
                        </button>
                        <a
                            href="/"
                            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-zinc-50 transition-all"
                        >
                            ← Back to Dashboard
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1: KRI SUMMARY BAR
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Key Risk Indicators — Live Monitoring
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {!kris ? (
                            [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
                        ) : (
                            Object.entries(kriMeta).map(([key, meta]) => {
                                const ragStatus = getRag(key)
                                const colors = ragColors[ragStatus]
                                const Icon = meta.icon
                                const value = kris[key as keyof KRISummary] as number
                                return (
                                    <motion.div
                                        key={key}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-5 rounded-2xl bg-white/5 backdrop-blur-xl border ${colors.border} transition-all hover:bg-white/[0.07] group`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider leading-tight">
                                                {meta.label}
                                            </span>
                                            <InfoTooltip text={meta.tooltip} />
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <span className={`text-2xl font-bold tracking-tight ${colors.text}`}>
                                                {meta.format(value)}
                                            </span>
                                            <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                                                <Icon className={`w-4 h-4 ${colors.text}`} />
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>{ragStatus}</span>
                                        </div>
                                    </motion.div>
                                )
                            })
                        )}
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2: RISK APPETITE FRAMEWORK
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-bold text-zinc-50 mb-1">
                                    Risk Appetite Framework — Board Approved Thresholds
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    Updated: {lastRefresh.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Target className="w-5 h-5 text-amber-400" />
                            </div>
                        </div>

                        {!appetite ? <SkeletonTable /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">KRI Name</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Board Threshold</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Current Value</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">RAG Status</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Breach</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50">
                                        {appetite.map((item) => {
                                            const colors = ragColors[item.status]
                                            const meta = kriMeta[item.kri_key]
                                            return (
                                                <tr key={item.kri_key} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3 px-4 font-medium text-zinc-200">{item.kri_name}</td>
                                                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                                                        {meta ? meta.format(item.threshold) : item.threshold}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-mono font-semibold ${colors.text}`}>
                                                        {meta ? meta.format(item.current_value) : item.current_value}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {item.breach ? (
                                                            <XCircle className="w-4 h-4 text-rose-400 mx-auto" />
                                                        ) : (
                                                            <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3: INTRADAY ORE TREND CHART
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-bold text-zinc-50 mb-1">
                                    Intraday ORE Trend — Operational Risk Exposure by Hour
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    Real-time hourly buckets · Board-approved threshold shown as dashed line
                                </p>
                            </div>
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>

                        {!trend ? <SkeletonChart /> : (
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={trend.trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="oreGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fill: '#71717a', fontSize: 11 }}
                                        tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                                        stroke="#3f3f46"
                                    />
                                    <YAxis
                                        tick={{ fill: '#71717a', fontSize: 11 }}
                                        tickFormatter={(v) => formatINR(v)}
                                        stroke="#3f3f46"
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            border: '1px solid #3f3f46',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#fafafa',
                                        }}
                                        labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                                        formatter={(value: any) => [formatINR(Number(value)), 'ORE']}
                                    />
                                    <ReferenceLine
                                        y={trend.ore_threshold}
                                        stroke="#ef4444"
                                        strokeDasharray="8 4"
                                        strokeWidth={2}
                                        label={{
                                            value: `Board Threshold: ${formatINR(trend.ore_threshold)}`,
                                            fill: '#ef4444',
                                            fontSize: 10,
                                            position: 'right',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="ore_value"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fill="url(#oreGradient)"
                                        animationDuration={1200}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 4: SCENARIO STRESS TEST
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-zinc-50 mb-1">
                                    Scenario Analysis — Stress Testing
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    Forward-looking projections against board-approved thresholds
                                </p>
                            </div>
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <Zap className="w-5 h-5 text-rose-400" />
                            </div>
                        </div>

                        {/* Scenario Buttons */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            {[
                                { scenario: 'volume_spike', multiplier: 5, label: 'Volume Spike (5×)', icon: ArrowUpRight, color: 'emerald' },
                                { scenario: 'geo_anomaly', multiplier: 3, label: 'Geographic Anomaly (3×)', icon: MapPin, color: 'amber' },
                                { scenario: 'model_drift', multiplier: 2, label: 'Model Drift Simulation (2×)', icon: ArrowDownRight, color: 'rose' },
                            ].map(({ scenario, multiplier, label, icon: Icon, color }) => (
                                <button
                                    key={scenario}
                                    onClick={() => runStressTest(scenario, multiplier)}
                                    disabled={stressLoading}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border
                    ${color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : ''}
                    ${color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' : ''}
                    ${color === 'rose' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' : ''}
                    disabled:opacity-50`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Stress Test Results */}
                        <AnimatePresence>
                            {stressLoading && (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                                </div>
                            )}
                            {stressResult && !stressLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <div className="overflow-x-auto mb-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">KRI</th>
                                                    <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Current</th>
                                                    <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Projected ({stressResult.multiplier}×)</th>
                                                    <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Threshold</th>
                                                    <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                                                    <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Breach</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800/50">
                                                {stressResult.projected_rag.map((item) => {
                                                    const colors = ragColors[item.status]
                                                    const meta = kriMeta[item.kri_key]
                                                    const fmt = meta ? meta.format : (v: number) => String(v)
                                                    return (
                                                        <tr key={item.kri_key} className={`transition-colors ${item.breach ? 'bg-rose-500/5' : 'hover:bg-white/[0.02]'}`}>
                                                            <td className="py-3 px-4 font-medium text-zinc-200">{item.kri_name}</td>
                                                            <td className="py-3 px-4 text-right font-mono text-zinc-400">{fmt(item.base_value)}</td>
                                                            <td className={`py-3 px-4 text-right font-mono font-semibold ${colors.text}`}>{fmt(item.current_value)}</td>
                                                            <td className="py-3 px-4 text-right font-mono text-zinc-500">{fmt(item.threshold)}</td>
                                                            <td className="py-3 px-4 text-center">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-center">
                                                                {item.breach ? <XCircle className="w-4 h-4 text-rose-400 mx-auto" /> : <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-400/80 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                        <span>Stress test results are forward-looking projections only and do not affect live system state.</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 5: MODEL RISK MANAGEMENT (MRM)
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-bold text-zinc-50 mb-1">
                                    Model Risk Management (MRM) — SR 11-7 Compliance Metrics
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    Federal Reserve SR 11-7 guidance · Basel model validation standards
                                </p>
                            </div>
                            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                <Gauge className="w-5 h-5 text-violet-400" />
                            </div>
                        </div>

                        {!model ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Gini */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        Gini Coefficient — Model Discrimination Power
                                    </div>
                                    <div className="text-3xl font-bold text-zinc-50 mb-3 font-mono">{model.gini_coefficient.toFixed(4)}</div>
                                    <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(model.gini_coefficient * 100, 100)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                            className={`h-full rounded-full ${model.gini_coefficient > 0.6 ? 'bg-emerald-500' : model.gini_coefficient > 0.3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        />
                                    </div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        {model.gini_coefficient > 0.6 ? 'Strong discrimination' : model.gini_coefficient > 0.3 ? 'Moderate discrimination' : 'Weak — review required'}
                                    </div>
                                    <div className="mt-1.5 text-[9px] text-zinc-600 italic leading-tight">
                                        Note: Metrics reflect current demo dataset sample size. Values normalize as transaction volume increases.
                                    </div>
                                </div>

                                {/* KS */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        KS Statistic — Distribution Separation
                                    </div>
                                    <div className="text-3xl font-bold text-zinc-50 mb-3 font-mono">{model.ks_statistic.toFixed(4)}</div>
                                    <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(model.ks_statistic * 100, 100)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                            className={`h-full rounded-full ${model.ks_statistic > 0.5 ? 'bg-emerald-500' : model.ks_statistic > 0.2 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        />
                                    </div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        {model.ks_statistic > 0.5 ? 'Excellent separation' : model.ks_statistic > 0.2 ? 'Adequate separation' : 'Poor — retraining recommended'}
                                    </div>
                                    <div className="mt-1.5 text-[9px] text-zinc-600 italic leading-tight">
                                        Note: Metrics reflect current demo dataset sample size. Values normalize as transaction volume increases.
                                    </div>
                                </div>

                                {/* PSI */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        PSI — Population Stability Index
                                    </div>
                                    <div className="text-3xl font-bold text-zinc-50 mb-3 font-mono">{model.psi.toFixed(4)}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                      ${model.psi < 0.1 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                model.psi < 0.25 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full
                        ${model.psi < 0.1 ? 'bg-emerald-400' : model.psi < 0.25 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                            />
                                            {model.psi < 0.01
                                                ? 'Stable — Insufficient history for drift detection (< 7 days data)'
                                                : model.psi_status}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        Basel model validation standard
                                    </div>
                                </div>

                                {/* Avg Risk Score - Fraud */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        Avg Risk Score — Fraud (BLOCK)
                                    </div>
                                    <div className="text-3xl font-bold text-rose-400 font-mono">{(model.avg_risk_score_fraud * 100).toFixed(1)}%</div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        Sample: n={formatNumber(model.sample_size_fraud)} fraud events — limited demo data
                                    </div>
                                </div>

                                {/* Avg Risk Score - Legit */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        Avg Risk Score — Legitimate (ALLOW)
                                    </div>
                                    <div className="text-3xl font-bold text-emerald-400 font-mono">{(model.avg_risk_score_legit * 100).toFixed(1)}%</div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        Sample: {formatNumber(model.sample_size_legit)} transactions
                                    </div>
                                </div>

                                {/* Score Separation */}
                                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                                        Score Separation — Fraud vs Legit
                                    </div>
                                    <div className="text-3xl font-bold text-zinc-50 font-mono">
                                        {((model.avg_risk_score_fraud - model.avg_risk_score_legit) * 100).toFixed(1)}pp
                                    </div>
                                    <div className="mt-2 text-[10px] text-zinc-500">
                                        Percentage point gap between fraud and legitimate
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 6: GEOGRAPHIC CONCENTRATION RISK
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                >
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-bold text-zinc-50 mb-1">
                                    Geographic Concentration Risk — Fraud Loss by Region
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    BCBS 239 Compliant · Risk data aggregation by geographic region
                                </p>
                            </div>
                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <MapPin className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>

                        {!geo ? <SkeletonChart /> : geo.length === 0 ? (
                            <div className="py-12 text-center text-zinc-500 text-sm">
                                No geographic fraud data available yet. Process transactions to populate.
                            </div>
                        ) : geo.length < 3 ? (
                            <div className="py-12 text-center text-zinc-500 text-sm">
                                Insufficient geographic data for concentration analysis. Run the live transaction stream to populate regional data.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {geo.map((item, idx) => {
                                    const maxLoss = geo[0]?.fraud_loss || 1
                                    const barWidth = (item.fraud_loss / maxLoss) * 100
                                    return (
                                        <div key={item.region} className="flex items-center gap-4">
                                            <div className="w-32 text-sm font-medium text-zinc-300 flex items-center gap-2">
                                                <span className="text-xs text-zinc-500 font-mono w-5">#{idx + 1}</span>
                                                {item.region}
                                            </div>
                                            <div className="flex-1 h-7 rounded-lg bg-zinc-800/50 overflow-hidden relative">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${barWidth}%` }}
                                                    transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.05 }}
                                                    className="h-full rounded-lg bg-gradient-to-r from-rose-500/40 to-rose-500/70"
                                                />
                                                <span className="absolute inset-y-0 left-3 flex items-center text-xs font-mono font-semibold text-zinc-200">
                                                    {formatINR(item.fraud_loss)}
                                                </span>
                                            </div>
                                            <div className="w-16 text-right text-xs font-mono text-zinc-400">
                                                {item.percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* ═══════════════════════════════════════════════════════════════════
            SECTION 7: AUDIT TRAIL FOOTER
        ═══════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <div className="px-6 py-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Last refreshed: {lastRefresh.toLocaleString('en-IN')}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Database className="w-3 h-3" />
                                Data source: fraud.transactions (PostgreSQL)
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <FileText className="w-3 h-3" />
                                Regulatory Framework: Basel III Pillar 2 / RBI Master Circular on Fraud
                            </span>
                            <span className="font-mono">Dashboard Version: 1.0.0</span>
                        </div>
                    </div>
                </motion.section>
            </div>
        </div>
    )
}
