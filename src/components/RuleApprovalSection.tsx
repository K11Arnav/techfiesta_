import { useEffect, useState } from "react";
import { Check, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Suggestion {
    target_rule: string;
    parameter: string;
    current_value: any;
    proposed_value: any;
    reasoning: string;
}

interface ApprovedSuggestion {
    target_rule: string;
    parameter: string;
    proposed_value: any;
}

export default function RuleApprovalSection() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchSuggestions = () => {
            fetch("http://localhost:8000/suggestions")
                .then((res) => res.json())
                .then((data) => {
                    setSuggestions(data);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Failed to load suggestions:", err);
                    setLoading(false);
                });
        };

        // Initial fetch
        fetchSuggestions();

        // Poll every 2 seconds
        const interval = setInterval(fetchSuggestions, 2000);

        return () => clearInterval(interval);
    }, []);

    const handleApply = async () => {
        setApplying(true);
        try {
            const payload: ApprovedSuggestion[] = suggestions.map((s) => ({
                target_rule: s.target_rule,
                parameter: s.parameter,
                proposed_value: s.proposed_value,
            }));

            const res = await fetch("http://localhost:8000/apply_rules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to apply rules");

            setSuccessMsg("Rules updated successfully! Engine reloaded.");
            setSuggestions([]);
        } catch (err) {
            console.error(err);
            alert("Error applying rules. Check console.");
        } finally {
            setApplying(false);
        }
    };

    return (
        <section id="admin-panel" className="py-24 bg-zinc-900/50 border-t border-zinc-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl font-bold tracking-tight text-zinc-50 mb-4 flex items-center justify-center gap-3">
                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                        AI Rule Optimization
                    </h2>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                        Review and approve automated adjustments to your fraud detection parameters.
                    </p>
                </motion.div>

                {/* Success Message */}
                {successMsg && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center gap-3 text-emerald-400 max-w-2xl mx-auto"
                    >
                        <Check className="w-5 h-5" />
                        {successMsg}
                    </motion.div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Loading suggestions...
                    </div>
                ) : suggestions.length === 0 && !successMsg ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center max-w-3xl mx-auto">
                        <ShieldCheck className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-zinc-300">
                            No Pending Suggestions
                        </h3>
                        <p className="text-zinc-500 mt-2">
                            The rule engine is currently optimized. Run the optimizer script to generate new recommendations.
                        </p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {suggestions.map((s, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all hover:border-emerald-500/30"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    {/* Left: Rule Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2.5 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-mono tracking-wide uppercase">
                                                {s.target_rule}
                                            </span>
                                            <span className="text-base font-semibold text-zinc-200">
                                                {s.parameter}
                                            </span>
                                        </div>
                                        <p className="text-zinc-400 text-sm leading-relaxed">
                                            <span className="text-zinc-500">Reasoning:</span>{" "}
                                            <span className="italic text-emerald-400/90">
                                                "{s.reasoning}"
                                            </span>
                                        </p>
                                    </div>

                                    {/* Right: Value Diff */}
                                    <div className="flex items-center justify-center gap-6 bg-zinc-950/50 px-8 py-4 rounded-lg border border-zinc-800 min-w-[280px]">
                                        <div className="text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">
                                                Current
                                            </div>
                                            <div className="font-mono text-lg text-zinc-400">
                                                {String(s.current_value)}
                                            </div>
                                        </div>

                                        <ArrowRight className="w-5 h-5 text-zinc-700" />

                                        <div className="text-center">
                                            <div className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold mb-1">
                                                Proposed
                                            </div>
                                            <div className="font-mono text-lg text-emerald-400 font-bold">
                                                {String(s.proposed_value)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {/* Actions */}
                        {suggestions.length > 0 && (
                            <div className="flex justify-end pt-6 border-t border-zinc-900">
                                <button
                                    onClick={handleApply}
                                    disabled={applying}
                                    className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                                >
                                    {applying ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Applying Changes...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Approve & Apply All Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
