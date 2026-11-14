// Tests for the built package in dist/. Run with `npm test` (builds first).
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { optimize } from 'svgo'
import svgoConfig from '../svgo.config.mjs'
import {
    ALLIANCE_TYPES,
    findHistoryProblems,
    getAirlineAssets,
    getAirlineHistory,
    getAssetDirs,
    toSlug,
} from '../utils/index.js'
import {
    normalizeAlliances,
    normalizeCatalog,
    publishCatalog,
} from '../utils/catalog.js'
import { validateAirlines, validateAlliances } from '../utils/schema.js'
import { findAirportProblems, normalizeAirports } from '../utils/airports.js'
import { selectSvgs } from './lint/changed.js'
import { groupCommits, renderNotes, REPO_URL } from './release-notes.js'
import { EXCLUDE_FILES } from './lint/exclude.js'
import { BROWSER_CHECKS, DOM_RULES, STRING_RULES } from './lint/rules.js'
import { ruleFillPlacement } from './lint/rule-styling.js'
import { ruleOptimize } from './lint/rule-optimize.js'
import { optimizeSvg } from './lint/optimize.js'
import { measureBBox } from './lint/render.js'
import {
    ruleNoNestedGroups,
    ruleOnePathPerColor,
    ruleTitle,
} from './lint/rule-structure.js'
import {
    allianceOf,
    carriedOn,
    extractInfobox,
    firstYear,
    formerNames,
    infoboxParams,
    linkTargets,
    listItems,
    namedDates,
} from './sync/wikipedia.js'

const require = createRequire(import.meta.url)

// Run from outside the repo, like a consumer would, so cwd-relative paths fail
process.chdir(tmpdir())

const cjs = require('../dist/index.cjs')
const esm = await import('../dist/index.js')

for (const [format, api] of [
    ['ESM', esm],
    ['CJS', cjs],
]) {
    const {
        listAirlines,
        getAirline,
        findAirlines,
        getAssetPath,
        listAlliances,
        getAlliance,
        getAllianceAssetPath,
    } = api

    describe(`${format} build`, () => {
        it('exports exactly the public API', () => {
            const names = Object.keys(api)
                .filter((key) => key !== 'default' && key !== 'module.exports')
                .sort()
            assert.deepEqual(names, [
                'findAirlines',
                'getAirline',
                'getAlliance',
                'getAllianceAssetPath',
                'getAssetPath',
                'listAirlines',
                'listAlliances',
            ])
        })

        describe('listAirlines', () => {
            let airlines
            before(() => (airlines = listAirlines()))

            it('returns every airline, sorted by name', () => {
                assert.ok(airlines.length > 0)
                const names = airlines.map((a) => a.name.toLowerCase())
                assert.deepEqual(names, [...names].sort())
            })

            it('returns a fresh array each call', () => {
                airlines.pop()
                assert.equal(listAirlines().length, airlines.length + 1)
            })

            it('returns frozen airline objects', () => {
                const vna = airlines.find((a) => a.iata === 'VN')
                assert.ok(Object.isFrozen(vna))
                assert.ok(Object.isFrozen(vna.assets.logo.colors))
                assert.throws(() => {
                    vna.name = 'changed'
                }, TypeError)
            })

            it('gives each airline a slug and assets, and no branding.colors', () => {
                for (const a of airlines) {
                    assert.match(a.slug, /^[a-z0-9-]+$/, a.name)
                    assert.equal(typeof a.assets, 'object', a.name)
                    assert.equal(a.branding?.colors, undefined, a.name)
                }
            })
        })

        describe('findAirlines', () => {
            const slugs = (code, options) =>
                findAirlines(code, options).map((a) => a.slug)

            it('lists every holder, getAirline() first', () => {
                for (const a of listAirlines()) {
                    for (const code of [a.iata, a.icao]) {
                        const found = findAirlines(code)
                        assert.ok(found.includes(a), `${a.name} by ${code}`)
                        assert.equal(found[0], getAirline(code), code)
                    }
                }
            })

            it('puts active holders before defunct ones', () => {
                assert.deepEqual(slugs('SL'), ['thai-lion-air', 'sas-connect'])
                assert.deepEqual(slugs('AS'), [
                    'alaska-airlines',
                    'hawaiian-airlines',
                ])
                assert.deepEqual(slugs(' bl '), [
                    'pacific-airlines',
                    'jetstar-pacific',
                ])
                assert.deepEqual(slugs('HVN'), ['vietnam-airlines'])
            })

            it('adds former holders only when asked', () => {
                assert.deepEqual(slugs('HA'), [])
                assert.deepEqual(slugs('HA', { former: true }), [
                    'hawaiian-airlines',
                ])
                // A current holder is not listed twice
                assert.deepEqual(slugs('AS', { former: true }), slugs('AS'))
            })

            it('returns a fresh empty array for anything else', () => {
                for (const query of ['XX', 'SL*', 'vietnam-airlines', '', 42]) {
                    assert.deepEqual(findAirlines(query), [], String(query))
                }
                const list = findAirlines('SL')
                list.pop()
                assert.equal(findAirlines('SL').length, 2)
            })
        })

        describe('getAirline', () => {
            it('finds a subsidiary as an airline of its own', () => {
                assert.equal(getAirline('FD')?.name, 'Thai AirAsia')
                assert.equal(
                    getAssetPath('FD', 'logo'),
                    'soaring-symbols/assets/thai-airasia/logo.svg',
                )
            })

            it('ignores case and surrounding whitespace', () => {
                for (const query of ['vn', 'hvn', '  VIETNAM AIRLINES ']) {
                    assert.equal(getAirline(query)?.slug, 'vietnam-airlines')
                }
            })

            it('finds every airline by each of its keys', () => {
                for (const a of listAirlines()) {
                    for (const key of [a.slug, a.name]) {
                        assert.equal(getAirline(key), a, `${a.name} by ${key}`)
                    }
                    // A defunct airline's code may have been reassigned, and
                    // then finds the active airline that holds it now; a
                    // brand flying under its parent's codes finds the parent,
                    // and an IATA controlled duplicate the unstarred holder
                    for (const field of ['iata', 'icao']) {
                        const found = getAirline(a[field])
                        const label = `${a.name} by ${a[field]}`
                        if (found === a) continue
                        assert.equal(found[field], a[field], label)
                        assert.ok(!found.defunct, label)
                        assert.ok(
                            a.defunct ||
                                a.parent === found.slug ||
                                (field === 'iata' &&
                                    a.iata_duplicate &&
                                    !found.iata_duplicate),
                            label,
                        )
                    }
                }
            })

            it('finds a renamed airline by its former slug and name', () => {
                const trinity = api.getAirline('trinity-airways')
                assert.deepEqual(
                    trinity.former.map((f) => f.slug),
                    ['hansung-airlines', 'tway-air'],
                )
                // Removed in 0.4: `former` holds them
                assert.equal(trinity.previous_names, undefined)
                assert.equal(trinity.previous_slugs, undefined)
                assert.equal(api.getAirline('tway-air'), trinity)
                assert.equal(api.getAirline("T'way Air"), trinity)
                assert.equal(api.getAirline('TW'), trinity)
                assert.equal(
                    api.getAssetPath('tway-air', 'logo'),
                    'soaring-symbols/assets/trinity-airways/logo.svg',
                )
                // Its T'way Air logo is in its history, under the new slug
                assert.equal(
                    api.getAssetPath('tway-air', 'logo', { since: 2010 }),
                    'soaring-symbols/assets/trinity-airways/history/2010/logo.svg',
                )
            })

            it('finds an airline by its former codes when no airline has them now', () => {
                const serbia = getAirline('air-serbia')
                assert.equal(getAirline('JAT'), serbia)
                assert.equal(getAirline('jat'), serbia)
                // Every former code finds an airline that has it now, or
                // else the airline that had it
                for (const a of listAirlines()) {
                    for (const item of a.former ?? []) {
                        for (const field of ['iata', 'icao']) {
                            const code = item[field]
                            if (!code) continue
                            const holder = listAirlines().find(
                                (b) => b[field] === code,
                            )
                            const found = getAirline(code)
                            const label = `${a.name} by former ${code}`
                            if (holder) assert.equal(found[field], code, label)
                            else assert.equal(found, a, label)
                        }
                    }
                }
            })

            it('finds the holder without iata_duplicate by a shared IATA code', () => {
                const thai = getAirline('thai-lion-air')
                const sas = getAirline('sas-connect')
                assert.equal(sas.iata, thai.iata)
                assert.equal(sas.iata_duplicate, true)
                assert.equal(getAirline(thai.iata), thai)
                assert.equal(getAirline(sas.icao), sas)
                // IATA's own notation finds the starred holder
                assert.equal(getAirline(`${sas.iata}*`), sas)
                assert.equal(getAirline(' sl* '), sas)
                // and only a starred one
                assert.equal(getAirline('VN*'), undefined)
            })

            it('finds the parent by a code a brand flies under', () => {
                const hawaiian = getAirline('hawaiian-airlines')
                const alaska = getAirline('alaska-airlines')
                assert.equal(hawaiian.parent, alaska.slug)
                assert.equal(hawaiian.iata, alaska.iata)
                assert.equal(getAirline(hawaiian.iata), alaska)
                assert.equal(getAirline(hawaiian.icao), alaska)
                // Its own former codes still find it
                assert.equal(getAirline('HA'), hawaiian)
                assert.equal(getAirline('HAL'), hawaiian)
            })

            it('returns undefined for unknown or empty queries', () => {
                for (const query of ['ZZZZ', '', '   ', undefined, null, 42]) {
                    assert.equal(getAirline(query), undefined, String(query))
                }
            })
        })

        describe('getAssetPath', () => {
            it('returns the package path of a color asset', () => {
                assert.equal(
                    getAssetPath('VN', 'logo'),
                    'soaring-symbols/assets/vietnam-airlines/logo.svg',
                )
            })

            it('returns the mono variant when asked', () => {
                assert.equal(
                    getAssetPath('VN', 'logo', { mono: true }),
                    'soaring-symbols/assets/vietnam-airlines/logo-mono.svg',
                )
            })

            it('accepts an airline object', () => {
                assert.equal(
                    getAssetPath(getAirline('VN'), 'icon'),
                    getAssetPath('VN', 'icon'),
                )
            })

            it('returns undefined when the file does not exist', () => {
                // Aer Lingus' logo is multi-color without a hand-made mono file
                assert.equal(
                    getAssetPath('EI', 'logo', { mono: true }),
                    undefined,
                )
                // Qantas ships only a mono icon
                assert.equal(getAssetPath('QF', 'icon'), undefined)
                assert.ok(getAssetPath('QF', 'icon', { mono: true }))
            })

            it('returns an older mark from the history with since', () => {
                const airline = {
                    ...getAirline('VN'),
                    history: [
                        {
                            since: 1989,
                            assets: {
                                logo: {
                                    color: true,
                                    mono: false,
                                    colors: ['#00579c', '#d99e09'],
                                },
                            },
                        },
                    ],
                }
                assert.equal(
                    getAssetPath(airline, 'logo', { since: 1989 }),
                    'soaring-symbols/assets/vietnam-airlines/history/1989/logo.svg',
                )
                assert.equal(
                    getAssetPath(airline, 'logo', { since: 1989, mono: true }),
                    undefined,
                )
                assert.equal(
                    getAssetPath(airline, 'icon', { since: 1989 }),
                    undefined,
                )
                assert.equal(
                    getAssetPath(airline, 'logo', { since: 2002 }),
                    undefined,
                )
                assert.equal(
                    getAssetPath('VN', 'logo', { since: 1989 }),
                    undefined,
                )
            })

            it('returns undefined for an unknown airline', () => {
                assert.equal(getAssetPath('ZZZZ', 'logo'), undefined)
            })

            it('throws on an unknown asset type', () => {
                assert.throws(() => getAssetPath('VN', 'banner'), TypeError)
            })

            it('returns a resolvable SVG for every listed asset', () => {
                for (const a of listAirlines()) {
                    const marks = [{ assets: a.assets }, ...(a.history ?? [])]
                    for (const { since, assets } of marks) {
                        for (const [type, info] of Object.entries(assets)) {
                            for (const mono of [false, true]) {
                                const path = getAssetPath(a, type, {
                                    mono,
                                    since,
                                })
                                const listed = mono ? info.mono : info.color
                                assert.equal(
                                    Boolean(path),
                                    listed,
                                    `${a.slug} ${type}`,
                                )
                                if (!path) continue
                                const svg = readFileSync(
                                    require.resolve(path),
                                    'utf8',
                                )
                                assert.match(svg, /^<svg[\s>]/, path)
                            }
                        }
                    }
                }
            })
        })

        describe('alliances', () => {
            it('lists every alliance airlines name, sorted by name', () => {
                const names = listAlliances().map((a) => a.name)
                assert.deepEqual(
                    names,
                    [...names].sort((a, b) =>
                        a.toLowerCase().localeCompare(b.toLowerCase()),
                    ),
                )
                for (const a of listAirlines()) {
                    for (const { alliance } of [
                        a,
                        ...(a.alliance_history ?? []),
                    ]) {
                        if (alliance) assert.ok(getAlliance(alliance), a.name)
                    }
                }
            })

            it('returns frozen alliances with their assets', () => {
                for (const a of listAlliances()) {
                    assert.ok(Object.isFrozen(a), a.name)
                    assert.equal(typeof a.assets, 'object', a.name)
                }
            })

            it('finds an alliance by name or slug, case-insensitive', () => {
                const star = getAlliance('Star Alliance')
                assert.equal(star.slug, 'star-alliance')
                assert.equal(getAlliance(' star-alliance '), star)
                assert.equal(getAlliance('STAR ALLIANCE'), star)
                assert.equal(getAlliance('SkyTeam').slug, 'skyteam')
                assert.equal(getAlliance('Unknown'), undefined)
                assert.equal(getAlliance(''), undefined)
            })

            it('returns the package path of an alliance file', () => {
                const alliance = {
                    slug: 'star-alliance',
                    assets: {
                        logo: { color: true, mono: true, colors: ['#000000'] },
                    },
                    history: [
                        {
                            since: 1997,
                            assets: {
                                logo: {
                                    color: true,
                                    mono: false,
                                    colors: ['#000000', '#ffffff'],
                                },
                            },
                        },
                    ],
                }
                assert.equal(
                    getAllianceAssetPath(alliance, 'logo'),
                    'soaring-symbols/alliances/star-alliance/logo.svg',
                )
                assert.equal(
                    getAllianceAssetPath(alliance, 'logo', { mono: true }),
                    'soaring-symbols/alliances/star-alliance/logo-mono.svg',
                )
                assert.equal(
                    getAllianceAssetPath(alliance, 'logo', { since: 1997 }),
                    'soaring-symbols/alliances/star-alliance/history/1997/logo.svg',
                )
                assert.equal(getAllianceAssetPath(alliance, 'icon'), undefined)
                assert.equal(getAllianceAssetPath('Unknown', 'logo'), undefined)
                assert.throws(
                    () => getAllianceAssetPath(alliance, 'tail'),
                    TypeError,
                )
            })

            it('points at files the package ships', () => {
                for (const a of listAlliances()) {
                    for (const type of Object.keys(a.assets)) {
                        for (const mono of [false, true]) {
                            const path = getAllianceAssetPath(a, type, { mono })
                            if (path) {
                                assert.ok(
                                    existsSync(require.resolve(path)),
                                    path,
                                )
                            }
                        }
                    }
                }
            })
        })
    })
}

