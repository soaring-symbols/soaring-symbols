/**
 * `logo` is the horizontal lockup, or the airline's only one; `logo-stacked`
 * the vertical one (the name under the mark), for airlines that have both.
 * New types may come in a minor release, as `logo-stacked` did: skip a type
 * you don't know instead of failing.
 */
export type AssetType = 'icon' | 'logo' | 'logo-stacked' | 'tail'

/**
 * An alliance's name as airlines write it in `alliance`. New alliances may
 * come in a minor release: handle a name you don't know instead of failing.
 */
export type AllianceName =
    | 'oneworld'
    | 'SkyTeam'
    | 'Star Alliance'
    | 'U-FLY Alliance'
    | 'Value Alliance'
    | 'Vanilla Alliance'

/** Which files exist for one asset type of an airline. */
export interface AssetInfo {
    /** `<type>.svg` (full color) exists. */
    readonly color: boolean
    /** `<type>-mono.svg` exists; always true for single-color assets. */
    readonly mono: boolean
    /**
     * `<type>-dark.svg`, for dark backgrounds, exists: the airline's own
     * version when it has one, the color file for a type in
     * `branding.dark_color`, else the monochrome file in white, else (no
     * monochrome file yet) the color file when every color reads on dark
     * (3:1 against #1e1e1e).
     */
    readonly dark: boolean
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

/** The brand details of an airline or an alliance. */
export interface Branding {
    readonly primary_color?: string
    readonly tagline?: string
    readonly guidelines?: string
    /** Year the current marks were introduced; set when it has `history`. */
    readonly since?: number
    /**
     * The mark types the airline keeps in color on dark backgrounds, so
     * their `-dark.svg` is the color file instead of the monochrome one in
     * white.
     */
    readonly dark_color?: readonly AssetType[]
}

/** @deprecated Use `Branding`, which airlines and alliances share. */
export type AirlineBranding = Branding

/** Another name an airline uses now, beside its full one (e.g. "SWISS"). */
export interface Alias {
    readonly name: string
    /**
     * The slug of `name`, when it differs from the airline's: getAirline()
     * finds the airline by it.
     */
    readonly slug?: string
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

/** An alliance an airline was a member of, in `alliance_history`. */
export interface AllianceMembership {
    readonly alliance: AllianceName
    /** Year the airline joined the alliance, when known. */
    readonly since?: number
    /** Year the airline left the alliance. */
    readonly until: number
}

export interface Airline {
    readonly name: string
    /** 2-character IATA code (e.g. "VN"). */
    readonly iata: string
    /**
     * `true` when IATA gave this airline's code to another airline as well
     * and marks this holder with an asterisk (e.g. "SL*" for SAS Connect,
     * whose SL Thai Lion Air also holds). getAirline() finds the other
     * holder by the code; find this one by the code with the asterisk
     * ("SL*"), its ICAO code, slug or name.
     */
    readonly iata_duplicate?: true
    /** 3-letter ICAO code (e.g. "HVN"). */
    readonly icao: string
    /** ICAO radiotelephony callsign, uppercase (e.g. "VIET NAM AIRLINES"). */
    readonly callsign?: string
    /** ISO 3166-1 alpha-2 code of the one country it is based in (e.g. "VN"). */
    readonly country: string
    readonly slug: string
    /**
     * Other names the airline uses now beside its full `name`, such as the
     * short one on its logo (e.g. SWISS for Swiss International Air Lines).
     * getAirline() finds the airline by each one and its slug.
     */
    readonly aliases?: readonly Alias[]
    /**
     * The names and codes the airline used before its current ones, oldest
     * first (e.g. Jat Airways, ICAO JAT, until 2013 for Air Serbia).
     * getAirline() finds the airline by its former names and slugs, and by
     * its former codes when no airline has them now.
     */
    readonly former?: readonly FormerIdentity[]
    readonly website?: string
    /**
     * `true` for a national flag carrier: of its `country`, or of each
     * country in `flag_carrier_countries`.
     */
    readonly flag_carrier?: boolean
    /**
     * Codes of the countries a joint flag carrier serves, its own `country`
     * among them, e.g. ["DK", "NO", "SE"] for Scandinavian Airlines. Only on
     * a flag carrier of several countries.
     */
    readonly flag_carrier_countries?: readonly string[]
    /**
     * `true` for an airline that flies only freight, or the cargo brand of a
     * passenger airline (e.g. FedEx Express, Qatar Airways Cargo). A
     * passenger airline that also carries cargo has none.
     */
    readonly cargo?: true
    /**
     * The alliance it is a member of now, or was when it ceased, e.g.
     * "oneworld", "SkyTeam", "Star Alliance". An affiliate flying under
     * another member's membership has none.
     */
    readonly alliance?: AllianceName
    /** Alliances it was a member of before, oldest first. */
    readonly alliance_history?: readonly AllianceMembership[]
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
    readonly branding?: Branding
    readonly assets: AssetMap
    /**
     * Marks the airline used before its current ones, oldest first; absent
     * when there are none.
     */
    readonly history?: readonly HistoricalMarks[]
}

/** The asset types of an alliance's marks: it has no tail. */
export type AllianceAssetType = 'icon' | 'logo'

/**
 * An airline alliance, as airlines name it in `alliance`. Its marks are at
 * `alliances/<slug>/`.
 */
export interface Alliance {
    /** As airlines write it in `alliance` (e.g. "Star Alliance"). */
    readonly name: AllianceName
    readonly slug: string
    readonly website?: string
    /** Year the alliance was founded. */
    readonly founded?: number
    readonly defunct?: boolean
    /** Year a defunct alliance was dissolved. */
    readonly ceased?: number
    readonly branding?: Branding
    /** Empty until the alliance has SVGs. */
    readonly assets: Readonly<Partial<Record<AllianceAssetType, AssetInfo>>>
    /**
     * Marks the alliance used before its current ones, oldest first, at
     * `alliances/<slug>/history/<since>/`; absent when there are none.
     */
    readonly history?: readonly HistoricalMarks[]
}

export interface FindAirlinesOptions {
    /** Also return airlines that held the code before (`former`), after the current holders. */
    former?: boolean
}

export interface AssetPathOptions {
    /** Return the `-mono.svg` variant. */
    mono?: boolean
    /**
     * Return the `-dark.svg` variant, for dark backgrounds. Throws a
     * TypeError together with `mono`.
     */
    dark?: boolean
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
 * with a defunct airline finds the active one, a code a brand shares with
 * its parent finds the parent, and an IATA code IATA gave to two airlines
 * finds the one without `iata_duplicate` and, written with IATA's asterisk
 * ("SL*"), the one with it. Aliases, former names and their slugs find the
 * airline as current ones do; a former code only when no airline has it now.
 */
export function getAirline(query: string): Airline | undefined
/**
 * Every airline holding an IATA or ICAO code (case-insensitive), where
 * getAirline() returns one. The airline getAirline() finds by the code comes
 * first, then the other active ones, then the defunct ones, each by name.
 * With `former: true`, airlines that held the code before follow in the same
 * order. Empty when no airline holds the code.
 */
export function findAirlines(
    code: string,
    options?: FindAirlinesOptions,
): Airline[]
export function getAssetPath(
    airline: Airline | string,
    type: AssetType,
    options?: AssetPathOptions,
): string | undefined
/** All alliances, sorted by name, including those without SVGs yet. */
export function listAlliances(): Alliance[]
/**
 * Find an alliance by name, as airlines write it in `alliance` (e.g.
 * "Star Alliance"), or by slug, case-insensitive.
 */
export function getAlliance(query: string): Alliance | undefined
/**
 * Package path of one file of an alliance's marks, e.g.
 * 'soaring-symbols/alliances/star-alliance/logo.svg'.
 */
export function getAllianceAssetPath(
    alliance: Alliance | string,
    type: AllianceAssetType,
    options?: AssetPathOptions,
): string | undefined
