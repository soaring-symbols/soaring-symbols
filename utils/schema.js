// airlines.schema.json, compiled once with Ajv: data validation for
// generate.js, sync-data.js and the tests. Kept apart from utils/index.js so
// the SVG tooling doesn't load Ajv.
import { readFileSync } from 'fs'
import Ajv2020 from 'ajv/dist/2020.js'

const schema = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
)
const ajv = new Ajv2020({ allErrors: true })
const validateSchema = ajv.compile(schema)

// Field order for airlines.json entries, taken from the schema so the two
// can't drift apart: generate.js writes every entry's keys in this order
const airlineFields = Object.keys(schema.$defs.airline.properties)
const subsidiaryFields = Object.keys(schema.$defs.subsidiary.properties)

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

// IATA and ICAO codes must be unique among airlines still flying,
// subsidiaries included. A defunct airline may share its code with the
// airline the code was reassigned to; getAirline() then finds the active one.
const findDuplicateCodes = (airlines) => {
    const active = airlines.flatMap((a) =>
        a.defunct ? [] : [a, ...(a.subsidiaries ?? [])],
    )

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

// Check an airlines.json array against airlines.schema.json and the rules a
// schema can't express. Returns one readable message per problem, e.g.
// 'Vietnam Airlines: /branding/primary_color must match pattern ...';
// an empty array means the data is valid.
const validateAirlines = (airlines) => {
    if (!validateSchema(airlines)) {
        return validateSchema.errors.map((error) =>
            formatSchemaError(airlines, error),
        )
    }

    return findDuplicateCodes(airlines)
}

export { airlineFields, subsidiaryFields, isValidField, validateAirlines }