describe('airlines.json schema', () => {
    it('ships a catalog that matches airlines.schema.json', () => {
        const shipped = JSON.parse(
            readFileSync(new URL('../dist/airlines.json', import.meta.url)),
        )
        assert.deepEqual(validateAirlines(shipped, { published: true }), [])
    })

    it('keeps a slug but no assets or history in the repo copy', () => {
        const source = JSON.parse(
            readFileSync(new URL('../airlines.json', import.meta.url)),
        )
        assert.deepEqual(validateAirlines(source), [])
        for (const a of source) {
            assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, a.name)
            assert.equal(a.assets, undefined, a.name)
            assert.equal(a.history, undefined, a.name)
        }
    })

    it('requires assets in the published catalog', () => {
        const source = JSON.parse(
            readFileSync(new URL('../airlines.json', import.meta.url)),
        )
        assert.notDeepEqual(validateAirlines(source, { published: true }), [])
    })

    it('rejects a missing, hand-picked or duplicate slug', () => {
        const source = JSON.parse(
            readFileSync(new URL('../airlines.json', import.meta.url)),
        )
        const [first, second, ...rest] = source
        const { slug, ...unslugged } = first
        assert.notDeepEqual(validateAirlines([unslugged, second, ...rest]), [])
        assert.deepEqual(
            validateAirlines([
                { ...first, slug: `${slug}-x` },
                second,
                ...rest,
            ]),
            [`${first.name}: slug must be "${slug}", not "${slug}-x"`],
        )
        // Two airlines with the same name can't both get its slug
        assert.deepEqual(
            validateAirlines([
                first,
                { ...second, name: first.name, slug },
                ...rest,
            ]),
            [
                `slug "${slug}" is used by more than one airline: ${first.name}, ${first.name}`,
            ],
        )
    })
})

