// Tests for the built package in dist/. Run with `npm test` (builds first).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { getAirlineAssets } from '../utils/index.js'

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
            it('ignores case and surrounding whitespace', () => {
                for (const query of ['vn', 'hvn', '  VIETNAM AIRLINES ']) {
                    assert.equal(getAirline(query)?.slug, 'vietnam-airlines')
                }
            })

            it('finds every airline by each of its keys', () => {
                for (const a of listAirlines()) {
                    for (const key of [a.iata, a.icao, a.slug, a.name]) {
                        assert.equal(getAirline(key), a, `${a.name} by ${key}`)
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

describe('svg-validator', () => {
    const svg = new JSDOM(
        readFileSync(
            require.resolve('soaring-symbols/assets/vietnam-airlines/logo.svg'),
        ),
        { contentType: 'image/svg+xml' },
    ).window.document.querySelector('svg')

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
})
