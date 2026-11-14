import airlines from './airlines.json' with { type: 'json' }

// Same list as utils/index.js, which can't be imported here: it uses fs
const ASSET_TYPES = ['icon', 'logo', 'tail']

const byIata = new Map()
const byIcao = new Map()
const bySlug = new Map()
const byName = new Map()
const byFormerIata = new Map()
const byFormerIcao = new Map()
// Every airline holding a code, current or former, in catalog (name) order
const holders = new Map()
const formerHolders = new Map()

const addHolder = (map, code, airline) => {
    if (!code) return
    const key = code.toUpperCase()
    const list = map.get(key) ?? []
    if (!list.includes(airline)) map.set(key, [...list, airline])
}

const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
    }

    return value
}

// Codes of airlines that ceased operations get reassigned, so a code can
// belong to one active airline and any number of defunct ones. The active
// airline wins; among defunct ones, the first by name does. A brand that
// flies under its parent's codes (Hawaiian Airlines under Alaska Airlines)
// shares them with the parent, which wins. An IATA code IATA gave to two
// airlines (a controlled duplicate) finds the holder without the asterisk,
// i.e. without `iata_duplicate`.
const setCode = (map, code, airline, { iata = false } = {}) => {
    if (!code) return
    const key = code.toUpperCase()
    const current = map.get(key)
    if (
        !current ||
        (current.defunct && !airline.defunct) ||
        (!airline.defunct && current.parent === airline.slug) ||
        (iata &&
            !airline.defunct &&
            current.iata_duplicate &&
            !airline.iata_duplicate)
    ) {
        map.set(key, airline)
    }
}

for (const airline of airlines) {
    deepFreeze(airline)
    setCode(byIata, airline.iata, airline, { iata: true })
    // IATA writes a controlled duplicate with an asterisk ("SL*"), which
    // finds the starred holder
    if (airline.iata_duplicate) setCode(byIata, `${airline.iata}*`, airline)
    setCode(byIcao, airline.icao, airline)
    addHolder(holders, airline.iata, airline)
    addHolder(holders, airline.icao, airline)
    bySlug.set(airline.slug, airline)
    byName.set(airline.name.toLowerCase(), airline)
}
// A renamed airline is also found by the slugs and names it had before, which
// no other airline may use, and by its former codes, which another airline
// may hold now
for (const airline of airlines) {
    for (const { name, slug, iata, icao } of airline.former ?? []) {
        if (slug && !bySlug.has(slug)) bySlug.set(slug, airline)
        if (name && !byName.has(name.toLowerCase())) {
            byName.set(name.toLowerCase(), airline)
        }
        setCode(byFormerIata, iata, airline)
        setCode(byFormerIcao, icao, airline)
        addHolder(formerHolders, iata, airline)
        addHolder(formerHolders, icao, airline)
    }
}

/**
 * All airlines, sorted by name. The array is a fresh copy; the airline
 * objects are frozen.
 */
function listAirlines() {
    return airlines.slice()
}

/**
 * Find an airline by IATA code, ICAO code, slug or name (case-insensitive),
 * tried in that order. A code shared with a defunct airline finds the
 * active one, a code a brand shares with its parent finds the parent, and an
 * IATA code IATA gave to two airlines finds the one without `iata_duplicate`
 * and, written with IATA's asterisk ("SL*"), the one with it. A renamed
 * airline is also found by its former slugs and names, and returned with its
 * current slug; a former code (`former`) finds it only when no airline has
 * that code now.
 */
function getAirline(query) {
    if (typeof query !== 'string' || !query.trim()) return undefined
    const q = query.trim()
    const upper = q.toUpperCase()
    const lower = q.toLowerCase()

    return (
        byIata.get(upper) ||
        byIcao.get(upper) ||
        bySlug.get(lower) ||
        byName.get(lower) ||
        byFormerIata.get(upper) ||
        byFormerIcao.get(upper)
    )
}

/**
 * Every airline holding an IATA or ICAO code (case-insensitive), where
 * getAirline() returns one: a code reassigned from a defunct airline, one a
 * brand shares with its parent, or an IATA controlled duplicate. The airline
 * getAirline() finds by the code comes first, then the other active ones, then
 * the defunct ones, each by name. With `former: true`, airlines that held the
 * code before (`former`) follow, in the same order. Returns a fresh array,
 * empty when no airline holds the code.
 */
function findAirlines(code, options = {}) {
    if (typeof code !== 'string' || !code.trim()) return []
    const key = code.trim().toUpperCase()
    const rank = (list) => {
        const first = byIata.get(key) || byIcao.get(key)

        return [...list].sort(
            (a, b) =>
                (b === first) - (a === first) ||
                Boolean(a.defunct) - Boolean(b.defunct),
        )
    }
    const current = holders.get(key) ?? []
    if (!options.former) return rank(current)
    const former = (formerHolders.get(key) ?? []).filter(
        (airline) => !current.includes(airline),
    )

    return [...rank(current), ...rank(former)]
}

/**
 * Package path of one asset file, e.g.
 * 'soaring-symbols/assets/vietnam-airlines/logo.svg'. With `since`, the file
 * of an older mark from the airline's `history`, e.g.
 * 'soaring-symbols/assets/sun-phuquoc-airways/history/2025/logo.svg'.
 * Returns undefined when the airline, that mark or that file does not exist.
 */
function getAssetPath(airline, type, options = {}) {
    const entry = typeof airline === 'string' ? getAirline(airline) : airline
    if (!ASSET_TYPES.includes(type)) {
        throw new TypeError(
            `Unknown asset type "${type}", expected one of: ${ASSET_TYPES.join(', ')}`,
        )
    }
    const { since } = options
    const assets =
        since === undefined
            ? entry?.assets
            : entry?.history?.find((mark) => mark.since === since)?.assets
    const asset = assets?.[type]
    const mono = Boolean(options.mono)
    if (!asset || !(mono ? asset.mono : asset.color)) return undefined
    const dir =
        since === undefined ? entry.slug : `${entry.slug}/history/${since}`

    return `soaring-symbols/assets/${dir}/${type}${mono ? '-mono' : ''}.svg`
}

export { listAirlines, getAirline, findAirlines, getAssetPath }
