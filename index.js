import airlines from './airlines.json' with { type: 'json' }

const ASSET_TYPES = ['icon', 'logo', 'tail']

const byIata = new Map()
const byIcao = new Map()
const bySlug = new Map()
const byName = new Map()

const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
    }

    return value
}

for (const airline of airlines) {
    deepFreeze(airline)
    if (airline.iata) byIata.set(airline.iata.toUpperCase(), airline)
    if (airline.icao) byIcao.set(airline.icao.toUpperCase(), airline)
    bySlug.set(airline.slug, airline)
    byName.set(airline.name.toLowerCase(), airline)
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
 * tried in that order.
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
        byName.get(lower)
    )
}

/**
 * Package path of one asset file, e.g.
 * 'soaring-symbols/assets/vietnam-airlines/logo.svg'.
 * Returns undefined when the airline or that file does not exist.
 */
function getAssetPath(airline, type, options = {}) {
    const entry = typeof airline === 'string' ? getAirline(airline) : airline
    if (!ASSET_TYPES.includes(type)) {
        throw new TypeError(
            `Unknown asset type "${type}", expected one of: ${ASSET_TYPES.join(', ')}`,
        )
    }
    const asset = entry?.assets?.[type]
    const mono = Boolean(options.mono)
    if (!asset || !(mono ? asset.mono : asset.color)) return undefined

    return `soaring-symbols/assets/${entry.slug}/${type}${mono ? '-mono' : ''}.svg`
}

export { listAirlines, getAirline, getAssetPath }
