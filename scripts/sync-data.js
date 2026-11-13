// Compare airlines.json with each airline's English Wikipedia infobox and
// report (or apply) what changed: IATA/ICAO codes, callsign, hubs, alliance,
// the year it was founded, names it flew under before, and whether the
// airline ceased operations. A rename or merger is only reported: a person
// renames the entry or sets its successor. Hubs new to airports.json get
// their coordinates from Wikidata.
//
//   node scripts/sync-data.js                     report only
//   node scripts/sync-data.js --write             apply, then npm run generate
//   node scripts/sync-data.js --summary out.md    also write a Markdown report
//
// Wikipedia is not an authority, so every change goes through review: the
// scheduled workflow (.github/workflows/sync-data.yml) opens a pull request.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isValidField, validateAirlines } from '../utils/schema.js'
import { hubCodes } from '../utils/airports.js'
import {
    allianceOf,
    carriedOn,
    extractInfobox,
    fetchAirports,
    fetchPages,
    firstYear,
    formerNames,
    infoboxParams,
    linkTargets,
    listItems,
    pageUrl,
} from './sync/wikipedia.js'

// Wikipedia page of airlines whose name leads elsewhere (a disambiguation
// page, another topic)
const PAGE_TITLES = {
    Azul: 'Azul Brazilian Airlines',
    Condor: 'Condor (airline)',
    Emirates: 'Emirates (airline)',
    Firefly: 'Firefly (airline)',
    // The original airline; a relaunch flew under the brand in 2022-2023
    Flybe: 'Flybe (1979–2020)',
    GOL: 'Gol Linhas Aéreas',
    Iberia: 'Iberia (airline)',
    'LATAM Airlines Chile': 'LATAM Chile',
    Level: 'Level (airline)',
    Viva: 'Viva (airline)',
}

// Wikipedia values reviewed and rejected, so they stop coming back, e.g.
// { 'Some Airline': { icao: 'XYZ' } }. A different value is reported again.
// `former` lists names from the "(as ...)" notes that aren't the airline's
// own: a company name, a description, or the ancestor of a split.
const IGNORE = {
    Aeroméxico: { former: ['Aeronaves de México S.A. de C.V.'] },
    'American Airlines': { former: ['a union of more than 80 airlines'] },
    // Malaysia-Singapore Airlines split in two in 1972: neither carried on
    // the name alone
    'Malaysia Airlines': { former: ['Malayan Airways'] },
    'Peach Aviation': { former: ['A&F Aviation'] },
    'Singapore Airlines': { former: ['Malayan Airways'] },
    // ModiLuft, the company SpiceJet grew out of, and the year it was founded
    SpiceJet: { founded: 1994, former: ['ModiLuft'] },
    // A trucking company before it flew as Charter One Airlines
    'Spirit Airlines': { former: ['Clippert Trucking Company'] },
}

const args = process.argv.slice(2)
const write = args.includes('--write')
const summaryPath = args.includes('--summary')
    ? args[args.indexOf('--summary') + 1]
    : undefined

const airlinesPath = new URL('../airlines.json', import.meta.url)
const airportsPath = new URL('../airports.json', import.meta.url)
const airports = JSON.parse(readFileSync(airportsPath, 'utf8'))
const ALLIANCES = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
).$defs.alliance.enum
const airlines = JSON.parse(readFileSync(airlinesPath, 'utf8'))
const titleOf = (airline) => PAGE_TITLES[airline.name] ?? airline.name

