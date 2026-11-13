// Tidy airlines.json and check it before it is committed: sort it, order each
// entry's keys, fill in a missing slug, drop the fields only the build adds,
// validate the catalog as it would be published, check every slug has its
// asset folder and well-formed history folders, and delete committed
// -mono.svg files the build derives. airports.json gets the same: sorted,
// trimmed to the hubs the catalog lists, and checked that each has its
// coordinates.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import {
    findHistoryProblems,
    getAssetDirs,
    removeDerivedMonos,
} from '../utils/index.js'
import { normalizeCatalog, publishCatalog } from '../utils/catalog.js'
import { findAirportProblems, normalizeAirports } from '../utils/airports.js'
import { validateAirlines } from '../utils/schema.js'

const airlines = normalizeCatalog(
    JSON.parse(readFileSync('airlines.json', 'utf8')),
)

// Check the catalog the build would publish, with `assets`, before touching
// any file
const problems = validateAirlines(publishCatalog(airlines), {
    published: true,
})
if (problems.length) {
    console.error('❌ airlines.json does not match airlines.schema.json:')
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}

const airports = JSON.parse(readFileSync('airports.json', 'utf8'))
const airportProblems = findAirportProblems(airports, airlines)
if (airportProblems.length) {
    console.error('❌ airports.json is missing or has wrong coordinates:')
    airportProblems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}
const tidyAirports = normalizeAirports(airports, airlines)
const unused = Object.keys(airports).filter((code) => !tidyAirports[code])

const removedMonos = []

for (const { name, slug, marks } of airlines) {
    // An airline with `marks` has no SVGs of its own: the build copies the
    // files of the airline it names to its slug
    if (marks && existsSync(`assets/${slug}`)) {
        console.error(
            `❌ ${name} has both marks "${marks}" and its own assets/${slug}; keep one`,
        )
        process.exit(1)
    }
    if (!marks && !existsSync(`assets/${slug}`)) {
        console.error(
            `❌ ${name} has slug "${slug}" but no assets/${slug} folder; add it, or set marks`,
        )
        process.exit(1)
    }
    if (marks) continue
    const historyProblems = findHistoryProblems(slug)
    if (historyProblems.length) {
        console.error(`❌ ${name} has a malformed assets/${slug}/history:`)
        historyProblems.forEach((problem) => console.error(`  - ${problem}`))
        process.exit(1)
    }
    for (const dir of getAssetDirs(slug)) {
        removedMonos.push(...removeDerivedMonos(dir))
    }
}

writeFileSync('airlines.json', JSON.stringify(airlines, null, 4))
writeFileSync('airports.json', JSON.stringify(tidyAirports, null, 4))
if (unused.length) {
    console.log(
        `✅ Removed ${unused.join(', ')} from airports.json; no airline lists it as a hub`,
    )
}

// AIRLINES.md was generated until the website took over its job; a pull
// request rebased from before then may bring it back
if (existsSync('AIRLINES.md')) {
    rmSync('AIRLINES.md')
    console.log('✅ Removed AIRLINES.md; the website lists every airline')
}

if (removedMonos.length) {
    console.log(
        `✅ Removed ${removedMonos.length} -mono.svg file(s) the build derives from single-color assets`,
    )
}
console.log('✅ airlines.json and airports.json are sorted and valid')
