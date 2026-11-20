// airlines.schema.json and alliances.schema.json, compiled once with Ajv:
// data validation for generate.js, sync-data.js and the tests. Kept apart
// from utils/index.js so the SVG tooling doesn't load Ajv.
import { readFileSync } from 'fs'
import Ajv2020 from 'ajv/dist/2020.js'
import {
    ALLIANCES_DIR,
    DARK_BACKGROUND,
    borrowedTypes,
    MIN_DARK_CONTRAST,
    aliasNames,
    aliasSlugs,
    formerNames,
    formerSlugs,
    readsOnDark,
    toSlug,
} from './index.js'

const schema = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
)
const ajv = new Ajv2020({ allErrors: true })
// The repo's airlines.json, and the copy the build publishes with `assets`
// added to every entry
const validateSource = ajv.compile(schema)
const validatePublished = ajv.getSchema(`${schema.$id}#/$defs/published`)

// alliances.json refers to airlines.schema.json's definitions, so it is
// compiled after it
const allianceSchema = JSON.parse(
    readFileSync(new URL('../alliances.schema.json', import.meta.url), 'utf8'),
)
const validateAlliancesSource = ajv.compile(allianceSchema)
const validateAlliancesPublished = ajv.getSchema(
    `${allianceSchema.$id}#/$defs/published`,
)
// Every alliance airlines.json may name, which alliances.json must list
const allianceNames = schema.$defs.alliance.enum

// Field order for airlines.json entries, taken from the schema so the two
// can't drift apart: generate.js and the build write every entry's keys in
// this order
const airlineFields = Object.keys(schema.$defs.airline.properties)
const allianceFields = Object.keys(allianceSchema.$defs.alliance.properties)

// Whether `value` is valid for one field of an airline entry, by the same
// schema rules as the whole file
const isValidField = (field, value) =>
    ajv.getSchema(`${schema.$id}#/$defs/airline/properties/${field}`)(value)

const formatSchemaError = (airlines, error, file = 'airlines.json') => {
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
        ? `${file} ${detail}`
        : `${name}: ${where || '(entry)'} ${detail}`
}

// IATA and ICAO codes must be unique among airlines still flying. A defunct
// airline may share its code with the airline the code was reassigned to;
// getAirline() then finds the active one. A brand that flies under its
// parent's codes (Hawaiian Airlines under Alaska Airlines) may share them
// with that parent, which getAirline() finds. IATA may also give one code to
// two airlines whose services don't overlap, marking all holders but one with
// an asterisk ("SL*"): those carry `iata_duplicate`, and getAirline() finds
// the one without it.
const sharesParentCode = (list) =>
    list.some((parent) =>
        list.every((a) => a === parent || a.parent === parent.slug),
    )

const isControlledDuplicate = (field, list) =>
    field === 'iata' && list.filter((a) => !a.iata_duplicate).length <= 1

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
            .filter(
                ([, list]) =>
                    list.length > 1 &&
                    !sharesParentCode(list) &&
                    !isControlledDuplicate(field, list),
            )
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
// two airlines may share one, defunct or not. The slugs of aliases and former
// names count too, since the package keeps them working: a link to
// assets/<old slug>/ must lead to one airline.
const findDuplicateSlugs = (airlines) => {
    const seen = new Map()

    return airlines.flatMap((a) =>
        [...new Set([a.slug, ...aliasSlugs(a), ...formerSlugs(a)])].flatMap(
            (slug) => {
                const first = seen.get(slug)
                if (!first) {
                    seen.set(slug, a)

                    return []
                }

                return [
                    `slug "${slug}" is used by more than one airline: ${first.name}, ${a.name}`,
                ]
            },
        ),
    )
}

// An airline with older marks says when its current ones came in, after the
// last older one, so every older mark has an end year
const findOpenHistory = (airlines) =>
    airlines
        .filter((a) => a.history)
        .flatMap((a) => {
            // The last older mark ends when the current ones came in
            const { since, until } = a.history.at(-1)
            if (until === undefined) {
                return [
                    `${a.name}: has older marks, so branding.since needs the year its current marks came in`,
                ]
            }

            return until > since
                ? []
                : [
                      `${a.name}: branding.since (${until}) must come after its last older mark (${since})`,
                  ]
        })

