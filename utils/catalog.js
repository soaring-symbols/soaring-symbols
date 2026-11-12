// The two shapes of the airline catalog. The repo keeps only the fields people
// write, `slug` included (normalizeCatalog); the build adds `assets` and
// `history`, which come from the SVGs on disk, the slugs of former names
// (in `former`, and in the deprecated `previous_names`/`previous_slugs`),
// and `predecessors`, the reverse of `successor`, to the copy it publishes
// (publishCatalog).
// Keeping generated fields out of the repo means a pull request that adds an
// airline only touches its own entry.
import sortBy from 'lodash.sortby'
import {
    formerNames,
    formerSlugs,
    getAirlineAssets,
    getAirlineHistory,
    toFullHex,
    toSlug,
} from './index.js'
import { airlineFields } from './schema.js'

// Fields only the published catalog has
const GENERATED_FIELDS = [
    'previous_names',
    'previous_slugs',
    'assets',
    'history',
    'predecessors',
]

// Before `former`, the repo kept former names in `previous_names`, which the
// build now derives from `former`: refuse one that `former` doesn't list
// rather than drop it
const checkPreviousNames = (airline) => {
    const missing = (airline.previous_names ?? []).filter(
        (name) => !formerNames(airline).includes(name),
    )
    if (missing.length) {
        throw new Error(
            `${airline.name}: move previous_names ${missing.map((n) => `"${n}"`).join(', ')} into former, each with the year it ended (see "Renames and mergers" in CONTRIBUTING.md)`,
        )
    }
}

// The items of `former` without the `slug` the build adds
const sourceFormer = (former) => former.map(({ slug, ...item }) => item)

const FORMER_FIELDS = ['name', 'slug', 'iata', 'icao', 'callsign', 'until']

// The items of `former` with the slug of each name that differs from the
// airline's own
const publishedFormer = (airline) =>
    airline.former.map((item) => {
        const slug = item.name && toSlug(item.name)

        return orderKeys(
            { ...item, ...(slug && slug !== airline.slug && { slug }) },
            FORMER_FIELDS,
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

// The catalog as the repo keeps it: sorted by name, keys in the schema's
// order, colors in six-digit lowercase hex, a `slug` from the name where an
// entry has none yet, and no generated fields
const normalizeCatalog = (airlines) =>
    sortBy(airlines, (a) => a.name.toLowerCase()).map((airline) => {
        checkPreviousNames(airline)
        const entry = Object.fromEntries(
            Object.entries(airline).filter(
                ([key]) => !GENERATED_FIELDS.includes(key),
            ),
        )
        entry.slug ??= toSlug(entry.name)
        if (Array.isArray(entry.former))
            entry.former = sourceFormer(entry.former)
        if (entry.branding?.primary_color) {
            entry.branding = {
                ...entry.branding,
                primary_color: toFullHex(entry.branding.primary_color),
            }
        }

        return orderKeys(entry, airlineFields)
    })

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

// The catalog as the package ships it: every entry also gets the `assets`
// found in `assetsDir`, the `history` of its older marks when it has any
// (each with the years it was used and the name on it),
// the slug of each former name that had another one (in `former` and the
// deprecated `previous_names`/`previous_slugs`), and `predecessors`
// when it carried on a defunct airline. An airline with
// `marks` reports the current files of the airline it names, which the
// build copies to its own slug, and no history.
const publishCatalog = (airlines, assetsDir = 'assets') => {
    const catalog = normalizeCatalog(airlines)
    const predecessorsOf = getPredecessors(catalog)

    return catalog.map((airline) => {
        const assets = getAirlineAssets(
            airline.marks ?? airline.slug,
            assetsDir,
        )

        // Each older mark was used until the next one, the last until the
        // current marks (branding.since, which validation requires then)
        const older = airline.marks
            ? []
            : getAirlineHistory(airline.slug, assetsDir)
        const history = older.map(({ since, name, assets }, i) => {
            // Left out when branding.since is missing, which validation reports
            const until = older[i + 1]?.since ?? airline.branding?.since

            return { since, ...(until && { until }), name, assets }
        })

        const predecessors = predecessorsOf.get(airline.slug)
        // previous_names and previous_slugs are deprecated, kept for readers
        // of 0.3 until 0.4: `former` holds the names and their slugs
        const previousNames = formerNames(airline)
        const previousSlugs = formerSlugs(airline)

        return orderKeys(
            {
                ...airline,
                ...(previousNames.length && { previous_names: previousNames }),
                ...(previousSlugs.length && { previous_slugs: previousSlugs }),
                ...(Array.isArray(airline.former) && {
                    former: publishedFormer(airline),
                }),
                ...(predecessors && { predecessors }),
                assets,
                ...(history.length && { history }),
            },
            airlineFields,
        )
    })
}

export { normalizeCatalog, publishCatalog }
