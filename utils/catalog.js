// The two shapes of the airline catalog. The repo keeps only the fields people
// write, `slug` included (normalizeCatalog); the build adds `assets` and
// `history`, which come from the SVGs on disk, the slugs of aliases and
// former names (in `aliases` and `former`), and `predecessors`, the reverse of `successor`, to the copy it publishes
// (publishCatalog).
// Keeping generated fields out of the repo means a pull request that adds an
// airline only touches its own entry.
import sortBy from 'lodash.sortby'
import {
    AIRLINES_DIR,
    ALLIANCES_DIR,
    assetTypes,
    borrowedTypes,
    borrowedEra,
    getAirlineAssets,
    hasOwnMarks,
    getAirlineHistory,
    toFullHex,
    toSlug,
} from './index.js'
import { airlineFields, allianceFields } from './schema.js'

// Fields only the published catalog has
const GENERATED_FIELDS = ['assets', 'history', 'predecessors']

// The items of `aliases` or `former` without the `slug` the build adds
const withoutSlugs = (items) => items.map(({ slug, ...item }) => item)

const ALIAS_FIELDS = ['name', 'slug']
const FORMER_FIELDS = ['name', 'slug', 'iata', 'icao', 'callsign', 'until']

// The items of `aliases` or `former` with the slug of each name that differs
// from the airline's own
const withSlugs = (items, airline, fields) =>
    items.map((item) => {
        const slug = item.name && toSlug(item.name)

        return orderKeys(
            { ...item, ...(slug && slug !== airline.slug && { slug }) },
            fields,
        )
    })

// A copy of the object with its keys in the given order; unknown keys go
// last so the schema check can report them
const orderKeys = (object, fields) =>
    Object.fromEntries(
        Object.entries(object).sort(
            ([a], [b]) =>
                (fields.indexOf(a) + 1 || Infinity) -
                (fields.indexOf(b) + 1 || Infinity),
        ),
    )

// A catalog as the repo keeps it, airlines or alliances: sorted by name,
// keys in the schema's order (`fields`), colors in six-digit lowercase hex,
// a `slug` from the name where an entry has none yet, and no generated
// fields
const normalizeEntries = (entries, fields) =>
    sortBy(entries, (a) => a.name.toLowerCase()).map((item) => {
        const entry = Object.fromEntries(
            Object.entries(item).filter(
                ([key]) => !GENERATED_FIELDS.includes(key),
            ),
        )
        entry.slug ??= toSlug(entry.name)
        for (const field of ['aliases', 'former']) {
            if (Array.isArray(entry[field]))
                entry[field] = withoutSlugs(entry[field])
        }
        if (entry.branding?.primary_color) {
            entry.branding = {
                ...entry.branding,
                primary_color: toFullHex(entry.branding.primary_color),
            }
        }

        return orderKeys(entry, fields)
    })

const normalizeCatalog = (airlines) => normalizeEntries(airlines, airlineFields)

// The slugs of the defunct airlines each airline carried on, by its slug:
// those whose `successor` names it, the earliest to cease first
const getPredecessors = (airlines) => {
    const predecessors = new Map()
    const ceased = sortBy(
        airlines.filter((a) => a.successor),
        (a) => a.ceased ?? Infinity,
    )
    for (const a of ceased) {
        predecessors.set(a.successor, [
            ...(predecessors.get(a.successor) ?? []),
            a.slug,
        ])
    }

    return predecessors
}

// The older marks in <assetsDir>/<slug>/history/, oldest first, each used
// until the next one and the last until the current marks (branding.since,
// which validation requires then)
const publishedHistory = (entry, assetsDir) => {
    const older = getAirlineHistory(entry.slug, assetsDir)

    return older.map(({ since, name, assets }, i) => {
        // Left out when branding.since is missing, which validation reports
        const until = older[i + 1]?.since ?? entry.branding?.since

        return { since, ...(until && { until }), name, assets }
    })
}