const sameList = (a = [], b = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join()

console.log(`Fetching ${airlines.length} Wikipedia pages...`)
const pages = await fetchPages(airlines.map(titleOf))
const paramsByName = Object.fromEntries(
    airlines.map((a) => {
        const params = infoboxParams(extractInfobox(pages[titleOf(a)], a.name))
        // Some infoboxes use the singular name
        params.hubs ??= params.hub

        return [a.name, params]
    }),
)
const hubTitles = Object.values(paramsByName).flatMap((p) =>
    linkTargets(p.hubs),
)
console.log(`Resolving ${new Set(hubTitles).size} hub airports...`)
const airportByTitle = await fetchAirports(hubTitles)
const airportCodes = Object.fromEntries(
    Object.entries(airportByTitle).map(([title, airport]) => [
        title,
        airport?.iata,
    ]),
)
// Coordinates by IATA code, for hubs new to airports.json
const placeByCode = Object.fromEntries(
    Object.values(airportByTitle)
        .filter((airport) => airport?.iata && airport.lat !== undefined)
        .map(({ iata, lat, lon }) => [iata, { lat, lon }]),
)

const proposals = [] // { airline, changes: [{ field, from, to }] }
const notes = [] // { airline, message }: needs a human

for (const airline of airlines) {
    const params = paramsByName[airline.name]
    const note = (message) => notes.push({ airline, message })
    if (!Object.keys(params).length) {
        note(
            `no airline infobox on "${titleOf(airline)}"; set its page in PAGE_TITLES`,
        )
        continue
    }
    const ignored = IGNORE[airline.name] ?? {}
    const changes = []
    const propose = (field, to) => {
        if (JSON.stringify(ignored[field]) === JSON.stringify(to)) return
        changes.push({ field, from: airline[field], to })
    }

    for (const field of ['iata', 'icao', 'callsign']) {
        const items = listItems(params[field])
        if (!items.length) continue
        const values = items
            .map((item) => item.toUpperCase())
            .filter((item) => isValidField(field, item))
        if (!values.length) {
            note(`could not read ${field} from "${items[0]}"`)
            continue
        }
        // An airline may list several (e.g. a second ICAO code); ours stays
        // as long as it is one of them
        if (!values.includes(airline[field])) propose(field, values[0])
    }

    const targets = linkTargets(params.hubs)
    const unknown = targets.filter((title) => !airportCodes[title])
    if (unknown.length) {
        note(`no IATA code found for hub page(s): ${unknown.join(', ')}`)
    } else {
        const hubs = [...new Set(targets.map((title) => airportCodes[title]))]
        if (!sameList(hubs, airline.hubs)) {
            propose('hubs', hubs.length ? hubs : undefined)
        }
    }

    // A "ceased" that says it was rebranded or renamed is the same airline
    // under a new name, renamed in place by hand; a merger leaves it defunct,
    // and so does a move out of a group's brand, which already has a successor
    const ending = carriedOn(params.ceased)
    const renamed =
        !airline.successor && /^(rebranded|renamed)/i.test(ending ?? '')
    const ceased = renamed ? undefined : firstYear(params.ceased)
    if (ceased) {
        if (!airline.defunct) propose('defunct', true)
        if (airline.ceased !== ceased) propose('ceased', ceased)
    } else if (airline.defunct && !airline.ceased) {
        note('defunct, but Wikipedia gives no year it ceased')
    }
    // An infobox without an alliance says nothing: it is often left empty
    const alliance = allianceOf(params.alliance, ALLIANCES)
    if (alliance && alliance !== airline.alliance) propose('alliance', alliance)

    // The first date in the infobox: when it was founded, or else when it
    // started flying
    const founded = firstYear(params.founded) ?? firstYear(params.commenced)
    if (founded && founded !== airline.founded) propose('founded', founded)

    if (renamed) {
        note(
            `Wikipedia says it was "${ending}"; rename it in place, listing the old name in former (see "Renames and mergers" in CONTRIBUTING.md)`,
        )
    } else if (ending && !airline.successor) {
        note(
            `Wikipedia says it ceased "${ending}"; set successor to the airline that carried on (see "Renames and mergers" in CONTRIBUTING.md)`,
        )
    }

    if (changes.length) proposals.push({ airline, changes })

    // Names it flew under before, from the "(as ...)" notes of its founding
    // dates. One a later name replaced, in a given year, goes in former, on
    // its own so a clash with another airline holds back only it; one with
    // nothing after it is left to a person, who knows when it stopped.
    // A name already in former counts in a shorter or longer form too:
    // "TACA" for "TACA International Airlines"
    const lower = (name) => name.toLowerCase()
    const listed = (airline.former ?? [])
        .map((item) => item.name)
        .filter(Boolean)
        .map(lower)
    const known = (name) =>
        name === lower(airline.name) ||
        listed.some((other) => other.includes(name) || name.includes(other))
    const rejected = new Set((ignored.former ?? []).map(lower))
    const found = formerNames(params, airline.name).filter(
        ({ name }) => !known(lower(name)) && !rejected.has(lower(name)),
    )
    const dated = found.filter((item) => item.until)
    if (dated.length) {
        proposals.push({
            airline,
            changes: [
                {
                    field: 'former',
                    to: dated,
                    // Oldest first, as CONTRIBUTING.md asks
                    value: [...(airline.former ?? []), ...dated].sort(
                        (a, b) => a.until - b.until,
                    ),
                },
            ],
        })
    }
    for (const { name, since } of found.filter((item) => !item.until)) {
        note(
            `Wikipedia says it flew as "${name}" from ${since}, with no later name to end it; add it to former with the year it stopped if it is a former name, or to IGNORE if not`,
        )
    }
}

// Accept an airline's changes only if the data stays valid with them (a code
// moving to an airline that still holds it elsewhere needs a decision)
const apply = (list, { airline, changes }) =>
    list.map((a) => {
        if (a.name !== airline.name) return a
        const patched = { ...a }
        for (const change of changes) {
            // A change may show less than it writes (the names it adds)
            const to = 'value' in change ? change.value : change.to
            if (to === undefined) delete patched[change.field]
            else patched[change.field] = to
        }

        return patched
    })
let result = airlines
const accepted = []
const held = []
for (const entry of proposals) {
    const candidate = apply(result, entry)
    const problems = validateAirlines(candidate)
    if (problems.length) {
        held.push({ ...entry, problems })
    } else {
        result = candidate
        accepted.push(entry)
    }
}

// Hubs the catalog lists once these changes are in, without coordinates
// yet: from Wikidata when it has them, else left to a person
const newHubs = hubCodes(result).filter((code) => !airports[code])
const placed = newHubs.filter((code) => placeByCode[code])
const unplaced = newHubs.filter((code) => !placeByCode[code])

// Report
const show = (value) => {
    if (value === undefined) return '–'
    if (!Array.isArray(value)) return value

    // Hubs as codes, former names with the year each stopped
    return typeof value[0] === 'object'
        ? value.map(({ name, until }) => `${name} (until ${until})`).join(', ')
        : value.join(' ')
}
const link = (airline) => `[${airline.name}](${pageUrl(titleOf(airline))})`
const md = []
if (accepted.length) {
    md.push(
        '### Changes',
        '',
        '| Airline | Field | Before | After |',
        '| :-- | :-- | :-- | :-- |',
        ...accepted.flatMap(({ airline, changes: list }) =>
            list.map(
                ({ field, from, to }) =>
                    `| ${link(airline)} | \`${field}\` | ${show(from)} | ${show(to)} |`,
            ),
        ),
        '',
    )
}
if (placed.length) {
    md.push(
        '### Hub coordinates',
        '',
        '| Hub | Latitude | Longitude |',
        '| :-- | --: | --: |',
        ...placed.map(
            (code) =>
                `| ${code} | ${placeByCode[code].lat} | ${placeByCode[code].lon} |`,
        ),
        '',
    )
}
if (held.length || notes.length || unplaced.length) {
    md.push('### Needs a manual look', '')
    for (const { airline, changes: list, problems } of held) {
        const what = list
            .map(
                ({ field, from, to }) =>
                    `\`${field}\` ${show(from)} → ${show(to)}`,
            )
            .join(', ')
        md.push(
            `- ${link(airline)}: Wikipedia says ${what}, not applied because ${problems.join('; ')}`,
        )
    }
    for (const { airline, message } of notes) {
        md.push(`- ${link(airline)}: ${message}`)
    }
    for (const code of unplaced) {
        md.push(
            `- ${code}: a hub without coordinates on Wikidata; add its \`lat\` and \`lon\` to airports.json by hand`,
        )
    }
    md.push('')
}
if (!md.length) md.push('Everything matches Wikipedia.', '')
md.push(
    'Values come from the English Wikipedia infobox of each airline and are not authoritative: check each one before merging. To reject a value for good, add it to `IGNORE` in `scripts/sync-data.js`.',
)
const report = md.join('\n') + '\n'

console.log(
    `\n${accepted.length} airline(s) changed, ${placed.length} hub(s) placed, ${held.length} held back, ${notes.length + unplaced.length} note(s)\n`,
)
console.log(report)
if (summaryPath) writeFileSync(summaryPath, report)

if (write && (accepted.length || placed.length)) {
    writeFileSync(airlinesPath, JSON.stringify(result, null, 4))
    for (const code of placed) airports[code] = placeByCode[code]
    // generate.js sorts it, and fails on a hub still without coordinates
    writeFileSync(airportsPath, JSON.stringify(airports, null, 4))
    // Re-sort, order keys and validate exactly like a manual edit
    execFileSync('node', ['scripts/generate.js'], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        stdio: 'inherit',
    })
}
