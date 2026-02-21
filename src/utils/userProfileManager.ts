/**
 * userProfileManager.ts
 * ──────────────────────
 * Runtime user context enrichment layer.
 * Attaches user_id + location to raw Kaggle transactions
 * WITHOUT modifying ML features (Time, V1–V28, Amount stay untouched).
 *
 * 97% of transactions: normal location (near user's home)
 * 3% of transactions:  fraud injection (far-away continent → impossible travel)
 */

// ── User Pool (mirrors user_profiles.json) ──────────────────────────────────
interface UserProfile {
    id: string;
    name: string;
    city: string;
    homeLat: number;
    homeLon: number;
}

const USER_POOL: UserProfile[] = [
    { id: "user_mumbai", name: "Arjun Mehta", city: "Mumbai", homeLat: 19.076, homeLon: 72.8777 },
    { id: "user_nyc", name: "Sarah Chen", city: "New York", homeLat: 40.7128, homeLon: -74.006 },
    { id: "user_london", name: "James Wright", city: "London", homeLat: 51.5074, homeLon: -0.1278 },
    { id: "user_tokyo", name: "Yuki Tanaka", city: "Tokyo", homeLat: 35.6762, homeLon: 139.6503 },
    { id: "user_demo", name: "Demo User", city: "New York", homeLat: 40.7128, homeLon: -74.006 },
];

// ── Fraud injection locations (different continents) ─────────────────────────
interface FraudLocation {
    city: string;
    lat: number;
    lon: number;
}

const FRAUD_LOCATIONS: FraudLocation[] = [
    { city: "London", lat: 51.5074, lon: -0.1278 },
    { city: "Tokyo", lat: 35.6762, lon: 139.6503 },
    { city: "São Paulo", lat: -23.5505, lon: -46.6333 },
    { city: "Sydney", lat: -33.8688, lon: 151.2093 },
    { city: "Dubai", lat: 25.2048, lon: 55.2708 },
    { city: "Mumbai", lat: 19.076, lon: 72.8777 },
    { city: "Singapore", lat: 1.3521, lon: 103.8198 },
    { city: "New York", lat: 40.7128, lon: -74.006 },
];

// ── State ────────────────────────────────────────────────────────────────────
let currentUserIndex = 0;

// Track what was injected (for UI display)
export interface EnrichedInfo {
    user_id: string;
    userName: string;
    userCity: string;
    latitude: number;
    longitude: number;
    isFraudInjection: boolean;
    fraudCity?: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the next user in the cyclic rotation.
 */
export function getNextUser(): UserProfile {
    const user = USER_POOL[currentUserIndex % USER_POOL.length];
    currentUserIndex++;
    return user;
}

/**
 * Decide whether this transaction should be a fraud injection.
 * ~3% chance of injection.
 */
function shouldInjectFraud(): boolean {
    return Math.random() < 0.03;
}

/**
 * Get a fraud location that is far from the user's home.
 * Ensures we pick a city on a different continent.
 */
function getFraudLocation(user: UserProfile): FraudLocation {
    // Filter out locations too close to the user's home (within 1000km conceptually)
    const farAway = FRAUD_LOCATIONS.filter(
        (loc) => Math.abs(loc.lat - user.homeLat) > 15 || Math.abs(loc.lon - user.homeLon) > 30
    );
    return farAway[Math.floor(Math.random() * farAway.length)] || FRAUD_LOCATIONS[0];
}

/**
 * Add slight random jitter to coordinates (±0.05°, ~5km) for realism.
 */
function jitter(value: number, range: number = 0.05): number {
    return value + (Math.random() - 0.5) * 2 * range;
}

/**
 * Enrich a raw Kaggle transaction with user context.
 * Returns a NEW object — original txn fields are preserved untouched.
 *
 * @param txn - Raw transaction { Time, V1–V28, Amount }
 * @returns   - Enriched transaction { ...txn, user_id, latitude, longitude } + metadata
 */
export function enrichTransaction(txn: Record<string, any>): {
    enrichedTxn: Record<string, any>;
    info: EnrichedInfo;
} {
    const user = getNextUser();
    const inject = shouldInjectFraud();

    let lat: number;
    let lon: number;
    let fraudCity: string | undefined;

    if (inject) {
        const fraudLoc = getFraudLocation(user);
        lat = jitter(fraudLoc.lat, 0.02);
        lon = jitter(fraudLoc.lon, 0.02);
        fraudCity = fraudLoc.city;
    } else {
        // Normal: near home with slight jitter
        lat = jitter(user.homeLat, 0.05);
        lon = jitter(user.homeLon, 0.05);
    }

    // Build enriched txn — spread original + add context fields
    const enrichedTxn = {
        ...txn,
        user_id: user.id,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lon.toFixed(4)),
    };

    const info: EnrichedInfo = {
        user_id: user.id,
        userName: user.name,
        userCity: user.city,
        latitude: enrichedTxn.latitude,
        longitude: enrichedTxn.longitude,
        isFraudInjection: inject,
        fraudCity,
    };

    return { enrichedTxn, info };
}

/**
 * Reset the user rotation (useful when stream restarts).
 */
export function resetProfileManager(): void {
    currentUserIndex = 0;
}
