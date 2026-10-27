import { createRequire } from 'module'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { join } from 'path'
const require = createRequire(import.meta.url)
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// Use require for airlines.json import issues
const {
    listAirlines,
    getAirline,
    getAssets,
    getAssetContent,
} = require('../dist/index.cjs')
const assert = require('assert')
const { JSDOM } = require('jsdom')

// Run from outside the repo, like a consumer would, so cwd-relative paths fail
process.chdir(tmpdir())

async function run() {
    // Basic sanity checks
    const airlines = listAirlines()
    assert(Array.isArray(airlines), 'listAirlines should return an array')
    assert(airlines.length > 0, 'airlines should not be empty')

    // Asset paths must resolve regardless of the cwd
    const vna = getAssets('VN')
    assert(vna?.logo?.color, 'getAssets should find Vietnam Airlines logo')
    assert(
        getAssetContent('VN')?.logo?.color?.includes('<svg'),
        'getAssetContent should read Vietnam Airlines logo',
    )

    // Pick the first airline and verify lookups
    const sample = airlines[0]
    assert(
        sample && (sample.name || sample.slug),
        'sample airline has a name or slug',
    )

    const bySlug = getAirline(sample.slug)
    assert(
        bySlug && bySlug.name === sample.name,
        'getAirline should find by slug',
    )

    const byName = getAirline(sample.name)
    assert(
        byName && byName.name === sample.name,
        'getAirline should find by name',
    )

    // getAssets may return null (if no assets) or an object
    const assets = getAssets(sample.slug)
    assert(
        assets === null || typeof assets === 'object',
        'getAssets returns null or an object',
    )

    // Test getAssetContent if assets are available
    if (assets) {
        const content = getAssetContent(sample.slug)
        assert(
            content !== null,
            'getAssetContent should return content when assets exist',
        )

        // Verify that SVG content is returned for at least one variant
        const hasContent = Object.values(content).some(
            (variant) =>
                variant.color?.includes('<svg') ||
                variant.monochrome?.includes('<svg'),
        )
        assert(hasContent, 'at least one variant should have SVG content')
    }

    // The bundled validator must be self-contained in both module formats
    const {
        runSvgValidations: validateCJS,
    } = require('../dist/svg-validator.cjs')
    const { runSvgValidations: validateESM } =
        await import('../dist/svg-validator.js')
    const svg = new JSDOM(
        readFileSync(
            require.resolve('../dist/assets/vietnam-airlines/logo.svg'),
        ),
        { contentType: 'image/svg+xml' },
    ).window.document.querySelector('svg')
    for (const validate of [validateCJS, validateESM]) {
        assert(
            validate(svg, 'logo').some((check) => check.pass),
            'runSvgValidations should validate a logo',
        )
    }

    assertSwiftPackage()

    console.log('All tests passed')
}

function assertSwiftPackage() {
    const catalog = readFileSync(
        join(repoRoot, 'swift/Sources/SoaringSymbols/Generated/Catalog.swift'),
        'utf8',
    )
    const airlines = require(join(repoRoot, 'airlines.json'))
    assert(
        catalog.includes('public extension SoaringAirline'),
        'Swift catalog should extend SoaringAirline',
    )
    assert(
        !catalog.includes('public extension Airline {'),
        'Swift catalog should not export a bare Airline type',
    )
    assert(
        catalog.includes('static let vietnamAirlines'),
        'Swift catalog should include Vietnam Airlines',
    )

    for (const airline of airlines) {
        assert(
            catalog.includes(`iata: "${airline.iata}"`),
            `catalog missing ${airline.iata}`,
        )
    }

    const manifest = JSON.parse(
        readFileSync(join(repoRoot, 'swift/png-manifest.json'), 'utf8'),
    )
    assert.equal(manifest.pixelSize, 512)

    const pngRoot = join(repoRoot, 'swift/Sources/SoaringSymbols/Resources/png')
    const kinds = ['icon', 'logo', 'tail']
    for (const airline of airlines) {
        for (const kind of kinds) {
            for (const mono of [false, true]) {
                const base = mono ? `${kind}-mono` : kind
                const svgPath = join(
                    repoRoot,
                    'assets',
                    airline.slug,
                    `${base}.svg`,
                )
                if (!existsSync(svgPath)) continue

                const pngPath = join(pngRoot, airline.slug, `${base}.png`)
                const png = readFileSync(pngPath)
                assert.equal(png[0], 0x89, pngPath)
                assert.equal(png.readUInt32BE(16), manifest.pixelSize, pngPath)
                assert.equal(png.readUInt32BE(20), manifest.pixelSize, pngPath)
                assert.ok(
                    [2, 3, 4, 6].includes(png[25]),
                    `${pngPath} color type ${png[25]}`,
                )
                if (airline.slug === 'vietnam-airlines' && base === 'logo') {
                    assert.equal(png[25], 6, pngPath)
                }
                assert.equal(
                    manifest.files[`${airline.slug}/${base}.png`]?.length,
                    64,
                    pngPath,
                )
            }
        }
    }

    const orphan = []
    for (const slug of readdirSync(pngRoot)) {
        for (const file of readdirSync(join(pngRoot, slug))) {
            const key = `${slug}/${file}`
            if (!manifest.files[key]) orphan.push(key)
        }
    }
    assert.deepEqual(orphan, [])
}

run().catch((err) => {
    console.error('Test failed:')
    console.error(err && err.stack ? err.stack : err)
    process.exit(1)
})
