import { createHash } from 'crypto'
import { spawnSync } from 'child_process'
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'fs'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { toSlug, getAirlineAssets } from '../utils/index.js'

const require = createRequire(import.meta.url)
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const swiftRoot = join(root, 'swift/Sources/SoaringSymbols')
const svgOut = join(swiftRoot, 'Resources/svg')
const pngOut = join(swiftRoot, 'Resources/png')
const manifestPath = join(root, 'swift/png-manifest.json')
const catalogPath = join(swiftRoot, 'Generated/Catalog.swift')
const kinds = ['icon', 'logo', 'tail']
const PNG_SIZE = 512

const keywords = new Set([
    'associatedtype',
    'class',
    'deinit',
    'enum',
    'extension',
    'fileprivate',
    'func',
    'import',
    'init',
    'inout',
    'internal',
    'let',
    'open',
    'operator',
    'private',
    'precedencegroup',
    'protocol',
    'public',
    'rethrows',
    'static',
    'struct',
    'subscript',
    'typealias',
    'var',
    'break',
    'case',
    'continue',
    'default',
    'defer',
    'do',
    'else',
    'fallthrough',
    'for',
    'guard',
    'if',
    'in',
    'repeat',
    'return',
    'switch',
    'where',
    'while',
    'as',
    'Any',
    'catch',
    'false',
    'is',
    'nil',
    'rethrows',
    'super',
    'self',
    'Self',
    'throw',
    'throws',
    'true',
    'try',
    'Type',
    'Protocol',
])

const reservedIdents = new Set([
    'all',
    'find',
    'pngData',
    'svg',
    'preparedLogo',
    'uiImage',
    'nsImage',
])

function swiftString(value) {
    return `"${String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"')
        .replaceAll('\r', '\\r')
        .replaceAll('\n', '\\n')}"`
}

function swiftOptional(value) {
    if (value == null || value === '') return 'nil'

    return swiftString(value)
}

function swiftIdent(slug) {
    const parts = slug.split('-').filter(Boolean)
    let ident = parts
        .map((part, index) =>
            index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join('')

    if (!ident || !/^[_A-Za-z]/.test(ident)) ident = `_${ident}`

    return ident
}

function quoteIdent(ident) {
    if (keywords.has(ident)) return `\`${ident}\``

    return ident
}

function assetLiteral(kind, info, slug) {
    const hasColor = existsSync(join(root, 'assets', slug, `${kind}.svg`))
    const hasMono = existsSync(join(root, 'assets', slug, `${kind}-mono.svg`))
    if (!hasColor && !hasMono) return 'nil'

    const model = info?.color_model ? `.${info.color_model}` : 'nil'
    const colors = (info?.colors || [])
        .map((color) => swiftString(color))
        .join(', ')

    return [
        'SoaringAirline.Asset(',
        `kind: .${kind}, `,
        `colorModel: ${model}, `,
        `colors: [${colors}], `,
        `hasColor: ${hasColor ? 'true' : 'false'}, `,
        `hasMonochrome: ${hasMono ? 'true' : 'false'}`,
        ')',
    ].join('')
}

function colorsLiteral(colors) {
    const entries = kinds
        .filter((kind) => Array.isArray(colors?.[kind]) && colors[kind].length)
        .map((kind) => {
            const values = colors[kind]
                .map((color) => swiftString(color))
                .join(', ')

            return `.${kind}: [${values}]`
        })

    if (!entries.length) return '[:]'

    return `[\n${entries.map((entry) => `                ${entry},`).join('\n')}\n            ]`
}

function subsidiaryLiteral(sub) {
    return [
        'SoaringAirline.Subsidiary(',
        `name: ${swiftString(sub.name)}, `,
        `iata: ${swiftString(sub.iata || '')}, `,
        `icao: ${swiftString(sub.icao || '')}, `,
        `country: ${swiftString(sub.country || '')}, `,
        `slug: ${swiftString(toSlug(sub.name))}, `,
        `flagCarrier: ${sub.flag_carrier ? 'true' : 'false'}`,
        ')',
    ].join('')
}

function airlineLiteral(airline, assets) {
    const branding = airline.branding || {}
    const subsidiaries = Array.isArray(airline.subsidiaries)
        ? airline.subsidiaries
        : []

    return `    SoaringAirline(
        name: ${swiftString(airline.name)},
        iata: ${swiftString(airline.iata || '')},
        icao: ${swiftString(airline.icao || '')},
        country: ${swiftString(airline.country || '')},
        flagCarrier: ${airline.flag_carrier ? 'true' : 'false'},
        defunct: ${airline.defunct ? 'true' : 'false'},
        website: ${swiftOptional(airline.website)},
        alliance: ${swiftOptional(airline.alliance)},
        slug: ${swiftString(airline.slug)},
        branding: SoaringAirline.Branding(
            primaryColor: ${swiftOptional(branding.primary_color)},
            tagline: ${swiftOptional(branding.tagline)},
            guidelines: ${swiftOptional(branding.guidelines)},
            colors: ${colorsLiteral(branding.colors)}
        ),
        assets: SoaringAirline.Assets(
            icon: ${assetLiteral('icon', assets.icon, airline.slug)},
            logo: ${assetLiteral('logo', assets.logo, airline.slug)},
            tail: ${assetLiteral('tail', assets.tail, airline.slug)}
        ),
        subsidiaries: [${subsidiaries.map(subsidiaryLiteral).join(', ')}]
    )`
}

function walkFiles(dir, found = []) {
    if (!existsSync(dir)) return found

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walkFiles(path, found)
        else found.push(path)
    }

    return found
}

