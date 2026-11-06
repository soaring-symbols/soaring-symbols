import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import slugify from 'slugify'
import Ajv2020 from 'ajv/dist/2020.js'

const toSlug = (name) => {
    return slugify(name, {
        lower: true,
        strict: true,
    })
}

// Hex colors an SVG paints with: fill, stroke and gradient stops, as
// attributes or inside style, so gradient marks are not mistaken for
// single-color ones
const PAINT_COLOR =
    /(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi

// The six-digit lowercase form of a hex color, so #fff and #ffffff count
// as one color: #F60 -> #ff6600
const toFullHex = (hex) =>
    (hex.length === 4
        ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
        : hex
    ).toLowerCase()

const extractColorsFromSvg = (filePath) => {
    const content = readFileSync(filePath, 'utf8')

    return [
        ...new Set(
            [...content.matchAll(PAINT_COLOR)].map(([, color]) =>
                toFullHex(color),
            ),
        ),
    ]
}

// The monochrome version of a single-color SVG: its one color becomes
// currentColor, the way every hand-made -mono.svg is drawn
const toMonoSvg = (svg) =>
    svg.replace(PAINT_COLOR, (match, color) =>
        match.replace(color, 'currentColor'),
    )

const assetTypes = ['icon', 'logo', 'tail']

// Write <type>-mono.svg next to every single-color <type>.svg, so each such
// asset ships a monochrome file. Multi-color assets keep their hand-made
// -mono.svg. Returns the paths it wrote.
const writeDerivedMonos = (slug, assetsDir = 'assets') => {
    const written = []
    assetTypes.forEach((assetType) => {
        const colorPath = join(assetsDir, slug, `${assetType}.svg`)
        if (!existsSync(colorPath)) return
        if (extractColorsFromSvg(colorPath).length !== 1) return

        const monoPath = join(assetsDir, slug, `${assetType}-mono.svg`)
        const mono = toMonoSvg(readFileSync(colorPath, 'utf8'))
        if (existsSync(monoPath) && readFileSync(monoPath, 'utf8') === mono) {
            return
        }
        writeFileSync(monoPath, mono)
        written.push(monoPath)
    })

    return written
}

// Describe which files exist for each asset type of an airline:
// { logo: { color: true, mono: false, colors: ['#d99e09'] }, ... }
// `colors` comes from the color file and is empty when there is none.
// Repo tooling only: the published library reads this from airlines.json.
const getAirlineAssets = (slug, assetsDir = 'assets') => {
    const airlineDir = join(assetsDir, slug)

    const assets = {}
    assetTypes.forEach((assetType) => {
        const colorPath = join(airlineDir, `${assetType}.svg`)
        const color = existsSync(colorPath)
        const mono = existsSync(join(airlineDir, `${assetType}-mono.svg`))

        if (!color && !mono) return

        assets[assetType] = {
            color,
            mono,
            colors: color ? extractColorsFromSvg(colorPath) : [],
        }
    })

    return assets
}

const schema = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
)
const validateSchema = new Ajv2020({ allErrors: true }).compile(schema)

// Field order for airlines.json entries, taken from the schema so the two
// can't drift apart: generate.js writes every entry's keys in this order
const airlineFields = Object.keys(schema.$defs.airline.properties)
const subsidiaryFields = Object.keys(schema.$defs.subsidiary.properties)

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
            owners.set(a[field], [...(owners.get(a[field]) ?? []), a])
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

export {
    airlineFields,
    subsidiaryFields,
    assetTypes,
    toSlug,
    toFullHex,
    getAirlineAssets,
    writeDerivedMonos,
    validateAirlines,
}
