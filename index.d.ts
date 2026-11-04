export type AssetType = 'icon' | 'logo' | 'tail'

/** Which files exist for one asset type of an airline. */
export interface AssetInfo {
    /** `<type>.svg` (full color) exists. */
    readonly color: boolean
    /** `<type>-mono.svg` exists. */
    readonly mono: boolean
    /**
     * Hex fill colors found in the color file; empty when there is no color
     * file or its colors are only in gradients. A single color means the
     * color file can also be used as a monochrome mark.
     */
    readonly colors: readonly string[]
}

export interface AirlineBranding {
    readonly primary_color?: string
    readonly tagline?: string
    readonly guidelines?: string
}

/** An airline listed under a parent airline; it has no assets of its own. */
export interface Subsidiary {
    readonly name: string
    readonly iata: string
    readonly icao: string
    /** ISO 3166-1 alpha-2 code (e.g. "VN"). */
    readonly country: string
    readonly flag_carrier?: boolean
}

export interface Airline {
    readonly name: string
    /** 2-character IATA code (e.g. "VN"). */
    readonly iata: string
    /** 3-letter ICAO code (e.g. "HVN"). */
    readonly icao: string
    /** ISO 3166-1 alpha-2 code(s), comma-separated (e.g. "VN"). */
    readonly country: string
    readonly slug: string
    readonly website?: string
    readonly flag_carrier?: boolean
    /** e.g. "oneworld", "SkyTeam", "Star Alliance". */
    readonly alliance?: string
    readonly defunct?: boolean
    readonly vectorized?: boolean
    readonly branding?: AirlineBranding
    readonly assets: Readonly<Partial<Record<AssetType, AssetInfo>>>
    readonly subsidiaries?: readonly Subsidiary[]
}

export interface AssetPathOptions {
    /** Return the `-mono.svg` variant. */
    mono?: boolean
}

export function listAirlines(): Airline[]
export function getAirline(query: string): Airline | undefined
export function getAssetPath(
    airline: Airline | string,
    type: AssetType,
    options?: AssetPathOptions,
): string | undefined
