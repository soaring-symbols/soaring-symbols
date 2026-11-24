// Tidy airlines.json and check it before it is committed: sort it, order each
// entry's keys, fill in a missing slug, drop the fields only the build adds,
// validate the catalog as it would be published, check every slug has its
// asset folder and well-formed history folders, check hand-made -dark.svg
// files, and delete committed -mono.svg files the build derives.
// airports.json gets the same: sorted, trimmed to the hubs the catalog lists,
// and checked that each has its coordinates. alliances.json and alliances/
// get the airlines' treatment too, except that an alliance may have no SVGs
// yet.
import {
    existsSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'fs'
import {
    ALLIANCE_TYPES,
    AIRLINES_DIR,
    ALLIANCES_DIR,
    borrowedMarksFolder,
    borrowedTypes,
    findAllianceFileProblems,
    findDarkProblems,
    findHistoryProblems,
    getAssetDirs,
    hasOwnMarks,
    markFile,
    removeDerivedMonos,
} from '../utils/index.js'
import {
    normalizeAlliances,
    normalizeCatalog,
    publishAlliances,
    publishCatalog,
} from '../utils/catalog.js'
import { findAirportProblems, normalizeAirports } from '../utils/airports.js'
import {
    findDarkColorWarnings,
    findMissingSince,
    validateAirlines,
    validateAlliances,
} from '../utils/schema.js'

const airlines = normalizeCatalog(
    JSON.parse(readFileSync('airlines.json', 'utf8')),
)

// Check the catalog the build would publish, with `assets`, before touching
// any file
const published = publishCatalog(airlines)
const problems = validateAirlines(published, { published: true })
if (problems.length) {
    console.error('❌ airlines.json does not match airlines.schema.json:')
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}

const alliances = normalizeAlliances(
    JSON.parse(readFileSync('alliances.json', 'utf8')),
)
const publishedAlliances = publishAlliances(alliances)
const allianceProblems = validateAlliances(publishedAlliances, {
    published: true,
})
if (allianceProblems.length) {
    console.error('❌ alliances.json does not match alliances.schema.json:')
    allianceProblems.forEach((problem) => console.error(`  - ${problem}`))
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

// Folders whose derived monos go once every check has passed, so a failed
// check leaves the working tree as it was
const monoFolders = []
// Colors that hardly read on dark, kept by branding.dark_color or drawn in a
// hand-made -dark.svg: printed for review, never a reason to stop
const darkWarnings = [
    ...findDarkColorWarnings(published),
    ...findDarkColorWarnings(publishedAlliances),
]

// Stop on a hand-made -dark.svg that is out of place; collect its warnings
const checkDarks = (where, dirs, assetsDir, keepColor) => {
    // branding.dark_color is about the current marks, the first folder
    const found = dirs.map((dir, i) =>
        findDarkProblems(dir, assetsDir, i === 0 ? keepColor : []),
    )
    const darkProblems = found.flatMap((f) => f.problems)
    darkWarnings.push(...found.flatMap((f) => f.warnings))
    if (darkProblems.length) {
        console.error(`❌ ${where} has -dark.svg files out of place:`)
        darkProblems.forEach((problem) => console.error(`  - ${problem}`))
        process.exit(1)
    }
}

// A defunct airline borrowing marks gets those its lender used when it
// ceased: one that ceased before the lender's branding.since needs the older
// marks in the lender's history/, or it would show marks it never flew with
const missingEra = airlines.flatMap((airline) => {
    const lender = airlines.find((a) => a.slug === airline.marks)
    if (!lender || borrowedMarksFolder(airline, lender) !== null) return []

    return [
        `${airline.name} ceased in ${airline.ceased}, before ${lender.name}'s current marks (${lender.branding.since}); add the marks it flew with to airlines/${lender.slug}/history/<year>/, or leave it out until they come`,
    ]
})
if (missingEra.length) {
    console.error('❌ Airlines without the marks they flew with:')
    missingEra.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}

for (const airline of airlines) {
    const { name, slug, marks, branding } = airline
    // An airline with `marks` alone has no SVGs of its own: the build copies
    // the files of the airline it names to its slug. With `marks_types` it
    // copies only those types, and the others are the airline's own.
    const own = hasOwnMarks(airline)
    if (!own && existsSync(`airlines/${slug}`)) {
        console.error(
            `❌ ${name} has both marks "${marks}" and its own airlines/${slug}; keep one, or list the types it takes from "${marks}" in marks_types`,
        )
        process.exit(1)
    }
    if (own && !existsSync(`airlines/${slug}`)) {
        console.error(
            marks
                ? `❌ ${name} takes only ${borrowedTypes(airline).join(', ')} from "${marks}" but has no airlines/${slug} folder for its own marks`
                : `❌ ${name} has slug "${slug}" but no airlines/${slug} folder; add it, or set marks`,
        )
        process.exit(1)
    }
    if (!own) continue
    // A type it takes from `marks` has no file of its own
    const borrowed = borrowedTypes(airline)
    const doubled = borrowed.length
        ? readdirSync(`airlines/${slug}`).filter((file) =>
              markFile(borrowed).test(file),
          )
        : []
    if (doubled.length) {
        console.error(
            `❌ ${name} takes ${borrowed.join(', ')} from "${marks}" (marks_types) but has its own ${doubled.join(', ')}; remove them or the type`,
        )
        process.exit(1)
    }
    const historyProblems = findHistoryProblems(slug)
    if (historyProblems.length) {
        console.error(`❌ ${name} has a malformed airlines/${slug}/history:`)
        historyProblems.forEach((problem) => console.error(`  - ${problem}`))
        process.exit(1)
    }
    const dirs = getAssetDirs(slug)
    checkDarks(name, dirs, AIRLINES_DIR, branding?.dark_color)
    monoFolders.push(...dirs.map((dir) => [dir, AIRLINES_DIR]))
}

// An alliance needs no folder until its SVGs come, but a folder needs an
// alliance
const alliancesBySlug = new Map(alliances.map((a) => [a.slug, a]))
const allianceDirs = existsSync(ALLIANCES_DIR)
    ? readdirSync(ALLIANCES_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
    : []
for (const slug of allianceDirs) {
    if (!alliancesBySlug.has(slug)) {
        console.error(
            `❌ ${ALLIANCES_DIR}/${slug} matches no alliance in alliances.json; its slug is the slugified name`,
        )
        process.exit(1)
    }
    const folderProblems = [
        ...findAllianceFileProblems(slug),
        ...findHistoryProblems(slug, ALLIANCES_DIR, ALLIANCE_TYPES),
    ]
    if (folderProblems.length) {
        console.error(`❌ ${ALLIANCES_DIR}/${slug} has files out of place:`)
        folderProblems.forEach((problem) => console.error(`  - ${problem}`))
        process.exit(1)
    }
    const dirs = getAssetDirs(slug, ALLIANCES_DIR)
    checkDarks(
        `${ALLIANCES_DIR}/${slug}`,
        dirs,
        ALLIANCES_DIR,
        alliancesBySlug.get(slug).branding?.dark_color,
    )
    monoFolders.push(...dirs.map((dir) => [dir, ALLIANCES_DIR]))
}

const removedMonos = monoFolders.flatMap(([dir, root]) =>
    removeDerivedMonos(dir, root),
)

writeFileSync('airlines.json', JSON.stringify(airlines, null, 4))
writeFileSync('alliances.json', JSON.stringify(alliances, null, 4))
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
darkWarnings.forEach((warning) => console.warn(`⚠️  ${warning}`))
const missingSince = findMissingSince(airlines)
if (missingSince.lenders.length) {
    console.warn(
        `⚠️  No branding.since on marks other airlines borrow: ${missingSince.lenders.join(', ')}; add the year their current marks came in`,
    )
}
if (missingSince.others) {
    console.warn(
        `⚠️  ${missingSince.others} more airline(s) have no branding.since; add it when you know the year`,
    )
}
console.log(
    '✅ airlines.json, alliances.json and airports.json are sorted and valid',
)