describe('alliances.json schema', () => {
    const read = (file) =>
        JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)))

    it('ships a catalog that matches alliances.schema.json', () => {
        const shipped = read('dist/alliances.json')
        assert.deepEqual(validateAlliances(shipped, { published: true }), [])
        for (const a of shipped) {
            assert.deepEqual(
                a.assets,
                getAirlineAssets(
                    a.slug,
                    fileURLToPath(
                        new URL('../dist/alliances/', import.meta.url),
                    ),
                ),
                a.slug,
            )
        }
    })

    it('keeps the repo copy tidy, without assets', () => {
        const source = read('alliances.json')
        assert.deepEqual(validateAlliances(source), [])
        assert.deepEqual(normalizeAlliances(source), source)
        assert.notDeepEqual(validateAlliances(source, { published: true }), [])
    })

    it('needs a primary color once an alliance has SVGs', () => {
        const [first, ...rest] = read('dist/alliances.json')
        const icon = { color: true, mono: true, colors: ['#1a3576'] }
        const { branding, ...uncolored } = first
        assert.deepEqual(
            validateAlliances([{ ...uncolored, assets: {} }, ...rest], {
                published: true,
            }).filter((problem) => problem.startsWith(`${first.name}:`)),
            [],
        )
        assert.deepEqual(
            validateAlliances([{ ...uncolored, assets: { icon } }, ...rest], {
                published: true,
            }).filter((problem) => problem.startsWith(`${first.name}:`)),
            [
                `${first.name}: has SVGs in alliances/${first.slug}/, so it needs branding.primary_color`,
            ],
        )
    })

    it('needs one entry per alliance airlines can name', () => {
        const [first, ...rest] = read('alliances.json')
        assert.deepEqual(validateAlliances(rest), [
            `alliances.json has no entry for ${first.name}`,
        ])
        assert.deepEqual(validateAlliances([first, first, ...rest]), [
            `alliances.json lists ${first.name} more than once`,
        ])
        assert.notDeepEqual(
            validateAlliances([{ name: 'Unknown', slug: 'unknown' }, ...rest]),
            [],
        )
        assert.deepEqual(
            validateAlliances([{ ...first, slug: 'x' }, ...rest]),
            [`${first.name}: slug must be "${first.slug}", not "x"`],
        )
    })
})

describe('airports.json (hub coordinates)', () => {
    const read = (file) =>
        JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)))

    it('ships coordinates for every hub, and only for hubs', () => {
        const catalog = read('dist/airlines.json')
        const shipped = read('dist/airports.json')
        assert.deepEqual(findAirportProblems(shipped, catalog), [])
        assert.deepEqual(
            Object.keys(shipped),
            [...new Set(catalog.flatMap((a) => a.hubs ?? []))].sort(),
        )
    })

    it('reports a hub without coordinates and a malformed entry', () => {
        const airlines = [
            { name: 'Example Air', hubs: ['HAN', 'SGN'] },
            { name: 'Other Air', hubs: ['SGN'] },
        ]
        assert.deepEqual(
            findAirportProblems(
                { HAN: { lat: 21.22, lon: 105.81 }, SGN: { lat: 95, lon: 0 } },
                airlines,
            ),
            ['SGN needs a lat between -90 and 90'],
        )
        assert.deepEqual(
            findAirportProblems({ HAN: { lat: 21.22, lon: 105.81 } }, airlines),
            [
                'SGN is a hub of Example Air, Other Air but has no coordinates; run npm run sync:data -- --write or add it by hand',
            ],
        )
    })

    it('sorts the file and drops airports no airline lists', () => {
        const tidy = normalizeAirports(
            {
                SGN: { lon: 106.65, lat: 10.82 },
                DAD: { lat: 16.04, lon: 108.2 },
                HAN: { lat: 21.22, lon: 105.81 },
            },
            [{ name: 'Example Air', hubs: ['SGN', 'HAN'] }],
        )
        assert.deepEqual(Object.keys(tidy), ['HAN', 'SGN'])
        assert.deepEqual(Object.keys(tidy.SGN), ['lat', 'lon'])
    })
})

describe('renames and mergers (successor)', () => {
    const entry = (name, fields = {}) => ({
        name,
        slug: toSlug(name),
        iata: 'BL',
        icao: 'PIC',
        country: 'VN',
        website: 'https://www.pacificairlines.com',
        branding: { primary_color: '#0b2a63' },
        ...fields,
    })
    const renamed = (name, successor, ceased) =>
        entry(name, { defunct: true, ceased, successor })

    it('accepts a defunct airline whose successor shares its codes', () => {
        assert.deepEqual(
            validateAirlines([
                renamed('Jetstar Pacific', 'pacific-airlines', 2020),
                entry('Pacific Airlines'),
            ]),
            [],
        )
    })

    it('allows a successor only on a defunct airline', () => {
        assert.notDeepEqual(
            validateAirlines([
                entry('Jetstar Pacific', { successor: 'pacific-airlines' }),
                entry('Pacific Airlines', { iata: 'XX', icao: 'XXX' }),
            ]),
            [],
        )
    })

    it('rejects a successor that is missing, itself or a loop', () => {
        assert.deepEqual(
            validateAirlines([renamed('Jetstar Pacific', 'nowhere', 2020)]),
            ['Jetstar Pacific: successor "nowhere" is not another airline'],
        )
        assert.deepEqual(
            validateAirlines([
                renamed('Jetstar Pacific', 'jetstar-pacific', 2020),
            ]),
            [
                'Jetstar Pacific: successor "jetstar-pacific" is not another airline',
            ],
        )
        assert.deepEqual(
            validateAirlines([
                renamed('Old Air', 'new-air', 2010),
                renamed('New Air', 'old-air', 2020),
            ]),
            [
                'Old Air: successor "new-air" leads back to it',
                'New Air: successor "old-air" leads back to it',
            ],
        )
    })

    const noAssets = join(tmpdir(), 'soaring-symbols-no-assets')
    const formerly = (name, former) => entry(name, { former })

    it('keeps former names apart from every other airline', () => {
        const binter = formerly('Binter', [
            { name: 'Binter Canarias', until: 2018 },
        ])
        assert.deepEqual(validateAirlines([binter]), [])
        // Its former slug is another airline's slug
        assert.deepEqual(
            validateAirlines([
                binter,
                entry('Binter Canarias', { iata: 'XX', icao: 'XXX' }),
            ]),
            [
                'slug "binter-canarias" is used by more than one airline: Binter, Binter Canarias',
            ],
        )
        // A former name with the same slug adds no alias
        const tway = formerly("T'way Air", [{ name: 'Tway Air', until: 2010 }])
        assert.deepEqual(validateAirlines([tway]), [])
        const [published] = publishCatalog([tway], noAssets)
        assert.equal(published.former[0].slug, undefined)
    })

    it('rejects former items that are current, unordered or empty', () => {
        assert.deepEqual(
            validateAirlines([
                formerly('Binter', [
                    { name: 'Binter', iata: 'BL', until: 2018 },
                ]),
            ]),
            [
                'Binter: former lists its current name',
                'Binter: former lists its current iata',
            ],
        )
        assert.deepEqual(
            validateAirlines([
                formerly('Air Serbia', [
                    { name: 'Jat Airways', until: 2013 },
                    { name: 'Yugoslav Airlines', until: 2003 },
                ]),
            ]),
            ['Air Serbia: former must be oldest first (2003 comes after 2013)'],
        )
        // Each item needs a name or a code, and the year it ended
        for (const item of [{ until: 2013 }, { name: 'Jat Airways' }]) {
            assert.notDeepEqual(
                validateAirlines([formerly('Air Serbia', [item])]),
                [],
                JSON.stringify(item),
            )
        }
    })

    it('checks alliance_history is oldest first and joined before it was left', () => {
        const sas = (history) =>
            entry('Scandinavian Airlines', {
                alliance: 'SkyTeam',
                alliance_history: history,
            })
        assert.deepEqual(
            validateAirlines([
                sas([{ alliance: 'Star Alliance', since: 1997, until: 2024 }]),
            ]),
            [],
        )
        assert.deepEqual(
            validateAirlines([
                sas([
                    { alliance: 'oneworld', since: 2025, until: 2024 },
                    { alliance: 'Star Alliance', until: 2010 },
                ]),
            ]),
            [
                'Scandinavian Airlines: alliance_history has oneworld joined in 2025, after it left in 2024',
                'Scandinavian Airlines: alliance_history must be oldest first (2010 comes after 2024)',
            ],
        )
        // Each item needs a known alliance and the year it ended
        for (const item of [
            { alliance: 'Star Alliance' },
            { alliance: 'Skyteam', until: 2018 },
        ]) {
            assert.notDeepEqual(
                validateAirlines([sas([item])]),
                [],
                JSON.stringify(item),
            )
        }
    })

    it('publishes the slugs of former names', () => {
        const [serbia] = publishCatalog(
            [
                formerly('Air Serbia', [
                    { name: 'Jat Airways', icao: 'JAT', until: 2013 },
                    { callsign: 'SERBIA', until: 2014 },
                ]),
            ],
            noAssets,
        )
        assert.deepEqual(serbia.former, [
            {
                name: 'Jat Airways',
                slug: 'jat-airways',
                icao: 'JAT',
                until: 2013,
            },
            { callsign: 'SERBIA', until: 2014 },
        ])
        assert.deepEqual(validateAirlines([serbia], { published: true }), [])
        // The repo copy keeps none of them
        const [source] = normalizeCatalog([serbia])
        assert.equal(source.former[0].slug, undefined)
    })

    it('rejects previous_names, removed in 0.4', () => {
        const [airline] = normalizeCatalog([
            formerly('Air Serbia', [{ name: 'Jat Airways', until: 2013 }]),
        ])
        assert.match(
            validateAirlines([
                { ...airline, previous_names: ['Jat Airways'] },
            ]).join('\n'),
            /previous_names/,
        )
    })

    it('lets a brand share codes with its parent only', () => {
        const alaska = entry('Alaska Airlines', { iata: 'AS', icao: 'ASA' })
        const hawaiian = entry('Hawaiian Airlines', {
            iata: 'AS',
            icao: 'ASA',
            parent: 'alaska-airlines',
        })
        assert.deepEqual(validateAirlines([alaska, hawaiian]), [])
        const { parent, ...unrelated } = hawaiian
        assert.deepEqual(validateAirlines([alaska, unrelated]), [
            'IATA AS is used by more than one active airline: Alaska Airlines, Hawaiian Airlines',
            'ICAO ASA is used by more than one active airline: Alaska Airlines, Hawaiian Airlines',
        ])
    })

    it('lets IATA controlled duplicates share a code', () => {
        const thai = entry('Thai Lion Air', { iata: 'SL', icao: 'TLM' })
        const sas = entry('SAS Connect', {
            iata: 'SL',
            icao: 'SZS',
            iata_duplicate: true,
        })
        assert.deepEqual(validateAirlines([sas, thai]), [])
        // Only for IATA, and only while one holder has no asterisk
        const { iata_duplicate, ...unmarked } = sas
        assert.deepEqual(validateAirlines([unmarked, thai]), [
            'IATA SL is used by more than one active airline: SAS Connect, Thai Lion Air',
        ])
        assert.deepEqual(validateAirlines([sas, { ...thai, icao: 'SZS' }]), [
            'ICAO SZS is used by more than one active airline: SAS Connect, Thai Lion Air',
        ])
    })

    it('publishes predecessors on the successor, earliest to cease first', () => {
        const catalog = publishCatalog(
            [
                renamed('B Air', 'c-air', 2020),
                renamed('A Air', 'c-air', 2010),
                renamed('Old C Air', 'b-air', 2015),
                entry('C Air'),
            ],
            // No SVGs needed: a missing folder reads as no assets
            join(tmpdir(), 'soaring-symbols-no-assets'),
        )
        const bySlug = (slug) => catalog.find((a) => a.slug === slug)
        assert.deepEqual(bySlug('c-air').predecessors, ['a-air', 'b-air'])
        assert.deepEqual(bySlug('b-air').predecessors, ['old-c-air'])
        assert.equal(bySlug('a-air').predecessors, undefined)
        // Generated, so the repo copy never keeps it
        assert.equal(
            normalizeCatalog(catalog).find((a) => a.slug === 'c-air')
                .predecessors,
            undefined,
        )
    })
})

