// The two shapes of the airline catalog. The repo keeps only the fields people
// write (normalizeCatalog); the build adds `slug` and `assets`, which come from
// the name and the SVGs on disk, to the copy it publishes (publishCatalog).
// Keeping the generated fields out of the repo means a pull request that adds
// an airline only touches its own entry.
import sortBy from 'lodash.sortby'
import { getAirlineAssets, toFullHex, toSlug } from './index.js'
import { airlineFields } from './schema.js'

// Fields only the published catalog has
const GENERATED_FIELDS = ['slug', 'assets']

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
// order, colors in six-digit lowercase hex, and no generated fields
const normalizeCatalog = (airlines) =>
    sortBy(airlines, (a) => a.name.toLowerCase()).map((airline) => {
        const entry = Object.fromEntries(
            Object.entries(airline).filter(
                ([key]) => !GENERATED_FIELDS.includes(key),
            ),
        )
        if (entry.branding?.primary_color) {
            entry.branding = {
                ...entry.branding,
                primary_color: toFullHex(entry.branding.primary_color),
            }
        }

        return orderKeys(entry, airlineFields)
    })

// The catalog as the package ships it: every entry also gets its `slug` and
// the `assets` found in `assetsDir`. An airline with `marks` reports the files
// of the airline it names, which the build copies to its own slug.
const publishCatalog = (airlines, assetsDir = 'assets') =>
    normalizeCatalog(airlines).map((airline) => {
        const slug = toSlug(airline.name)
        const assets = getAirlineAssets(airline.marks ?? slug, assetsDir)

        return orderKeys({ ...airline, slug, assets }, airlineFields)
    })

export { normalizeCatalog, publishCatalog }
