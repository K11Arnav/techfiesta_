import { useState } from "react";
import { useAuth } from '../contexts/AuthContext';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    MapPin,
    ShieldAlert,
    ShieldCheck,
    Loader2,
    Plane,
    RotateCcw,
    User,
    DollarSign,
    Clock,
    Gauge,
    Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const redIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

// Demo user profiles
const DEMO_USERS = [
    { id: "user_mumbai", name: "Arjun Mehta", city: "Mumbai", lat: 19.076, lon: 72.8777 },
    { id: "user_nyc", name: "Sarah Chen", city: "New York", lat: 40.7128, lon: -74.006 },
    { id: "user_london", name: "James Wright", city: "London", lat: 51.5074, lon: -0.1278 },
    { id: "user_tokyo", name: "Yuki Tanaka", city: "Tokyo", lat: 35.6762, lon: 139.6503 },
    { id: "user_demo", name: "Demo User", city: "New York", lat: 40.7128, lon: -74.006 },
];

// Quick city presets for location inputs
const CITY_PRESETS = [
    { name: "Mumbai", lat: 19.076, lon: 72.8777 },
    { name: "New York", lat: 40.7128, lon: -74.006 },
    { name: "London", lat: 51.5074, lon: -0.1278 },
    { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    { name: "Dubai", lat: 25.2048, lon: 55.2708 },
    { name: "São Paulo", lat: -23.5505, lon: -46.6333 },
    { name: "Singapore", lat: 1.3521, lon: 103.8198 },
];

interface TransportMode {
    mode: string;
    emoji: string;
    label: string;
    max_speed: number;
    feasible: boolean;
}

interface TravelAnalysis {
    distance_km: number;
    time_gap_seconds: number;
    time_gap_display: string;
    implied_speed_kmh: number;
    transport_modes: TransportMode[];
    verdict: string;
}

interface LocationResult {
    user_risk: number;
    location_risk: number;
    geo_distance_km: number;
    risk_tier: string;
    user_name?: string;
    user_city?: string;
}

interface DemoResult {
    txn_1: LocationResult;
    txn_2: LocationResult;
    travel_analysis: TravelAnalysis;
    fraud_detected: boolean;
}

// ---- Helpers ----
function tierColor(tier: string) {
    switch (tier) {
        case "CRITICAL": return "text-red-400";
        case "HIGH": return "text-orange-400";
        case "MEDIUM": return "text-amber-400";
        default: return "text-emerald-400";
    }
}

function verdictColor(verdict: string) {
    switch (verdict) {
        case "IMPOSSIBLE": return "text-red-400";
        case "SUSPICIOUS": return "text-orange-400";
        case "UNLIKELY": return "text-amber-400";
        default: return "text-emerald-400";
    }
}

function verdictBg(verdict: string) {
    switch (verdict) {
        case "IMPOSSIBLE": return "bg-red-500/10 border-red-500/40";
        case "SUSPICIOUS": return "bg-orange-500/10 border-orange-500/40";
        case "UNLIKELY": return "bg-amber-500/10 border-amber-500/40";
        default: return "bg-emerald-500/10 border-emerald-500/40";
    }
}

// Get a default datetime string for inputs (local ISO format without seconds)
function getDefaultDateTime(offsetMinutes: number = 0): string {
    const d = new Date(Date.now() - offsetMinutes * 60 * 1000);
    // Format: YYYY-MM-DDTHH:MM
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LocationFraudDemo() {
    const navigate = useNavigate();
    const { authFetch } = useAuth();
    const [selectedUser, setSelectedUser] = useState(DEMO_USERS[0]);
    const [amount, setAmount] = useState(500);

    // Transaction 1 inputs
    const [txn1DateTime, setTxn1DateTime] = useState(getDefaultDateTime(5)); // 5 min ago
    const [txn1Lat, setTxn1Lat] = useState("19.076");
    const [txn1Lon, setTxn1Lon] = useState("72.8777");
    const [txn1City, setTxn1City] = useState("Mumbai");

    // Transaction 2 inputs
    const [txn2DateTime, setTxn2DateTime] = useState(getDefaultDateTime(0)); // now
    const [txn2Lat, setTxn2Lat] = useState("51.5074");
    const [txn2Lon, setTxn2Lon] = useState("-0.1278");
    const [txn2City, setTxn2City] = useState("London");

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DemoResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const applyPreset = (txn: 1 | 2, city: typeof CITY_PRESETS[0]) => {
        if (txn === 1) {
            setTxn1Lat(city.lat.toString());
            setTxn1Lon(city.lon.toString());
            setTxn1City(city.name);
        } else {
            setTxn2Lat(city.lat.toString());
            setTxn2Lon(city.lon.toString());
            setTxn2City(city.name);
        }
    };

    const analyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        const lat1 = parseFloat(txn1Lat);
        const lon1 = parseFloat(txn1Lon);
        const lat2 = parseFloat(txn2Lat);
        const lon2 = parseFloat(txn2Lon);

        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
            setError("Please enter valid coordinates for both transactions.");
            setLoading(false);
            return;
        }

        // Calculate time gap in seconds
        const t1 = new Date(txn1DateTime).getTime();
        const t2 = new Date(txn2DateTime).getTime();
        const timeGapSeconds = Math.abs(t2 - t1) / 1000;

        if (timeGapSeconds < 0.001) {
            setError("Time gap must be greater than 0. Please set different timestamps.");
            setLoading(false);
            return;
        }

        try {
            const res = await authFetch("http://localhost:8000/demo/location_fraud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    user_id: selectedUser.id,
                    lat1, lon1,
                    lat2, lon2,
                    time_gap_seconds: timeGapSeconds,
                }),
            });

            if (!res.ok) throw new Error("API error");
            const data: DemoResult = await res.json();
            setResult(data);
        } catch {
            setError("Failed to connect to backend. Is the server running on port 8000?");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setResult(null);
        setError(null);
    };

    // Compute map center from both points
    const lat1Num = parseFloat(txn1Lat) || 20;
    const lon1Num = parseFloat(txn1Lon) || 0;
    const lat2Num = parseFloat(txn2Lat) || 20;
    const lon2Num = parseFloat(txn2Lon) || 0;
    const mapCenter: [number, number] = [(lat1Num + lat2Num) / 2, (lon1Num + lon2Num) / 2];

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            {/* Header */}
            <div className="bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg border border-red-500/20">
                            <Plane className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-zinc-50">
                                Impossible Travel Detection
                            </h1>
                            <p className="text-xs text-zinc-500">
                                Location Intelligence • Fraud Detection Layer
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/")}
                        className="text-sm px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-all"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Top row: User + Amount */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* User Selector */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            <User className="w-3.5 h-3.5" />
                            User Profile
                        </label>
                        <select
                            value={selectedUser.id}
                            onChange={(e) => {
                                const u = DEMO_USERS.find((d) => d.id === e.target.value);
                                if (u) { setSelectedUser(u); reset(); }
                            }}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                            {DEMO_USERS.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} — {u.city}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            <DollarSign className="w-3.5 h-3.5" />
                            Transaction Amount ($)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                            min={1}
                        />
                    </div>

                    {/* Actions */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <button
                            onClick={analyze}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-lg hover:from-red-500 hover:to-orange-400 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Search className="w-4 h-4" />
                            )}
                            {loading ? "Analyzing..." : "Analyze Travel"}
                        </button>
                        <button
                            onClick={reset}
                            className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    </div>
                </div>

                {/* Transaction Input Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Transaction 1 */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                                Transaction 1
                            </h3>
                            {txn1City && (
                                <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                                    {txn1City}
                                </span>
                            )}
                        </div>

                        {/* Timestamp */}
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                            <Clock className="w-3 h-3" /> Timestamp
                        </label>
                        <input
                            type="datetime-local"
                            value={txn1DateTime}
                            onChange={(e) => setTxn1DateTime(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors mb-3
                            [color-scheme:dark]"
                        />

                        {/* Coordinates */}
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                            <MapPin className="w-3 h-3" /> Coordinates
                        </label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Latitude"
                                    value={txn1Lat}
                                    onChange={(e) => { setTxn1Lat(e.target.value); setTxn1City(""); }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                                <span className="text-[10px] text-zinc-600 mt-0.5 block">Lat (-90 to 90)</span>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Longitude"
                                    value={txn1Lon}
                                    onChange={(e) => { setTxn1Lon(e.target.value); setTxn1City(""); }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                                <span className="text-[10px] text-zinc-600 mt-0.5 block">Lon (-180 to 180)</span>
                            </div>
                        </div>

                        {/* City Presets */}
                        <div className="flex flex-wrap gap-1.5">
                            {CITY_PRESETS.map((c) => (
                                <button
                                    key={c.name}
                                    onClick={() => applyPreset(1, c)}
                                    className={`px-2 py-1 text-[11px] rounded-md border transition-all ${txn1City === c.name
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                                        }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transaction 2 */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                                Transaction 2
                            </h3>
                            {txn2City && (
                                <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                                    {txn2City}
                                </span>
                            )}
                        </div>

                        {/* Timestamp */}
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                            <Clock className="w-3 h-3" /> Timestamp
                        </label>
                        <input
                            type="datetime-local"
                            value={txn2DateTime}
                            onChange={(e) => setTxn2DateTime(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors mb-3
                            [color-scheme:dark]"
                        />

                        {/* Coordinates */}
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                            <MapPin className="w-3 h-3" /> Coordinates
                        </label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Latitude"
                                    value={txn2Lat}
                                    onChange={(e) => { setTxn2Lat(e.target.value); setTxn2City(""); }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                                <span className="text-[10px] text-zinc-600 mt-0.5 block">Lat (-90 to 90)</span>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Longitude"
                                    value={txn2Lon}
                                    onChange={(e) => { setTxn2Lon(e.target.value); setTxn2City(""); }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                                <span className="text-[10px] text-zinc-600 mt-0.5 block">Lon (-180 to 180)</span>
                            </div>
                        </div>

                        {/* City Presets */}
                        <div className="flex flex-wrap gap-1.5">
                            {CITY_PRESETS.map((c) => (
                                <button
                                    key={c.name}
                                    onClick={() => applyPreset(2, c)}
                                    className={`px-2 py-1 text-[11px] rounded-md border transition-all ${txn2City === c.name
                                        ? "bg-red-500/15 border-red-500/40 text-red-300"
                                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                                        }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 mb-6">
                        {error}
                    </div>
                )}

                {/* Map + Results */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map */}
                    <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                Map Visualization
                            </span>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1.5 text-emerald-400">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                    Txn 1{txn1City ? ` (${txn1City})` : ""}
                                </span>
                                <span className="flex items-center gap-1.5 text-red-400">
                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                    Txn 2{txn2City ? ` (${txn2City})` : ""}
                                </span>
                            </div>
                        </div>
                        <div style={{ height: "500px" }}>
                            <MapContainer
                                center={mapCenter}
                                zoom={2}
                                style={{ height: "100%", width: "100%" }}
                                className="z-0"
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                />

                                {/* User home marker (blue) */}
                                <Marker
                                    position={[selectedUser.lat, selectedUser.lon]}
                                    icon={
                                        new L.Icon({
                                            iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                                            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
                                            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
                                        })
                                    }
                                >
                                    <Popup>
                                        <strong>{selectedUser.name}</strong><br />
                                        Home: {selectedUser.city}
                                    </Popup>
                                </Marker>

                                {/* Txn 1 pin (green) */}
                                {!isNaN(lat1Num) && !isNaN(lon1Num) && (
                                    <Marker position={[lat1Num, lon1Num]} icon={greenIcon}>
                                        <Popup>
                                            <strong>Transaction 1</strong><br />
                                            {txn1City || `${lat1Num.toFixed(4)}, ${lon1Num.toFixed(4)}`}<br />
                                            {txn1DateTime.replace("T", " ")}
                                        </Popup>
                                    </Marker>
                                )}

                                {/* Txn 2 pin (red) */}
                                {!isNaN(lat2Num) && !isNaN(lon2Num) && (
                                    <Marker position={[lat2Num, lon2Num]} icon={redIcon}>
                                        <Popup>
                                            <strong>Transaction 2</strong><br />
                                            {txn2City || `${lat2Num.toFixed(4)}, ${lon2Num.toFixed(4)}`}<br />
                                            {txn2DateTime.replace("T", " ")}
                                        </Popup>
                                    </Marker>
                                )}

                                {/* Dashed line between the two points */}
                                {result && !isNaN(lat1Num) && !isNaN(lon1Num) && !isNaN(lat2Num) && !isNaN(lon2Num) && (
                                    <Polyline
                                        positions={[[lat1Num, lon1Num], [lat2Num, lon2Num]]}
                                        pathOptions={{
                                            color: result.fraud_detected ? "#ef4444" : "#22c55e",
                                            weight: 2,
                                            dashArray: "8, 8",
                                            opacity: 0.7,
                                        }}
                                    />
                                )}
                            </MapContainer>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="space-y-4">
                        {/* Loading */}
                        <AnimatePresence>
                            {loading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="bg-zinc-900/80 border border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center gap-3"
                                >
                                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                    <p className="text-sm text-zinc-400">Analyzing travel pattern...</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Empty state */}
                        {!result && !loading && !error && (
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center">
                                <Gauge className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                                <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                                    Configure & Analyze
                                </h3>
                                <p className="text-xs text-zinc-600">
                                    Set timestamps and locations for two transactions, then click
                                    "Analyze Travel" to detect impossible travel patterns.
                                </p>
                            </div>
                        )}

                        {/* Results */}
                        <AnimatePresence>
                            {result && (
                                <>
                                    {/* Verdict Banner */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`rounded-xl p-5 border text-center ${verdictBg(result.travel_analysis.verdict)}`}
                                    >
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            {result.fraud_detected ? (
                                                <ShieldAlert className="w-6 h-6 text-red-400" />
                                            ) : (
                                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                            )}
                                            <span className={`text-lg font-bold ${verdictColor(result.travel_analysis.verdict)}`}>
                                                {result.travel_analysis.verdict === "IMPOSSIBLE"
                                                    ? "🚨 IMPOSSIBLE TRAVEL"
                                                    : result.travel_analysis.verdict === "SUSPICIOUS"
                                                        ? "⚠️ SUSPICIOUS TRAVEL"
                                                        : result.travel_analysis.verdict === "UNLIKELY"
                                                            ? "⚠️ UNLIKELY TRAVEL"
                                                            : "✅ FEASIBLE TRAVEL"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500">
                                            {result.travel_analysis.verdict === "IMPOSSIBLE"
                                                ? "Faster than any commercial aircraft — physically impossible."
                                                : result.travel_analysis.verdict === "SUSPICIOUS"
                                                    ? "Only possible by flight — suspicious for this time window."
                                                    : result.travel_analysis.verdict === "UNLIKELY"
                                                        ? "Would require high-speed rail or faster."
                                                        : "Achievable by car or slower — no anomaly."}
                                        </p>
                                    </motion.div>

                                    {/* Travel Analysis */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <Gauge className="w-4 h-4 text-zinc-500" />
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                                Travel Analysis
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            <div className="text-center">
                                                <div className="text-[10px] text-zinc-500 mb-1">Distance</div>
                                                <div className="text-lg font-bold text-zinc-200 font-mono">
                                                    {result.travel_analysis.distance_km.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-zinc-600">km</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-zinc-500 mb-1">Time Gap</div>
                                                <div className="text-lg font-bold text-zinc-200 font-mono">
                                                    {result.travel_analysis.time_gap_display}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-zinc-500 mb-1">Speed Needed</div>
                                                <div className={`text-lg font-bold font-mono ${verdictColor(result.travel_analysis.verdict)}`}>
                                                    {result.travel_analysis.implied_speed_kmh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                                <div className="text-[10px] text-zinc-600">km/h</div>
                                            </div>
                                        </div>

                                        {/* Transport Modes */}
                                        <div className="space-y-1.5">
                                            {result.travel_analysis.transport_modes.map((t) => (
                                                <div
                                                    key={t.mode}
                                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${t.feasible
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-red-500/5 border-red-500/20"
                                                        }`}
                                                >
                                                    <span className="text-xs text-zinc-300">
                                                        {t.emoji} {t.label}
                                                    </span>
                                                    <span className={`text-xs font-bold ${t.feasible ? "text-emerald-400" : "text-red-400"}`}>
                                                        {t.feasible ? "✅ Possible" : "❌ Too fast"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>

                                    {/* Risk Scores */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="grid grid-cols-2 gap-3"
                                    >
                                        {/* Txn 1 Risk */}
                                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                <span className="text-xs font-bold text-zinc-400">Txn 1</span>
                                                <span className={`text-[10px] font-bold ml-auto ${tierColor(result.txn_1.risk_tier)}`}>
                                                    {result.txn_1.risk_tier}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">User Risk</span>
                                                    <span className="text-zinc-200 font-mono">{(result.txn_1.user_risk * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Loc Risk</span>
                                                    <span className="text-zinc-200 font-mono">{(result.txn_1.location_risk * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Txn 2 Risk */}
                                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                                <span className="text-xs font-bold text-zinc-400">Txn 2</span>
                                                <span className={`text-[10px] font-bold ml-auto ${tierColor(result.txn_2.risk_tier)}`}>
                                                    {result.txn_2.risk_tier}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">User Risk</span>
                                                    <span className="text-zinc-200 font-mono">{(result.txn_2.user_risk * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Loc Risk</span>
                                                    <span className="text-zinc-200 font-mono">{(result.txn_2.location_risk * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