describe('airlines.json assets metadata', () => {
    const assetsDir = new URL('../dist/assets/', import.meta.url)

    it('matches the files in dist/assets', () => {
        for (const a of cjs.listAirlines()) {
            assert.deepEqual(
                a.assets,
                getAirlineAssets(a.slug, fileURLToPath(assetsDir)),
                a.slug,
            )
        }
    })

    it('ships a mono file for every single-color asset', () => {
        for (const a of cjs.listAirlines()) {
            for (const [type, info] of Object.entries(a.assets)) {
                if (info.colors.length === 1) {
                    assert.ok(info.mono, `${a.slug} ${type}-mono.svg`)
                }
            }
        }
    })

    it('writes every color as six-digit lowercase hex', () => {
        const FULL_HEX = /^#[0-9a-f]{6}$/
        for (const a of cjs.listAirlines()) {
            const colors = [
                a.branding?.primary_color,
                ...Object.values(a.assets).flatMap((info) => info.colors),
            ].filter(Boolean)
            for (const color of colors) {
                assert.match(color, FULL_HEX, `${a.slug} ${color}`)
            }
        }
    })

    it('publishes shared marks under the borrowing airline, with its title', () => {
        const borrowers = cjs.listAirlines().filter((a) => a.marks)
        assert.ok(borrowers.length > 0)
        for (const a of borrowers) {
            const owner = cjs.getAirline(a.marks)
            assert.deepEqual(a.assets, owner.assets, a.slug)
            for (const type of Object.keys(a.assets)) {
                const svg = readFileSync(
                    new URL(`${a.slug}/${type}.svg`, assetsDir),
                    'utf8',
                ).replace(/&amp;/g, '&')
                assert.match(
                    svg,
                    new RegExp(`<title>${a.name}</title>`),
                    a.slug,
                )
            }
        }
    })

    it('publishes the current files of a renamed airline at its published former slugs', () => {
        const slugsOf = (a) =>
            (a.former ?? []).flatMap(({ slug }) => (slug ? [slug] : []))
        const renamed = cjs.listAirlines().filter((a) => slugsOf(a).length)
        assert.ok(renamed.length > 0)
        const published = new Set(
            JSON.parse(
                readFileSync(
                    new URL('../published-slugs.json', import.meta.url),
                ),
            ),
        )
        const filesIn = (slug) =>
            readdirSync(new URL(`${slug}/`, assetsDir), { withFileTypes: true })
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .sort()
        for (const a of renamed) {
            for (const slug of slugsOf(a)) {
                // A former name that was never a slug in a release has no
                // links to keep, so no copy (Air Pacific for Fiji Airways)
                if (!published.has(slug)) {
                    assert.ok(!existsSync(new URL(slug, assetsDir)), slug)
                    continue
                }
                // The current files only, never history/
                assert.deepEqual(filesIn(slug), filesIn(a.slug), slug)
                assert.ok(
                    !existsSync(new URL(`${slug}/history`, assetsDir)),
                    slug,
                )
            }
        }
    })

    it('has an airline for every asset directory', () => {
        const slugs = new Set(
            cjs
                .listAirlines()
                .flatMap((a) => [
                    a.slug,
                    ...(a.former ?? []).map(({ slug }) => slug),
                ]),
        )
        const dirs = readdirSync(assetsDir, { withFileTypes: true })
        assert.ok(
            dirs.every((d) => d.isDirectory()),
            'only directories',
        )
        for (const { name: dir } of dirs) {
            assert.ok(slugs.has(dir), `assets/${dir} has no airline`)
        }
    })
})

describe('asset history (assets/<slug>/history/<year>/)', () => {
    const svg = (color) =>
        `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 64 64"><title>Korean Air</title><path fill="${color}" d="M0 0h64v64H0z"/></svg>`
    let assetsDir
    const write = (file, content = svg('#051766')) => {
        mkdirSync(join(assetsDir, file, '..'), { recursive: true })
        writeFileSync(join(assetsDir, file), content)
    }
    const source = JSON.parse(
        readFileSync(new URL('../airlines.json', import.meta.url)),
    )
    const koreanAir = source.find((a) => a.slug === 'korean-air')

    before(() => {
        assetsDir = mkdtempSync(join(tmpdir(), 'history-'))
        write('korean-air/logo.svg')
        write('korean-air/history/2002/logo.svg', svg('#00256c'))
        write('korean-air/history/1984/logo.svg', svg('#c60c30'))
        write('korean-air/history/1984/icon.svg', svg('#c60c30'))
    })
    after(() => rmSync(assetsDir, { recursive: true, force: true }))

    it('lists the history folders oldest first, after the current one', () => {
        assert.deepEqual(getAssetDirs('korean-air', assetsDir), [
            'korean-air',
            join('korean-air', 'history', '1984'),
            join('korean-air', 'history', '2002'),
        ])
        assert.deepEqual(getAssetDirs('vietnam-airlines', assetsDir), [
            'vietnam-airlines',
        ])
    })

    it('describes each older mark like the current assets', () => {
        assert.deepEqual(getAirlineHistory('korean-air', assetsDir), [
            {
                since: 1984,
                name: 'Korean Air',
                assets: {
                    icon: { color: true, mono: true, colors: ['#c60c30'] },
                    logo: { color: true, mono: true, colors: ['#c60c30'] },
                },
            },
            {
                since: 2002,
                name: 'Korean Air',
                assets: {
                    logo: { color: true, mono: true, colors: ['#00256c'] },
                },
            },
        ])
        assert.deepEqual(findHistoryProblems('korean-air', assetsDir), [])
    })

    it('publishes history only for airlines that have it', () => {
        const borrower = source.find((a) => a.marks)
        const catalog = publishCatalog(
            [
                koreanAir,
                borrower,
                source.find((a) => a.slug === borrower.marks),
            ],
            assetsDir,
        )
        const published = catalog.find((a) => a.slug === 'korean-air')
        assert.deepEqual(
            published.history.map(({ since, until, name }) => [
                since,
                until,
                name,
            ]),
            [
                [1984, 2002, 'Korean Air'],
                [2002, koreanAir.branding.since, 'Korean Air'],
            ],
        )
        // Older marks need the year the current ones came in, after the last
        const errorsWith = (branding) =>
            validateAirlines(
                publishCatalog([{ ...koreanAir, branding }], assetsDir),
                { published: true },
            )
        assert.deepEqual(errorsWith({ primary_color: '#051766' }), [
            'Korean Air: has older marks, so branding.since needs the year its current marks came in',
        ])
        assert.deepEqual(
            errorsWith({ primary_color: '#051766', since: 2002 }),
            [
                'Korean Air: branding.since (2002) must come after its last older mark (2002)',
            ],
        )
    })

    it('reports malformed history folders', () => {
        const dir = mkdtempSync(join(tmpdir(), 'history-bad-'))
        const put = (file) => {
            mkdirSync(join(dir, file, '..'), { recursive: true })
            writeFileSync(join(dir, file), svg('#000000'))
        }
        put('x/history/logo.svg')
        put('x/history/old/logo.svg')
        put('x/history/2999/logo.svg')
        put('x/history/1990/logo-2.svg')
        put('x/history/1995/logo-mono.svg')
        const problems = findHistoryProblems('x', dir)
        rmSync(dir, { recursive: true, force: true })
        const has = (text) =>
            assert.ok(
                problems.some((p) => p.includes(text)),
                `${text} in ${problems.join('; ')}`,
            )
        has('history/logo.svg must be in a year folder')
        has('history/old/ must be named after the year')
        has('history/2999/ must be named after the year')
        has('history/1990/logo-2.svg is not icon, logo or tail')
        has('history/1990/ has no icon.svg')
        has('history/1995/ has no icon.svg')
        assert.equal(problems.length, 6)
    })

    it('allows no tail in an alliance’s history', () => {
        const dir = mkdtempSync(join(tmpdir(), 'history-alliance-'))
        mkdirSync(join(dir, 'x/history/2000'), { recursive: true })
        writeFileSync(join(dir, 'x/history/2000/tail.svg'), svg('#000000'))
        const problems = findHistoryProblems('x', dir, ALLIANCE_TYPES)
        rmSync(dir, { recursive: true, force: true })
        assert.deepEqual(problems, [
            `${dir}/x/history/2000/tail.svg is not icon or logo (.svg or -mono.svg)`,
            `${dir}/x/history/2000/ has no icon.svg or logo.svg`,
        ])
    })
})

