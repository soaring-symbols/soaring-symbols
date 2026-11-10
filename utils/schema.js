// airlines.schema.json, compiled once with Ajv: data validation for
// generate.js, sync-data.js and the tests. Kept apart from utils/index.js so
// the SVG tooling doesn't load Ajv.
import { readFileSync } from 'fs'
import Ajv2020 from 'ajv/dist/2020.js'
import { toSlug } from './index.js'

const schema = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
)
const ajv = new Ajv2020({ allErrors: true })
// The repo's airlines.json, and the copy the build publishes with `assets`
// added to every entry
const validateSource = ajv.compile(schema)
const validatePublished = ajv.getSchema(`${schema.$id}#/$defs/published`)

// Field order for airlines.json entries, taken from the schema so the two
// can't drift apart: generate.js and the build write every entry's keys in
// this order
const airlineFields = Object.keys(schema.$defs.airline.properties)

// Whether `value` is valid for one field of an airline entry, by the same
// schema rules as the whole file
const isValidField = (field, value) =>
    ajv.getSchema(`${schema.$id}#/$defs/airline/properties/${field}`)(value)

const formatSchemaError = (airlines, error) => {
    const [, index, ...rest] = error.instancePath.split('/')
    const name = airlines[index]?.name ?? `#${index}`
    const where = rest.length ? `/${rest.join('/')}` : ''
    const detail =
        error.keyword === 'additionalProperties'
            ? `has unknown field "${error.params.additionalProperty}"`
            : error.keyword === 'enum'
              ? `must be one of: ${error.params.allowedValues.join(', ')}`
              : error.message

    return index === undefined
        ? `airlines.json ${detail}`
        : `${name}: ${where || '(entry)'} ${detail}`
}

// IATA and ICAO codes must be unique among airlines still flying. A defunct
// airline may share its code with the airline the code was reassigned to;
// getAirline() then finds the active one.
const findDuplicateCodes = (airlines) => {
    const active = airlines.filter((a) => !a.defunct)

    return ['iata', 'icao'].flatMap((field) => {
        // Map.groupBy needs Node 21; the repo supports Node 20
        const owners = new Map()
        for (const a of active) {
            if (!owners.has(a[field])) owners.set(a[field], [])
            owners.get(a[field]).push(a)
        }

        return [...owners]
            .filter(([, list]) => list.length > 1)
            .map(
                ([code, list]) =>
                    `${field.toUpperCase()} ${code} is used by more than one active airline: ${list.map((a) => a.name).join(', ')}`,
            )
    })
}

// A slug is always the slugified name, never chosen by hand
const findWrongSlugs = (airlines) =>
    airlines
        .filter((a) => a.slug !== toSlug(a.name))
        .map(
            (a) =>
                `${a.name}: slug must be "${toSlug(a.name)}", not "${a.slug}"`,
        )

// Slugs name the asset folders and what `parent` and `marks` point at, so no
// two airlines may share one, defunct or not
const findDuplicateSlugs = (airlines) => {
    const seen = new Map()

    return airlines.flatMap((a) => {
        const first = seen.get(a.slug)
        if (!first) {
            seen.set(a.slug, a)

            return []
        }

        return [
            `slug "${a.slug}" is used by more than one airline: ${first.name}, ${a.name}`,
        ]
    })
}

// `parent`, `marks` and `successor` must name another airline in the
// catalog, `marks` one with SVGs of its own (no chains), and following
// `successor` must end at an airline without one (no loops)
const findBrokenReferences = (airlines) => {
    const bySlug = new Map(airlines.map((a) => [a.slug, a]))

    // A chain longer than the catalog must loop; a loop that doesn't pass
    // through `a` is reported by its own members
    const findLoop = (a) => {
        let next = bySlug.get(a.successor)
        for (let i = 0; next && i < airlines.length; i++) {
            if (next === a) {
                return [
                    `${a.name}: successor "${a.successor}" leads back to it`,
                ]
            }
            next = bySlug.get(next.successor)
        }

        return []
    }

    return airlines.flatMap((a) =>
        ['parent', 'marks', 'successor'].flatMap((field) => {
            const slug = a[field]
            if (slug === undefined) return []
            const target = bySlug.get(slug)
            if (!target || target === a) {
                return [`${a.name}: ${field} "${slug}" is not another airline`]
            }
            if (field === 'marks' && target.marks) {
                return [
                    `${a.name}: marks "${slug}" uses the marks of "${target.marks}"; point at that airline instead`,
                ]
            }
            if (field === 'successor') return findLoop(a)

            return []
        }),
    )
}

// Check an airlines.json array against airlines.schema.json and the rules a
// schema can't express: the repo's copy by default, or with `published` the
// built one, whose entries must also have `assets`. Returns one
// readable message per problem, e.g.
// 'Vietnam Airlines: /branding/primary_color must match pattern ...';
// an empty array means the data is valid.
const validateAirlines = (airlines, { published = false } = {}) => {
    const validate = published ? validatePublished : validateSource
    if (!validate(airlines)) {
        return validate.errors.map((error) =>
            formatSchemaError(airlines, error),
        )
    }

    return [
        ...findWrongSlugs(airlines),
        ...findDuplicateSlugs(airlines),
        ...findDuplicateCodes(airlines),
        ...findBrokenReferences(airlines),
    ]
}

export { airlineFields, isValidField, validateAirlines }