// `former` lists what the airline used before, oldest first: never its
// current name or codes, and each item ends no earlier than the one before
const findFormerProblems = (airlines) =>
    airlines.flatMap((a) =>
        (a.former ?? []).flatMap((item, i, former) => [
            ...['name', 'iata', 'icao', 'callsign']
                .filter((field) => item[field] && item[field] === a[field])
                .map((field) => `${a.name}: former lists its current ${field}`),
            ...(i > 0 && item.until < former[i - 1].until
                ? [
                      `${a.name}: former must be oldest first (${item.until} comes after ${former[i - 1].until})`,
                  ]
                : []),
        ]),
    )

// `aliases` are other names the airline uses now: never its own name, a
// former one or the same alias twice (letter case aside, as getAirline()
// compares names)
const findAliasProblems = (airlines) =>
    airlines.flatMap((a) => {
        const lower = (name) => name.toLowerCase()
        const former = new Set(formerNames(a).map(lower))

        return aliasNames(a).flatMap((alias, i, aliases) => {
            const key = lower(alias)
            if (key === lower(a.name)) {
                return [`${a.name}: aliases lists its own name`]
            }
            if (former.has(key)) {
                return [
                    `${a.name}: "${alias}" is in both aliases and former; a name it stopped using goes in former only`,
                ]
            }

            return aliases.findIndex((other) => lower(other) === key) < i
                ? [`${a.name}: aliases lists "${alias}" twice`]
                : []
        })
    })

// `alliance_history` lists the alliances the airline left, oldest first,
// each joined no later than it was left
const findAllianceHistoryProblems = (airlines) =>
    airlines.flatMap((a) =>
        (a.alliance_history ?? []).flatMap((item, i, history) => [
            ...(item.since > item.until
                ? [
                      `${a.name}: alliance_history has ${item.alliance} joined in ${item.since}, after it left in ${item.until}`,
                  ]
                : []),
            ...(i > 0 && item.until < history[i - 1].until
                ? [
                      `${a.name}: alliance_history must be oldest first (${item.until} comes after ${history[i - 1].until})`,
                  ]
                : []),
        ]),
    )

// A joint flag carrier's countries include its own
const findFlagCarrierProblems = (airlines) =>
    airlines
        .filter(
            (a) =>
                a.flag_carrier_countries &&
                !a.flag_carrier_countries.includes(a.country),
        )
        .map(
            (a) =>
                `${a.name}: flag_carrier_countries must include its country (${a.country})`,
        )

// `parent`, `marks` and `successor` must name another airline in the
// catalog, `marks` one with SVGs of its own and, in the published copy,
// every type `marks_types` takes from it, and following `successor` must end
// at an airline without one (no loops). `marks` may name an airline that
// itself takes some types with `marks_types` from one with its own SVGs (a
// cargo brand with its own logo and another airline's icon, which its
// sister airlines share whole), but no longer chain.
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
            const sharesPart =
                target.marks_types && !bySlug.get(target.marks)?.marks
            if (field === 'marks' && target.marks && !sharesPart) {
                return [
                    `${a.name}: marks "${slug}" uses the marks of "${target.marks}"; point at that airline instead`,
                ]
            }
            if (field === 'marks' && target.assets) {
                return (a.marks_types ?? [])
                    .filter((type) => !target.assets[type])
                    .map(
                        (type) =>
                            `${a.name}: marks_types takes ${type} from "${slug}", which has no ${type}.svg`,
                    )
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
        ...findAliasProblems(airlines),
        ...findFormerProblems(airlines),
        ...findAllianceHistoryProblems(airlines),
        ...findFlagCarrierProblems(airlines),
        ...findOpenHistory(airlines),
        ...findDuplicateCodes(airlines),
        ...findBrokenReferences(airlines),
        ...findDarkColorProblems(airlines),
        ...findLoneStackedLogos(airlines),
    ]
}