describe('package exports', () => {
    it('ships declarations for both import and require', () => {
        for (const entry of [
            'soaring-symbols',
            'soaring-symbols/svg-validator',
        ]) {
            const base = require.resolve(entry).replace(/\.c?js$/, '')
            assert.ok(existsSync(`${base}.d.ts`), `${entry} .d.ts`)
            assert.ok(existsSync(`${base}.d.cts`), `${entry} .d.cts`)
        }
    })

    it('ships the browser fixer as ESM with its declarations', () => {
        const base = require
            .resolve('soaring-symbols/package.json')
            .replace(/package\.json$/, 'dist/svg-fixer')
        assert.ok(existsSync(`${base}.js`))
        assert.ok(existsSync(`${base}.d.ts`))
    })
})

describe('wikipedia infobox parsing (sync-data)', () => {
    const page = `Intro {{Short description|Airline}}
{{Infobox airline
| airline = Example Air
| IATA = EX (formerly EY)
| ICAO = EXA; EXB<ref>{{cite web |url=https://x.test |title=Codes}}</ref>
| callsign = EXAMPLE{{efn|Its regional arm uses EXPRESS.}}
| hubs = {{ubl|class=nowrap
| [[Noi Bai International Airport|Hanoi]]
| [[Tan Son Nhat International Airport]]}}
| ceased = {{end date|2020|03|05}}<!-- administration -->
}}
'''Example Air''' is an airline.`

    const params = infoboxParams(extractInfobox(page))

    it('reads top-level infobox parameters', () => {
        assert.deepEqual(Object.keys(params), [
            'airline',
            'iata',
            'icao',
            'callsign',
            'hubs',
            'ceased',
        ])
    })

    it('drops references, footnotes and comments from values', () => {
        assert.deepEqual(listItems(params.iata), ['EX'])
        assert.deepEqual(listItems(params.icao), ['EXA', 'EXB'])
        assert.deepEqual(listItems(params.callsign), ['EXAMPLE'])
    })

    it('keeps the items of list templates', () => {
        assert.deepEqual(listItems(params.hubs), [
            'Hanoi',
            'Tan Son Nhat International Airport',
        ])
        assert.deepEqual(linkTargets(params.hubs), [
            'Noi Bai International Airport',
            'Tan Son Nhat International Airport',
        ])
    })

    it('reads the year out of a date template', () => {
        assert.equal(firstYear(params.ceased), 2020)
        assert.equal(firstYear(''), undefined)
    })

    it("picks the infobox of the name asked for on a renamed airline's page", () => {
        const renamed = `{{Infobox airline
| airline = Pacific Airlines
| callsign = PACIFIC
}}
=== Jetstar Pacific ===
{{Infobox airline
| airline = Jetstar Pacific Airlines
| callsign = PACIFIC EXPRESS
| ceased = {{end date|2020|07|29|df=yes}}<br />{{small|(rebranded to ''Pacific Airlines'')}}
}}`
        const callsignOf = (name) =>
            infoboxParams(extractInfobox(renamed, name)).callsign
        assert.equal(callsignOf('Pacific Airlines'), 'PACIFIC')
        assert.equal(callsignOf('Jetstar Pacific'), 'PACIFIC EXPRESS')
        assert.equal(callsignOf('Someone Else'), 'PACIFIC')
        assert.equal(callsignOf(), 'PACIFIC')

        const { ceased } = infoboxParams(
            extractInfobox(renamed, 'Jetstar Pacific'),
        )
        assert.equal(firstYear(ceased), 2020)
        assert.equal(carriedOn(ceased), 'rebranded to Pacific Airlines')
        assert.equal(carriedOn(params.ceased), undefined)
    })

    it('reads the alliance an airline is a member of', () => {
        const names = ['oneworld', 'SkyTeam', 'Star Alliance']
        assert.equal(allianceOf('[[SkyTeam]]', names), 'SkyTeam')
        assert.equal(allianceOf('[[SkyTeam]] (affiliate)', names), undefined)
        assert.equal(
            allianceOf('[[Star Alliance]] (connecting partner)', names),
            undefined,
        )
        assert.equal(
            allianceOf('[[Oneworld]] (affiliate; 2007–2020)', names),
            undefined,
        )
        assert.equal(allianceOf('', names), undefined)
    })

    it('reads the names an airline flew under from its founding dates', () => {
        const founded =
            "{{start date and age|1968}} (as ''[[Sahakol Air]]'')<ref>x</ref>"
        assert.deepEqual(namedDates(founded), [
            { year: 1968, name: 'Sahakol Air' },
        ])
        assert.deepEqual(namedDates('1956'), [])

        // A later name ends the one before it; the current name is left out
        assert.deepEqual(
            formerNames(
                {
                    founded,
                    commenced:
                        "{{ubl|{{start date|1968}} (as ''Sahakol Air'')|{{start date|1989}} (as Bangkok Airways)}}",
                },
                'Bangkok Airways',
            ),
            [{ name: 'Sahakol Air', until: 1989 }],
        )
        // The latest name is the current one, however it is spelled
        assert.deepEqual(
            formerNames(
                {
                    founded: '1998 (as LAN Perú)',
                    commenced: '2016 (as LATAM Perú)',
                },
                'LATAM Airlines Perú',
            ),
            [{ name: 'LAN Perú', until: 2016 }],
        )
        // Nothing after it: only the year it started
        assert.deepEqual(
            formerNames({ founded: '1932 (as Tata Airlines)' }, 'Air India'),
            [{ name: 'Tata Airlines', since: 1932 }],
        )
        assert.deepEqual(formerNames({}, 'Example Air'), [])
    })

    it('returns nothing for a page without an airline infobox', () => {
        assert.equal(extractInfobox('No infobox here'), '')
        assert.deepEqual(infoboxParams(''), {})
    })
})

describe('lint file selection (lint-svg --changed)', () => {
    // Paths and git refs are read from the repo, like lint-svg.js does
    const outside = process.cwd()
    before(() => process.chdir(fileURLToPath(new URL('..', import.meta.url))))
    after(() => process.chdir(outside))

    it('keeps listed SVGs that exist, normalized and deduplicated', () => {
        const { listed, files } = selectSvgs([
            '--fix',
            './assets/iberia/icon.svg',
            'assets/iberia/icon.svg',
            'assets/iberia/missing.svg',
            'README.md',
        ])
        assert.equal(listed, true)
        assert.deepEqual(files, ['assets/iberia/icon.svg'])
    })

    it('reads --base as the ref, not as a file', () => {
        const { base, listed } = selectSvgs(['--changed', '--base', 'HEAD'])
        assert.equal(base, 'HEAD')
        assert.equal(listed, false)
    })
})

