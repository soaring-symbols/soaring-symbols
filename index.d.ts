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
    /**
     * Year the next mark replaced it (e.g. 2025). Missing in releases before
     * it was added.
     */
    readonly until?: number
    /**
     * The airline's name on the mark: the current one, or a former one for a
     * mark used before a rename (e.g. "T'way Air"). Missing in releases
     * before it was added.
     */
    readonly name?: string
    readonly assets: AssetMap
}

export interface AirlineBranding {
    readonly primary_color?: string
    readonly tagline?: string
    readonly guidelines?: string
    /** Year the current marks were introduced; set when it has `history`. */
    readonly since?: number
}

/**
 * A name or codes an airline used before, and the year it stopped using
 * them. Holds only what changed then: at least one of `name`, `iata`, `icao`
 * and `callsign`.
 */
export interface FormerIdentity {
    readonly name?: string
    /**
     * The slug of `name`, when it differs from the airline's: getAirline()
     * finds the airline by it.
     */
    readonly slug?: string
    readonly iata?: string
    readonly icao?: string
    readonly callsign?: string
    /** Year the airline stopped using this name or these codes. */
    readonly until: number
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
     * The names and codes the airline used before its current ones, oldest
     * first (e.g. Jat Airways, ICAO JAT, until 2013 for Air Serbia).
     * getAirline() finds the airline by its former names and slugs, and by
     * its former codes when no airline has them now.
     */
    readonly former?: readonly FormerIdentity[]
    /**
     * Names the airline flew under before `name`, oldest first.
     * @deprecated Read the names in `former`; removed in 0.4.
     */
    readonly previous_names?: readonly string[]
    /**
     * The slugs of former names that differ from `slug`; the package also
     * ships the airline's current files at assets/<previous slug>/ for those
     * a release has shipped.
     * @deprecated Read `former[].slug`; removed in 0.4.
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
 * tried in that order, then by a former IATA or ICAO code. A code shared
 * with a defunct airline finds the active one, and a code a brand shares
 * with its parent finds the parent. Former names and slugs find the airline
 * as current ones do; a former code only when no airline has it now.
 */
export function getAirline(query: string): Airline | undefined
export function getAssetPath(
    airline: Airline | string,
    type: AssetType,
    options?: AssetPathOptions,
): string | undefined