// The catalog as the package ships it: every entry also gets the `assets`
// found in `assetsDir`, the `history` of its older marks when it has any
// (each with the years it was used and the name on it),
// the slug of each alias and former name that has another one (in `aliases`
// and `former`), and
// `predecessors`
// when it carried on a defunct airline. An airline with
// `marks` reports the current files of the airline it names (for a defunct
// one that ceased before those came in, the older ones it flew with:
// borrowedEra), which the build copies to its own slug, and no
// history; with `marks_types`, only
// those types come from there, the others and any history from its own
// folder. The airline it names may itself take types from another
// (`marks_types`), and those come through too.
// An airline's own assets with the types in `types` taken from `shared`
// instead, in the usual type order
const sharedTypes = (own, shared, types) =>
    Object.fromEntries(
        assetTypes
            .map((type) => [
                type,
                types.includes(type) ? shared[type] : own[type],
            ])
            .filter(([, info]) => info),
    )

const publishCatalog = (airlines, assetsDir = AIRLINES_DIR) => {
    const catalog = normalizeCatalog(airlines)
    const predecessorsOf = getPredecessors(catalog)
    const bySlug = new Map(catalog.map((a) => [a.slug, a]))
    const historyOf = new Map(
        catalog
            .filter(hasOwnMarks)
            .map((a) => [a.slug, publishedHistory(a, assetsDir)]),
    )

    // The assets an airline takes from the one in `marks`: the older ones
    // it flew with when it ceased before that airline's current marks
    // (borrowedEra), else that airline's published assets
    const borrowedAssets = (airline, depth) => {
        const owner = bySlug.get(airline.marks)
        if (!owner) return {}
        const era = borrowedEra(airline, {
            ...owner,
            history: historyOf.get(owner.slug),
        })
        if (era !== undefined) return era?.assets ?? {}

        // A chain longer than the catalog must loop; the schema reports it
        return depth < catalog.length ? assetsOf(owner, depth + 1) : {}
    }

    // An airline's assets: its own, with the types it borrows taken from
    // the published assets of the airline in `marks`. Shared marks keep the
    // colors their owner keeps on dark.
    const assetsOf = (airline, depth = 0) => {
        const own = hasOwnMarks(airline)
            ? getAirlineAssets(
                  airline.slug,
                  assetsDir,
                  airline.branding?.dark_color,
              )
            : {}
        const shared = borrowedAssets(airline, depth)

        return sharedTypes(own, shared, borrowedTypes(airline))
    }

    return catalog.map((airline) => {
        const assets = assetsOf(airline)

        const history = historyOf.get(airline.slug) ?? []

        const predecessors = predecessorsOf.get(airline.slug)

        return orderKeys(
            {
                ...airline,
                ...(Array.isArray(airline.aliases) && {
                    aliases: withSlugs(airline.aliases, airline, ALIAS_FIELDS),
                }),
                ...(Array.isArray(airline.former) && {
                    former: withSlugs(airline.former, airline, FORMER_FIELDS),
                }),
                ...(predecessors && { predecessors }),
                assets,
                ...(history.length && { history }),
            },
            airlineFields,
        )
    })
}

const normalizeAlliances = (alliances) =>
    normalizeEntries(alliances, allianceFields)

// The alliance catalog as the package ships it: every entry also gets the
// `assets` found in alliances/<slug>/ (empty until it has SVGs) and the
// `history` of its older marks when it has any, like an airline's
const publishAlliances = (alliances, assetsDir = ALLIANCES_DIR) =>
    normalizeAlliances(alliances).map((alliance) => {
        const history = publishedHistory(alliance, assetsDir)

        return orderKeys(
            {
                ...alliance,
                assets: getAirlineAssets(
                    alliance.slug,
                    assetsDir,
                    alliance.branding?.dark_color,
                ),
                ...(history.length && { history }),
            },
            allianceFields,
        )
    })

export {
    normalizeCatalog,
    publishCatalog,
    normalizeAlliances,
    publishAlliances,
}