describe('release notes (release-notes.js)', () => {
    const commit = (subject, files = ['scripts/build.js'], body = '') => ({
        subject,
        body,
        files,
    })

    it('groups commits by type and leaves out the rest', () => {
        const groups = groupCommits([
            commit('feat!: replace getAssets with getAssetPath (#44)'),
            commit('feat: add Juneyao Air (#20)', [
                'airlines.json',
                'assets/juneyao-air/logo.svg',
            ]),
            commit('fix: drop the hubs', ['airlines.json', 'airports.json']),
            commit('chore(data): sync airline data from wikipedia (#45)', [
                'airlines.json',
            ]),
            commit('feat(lint): add a no-strokes rule'),
            commit('fix(svgo): keep black fills when optimizing'),
            commit(
                'refactor: drop the old field',
                ['index.js'],
                'BREAKING CHANGE: gone',
            ),
            commit('docs: tidy the roadmap', ['README.md']),
            commit('chore(release): v0.3.3', ['package.json']),
            commit('ci: run on tags'),
            commit('not a conventional commit'),
        ])
        assert.deepEqual(groups, {
            breaking: [
                'Replace getAssets with getAssetPath (#44)',
                'Drop the old field',
            ],
            airlines: [
                'Add Juneyao Air (#20)',
                'Drop the hubs',
                'Sync airline data from wikipedia (#45)',
            ],
            features: ['Add a no-strokes rule'],
            fixes: ['Keep black fills when optimizing'],
        })
    })

    it('renders the non-empty sections and a compare link', () => {
        const notes = renderNotes(
            groupCommits([commit('feat: add SpiceJet', ['airlines.json'])]),
            { from: 'v0.3.0', version: '0.3.1' },
        )
        assert.equal(
            notes,
            `### Airlines\n\n- Add SpiceJet\n\n**Full Changelog**: <${REPO_URL}/compare/v0.3.0...v0.3.1>\n`,
        )
    })

    it('says so when nothing user-facing changed', () => {
        const notes = renderNotes(groupCommits([commit('docs: fix a typo')]), {
            version: '1.0.0',
        })
        assert.match(notes, /^Maintenance release/)
        assert.match(notes, /\/commits\/v1\.0\.0>\n$/)
    })
})

