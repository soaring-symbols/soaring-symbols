// Tests for the built package in dist/. Run with `npm test` (builds first).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { getAirlineAssets } from '../utils/index.js'
import { validateAirlines } from '../utils/schema.js'
import { EXCLUDE_FILES } from './lint/exclude.js'
import { BROWSER_CHECKS, DOM_RULES, STRING_RULES } from './lint/rules.js'
import {
    extractInfobox,
    firstYear,
    infoboxParams,
    linkTargets,
    listItems,
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
    const { listAirlines, getAirline, getAssetPath } = api

    describe(`${format} build`, () => {
        it('exports exactly the public API', () => {
            const names = Object.keys(api)
                .filter((key) => key !== 'default' && key !== 'module.exports')
                .sort()
            assert.deepEqual(names, [
                'getAirline',
                'getAssetPath',
                'listAirlines',
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
                    // then finds the active airline that holds it now
                    for (const field of ['iata', 'icao']) {
                        const found = getAirline(a[field])
                        const label = `${a.name} by ${a[field]}`
                        if (found === a) continue
                        assert.ok(a.defunct, label)
                        assert.equal(found[field], a[field], label)
                        assert.ok(!found.defunct, label)
                    }
                }
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

            it('returns undefined for an unknown airline', () => {
                assert.equal(getAssetPath('ZZZZ', 'logo'), undefined)
            })

            it('throws on an unknown asset type', () => {
                assert.throws(() => getAssetPath('VN', 'banner'), TypeError)
            })

            it('returns a resolvable SVG for every listed asset', () => {
                for (const a of listAirlines()) {
                    for (const [type, info] of Object.entries(a.assets)) {
                        for (const mono of [false, true]) {
                            const path = getAssetPath(a, type, { mono })
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

    it('keeps slug and assets out of the repo copy', () => {
        const source = JSON.parse(
            readFileSync(new URL('../airlines.json', import.meta.url)),
        )
        assert.deepEqual(validateAirlines(source), [])
        for (const a of source) {
            assert.equal(a.slug, undefined, a.name)
            assert.equal(a.assets, undefined, a.name)
        }
    })

    it('requires slug and assets in the published catalog', () => {
        const source = JSON.parse(
            readFileSync(new URL('../airlines.json', import.meta.url)),
        )
        assert.notDeepEqual(validateAirlines(source, { published: true }), [])
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

    it('has an airline for every asset directory', () => {
        const slugs = new Set(cjs.listAirlines().map((a) => a.slug))
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

    it('returns nothing for a page without an airline infobox', () => {
        assert.equal(extractInfobox('No infobox here'), '')
        assert.deepEqual(infoboxParams(''), {})
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
