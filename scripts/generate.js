import { writeFileSync } from 'fs'
import sortBy from 'lodash.sortby'
import {
    airlineFields,
    subsidiaryFields,
    assetTypes,
    toSlug,
    toFullHex,
    getAirlineAssets,
    writeDerivedMonos,
    validateAirlines,
} from '../utils/index.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const airlines = require('../airlines.json')

const sorted = sortBy(airlines, (a) => a.name.toLowerCase())

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

const getFlagEmoji = (isoCode) => {
    if (!isoCode) return '🏴'

    if (isoCode === 'GB-ENG') return '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
    if (isoCode === 'GB-WLS') return '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
    if (isoCode === 'GB-SCT') return '🏴󠁧󠁢󠁳󠁣󠁴󠁿'
    if (isoCode === 'GB-NIR') return '🇬🇧'

    return isoCode
        .toUpperCase()
        .replace(/./g, (char) =>
            String.fromCodePoint(127397 + char.charCodeAt(0)),
        )
}

let md = `# Soaring Symbols: Airlines

This file provides an overview of the airlines included in the Soaring Symbols project.

| Airline | Country | IATA | ICAO | Alliance | Primary Color | Icon | Logo | Tail |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
`

const derivedMonos = []

sorted.forEach((airline) => {
    // Hand-written colors get the six-digit lowercase form the SVGs use
    if (airline.branding?.primary_color) {
        airline.branding.primary_color = toFullHex(
            airline.branding.primary_color,
        )
    }

    const slug = toSlug(airline.name)
    derivedMonos.push(...writeDerivedMonos(slug))
    const assets = getAirlineAssets(slug)

    const includedStates = []

    const {
        name,
        iata,
        website,
        icao,
        country,
        alliance,
        flag_carrier,
        branding: { primary_color },
        subsidiaries,
    } = airline

    airline.slug = slug
    airline.assets = assets

    let airlineName = website ? `[${name}](${website})` : name

    if (flag_carrier) {
        const countries = country.split(',')
        countries.forEach((code) => {
            airlineName += ` ${getFlagEmoji(code)}`
        })
    }

    assetTypes.forEach((type) => {
        const assetInfo = assets[type]

        if (!assetInfo) {
            includedStates.push('')

            return
        }

        // Complete: both the color file and its monochrome version
        const isComplete = assetInfo.color && assetInfo.mono

        if (isComplete) {
            includedStates.push('✅')
        } else {
            includedStates.push('☑️')
        }
    })

    const colorSquare = primary_color
        ? `![${primary_color}](https://place-hold.it/10x10/${primary_color.replace(
              '#',
              '',
          )}/${primary_color.replace('#', '')}.png)`
        : ''

    md += `| ${airlineName} | ${country || ''} | ${iata || ''} | ${
        icao || ''
    } | ${alliance || ''} | ${colorSquare} | ${includedStates.join(' | ')} |\n`

    if (Array.isArray(subsidiaries)) {
        subsidiaries.forEach((sub) => {
            let subsidiaryAirlineName = sub.name
            if (sub.flag_carrier) {
                subsidiaryAirlineName += ` ${getFlagEmoji(sub.country)}`
            }

            md += `| ${subsidiaryAirlineName} | ${sub.country || ''} | ${
                sub.iata || ''
            } | ${sub.icao || ''} | ${
                sub.alliance || ''
            } | ${colorSquare} | ${includedStates.join(' | ')} |\n`
        })
    }
})

const ordered = sorted.map((airline) => {
    const entry = orderKeys(airline, airlineFields)
    if (Array.isArray(entry.subsidiaries)) {
        entry.subsidiaries = entry.subsidiaries.map((sub) =>
            orderKeys(sub, subsidiaryFields),
        )
    }

    return entry
})

// Check the finished data, generated fields included, before writing anything
const problems = validateAirlines(ordered)
if (problems.length) {
    console.error('❌ airlines.json does not match airlines.schema.json:')
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}

writeFileSync('airlines.json', JSON.stringify(ordered, null, 4))
writeFileSync('AIRLINES.md', md)

if (derivedMonos.length) {
    console.log(
        `✅ Wrote ${derivedMonos.length} mono file(s) for single-color assets`,
    )
}
console.log('✅ Successfully generated airlines.json and AIRLINES.md')