describe('svg-validator', () => {
    // One parser for every file: a JSDOM window per SVG is slow
    const parser = new new JSDOM('').window.DOMParser()
    const parse = (source) =>
        parser.parseFromString(source, 'image/svg+xml').documentElement
    const svg = parse(
        readFileSync(
            require.resolve('soaring-symbols/assets/vietnam-airlines/logo.svg'),
            'utf8',
        ),
    )

    it('is self-contained in both module formats', async () => {
        const {
            runSvgValidations: validateCJS,
        } = require('../dist/svg-validator.cjs')
        const { runSvgValidations: validateESM } =
            await import('../dist/svg-validator.js')
        for (const validate of [validateCJS, validateESM]) {
            assert.ok(validate(svg, 'logo').some((check) => check.pass))
        }
    })

    const assetsDir = fileURLToPath(new URL('../assets', import.meta.url))

    // lint-svg.js --check passes in CI, so every SVG it lints must pass the
    // same error-level checks in the browser
    it('agrees with lint-svg.js on every asset', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const failures = []
        const dirs = readdirSync(assetsDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
        for (const dir of dirs) {
            for (const file of readdirSync(`${assetsDir}/${dir}`)) {
                const path = `${assetsDir}/${dir}/${file}`
                if (!file.endsWith('.svg')) continue
                if (EXCLUDE_FILES.includes(`assets/${dir}/${file}`)) continue
                const source = readFileSync(path, 'utf8')
                const type = /icon|tail/.test(file) ? 'icon' : 'logo'
                const checks = runSvgValidations(parse(source), type, null, {
                    fileName: file,
                    source,
                })
                for (const check of checks) {
                    if (check.level === 'error' && !check.pass) {
                        failures.push(
                            `${dir}/${file}: ${check.label} (${check.detail})`,
                        )
                    }
                }
            }
        }
        assert.deepEqual(failures, [])
    })

    it('reports what lint-svg.js would', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const source =
            '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" role="img"><!-- c --><path d="M0.5 1.1234567" fill="#F60"/><title>X</title><g><g><path fill="red" style="opacity:.5" d="M1 1"/></g></g></svg>'
        const failing = runSvgValidations(parse(source), 'logo', null, {
            fileName: 'logo.svg',
            source,
        })
            .filter((check) => !check.pass)
            .map((check) => `${check.group}/${check.label}/${check.level}`)
        assert.deepEqual(failing, [
            'Structure/Title first/error',
            'Structure/No nested groups/warning',
            'Format/No width or height/error',
            'Format/No editor data/error',
            'Format/Number format/error',
            'Format/Starts with <svg>/error',
            'Format/Attribute order/error',
            'Style/No styles/error',
            'Style/Hex colors/error',
        ])
    })

    it('asks for one path per color, merging neighbours only', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const onePath = (body) =>
            runSvgValidations(
                parse(
                    `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>X</title>${body}</svg>`,
                ),
                'icon',
            ).find((check) => check.label === 'One path per color').pass
        const a = '<path fill="#ff0000" d="M1 1"/>'
        const b = '<path fill="#0000ff" d="M2 2"/>'
        assert.equal(onePath(a + b), true)
        // Merging the two reds would draw one of them over the blue
        assert.equal(onePath(a + b + a), true)
        assert.equal(onePath(a + a + b), false)
        // A single-color SVG, its fill on the root
        assert.equal(onePath('<path d="M1 1"/><circle r="1"/>'), false)
        // Same color, different clip: they can't share a path
        assert.equal(
            onePath(`${a}<path fill="#ff0000" clip-path="url(#c)" d="M2 2"/>`),
            true,
        )
    })

    it('reports every stroke, painting or not', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const noStrokes = (body) =>
            runSvgValidations(
                parse(
                    `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>X</title>${body}</svg>`,
                ),
                'icon',
            ).find((check) => check.label === 'No strokes').pass
        assert.equal(noStrokes('<path d="M1 1"/>'), true)
        for (const body of [
            '<path stroke="#000000" d="M1 1"/>',
            '<path style="stroke:#000000" d="M1 1"/>',
            '<path stroke="none" d="M1 1"/>',
            '<path stroke="transparent" d="M1 1"/>',
            '<path stroke-width=".6" d="M1 1"/>',
            '<path style="display:inline;stroke-width:.6" d="M1 1"/>',
        ]) {
            assert.equal(noStrokes(body), false, body)
        }
    })

    // Every lint rule has a browser check and every browser check (geometry
    // aside, which the CLI doesn't check yet) a rule, at the same level
    it('has a browser check for every lint rule', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const source = readFileSync(
            require.resolve('soaring-symbols/assets/vietnam-airlines/logo.svg'),
            'utf8',
        )
        const checks = runSvgValidations(parse(source), 'logo', null, {
            fileName: 'logo.svg',
            source,
        })
        const levels = new Map(checks.map((c) => [c.label, c.level]))
        const claimed = new Set()

        for (const rule of [...DOM_RULES, ...STRING_RULES]) {
            const entry = BROWSER_CHECKS.get(rule)
            assert.ok(entry, `${rule.name} has no entry in BROWSER_CHECKS`)
            for (const label of entry.labels) {
                assert.ok(levels.has(label), `no browser check "${label}"`)
                const level = entry.warning ? 'warning' : 'error'
                assert.equal(levels.get(label), level, `level of "${label}"`)
                claimed.add(label)
            }
        }
        const unclaimed = checks
            .filter((c) => c.group !== 'Geometry' && !claimed.has(c.label))
            .map((c) => c.label)
        assert.deepEqual(unclaimed, [], 'browser checks with no lint rule')
    })

    it('grades geometry as exact, a warning or an error', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const grade = (bbox) =>
            Object.fromEntries(
                runSvgValidations(svg, 'icon', bbox)
                    .filter((c) => c.group === 'Geometry')
                    .map((c) => [c.label, c.pass ? 'pass' : c.level]),
            )
        // Off by less than 0.01: exact
        assert.deepEqual(grade({ x: 0.005, y: 2, width: 23.995, height: 20 }), {
            'Fills viewBox': 'pass',
            'Fits viewBox': 'pass',
            Centered: 'pass',
        })
        // Within each tolerance but not exact
        assert.deepEqual(
            grade({ x: 0.027, y: 1.507, width: 23.976, height: 21.016 }),
            {
                'Fills viewBox': 'warning',
                'Fits viewBox': 'pass',
                Centered: 'warning',
            },
        )
        assert.deepEqual(grade({ x: -0.3, y: 2, width: 24.3, height: 20 }), {
            'Fills viewBox': 'pass',
            'Fits viewBox': 'warning',
            Centered: 'warning',
        })
        // Beyond the tolerances
        assert.deepEqual(grade({ x: 2, y: 2, width: 20, height: 20 }), {
            'Fills viewBox': 'error',
            'Fits viewBox': 'error',
            Centered: 'error',
        })
        assert.deepEqual(grade({ x: 0, y: 4, width: 24, height: 10 }), {
            'Fills viewBox': 'pass',
            'Fits viewBox': 'pass',
            Centered: 'error',
        })
    })

    it('counts a gradient as a color in fill placement (#53)', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const fill = (root, body) =>
            runSvgValidations(
                parse(
                    `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"${root}><title>X</title>${body}</svg>`,
                ),
                'icon',
            ).find((check) => check.label === 'Fill placement').pass
        const gradient = '<path fill="url(#a)" d="M1 1"/>'
        assert.equal(
            fill('', `${gradient}<path fill="#111111" d="M2 2"/>`),
            true,
        )
        assert.equal(fill(' fill="currentColor"', gradient + gradient), true)
        assert.equal(
            fill(' fill="#111111"', `${gradient}<path d="M2 2"/>`),
            false,
        )
    })

    it('lets an older mark keep a former name as its title', () => {
        const titleOf = (title, formerNames) => {
            const svgElement = parse(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${title}</title><path d="M0 0h64v64H0z"/></svg>`,
            )
            const issues = []
            ruleTitle({
                svgElement,
                document: svgElement.ownerDocument,
                airlineName: 'Trinity Airways',
                isCatalogName: true,
                formerNames,
                issues,
            })

            return [
                svgElement.querySelector('title').textContent,
                issues.length,
            ]
        }
        // In history/, a previous name stays
        assert.deepEqual(
            titleOf("T'way Air", ['Hansung Airlines', "T'way Air"]),
            ["T'way Air", 0],
        )
        // Anything else, or a current mark, gets the current name
        assert.deepEqual(titleOf('Tway', ["T'way Air"]), ['Trinity Airways', 1])
        assert.deepEqual(titleOf("T'way Air", []), ['Trinity Airways', 1])
    })

    it('writes <title> without an empty xmlns', () => {
        for (const title of ['', '<title xmlns="">Old Name</title>']) {
            const svg = parse(
                `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${title}<path d="M1 1"/></svg>`,
            )
            const issues = []
            ruleTitle({
                svgElement: svg,
                document: svg.ownerDocument,
                airlineName: 'Korean Air',
                isCatalogName: true,
                issues,
            })
            assert.ok(issues.length > 0, title)
            assert.match(
                svg.outerHTML,
                /<svg [^>]*><title>Korean Air<\/title><path/,
            )
        }
    })

    it('moves the root fill onto the shapes that use it', () => {
        const svg = parse(
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#111111"><title>X</title><path fill="url(#a)" d="M1 1"/><path d="M2 2"/></svg>',
        )
        const issues = []
        ruleFillPlacement({ isMono: false, svgElement: svg, issues })
        assert.equal(issues.length, 1)
        assert.equal(svg.getAttribute('fill'), null)
        assert.deepEqual(
            [...svg.querySelectorAll('path')].map((p) =>
                p.getAttribute('fill'),
            ),
            ['url(#a)', '#111111'],
        )
    })

    const fixStructure = (body, { mergePaths = true } = {}) => {
        const svg = parse(
            `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#111111"><title>X</title>${body}</svg>`,
        )
        const ctx = { svgElement: svg, mergePaths, issues: [], warnings: [] }
        ruleNoNestedGroups(ctx)
        ruleOnePathPerColor(ctx)

        return { ...ctx, paths: [...svg.querySelectorAll('path')] }
    }

    it('flattens nested groups and merges single-color paths', () => {
        const { issues, warnings, paths } = fixStructure(
            '<g fill-rule="evenodd"><g fill="#111111"><path d="m2 2h8v8h-8z"/></g><path d="m12 12 8 0 0 8-8 0z"/></g>',
        )
        assert.equal(issues.length, 2)
        assert.deepEqual(warnings, [])
        assert.equal(paths.length, 1)
        // The second path's relative moveto and implicit lineto survive
        assert.equal(
            paths[0].getAttribute('d'),
            'm2 2h8v8h-8zM12 12l8 0 0 8-8 0z',
        )
    })

    it('merges paths only with --merge-paths', () => {
        const { issues, warnings, paths } = fixStructure(
            '<path d="M2 2h8v8H2z"/><path d="M12 12h8v8h-8z"/>',
            { mergePaths: false },
        )
        // Still a warning, so --check passes, with a hint at the flag
        assert.deepEqual(issues, [])
        assert.equal(warnings.length, 1)
        assert.match(warnings[0], /--merge-paths/)
        assert.equal(paths.length, 2)
    })

    it('merges runs of one color in a multi-color svg', () => {
        const { issues, warnings, paths } = fixStructure(
            '<path fill="#ff0000" d="M2 2h4v4H2z"/><path fill="#ff0000" d="M8 2h4v4H8z"/><path fill="#0000ff" d="M2 8h4v4H2z"/><path fill="#0000ff" d="M8 8h4v4H8z"/>',
        )
        assert.equal(issues.length, 1)
        assert.deepEqual(warnings, [])
        assert.deepEqual(
            paths.map((p) => [p.getAttribute('fill'), p.getAttribute('d')]),
            [
                ['#ff0000', 'M2 2h4v4H2zM8 2h4v4H8z'],
                ['#0000ff', 'M2 8h4v4H2zM8 8h4v4H8z'],
            ],
        )
    })

    it('keeps apart shapes of one color with another color between them', () => {
        // Merging the two red squares would draw one of them under the blue
        const { issues, warnings, paths } = fixStructure(
            '<path fill="#ff0000" d="M2 2h4v4H2z"/><path fill="#0000ff" d="M4 4h4v4H4z"/><path fill="#ff0000" d="M6 6h4v4H6z"/>',
        )
        assert.deepEqual(issues, [])
        assert.deepEqual(warnings, [])
        assert.equal(paths.length, 3)
    })

    it('merges a shape that inherits the color it sets on another', () => {
        // The root fill is #111111, so both squares draw in it
        const { issues, paths } = fixStructure(
            '<path d="M2 2h4v4H2z"/><path fill="#111111" d="M8 8h4v4H8z"/><path fill="#ff0000" d="M14 14h4v4h-4z"/>',
        )
        assert.equal(issues.length, 1)
        assert.equal(paths.length, 2)
        assert.equal(paths[1].getAttribute('fill'), '#ff0000')
    })

    it('leaves paths whose merge would leave a hole', () => {
        // Opposite winding: as one path the inner square is cut out
        const { issues, warnings, paths } = fixStructure(
            '<path d="M2 2h16v16H2z"/><path d="M6 6v8h8V6z"/>',
        )
        assert.deepEqual(issues, [])
        assert.equal(warnings.length, 1)
        assert.equal(paths.length, 2)
    })

    it('runs SVGO on what only SVGO fixes, keeping the rendering', () => {
        const optimizeLint = (source) => {
            const ctx = { issues: [], warnings: [] }
            const content = ruleOptimize(source, parse(source), ctx)

            return { content, ...ctx }
        }
        const clean =
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#ff0000"><title>X</title><path d="M0 0h24v24H0z"/></svg>'
        assert.equal(optimizeLint(clean).content, clean)

        const { content, issues, warnings } = optimizeLint(
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>X</title><metadata>x</metadata><style>.a{fill:red}</style><g transform="translate(0 2)"><path class="a" d="M0 0h24.1234567v20H-0z"/></g></svg>',
        )
        assert.equal(issues.length, 1)
        assert.deepEqual(warnings, [])
        assert.doesNotMatch(content, /metadata|style|transform|\.1234567|-0/)
    })

    it('optimizes at three decimals unless the shapes would move', () => {
        const optimizeAsset = (file) =>
            optimizeSvg(
                readFileSync(
                    new URL(`../assets/${file}`, import.meta.url),
                    'utf8',
                ),
            )
        const vietnam = optimizeAsset('vietnam-airlines/logo.svg')
        assert.equal(vietnam.precision, 3)
        assert.ok(vietnam.alike)
        assert.doesNotMatch(vietnam.data, /\.\d{4}/)

        // Small circles drawn as arcs shift at three decimals
        const brussels = optimizeAsset('brussels-airlines/icon.svg')
        assert.ok(brussels.precision > 3, `${brussels.precision} decimals`)
        assert.ok(brussels.alike)
    })

    it('keeps the artwork on the edges of the viewBox it filled', () => {
        const read = (file) =>
            readFileSync(new URL(`../assets/${file}`, import.meta.url), 'utf8')
        const edges = (svg) => {
            const { x, y, width, height } = measureBBox(svg)

            return [x, y, x + width, y + height]
        }
        // Rounding the original at three decimals moves an edge off the
        // viewBox (Saudia) or by 0.019 (Philippine Airlines)
        for (const file of [
            'saudia/icon.svg',
            'philippine-airlines/logo.svg',
            'bamboo-airways/logo.svg',
            // Fills 64 at three decimals (-0.0002 to 64.0002), not 63.998
            'virgin-australia/logo-mono.svg',
        ]) {
            const source = read(file)
            const result = optimizeSvg(source)
            assert.ok(result.alike, file)
            const size = file.includes('/logo') ? 64 : 24
            const before = edges(source)
            edges(result.data).forEach((edge, i) => {
                const viewBox = i < 2 ? 0 : size
                if (Math.abs(before[i] - viewBox) < 0.0005) {
                    assert.ok(
                        Math.abs(edge - viewBox) < 0.0005,
                        `${file}: edge ${i} left the viewBox (${edge})`,
                    )
                }
                assert.ok(
                    Math.abs(edge - before[i]) < 0.01,
                    `${file}: edge ${i} moved from ${before[i]} to ${edge}`,
                )
            })
            // Optimizing the result again changes nothing
            assert.equal(optimizeSvg(result.data).data, result.data, file)
        }
    })

    it('keeps black in a multi-color svg, however it is written', () => {
        const svg = (black, extra = '') =>
            `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>X</title>${extra}<path fill="#ff0000" d="M0 0h10v10H0z"/><path ${black} d="M12 12h10v10H12z"/></svg>`
        for (const [black, extra] of [
            ['fill="#000"'],
            ['fill="black"'],
            ['style="fill:#000000"'],
            ['style="fill:black"'],
            ['class="k"', '<style>.k{fill:#000}</style>'],
        ]) {
            const out = optimize(svg(black, extra), svgoConfig).data
            assert.match(
                out,
                /<path fill="#000000" d="M12 12h10v10H12z"\/>/,
                black,
            )
        }
    })

    it('expects currentColor in a -mono.svg', async () => {
        const { runSvgValidations } = await import('../dist/svg-validator.js')
        const svg = parse(
            '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#111111"><title>X</title><path d="M1 1"/></svg>',
        )
        const fill = (fileName) =>
            runSvgValidations(svg, 'icon', null, { fileName }).find(
                (check) => check.label === 'Fill placement',
            ).pass
        assert.equal(fill('icon.svg'), true)
        assert.equal(fill('icon-mono.svg'), false)
    })
})

