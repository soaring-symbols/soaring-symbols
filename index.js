import airlines from './airlines.json' with { type: 'json' }

// Same list as utils/index.js, which can't be imported here: it uses fs
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

// Codes of airlines that ceased operations get reassigned, so a code can
// belong to one active airline and any number of defunct ones. The active
// airline wins; among defunct ones, the first by name does.
const setCode = (map, code, airline) => {
    if (!code) return
    const key = code.toUpperCase()
    const current = map.get(key)
    if (!current || (current.defunct && !airline.defunct)) {
        map.set(key, airline)
    }
}

for (const airline of airlines) {
    deepFreeze(airline)
    setCode(byIata, airline.iata, airline)
    setCode(byIcao, airline.icao, airline)
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
 * tried in that order. A code shared with a defunct airline finds the
 * active one.
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

export { listAirlines, getAirline, getAssetPath }
