import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';
import Footer from './Footer';
import { ShieldAlert, Play, Pause, Activity, FileText, Gauge, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import testTransactions from '../data/test_transactions.json';

interface SHAPFeature {
    feature: string;
    impact: number;
    direction?: string;
    strength?: string;
    narrative?: string;
}

interface ExplainabilityV2 {
    risk_tier: string;
    confidence_level: string;
    executive_summary: string;
    fraud_boundary?: { distance_to_fraud: number; interpretation: string };
    engine_influence_pct?: Record<string, number>;
}

export default function AnomalyPage() {
    const { authFetch, role } = useAuth();

    const [isStreaming, setIsStreaming] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState<number | null>(null);
    const [explanation, setExplanation] = useState<SHAPFeature[]>([]);
    const [explainabilityV2, setExplainabilityV2] = useState<ExplainabilityV2 | null>(null);
    const [currentTxn, setCurrentTxn] = useState<any>(null);
    const [lastValidScore, setLastValidScore] = useState<number | null>(null);
    const [scrolled, setScrolled] = useState(false);

    const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const indexRef = useRef(0);
    const isProcessingRef = useRef(false);
    const isStreamingRef = useRef(false);

    const filteredTransactions = useMemo(() => {
        return testTransactions.filter(txn => {
            if (role === 'admin') return true;
            return (txn as any).transaction_domain === role;
        });
    }, [role]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        return () => { if (streamRef.current) clearInterval(streamRef.current); };
    }, []);

    useEffect(() => {
        isStreamingRef.current = isStreaming;
        if (isStreaming) {
            streamRef.current = setInterval(() => { processNextTransaction(); }, 1000);
        } else if (streamRef.current) {
            clearInterval(streamRef.current);
            streamRef.current = null;
        }
        return () => { if (streamRef.current) clearInterval(streamRef.current); };
    }, [isStreaming, filteredTransactions]);

    const processNextTransaction = async () => {
        if (!isStreamingRef.current || isProcessingRef.current) return;
        if (indexRef.current >= filteredTransactions.length) {
            indexRef.current = 0;
            setCurrentIndex(0);
        }

        isProcessingRef.current = true;
        const txn = filteredTransactions[indexRef.current];

        setCurrentTxn(txn);
        setScore(null);
        setExplanation([]);
        setExplainabilityV2(null);

        try {
            const res = await authFetch('http://localhost:8000/score/iso', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txn),
            });

            if (!res.ok) throw new Error('API failed');
            const data = await res.json();

            if (data.score !== null && data.score !== undefined) {
                setScore(data.score);
                setLastValidScore(data.score);
                setExplanation(data.explanation || []);
                setExplainabilityV2(data.explainability_v2);
            }

            indexRef.current += 1;
            setCurrentIndex(indexRef.current);
        } catch (err) {
            console.error('Error in ISO stream:', err);
            if (lastValidScore !== null) setScore(lastValidScore);
        } finally {
            isProcessingRef.current = false;
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200">
            <Navigation scrolled={scrolled} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent mb-2">
                            Anomaly Engine - Isolation Forest
                        </h1>
                        <p className="text-zinc-400 max-w-2xl">
                            Detecting outliers via recursive feature partitions and decision path lengths.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsStreaming(!isStreaming)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${isStreaming
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                                : 'bg-violet-500 hover:bg-violet-400 text-white'
                                }`}
                        >
                            {isStreaming ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                            {isStreaming ? 'Stop Stream' : 'Start Stream'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left Panel: Dashboard-Style Result (4 Col) */}
                    <div className="lg:col-span-4 space-y-6">
                        {!score && !currentTxn ? (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 border-dashed">
                                <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="text-sm">Inference stream standby</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Hero Risk Block */}
                                <div className={`p-6 rounded-3xl border ${score && score >= 0.8 ? 'bg-rose-500/10 border-rose-500/20' : score && score >= 0.6 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs uppercase tracking-widest font-bold text-zinc-400">Transaction #{currentIndex}</span>
                                        {score && (score >= 0.8 ? <ShieldAlert className="w-8 h-8 text-rose-500" /> : score >= 0.6 ? <AlertTriangle className="w-8 h-8 text-amber-400" /> : <ShieldCheck className="w-8 h-8 text-emerald-400" />)}
                                    </div>
                                    <div className="flex items-end justify-between mb-4">
                                        <span className="text-6xl font-black text-zinc-50 tracking-tighter">{((score || 0) * 100).toFixed(1)}%</span>
                                        <div className={`text-xl font-bold uppercase tracking-wider ${score && score >= 0.8 ? 'text-rose-400' : score && score >= 0.6 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {score && score >= 0.8 ? 'Outlier' : score && score >= 0.6 ? 'Suspicious' : 'Normal'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {explainabilityV2?.risk_tier && (
                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase bg-zinc-950 border border-zinc-800 tracking-widest ${explainabilityV2.risk_tier === 'High Risk' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {explainabilityV2.risk_tier}
                                            </span>
                                        )}
                                        {explainabilityV2?.confidence_level && (
                                            <span className="text-[10px] font-medium text-zinc-300 flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 uppercase tracking-widest">
                                                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                                                {explainabilityV2.confidence_level}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Engine Contribution - Specific to Isolation Forest */}
                                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
                                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Engine Contributions</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-zinc-800 text-zinc-500 border-zinc-700">
                                            XGBoost 0%
                                        </span>
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-violet-500/20 text-violet-400 border-violet-500/30">
                                            Anomaly 100%
                                        </span>
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-zinc-800 text-zinc-500 border-zinc-700">
                                            Rules 0%
                                        </span>
                                    </div>
                                </div>

                                {/* Forensic Summary */}
                                {explainabilityV2?.executive_summary && (
                                    <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="w-4 h-4 text-violet-400" />
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Forensic Summary</span>
                                        </div>
                                        <div className="space-y-2">
                                            {explainabilityV2.executive_summary.split('. ').filter(Boolean).map((sentence, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <span className={`mt-0.5 font-bold ${sentence.toLowerCase().includes('below') || sentence.toLowerCase().includes('safe') || sentence.toLowerCase().includes('legitimate') || sentence.toLowerCase().includes('cleared') ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {sentence.toLowerCase().includes('below') || sentence.toLowerCase().includes('safe') || sentence.toLowerCase().includes('legitimate') || sentence.toLowerCase().includes('cleared') ? '✔' : '⚠'}
                                                    </span>
                                                    <span className="text-zinc-300 leading-relaxed font-medium">{sentence.trim()}.</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Data Details (8 Col) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Outlier Drivers */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                            <div className="flex items-center gap-2 mb-8">
                                <Activity className="w-4 h-4 text-violet-400" />
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Decision Path Drivers</h3>
                            </div>

                            {explanation.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                                    <Activity className="w-8 h-8 mb-4 opacity-10" />
                                    <p className="text-sm tracking-widest">ISOLATING PACKET PATHS...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {explanation.map((item, idx) => (
                                        <div key={idx}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">{item.feature}</span>
                                                <span className={`text-[11px] font-mono font-bold text-violet-400`}>
                                                    {item.impact.toFixed(3)}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(item.impact * 100, 100)}%` }}
                                                    className={`h-full rounded-full transition-all duration-300 bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.4)]`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Raw Forensics */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                            <div className="flex items-center gap-2 mb-8">
                                <FileText className="w-4 h-4 text-zinc-400" />
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Outlier Input Vector</h3>
                            </div>

                            {!currentTxn ? (
                                <div className="py-12 text-center text-zinc-600 italic">Waiting for transmission...</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {Object.entries(currentTxn).filter(([k]) => ['Time', 'Amount', 'V2', 'V5', 'V8', 'V11', 'V14', 'V20'].includes(k)).map(([key, val]: [string, any]) => (
                                        <div key={key} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                                            <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">{key}</span>
                                            <span className="text-sm font-mono text-zinc-200">
                                                {typeof val === 'number' ? val.toFixed(2) : val}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
