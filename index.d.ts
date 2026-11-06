export type AssetType = 'icon' | 'logo' | 'tail'

/** Which files exist for one asset type of an airline. */
export interface AssetInfo {
    /** `<type>.svg` (full color) exists. */
    readonly color: boolean
    /** `<type>-mono.svg` exists; always true for single-color assets. */
    readonly mono: boolean
    /**
     * Hex colors the color file paints with (fills, strokes and gradient
     * stops), lowercase; empty when there is no color file.
     */
    readonly colors: readonly string[]
}

export interface AirlineBranding {
    readonly primary_color?: string
    readonly tagline?: string
    readonly guidelines?: string
}

export interface Airline {
    readonly name: string
    /** 2-character IATA code (e.g. "VN"). */
    readonly iata: string
    /** 3-letter ICAO code (e.g. "HVN"). */
    readonly icao: string
    /** ICAO radiotelephony callsign, uppercase (e.g. "VIET NAM AIRLINES"). */
    readonly callsign?: string
    /** ISO 3166-1 alpha-2 code(s), comma-separated (e.g. "VN"). */
    readonly country: string
    readonly slug: string
    readonly website?: string
    readonly flag_carrier?: boolean
    /** e.g. "oneworld", "SkyTeam", "Star Alliance". */
    readonly alliance?: string
    /** Slug of the airline that owns this one (e.g. "airasia"). */
    readonly parent?: string
    /**
     * Slug of the airline whose marks this one uses (e.g. "airasia"). Its
     * files are still published under this airline's own slug.
     */
    readonly marks?: string
    /** IATA codes of its hub airports (e.g. ["HAN", "SGN"]). */
    readonly hubs?: readonly string[]
    /** Year founded, counting from the predecessor its history starts with. */
    readonly founded?: number
    readonly defunct?: boolean
    /** Year a defunct airline ceased operations. */
    readonly ceased?: number
    readonly vectorized?: boolean
    readonly branding?: AirlineBranding
    readonly assets: Readonly<Partial<Record<AssetType, AssetInfo>>>
}

export interface AssetPathOptions {
    /** Return the `-mono.svg` variant. */
    mono?: boolean
}

export function listAirlines(): Airline[]
/**
 * Find an airline by IATA code, ICAO code, slug or name (case-insensitive),
 * tried in that order. A code shared with a defunct airline finds the
 * active one.
 */
export function getAirline(query: string): Airline | undefined
export function getAssetPath(
    airline: Airline | string,
    type: AssetType,
    options?: AssetPathOptions,
): string | undefined
