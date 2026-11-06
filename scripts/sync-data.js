// Compare airlines.json with each airline's English Wikipedia infobox and
// report (or apply) what changed: IATA/ICAO codes, callsign, hubs, and
// whether the airline ceased operations.
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
import { validateAirlines } from '../utils/index.js'
import {
    extractInfobox,
    fetchAirportCodes,
    fetchPages,
    firstYear,
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
    Viva: 'Viva (airline)',
}

// Wikipedia values reviewed and rejected, so they stop coming back, e.g.
// { 'Some Airline': { icao: 'XYZ' } }. A different value is reported again.
const IGNORE = {}

const args = process.argv.slice(2)
const write = args.includes('--write')
const summaryPath = args.includes('--summary')
    ? args[args.indexOf('--summary') + 1]
    : undefined

const schema = JSON.parse(
    readFileSync(new URL('../airlines.schema.json', import.meta.url), 'utf8'),
)
const props = schema.$defs.airline.properties
const PATTERNS = {
    iata: new RegExp(schema.$defs.iata.pattern),
    icao: new RegExp(schema.$defs.icao.pattern),
    callsign: new RegExp(props.callsign.pattern),
}

const airlinesPath = new URL('../airlines.json', import.meta.url)
const airlines = JSON.parse(readFileSync(airlinesPath, 'utf8'))
const titleOf = (airline) => PAGE_TITLES[airline.name] ?? airline.name

const sameList = (a = [], b = []) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join()

// Candidate values Wikipedia gives for a code or callsign field
const candidates = (raw, field) =>
    listItems(raw)
        .map((item) => item.toUpperCase())
        .filter((item) => PATTERNS[field].test(item))

console.log(`Fetching ${airlines.length} Wikipedia pages...`)
const pages = await fetchPages(airlines.map(titleOf))
const paramsByName = Object.fromEntries(
    airlines.map((a) => [
        a.name,
        infoboxParams(extractInfobox(pages[titleOf(a)])),
    ]),
)
const hubTitles = Object.values(paramsByName).flatMap((p) =>
    linkTargets(p.hubs ?? p.hub),
)
console.log(`Resolving ${new Set(hubTitles).size} hub airports...`)
const airportCodes = await fetchAirportCodes(hubTitles)

const changes = [] // { airline, field, from, to }
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
    const propose = (field, to) => {
        if (JSON.stringify(ignored[field]) === JSON.stringify(to)) return
        changes.push({ airline, field, from: airline[field], to })
    }

    for (const field of ['iata', 'icao', 'callsign']) {
        const raw = params[field]
        if (!raw) continue
        const values = candidates(raw, field)
        if (!values.length) {
            if (listItems(raw).length) {
                note(`could not read ${field} from "${listItems(raw)[0]}"`)
            }
            continue
        }
        // An airline may list several (e.g. a second ICAO code); ours stays
        // as long as it is one of them
        if (!values.includes(airline[field])) propose(field, values[0])
    }

    const targets = linkTargets(params.hubs ?? params.hub)
    const hubs = [...new Set(targets.map((title) => airportCodes[title]))]
    if (hubs.includes(undefined)) {
        const unknown = targets.filter((title) => !airportCodes[title])
        note(`no IATA code found for hub page(s): ${unknown.join(', ')}`)
    } else if (!sameList(hubs, airline.hubs)) {
        propose('hubs', hubs.length ? hubs : undefined)
    }

    const ceased = firstYear(params.ceased)
    if (ceased && !airline.defunct) {
        propose('defunct', true)
        propose('ceased', ceased)
    } else if (ceased && airline.ceased !== ceased) {
        propose('ceased', ceased)
    } else if (!ceased && airline.defunct && !airline.ceased) {
        note('defunct, but Wikipedia gives no year it ceased')
    }
}

// Accept an airline's changes only if the data stays valid with them (a code
// moving to an airline that still holds it elsewhere needs a decision)
const apply = (list, entry) => {
    const copy = structuredClone(list)
    const target = copy.find((a) => a.name === entry.airline.name)
    for (const { field, to } of entry.changes) {
        if (to === undefined) delete target[field]
        else target[field] = to
    }

    return copy
}
let result = airlines
const accepted = []
const held = []
for (const name of new Set(changes.map((c) => c.airline.name))) {
    const entry = {
        airline: changes.find((c) => c.airline.name === name).airline,
        changes: changes.filter((c) => c.airline.name === name),
    }
    const candidate = apply(result, entry)
    const problems = validateAirlines(candidate)
    if (problems.length) {
        held.push({ ...entry, problems })
    } else {
        result = candidate
        accepted.push(entry)
    }
}

// Report
const show = (value) =>
    value === undefined ? '–' : Array.isArray(value) ? value.join(' ') : value
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
if (held.length || notes.length) {
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
    md.push('')
}
if (!md.length) md.push('Everything matches Wikipedia.', '')
md.push(
    'Values come from the English Wikipedia infobox of each airline and are not authoritative: check each one before merging. To reject a value for good, add it to `IGNORE` in `scripts/sync-data.js`.',
)
const report = md.join('\n') + '\n'

console.log(
    `\n${accepted.length} airline(s) changed, ${held.length} held back, ${notes.length} note(s)\n`,
)
console.log(report)
if (summaryPath) writeFileSync(summaryPath, report)

if (write && accepted.length) {
    writeFileSync(airlinesPath, JSON.stringify(result, null, 4))
    // Re-sort, order keys and validate exactly like a manual edit
    execFileSync('node', ['scripts/generate.js'], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        stdio: 'inherit',
    })
}
