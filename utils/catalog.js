// The two shapes of the airline catalog. The repo keeps only the fields people
// write, `slug` included (normalizeCatalog); the build adds `assets` and
// `history`, which come from the SVGs on disk, to the copy it publishes
// (publishCatalog).
// Keeping generated fields out of the repo means a pull request that adds an
// airline only touches its own entry.
import sortBy from 'lodash.sortby'
import {
    getAirlineAssets,
    getAirlineHistory,
    toFullHex,
    toSlug,
} from './index.js'
import { airlineFields } from './schema.js'

// Fields only the published catalog has
const GENERATED_FIELDS = ['assets', 'history']

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
        const entry = Object.fromEntries(
            Object.entries(airline).filter(
                ([key]) => !GENERATED_FIELDS.includes(key),
            ),
        )
        entry.slug ??= toSlug(entry.name)
        if (entry.branding?.primary_color) {
            entry.branding = {
                ...entry.branding,
                primary_color: toFullHex(entry.branding.primary_color),
            }
        }

        return orderKeys(entry, airlineFields)
    })

// The catalog as the package ships it: every entry also gets the `assets`
// found in `assetsDir`, and the `history` of its older marks when it has
// any. An airline with `marks` reports the current files of the airline it
// names, which the build copies to its own slug, and no history.
const publishCatalog = (airlines, assetsDir = 'assets') =>
    normalizeCatalog(airlines).map((airline) => {
        const assets = getAirlineAssets(
            airline.marks ?? airline.slug,
            assetsDir,
        )

        const history = airline.marks
            ? []
            : getAirlineHistory(airline.slug, assetsDir)

        return orderKeys(
            { ...airline, assets, ...(history.length && { history }) },
            airlineFields,
        )
    })

export { normalizeCatalog, publishCatalog }
