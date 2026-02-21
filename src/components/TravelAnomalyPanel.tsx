import { useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plane, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Marker icons
const greenIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [20, 33],
    iconAnchor: [10, 33],
    popupAnchor: [1, -28],
    shadowSize: [33, 33],
});

const redIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [20, 33],
    iconAnchor: [10, 33],
    popupAnchor: [1, -28],
    shadowSize: [33, 33],
});

// ── Types (NO identity fields) ───────────────────────────────────────────────
export interface TravelAnomaly {
    id: number;
    userId: string;
    direction: string;
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    distanceKm: number;
    isImpossible: boolean;
    timestamp: string;
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
    anomalies: TravelAnomaly[];
}

export default function TravelAnomalyPanel({ anomalies }: Props) {
    const [expanded, setExpanded] = useState(true);
    const [selectedAnomaly, setSelectedAnomaly] = useState<TravelAnomaly | null>(
        null
    );

    if (anomalies.length === 0) return null;

    const latest = anomalies.slice(0, 5);
    const mapTarget = selectedAnomaly || latest[0];
    const mapCenter: [number, number] = [
        (mapTarget.fromLat + mapTarget.toLat) / 2,
        (mapTarget.fromLon + mapTarget.toLon) / 2,
    ];

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-red-500/20 bg-zinc-900/80"
        >
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-red-500/10 rounded">
                        <Plane className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                        🚨 Impossible Travel Detected
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded-full font-mono">
                        {anomalies.length}
                    </span>
                </div>
                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-6 pb-4"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Anomaly List */}
                            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                {latest.map((a) => (
                                    <motion.div
                                        key={a.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={() => setSelectedAnomaly(a)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedAnomaly?.id === a.id
                                            ? "border-red-500/40 bg-red-500/5"
                                            : "border-zinc-800 bg-zinc-800/50 hover:border-zinc-700"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-zinc-400 font-mono">
                                                    {a.userId}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-red-500/10 border-red-500/30 text-red-400">
                                                    IMPOSSIBLE
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                {a.timestamp}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                            <MapPin className="w-3 h-3 text-red-400 flex-shrink-0" />
                                            <span className="font-mono">
                                                {a.distanceKm.toFixed(0)} km {a.direction}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Mini Map */}
                            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-800">
                                <div className="bg-zinc-800/80 px-3 py-2 border-b border-zinc-700 flex items-center gap-2">
                                    <Plane className="w-3 h-3 text-red-400" />
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                        Route Visualization
                                    </span>
                                </div>
                                <div style={{ height: "210px" }}>
                                    <MapContainer
                                        center={mapCenter}
                                        zoom={2}
                                        style={{ height: "100%", width: "100%" }}
                                        className="z-0"
                                        zoomControl={false}
                                        attributionControl={false}
                                    >
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

                                        <Marker
                                            position={[mapTarget.fromLat, mapTarget.fromLon]}
                                            icon={greenIcon}
                                        >
                                            <Popup>
                                                <strong>Previous Location</strong>
                                            </Popup>
                                        </Marker>

                                        <Marker
                                            position={[mapTarget.toLat, mapTarget.toLon]}
                                            icon={redIcon}
                                        >
                                            <Popup>
                                                <strong>Current Location</strong>
                                                <br />
                                                {mapTarget.distanceKm.toFixed(0)} km {mapTarget.direction}
                                            </Popup>
                                        </Marker>

                                        <Polyline
                                            positions={[
                                                [mapTarget.fromLat, mapTarget.fromLon],
                                                [mapTarget.toLat, mapTarget.toLon],
                                            ]}
                                            pathOptions={{
                                                color: "#ef4444",
                                                weight: 2,
                                                dashArray: "6, 6",
                                                opacity: 0.7,
                                            }}
                                        />
                                    </MapContainer>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
