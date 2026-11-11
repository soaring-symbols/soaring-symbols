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

export type AssetMap = Readonly<Partial<Record<AssetType, AssetInfo>>>

/**
 * One of the marks an airline used before its current ones. It was used from
 * `since` until the next entry's `since`, the last entry until the current
 * marks. Its files are at `assets/<slug>/history/<since>/`.
 */
export interface HistoricalMarks {
    /** Year the mark was introduced (e.g. 1984). */
    readonly since: number
    readonly assets: AssetMap
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
    /**
     * Names the airline flew under before `name`, oldest first (e.g.
     * ["Binter Canarias"] for Binter). getAirline() finds it by them.
     */
    readonly previous_names?: readonly string[]
    /**
     * The slugs of `previous_names` that differ from `slug`. getAirline()
     * finds the airline by them, and the package also ships its current files
     * at assets/<previous slug>/.
     */
    readonly previous_slugs?: readonly string[]
    readonly website?: string
    readonly flag_carrier?: boolean
    /** e.g. "oneworld", "SkyTeam", "Star Alliance". */
    readonly alliance?: string
    /** Slug of the airline group this one is a subsidiary of (e.g. "airasia"). */
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
    /**
     * Slug of the airline that carried on this defunct one after a merger, a
     * refounding, or a move into or out of a group's brand (e.g. "air-india"
     * for Vistara).
     */
    readonly successor?: string
    /**
     * Slugs of the defunct airlines whose `successor` is this one, the
     * earliest to cease first; absent when there are none.
     */
    readonly predecessors?: readonly string[]
    /**
     * The SVGs were vectorized by hand.
     * @deprecated Removed in 0.3; nothing reads it.
     */
    readonly vectorized?: boolean
    readonly branding?: AirlineBranding
    readonly assets: AssetMap
    /**
     * Marks the airline used before its current ones, oldest first; absent
     * when there are none.
     */
    readonly history?: readonly HistoricalMarks[]
}

export interface AssetPathOptions {
    /** Return the `-mono.svg` variant. */
    mono?: boolean
    /**
     * Return the file of the older mark introduced that year, from the
     * airline's `history`, instead of the current one.
     */
    since?: number
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