// logo-stacked.svg is the vertical lockup of an airline that also has the
// horizontal one; an airline with only a vertical lockup keeps it in
// logo.svg, so logo is always there to fall back on. Checked for the current
// marks and each set in history, from the published `assets`.
const findLoneStackedLogos = (airlines) =>
    airlines.flatMap((a) =>
        [
            { assets: a.assets, where: 'assets' },
            ...(a.history ?? []).map((mark) => ({
                assets: mark.assets,
                where: `history/${mark.since}`,
            })),
        ]
            .filter(({ assets }) => assets?.['logo-stacked'] && !assets.logo)
            .map(
                ({ where }) =>
                    `${a.name}: ${where} has logo-stacked but no logo; an airline with only a vertical lockup keeps it in logo.svg`,
            ),
    )

// branding.dark_color keeps a mark's color file on dark backgrounds: the
// mark must have one, and a mark shared from another airline (`marks`, or
// the types in `marks_types`) follows that airline's choice. Only the
// published copy has `assets` to tell.
const findDarkColorProblems = (entries) =>
    entries.flatMap((a) => {
        const types = a.branding?.dark_color ?? []
        const shared = types.filter((type) => borrowedTypes(a).includes(type))
        if (shared.length) {
            return [
                `${a.name}: shares its ${shared.join(' and ')} with "${a.marks}", so set branding.dark_color there`,
            ]
        }

        // The repo copy has no assets to check against
        if (!a.assets) return []

        return types
            .filter((type) => !a.assets[type]?.color)
            .map(
                (type) =>
                    `${a.name}: branding.dark_color lists ${type}, which has no ${type}.svg`,
            )
    })

// The colors branding.dark_color keeps on dark backgrounds that hardly read
// there (under 3:1 on #1e1e1e), for a reviewer to check against the source:
// what the airline does wins, so they don't stop anything. Published copy
// only, as above.
const findDarkColorWarnings = (entries) =>
    entries.flatMap((a) =>
        (a.branding?.dark_color ?? []).flatMap((type) => {
            const faint = (a.assets?.[type]?.colors ?? []).filter(
                (c) => !readsOnDark(c),
            )

            return faint.length
                ? [
                      `${a.name}: branding.dark_color keeps the ${type} in color, but ${faint.join(', ')} is under ${MIN_DARK_CONTRAST}:1 on ${DARK_BACKGROUND}; check it against the airline's own use`,
                  ]
                : []
        }),
    )

// An alliance may wait for its primary color until its SVGs are in the
// collection, but no longer: like every airline, one with marks has a color.
// Only the published copy has `assets` to tell.
const findMissingColors = (alliances) =>
    alliances
        .filter(
            (a) =>
                Object.keys(a.assets ?? {}).length > 0 &&
                !a.branding?.primary_color,
        )
        .map(
            (a) =>
                `${a.name}: has SVGs in ${ALLIANCES_DIR}/${a.slug}/, so it needs branding.primary_color`,
        )

// Check an alliances.json array against alliances.schema.json, the repo's
// copy by default or with `published` the built one, plus what the schema
// can't express: slugs, one entry per alliance airlines.json may name,
// branding.since once there are older marks and branding.primary_color once
// there are SVGs. Same messages as validateAirlines.
const validateAlliances = (alliances, { published = false } = {}) => {
    const validate = published
        ? validateAlliancesPublished
        : validateAlliancesSource
    if (!validate(alliances)) {
        return validate.errors.map((error) =>
            formatSchemaError(alliances, error, 'alliances.json'),
        )
    }
    const names = alliances.map((a) => a.name)

    return [
        ...findWrongSlugs(alliances),
        ...allianceNames
            .filter((name) => !names.includes(name))
            .map((name) => `alliances.json has no entry for ${name}`),
        ...names
            .filter((name, i) => names.indexOf(name) !== i)
            .map((name) => `alliances.json lists ${name} more than once`),
        ...findOpenHistory(alliances),
        ...findMissingColors(alliances),
        ...findDarkColorProblems(alliances),
    ]
}

export {
    findDarkColorWarnings,
    airlineFields,
    allianceFields,
    isValidField,
    validateAirlines,
    validateAlliances,
}
