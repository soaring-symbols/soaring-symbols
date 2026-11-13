// airports.json: the latitude and longitude of every hub an airline in the
// catalog lists, by IATA code, e.g. { "SGN": { "lat": 10.82, "lon": 106.65 } }.
// sync-data.js fills in a new hub's from Wikidata; one Wikidata lacks is
// added by hand. Repo tooling only: generate.js tidies and checks the file,
// build.js publishes it as dist/airports.json.

// Every hub the catalog lists, sorted
export const hubCodes = (airlines) =>
    [...new Set(airlines.flatMap((airline) => airline.hubs ?? []))].sort()

// The file as generate.js writes it: one entry per hub, sorted by code, each
// with `lat` then `lon`; airports no airline lists any more are dropped
export function normalizeAirports(airports, airlines) {
    return Object.fromEntries(
        hubCodes(airlines)
            .filter((code) => airports[code])
            .map((code) => {
                const { lat, lon } = airports[code]

                return [code, { lat, lon }]
            }),
    )
}

// One readable message per problem: a hub without coordinates, or an entry
// whose code or coordinates can't be right. Empty when the file is valid.
export function findAirportProblems(airports, airlines) {
    const owners = (code) =>
        airlines
            .filter((airline) => airline.hubs?.includes(code))
            .map((airline) => airline.name)
            .join(', ')
    const missing = hubCodes(airlines)
        .filter((code) => !airports[code])
        .map(
            (code) =>
                `${code} is a hub of ${owners(code)} but has no coordinates; run npm run sync:data -- --write or add it by hand`,
        )
    const malformed = Object.entries(airports).flatMap(([code, place]) => {
        const { lat, lon } = place ?? {}
        const problems = [
            !/^[A-Z]{3}$/.test(code) && 'is not a three-letter IATA code',
            !(Number.isFinite(lat) && Math.abs(lat) <= 90) &&
                'needs a lat between -90 and 90',
            !(Number.isFinite(lon) && Math.abs(lon) <= 180) &&
                'needs a lon between -180 and 180',
            Object.keys(place ?? {}).some(
                (key) => !['lat', 'lon'].includes(key),
            ) && 'may only have lat and lon',
        ].filter(Boolean)

        return problems.map((problem) => `${code} ${problem}`)
    })

    return [...missing, ...malformed]
}
