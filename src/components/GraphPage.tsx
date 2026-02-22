import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';
import Footer from './Footer';
import { ShieldAlert, Play, Pause, Activity, FileText, Gauge, AlertTriangle, ShieldCheck, Network, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import testTransactions from '../data/test_transactions.json';

interface Neighbor {
    label: number;
    amount: number;
}

interface ExplainabilityV2 {
    risk_tier: string;
    confidence_level: string;
    executive_summary: string;
    fraud_boundary?: { distance_to_fraud: number; interpretation: string };
    engine_influence_pct?: Record<string, number>;
}

export default function GraphPage() {
    const { authFetch, role } = useAuth();

    const [isStreaming, setIsStreaming] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState<number | null>(null);
    const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
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
        setNeighbors([]);
        setExplainabilityV2(null);

        try {
            const res = await authFetch('http://localhost:8000/score/graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txn),
            });

            if (!res.ok) throw new Error('API failed');
            const data = await res.json();

            if (data.score !== null && data.score !== undefined) {
                setScore(data.score);
                setLastValidScore(data.score);
                setNeighbors(data.neighbors || []);
                setExplainabilityV2(data.explainability_v2);
            }

            indexRef.current += 1;
            setCurrentIndex(indexRef.current);
        } catch (err) {
            console.error('Error in Graph stream:', err);
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
                            Graph Intelligence - Social Cluster
                        </h1>
                        <p className="text-zinc-400 max-w-2xl">
                            Analyzing network topology and behavioral proximity to identify risk clusters.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsStreaming(!isStreaming)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${isStreaming
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                                : 'bg-indigo-500 hover:bg-indigo-400 text-white'
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
                                <Network className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="text-sm">Mapping network clusters...</p>
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
                                            {score && score >= 0.8 ? 'Network Alert' : score && score >= 0.6 ? 'Outlier' : 'Valid'}
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

                                {/* Engine Contribution - Specific to Graph */}
                                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
                                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Engine Contributions</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-zinc-800 text-zinc-500 border-zinc-700">
                                            XGBoost 0%
                                        </span>
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-zinc-800 text-zinc-500 border-zinc-700">
                                            Anomaly 0%
                                        </span>
                                        <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg border bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                                            Graph 100%
                                        </span>
                                    </div>
                                </div>

                                {/* Forensic Summary */}
                                {explainabilityV2?.executive_summary && (
                                    <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="w-4 h-4 text-indigo-400" />
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

                        {/* Behavioral Neighbors */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                            <div className="flex items-center gap-2 mb-8">
                                <Users className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Behavioral Neighbors (Network Basis)</h3>
                            </div>

                            {neighbors.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                                    <Network className="w-8 h-8 mb-4 opacity-10" />
                                    <p className="text-sm tracking-widest">SEARCHING VECTOR SPACE...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                    {neighbors.slice(0, 10).map((neighbor, idx) => (
                                        <div key={idx} className={`p-4 rounded-2xl border ${neighbor.label === 1 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} flex flex-col items-center gap-2`}>
                                            <div className={`w-3 h-3 rounded-full ${neighbor.label === 1 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500'}`} />
                                            <span className="text-xs font-mono font-black text-zinc-200">${neighbor.amount.toFixed(0)}</span>
                                            <span className={`text-[10px] uppercase font-bold tracking-tight ${neighbor.label === 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {neighbor.label === 1 ? 'Fraud' : 'Valid'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Raw Forensics */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                            <div className="flex items-center gap-2 mb-8">
                                <FileText className="w-4 h-4 text-zinc-400" />
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Graph Input Vector (Centrality)</h3>
                            </div>

                            {!currentTxn ? (
                                <div className="py-12 text-center text-zinc-600 italic">Waiting for transmission...</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {Object.entries(currentTxn).filter(([k]) => ['Time', 'Amount', 'V3', 'V6', 'V9', 'V12', 'V15', 'V18', 'V21', 'V24'].includes(k)).map(([key, val]: [string, any]) => (
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