describe('svg-fixer', () => {
    // The browser build runs here on jsdom's DOMParser and resvg-wasm, and
    // must fix a file exactly as lint-svg.js does with jsdom and resvg-js
    const { window } = new JSDOM('')
    const parse = (source) =>
        new window.DOMParser().parseFromString(source, 'image/svg+xml')
    let browser
    let cli
    let validate

    before(async () => {
        globalThis.DOMParser = window.DOMParser
        browser = await import('../dist/svg-fixer.js')
        cli = await import('./lint/fix.js')
        ;({ runSvgValidations: validate } =
            await import('../dist/svg-validator.js'))
        await browser.initSvgFixer(
            readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
        )
    })
    after(() => {
        delete globalThis.DOMParser
    })

    const both = (source, options) => [
        browser.fixSvg(source, options),
        cli.fixSvg(source, { ...options, parse }),
    ]

    const NS = 'xmlns="http://www.w3.org/2000/svg"'
    const BROKEN = [
        [
            'a prolog, width and height, no title, editor data, rgb()',
            `<?xml version="1.0"?><svg ${NS} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="24" height="24" viewBox="0 0 24 24" inkscape:version="1.3"><path fill="rgb(255,0,0)" d="M0 0h24v24H0z"/></svg>`,
            { type: 'icon', airlineName: 'Test Air' },
        ],
        [
            'a <style> and a transform',
            `<svg role="img" viewBox="0 0 64 64" ${NS}><title>Test Air</title><style>.a{fill:#123456}</style><g transform="translate(0 2)"><path class="a" d="M0 0h64v60H0z"/></g></svg>`,
            { type: 'logo' },
        ],
        [
            'a <style> class shared by several paths, as design tools export',
            `<svg viewBox="0 0 64 64" ${NS}><title>Test Air</title><style>.cls-1{fill:rgb(195,11,18)}</style><g transform="translate(0 2)"><path class="cls-1" d="M0 0h32v60H0z"/><path class="cls-1" d="M32 0h32v60H32z"/></g></svg>`,
            { type: 'logo' },
        ],
        [
            'nested groups, long decimals and paths to merge',
            `<svg role="img" viewBox="0 0 24 24" ${NS}><title>Test Air</title><g fill="#ff0000"><g><path d="M0 0h12.123456v24H0z"/><path d="M12.123456 0H24v24H12.123456z"/></g></g></svg>`,
            { type: 'icon', mergePaths: true },
        ],
        [
            'a title out of place, with another name',
            `<svg role="img" viewBox="0 0 24 24" ${NS} fill="#123456"><path d="M0 0h24v24H0z"/><title>Old Name</title></svg>`,
            { type: 'icon', airlineName: 'Test Air', isCatalogName: true },
        ],
        [
            'a color file in currentColor, given its color',
            `<svg role="img" viewBox="0 0 64 64" ${NS} fill="currentColor"><title>Test Air</title><path fill="currentColor" d="M0 0h32v64H0z"/><path d="M32 0h32v64H32z"/></svg>`,
            { type: 'logo', fileName: 'logo.svg', fillColor: '#C30B12' },
        ],
        [
            'a -mono.svg in currentcolor, spelled in lowercase',
            `<svg role="img" viewBox="0 0 24 24" ${NS} fill="currentcolor"><title>Test Air</title><path d="M0 0h24v24H0z"/></svg>`,
            { type: 'icon', fileName: 'icon-mono.svg' },
        ],
        [
            'a root fill in uppercase hex',
            `<svg role="img" viewBox="0 0 24 24" ${NS} fill="#C30B12"><title>Test Air</title><path d="M0 0h24v24H0z"/></svg>`,
            { type: 'icon', fileName: 'icon.svg' },
        ],
        [
            'a -mono.svg with its own color',
            `<svg role="img" viewBox="0 0 24 24" ${NS}><title>Test Air</title><path fill="#000000" d="M0 0h24v24H0z"/></svg>`,
            { type: 'icon', fileName: 'icon-mono.svg' },
        ],
    ]

    for (const [name, source, options] of BROKEN) {
        it(`fixes ${name} as lint-svg.js --fix does`, () => {
            const [fromBrowser, fromCli] = both(source, options)
            assert.equal(fromBrowser.fixed, true)
            assert.deepEqual(fromBrowser, fromCli)
            // What --fix leaves is clean, to the fixer and to the validator
            const again = browser.fixSvg(fromBrowser.content, options)
            assert.equal(again.fixed, false, again.issues.join('; '))
            const failing = validate(
                parse(fromBrowser.content).documentElement,
                options.type,
                null,
                {
                    fileName: options.fileName ?? '',
                    source: fromBrowser.content,
                },
            ).filter(
                (check) =>
                    check.level === 'error' &&
                    !check.pass &&
                    check.group !== 'Geometry',
            )
            assert.deepEqual(failing, [])
        })
    }

    it('reports a color file drawn in currentColor, which it cannot fix', () => {
        const source = `<svg role="img" viewBox="0 0 64 64" ${NS} fill="currentColor"><title>Test Air</title><path d="M0 0h64v64H0z"/></svg>`
        const [fromBrowser, fromCli] = both(source, {
            type: 'logo',
            fileName: 'logo.svg',
        })
        assert.deepEqual(fromBrowser, fromCli)
        assert.equal(fromBrowser.fixed, false)
        assert.match(fromBrowser.issues.join(), /needs its own hex color/)
        const fill = (fileName) =>
            validate(parse(source).documentElement, 'logo', null, {
                fileName,
                source,
            }).find((check) => check.label === 'Fill placement')
        assert.equal(fill('logo.svg').pass, false)
        assert.match(fill('logo.svg').detail, /no color of its own/)
        // The same drawing is right as the monochrome version, told by its
        // name or by the mono option, and the check says it has no color
        assert.equal(fill('logo-mono.svg').pass, true)
        assert.equal(fill('logo.svg').fixable, 'fillColor')
        const asMono = validate(parse(source).documentElement, 'logo', null, {
            fileName: 'logo.svg',
            mono: true,
            source,
        }).find((check) => check.label === 'Fill placement')
        assert.equal(asMono.pass, true)
        assert.equal(
            browser.fixSvg(source, { fileName: 'logo.svg', mono: true })
                .errorCount,
            0,
        )
    })

    it('fixes every failing check it marks fixable', () => {
        const checks = (svgText, options) =>
            validate(parse(svgText).documentElement, options.type, null, {
                fileName: options.fileName ?? '',
                source: svgText,
            })
        for (const [name, source, options] of BROKEN) {
            const given = (fixable) =>
                fixable === true || options[fixable] !== undefined
            const expected = checks(source, options)
                .filter((check) => !check.pass && given(check.fixable))
                .map((check) => check.label)
            const after = checks(
                browser.fixSvg(source, options).content,
                options,
            )
            const left = after
                .filter(
                    (check) => expected.includes(check.label) && !check.pass,
                )
                .map((check) => check.label)
            assert.deepEqual(left, [], name)
        }
        // Geometry is never fixed: measured on a box that misses the edges
        const geometry = validate(
            parse(
                `<svg role="img" viewBox="0 0 24 24" ${NS}><title>X</title></svg>`,
            ).documentElement,
            'icon',
            { x: 2, y: 2, width: 4, height: 4 },
        ).filter((check) => check.group === 'Geometry')
        assert.ok(geometry.some((check) => !check.pass))
        assert.ok(geometry.every((check) => check.fixable === false))
    })

    it('leaves every asset as lint-svg.js does', () => {
        const assetsDir = fileURLToPath(new URL('../assets', import.meta.url))
        const differences = []
        const dirs = readdirSync(assetsDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
        for (const dir of dirs) {
            for (const folder of getAssetDirs(dir, assetsDir)) {
                for (const file of readdirSync(`${assetsDir}/${folder}`)) {
                    if (!file.endsWith('.svg')) continue
                    const path = `assets/${folder}/${file}`
                    if (EXCLUDE_FILES.includes(path)) continue
                    const source = readFileSync(
                        `${assetsDir}/${folder}/${file}`,
                        'utf8',
                    )
                    const [fromBrowser, fromCli] = both(source, {
                        fileName: file,
                        type: /icon|tail/.test(file) ? 'icon' : 'logo',
                    })
                    try {
                        assert.deepEqual(fromBrowser, fromCli)
                    } catch {
                        differences.push(path)
                    }
                }
            }
        }
        assert.deepEqual(differences, [])
    })
})