function sourceHash(label, contents) {
    return createHash('sha256')
        .update(String(PNG_SIZE))
        .update('\0')
        .update(label)
        .update('\0')
        .update(contents)
        .digest('hex')
}

function readManifest() {
    if (!existsSync(manifestPath)) {
        return { pixelSize: PNG_SIZE, files: {} }
    }

    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (parsed.pixelSize !== PNG_SIZE || !parsed.files) {
        return { pixelSize: PNG_SIZE, files: {} }
    }

    return parsed
}

let rsvgChecked = false
let rsvgAvailable = false

function assertRsvg() {
    if (rsvgChecked) {
        if (!rsvgAvailable) {
            throw new Error(
                'rsvg-convert is required to render changed airline PNGs. Install librsvg (apt install librsvg2-bin).',
            )
        }

        return
    }

    rsvgChecked = true
    const result = spawnSync('rsvg-convert', ['--version'], {
        encoding: 'utf8',
    })
    rsvgAvailable = result.status === 0
    if (!rsvgAvailable) {
        throw new Error(
            'rsvg-convert is required to render changed airline PNGs. Install librsvg (apt install librsvg2-bin).',
        )
    }
}

function renderPng(svgContents, pngPath) {
    assertRsvg()
    mkdirSync(dirname(pngPath), { recursive: true })
    const tmp = `${pngPath}.src.svg`
    writeFileSync(tmp, svgContents)
    const result = spawnSync(
        'rsvg-convert',
        ['-w', String(PNG_SIZE), '-h', String(PNG_SIZE), '-o', pngPath, tmp],
        { encoding: 'utf8' },
    )
    rmSync(tmp, { force: true })
    if (result.status !== 0) {
        throw new Error(result.stderr || `rsvg-convert failed for ${pngPath}`)
    }
}

function ensurePng(svgPath, pngPath, label, manifestKey, hashes, previous) {
    const raw = readFileSync(svgPath, 'utf8')
    const contents =
        label === 'mono' ? raw.replaceAll('currentColor', '#000000') : raw
    const hash = sourceHash(label, contents)
    hashes[manifestKey] = hash
    const current = previous.files?.[manifestKey]
    const fresh =
        current === hash && existsSync(pngPath) && statSync(pngPath).size > 8
    if (!fresh) renderPng(contents, pngPath)
}

function syncAssets(airlines) {
    const previous = readManifest()
    const hashes = {}
    const expected = new Set()

    for (const airline of airlines) {
        for (const kind of kinds) {
            for (const mono of [false, true]) {
                const filename = mono ? `${kind}-mono.svg` : `${kind}.svg`
                const svgPath = join(root, 'assets', airline.slug, filename)
                if (!existsSync(svgPath)) continue

                const svgDest = join(svgOut, airline.slug, filename)
                mkdirSync(dirname(svgDest), { recursive: true })
                copyFileSync(svgPath, svgDest)
                expected.add(svgDest)

                const pngName = filename.replace(/\.svg$/, '.png')
                const pngDest = join(pngOut, airline.slug, pngName)
                const key = relative(pngOut, pngDest).split('\\').join('/')
                ensurePng(
                    svgPath,
                    pngDest,
                    mono ? 'mono' : 'color',
                    key,
                    hashes,
                    previous,
                )
                expected.add(pngDest)
            }
        }
    }

    for (const file of walkFiles(svgOut)) {
        if (!expected.has(file)) rmSync(file)
    }
    for (const file of walkFiles(pngOut)) {
        if (!expected.has(file)) rmSync(file)
    }

    const files = {}
    for (const key of Object.keys(hashes).sort()) files[key] = hashes[key]
    writeFileSync(
        manifestPath,
        `${JSON.stringify({ pixelSize: PNG_SIZE, files }, null, 4)}\n`,
    )
}

function generateSwiftPackage() {
    const airlines = require('../airlines.json')
    const rendered = []
    const idents = []
    const used = new Set(reservedIdents)

    for (const airline of airlines) {
        const assets = getAirlineAssets(airline.slug, join(root, 'assets'))
        rendered.push(airlineLiteral(airline, assets))

        let ident = swiftIdent(airline.slug)
        if (reservedIdents.has(ident)) ident = `${ident}Airline`
        let unique = ident
        let suffix = 2
        while (used.has(unique)) {
            unique = `${ident}${suffix}`
            suffix += 1
        }
        used.add(unique)
        idents.push({ ident: quoteIdent(unique), slug: airline.slug })
    }

    syncAssets(airlines)

    const members = idents
        .map(
            (entry) =>
                `    static let ${entry.ident} = AirlineIndex.airline(slug: ${swiftString(entry.slug)})`,
        )
        .join('\n')

    const source = `// Generated by scripts/generate-swift.js. Do not edit by hand.
// airlines: ${airlines.length}

enum AirlineCatalogData {
    static let pngPixelSize = ${PNG_SIZE}

    static let airlines: [SoaringAirline] = [
${rendered.join(',\n')}
    ]
}

public extension SoaringAirline {
${members}
}
`

    mkdirSync(dirname(catalogPath), { recursive: true })
    writeFileSync(catalogPath, source)
    console.log(
        `✅ Swift package: ${airlines.length} airlines, ${Object.keys(JSON.parse(readFileSync(manifestPath, 'utf8')).files).length} PNGs`,
    )
}

const invokedDirectly = process.argv[1]?.endsWith('generate-swift.js')
if (invokedDirectly) generateSwiftPackage()

export { generateSwiftPackage }
