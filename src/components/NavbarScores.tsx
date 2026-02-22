import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Activity, ShieldAlert, Network } from 'lucide-react';

export default function NavbarScores() {
    const { authFetch, isAuthenticated } = useAuth();
    const [scores, setScores] = useState({
        xgb: null as number | null,
        iso: null as number | null,
        graph: null as number | null
    });

    const fetchScores = async () => {
        try {
<<<<<<< HEAD
            const [xgbRes, isoRes, graphRes] = await Promise.all([
                authFetch('http://localhost:8000/score/xgb').then(res => res.json()),
                authFetch('http://localhost:8000/score/iso').then(res => res.json()),
                authFetch('http://localhost:8000/score/graph').then(res => res.json())
=======
            // Endpoints expect a POST with a body
            const mockBody = JSON.stringify({ Amount: 100, Time: 100 });
            const [xgbRes, isoRes, graphRes] = await Promise.all([
                authFetch('http://localhost:8000/score/xgb', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: mockBody
                }).then(res => res.json()),
                authFetch('http://localhost:8000/score/iso', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: mockBody
                }).then(res => res.json()),
                authFetch('http://localhost:8000/score/graph', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: mockBody
                }).then(res => res.json())
>>>>>>> RMS
            ]);

            setScores({
                xgb: xgbRes.score,
                iso: isoRes.score,
                graph: graphRes.score
            });
        } catch (error) {
            console.error('Failed to fetch navbar scores:', error);
<<<<<<< HEAD
            // On error, we keep previous scores or they stay null (--)
=======
>>>>>>> RMS
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;

        fetchScores();
        const interval = setInterval(fetchScores, 15000); // Poll every 15s

        return () => clearInterval(interval);
    }, [isAuthenticated]);

    if (!isAuthenticated) return null;

    const formatScore = (val: number | null) =>
        val !== null && val !== undefined ? val.toFixed(2) : '--';

    return (
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-xl mx-4">
            <div className="flex items-center gap-2 group">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-medium leading-none">Fraud</span>
                    <span className="text-[11px] text-zinc-200 font-mono font-bold leading-tight">
                        {formatScore(scores.xgb)}
                    </span>
                </div>
            </div>

            <div className="w-px h-6 bg-zinc-800" />

            <div className="flex items-center gap-2 group">
                <Activity className="w-3.5 h-3.5 text-violet-500 group-hover:text-violet-400 transition-colors" />
                <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-medium leading-none">Anomaly</span>
                    <span className="text-[11px] text-zinc-200 font-mono font-bold leading-tight">
                        {formatScore(scores.iso)}
                    </span>
                </div>
            </div>

            <div className="w-px h-6 bg-zinc-800" />

            <div className="flex items-center gap-2 group">
                <Network className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-400 transition-colors" />
                <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-medium leading-none">Graph</span>
                    <span className="text-[11px] text-zinc-200 font-mono font-bold leading-tight">
                        {formatScore(scores.graph)}
                    </span>
                </div>
            </div>
        </div>
    );
}
