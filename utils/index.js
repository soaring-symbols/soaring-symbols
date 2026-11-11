import {
    readFileSync,
    readdirSync,
    existsSync,
    writeFileSync,
    rmSync,
} from 'fs'
import { join } from 'path'
import slugify from 'slugify'
import { toFullHex } from '../scripts/lint/validators.js'

const toSlug = (name) => {
    return slugify(name, {
        lower: true,
        strict: true,
    })
}

// The slugs an airline's former names (`previous_names`) had, apart from its
// current one: the build keeps each working as an alias
const formerSlugs = (airline) => [
    ...new Set(
        (airline.previous_names ?? [])
            .map(toSlug)
            .filter((slug) => slug !== airline.slug),
    ),
]

// Hex colors an SVG paints with: fill, stroke and gradient stops, as
// attributes or inside style, so gradient marks are not mistaken for
// single-color ones
const PAINT_COLOR =
    /(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi

const extractColorsFromSvg = (filePath) => {
    const content = readFileSync(filePath, 'utf8')

    return [
        ...new Set(
            [...content.matchAll(PAINT_COLOR)].map(([, color]) =>
                toFullHex(color),
            ),
        ),
    ]
}

// The monochrome version of a single-color SVG: its one color becomes
// currentColor, the way every hand-made -mono.svg is drawn
const toMonoSvg = (svg) =>
    svg.replace(PAINT_COLOR, (match, color) =>
        match.replace(color, 'currentColor'),
    )

const assetTypes = ['icon', 'logo', 'tail']

// The <type>.svg / <type>-mono.svg pairs of an airline whose color file is
// single-color: their mono file is derived from it, never drawn by hand
const derivedMonoPairs = (slug, assetsDir) =>
    assetTypes
        .map((assetType) => ({
            colorPath: join(assetsDir, slug, `${assetType}.svg`),
            monoPath: join(assetsDir, slug, `${assetType}-mono.svg`),
        }))
        .filter(
            ({ colorPath }) =>
                existsSync(colorPath) &&
                extractColorsFromSvg(colorPath).length === 1,
        )

// Write <type>-mono.svg next to every single-color <type>.svg, so each such
// asset ships a monochrome file. Multi-color assets keep their hand-made
// -mono.svg. The build runs it on dist/assets; the repo keeps no copies.
const writeDerivedMonos = (slug, assetsDir) => {
    for (const { colorPath, monoPath } of derivedMonoPairs(slug, assetsDir)) {
        writeFileSync(monoPath, toMonoSvg(readFileSync(colorPath, 'utf8')))
    }
}

// Delete -mono.svg files the build derives anyway, so a hand-made one for a
// single-color asset can't drift from its color file. Returns what it removed.
const removeDerivedMonos = (slug, assetsDir = 'assets') =>
    derivedMonoPairs(slug, assetsDir)
        .map(({ monoPath }) => monoPath)
        .filter((monoPath) => {
            if (!existsSync(monoPath)) return false
            rmSync(monoPath)

            return true
        })

// Describe which files an airline publishes for each asset type:
// { logo: { color: true, mono: false, colors: ['#d99e09'] }, ... }
// `colors` comes from the color file and is empty when there is none. A
// single-color asset always has `mono`, since the build derives that file.
// Repo tooling only: the published library reads this from airlines.json.
const getAirlineAssets = (slug, assetsDir = 'assets') => {
    const airlineDir = join(assetsDir, slug)

    const assets = {}
    assetTypes.forEach((assetType) => {
        const colorPath = join(airlineDir, `${assetType}.svg`)
        const color = existsSync(colorPath)
        const colors = color ? extractColorsFromSvg(colorPath) : []
        const mono =
            colors.length === 1 ||
            existsSync(join(airlineDir, `${assetType}-mono.svg`))

        if (!color && !mono) return

        assets[assetType] = { color, mono, colors }
    })

    return assets
}

// Older marks live in assets/<slug>/history/<year>/, one folder per year a
// mark was introduced, with the same file names as the current ones. The
// current files stay in assets/<slug>/, so nothing that links them changes.
const HISTORY_DIR = 'history'
const HISTORY_FILE = /^(icon|logo|tail)(-mono)?\.svg$/

// The asset folders of an airline relative to `assetsDir`: its own, then one
// per history year, oldest first. writeDerivedMonos and removeDerivedMonos run
// on each.
const getHistoryYears = (slug, assetsDir = 'assets') => {
    const historyDir = join(assetsDir, slug, HISTORY_DIR)
    if (!existsSync(historyDir)) return []

    return (
        readdirSync(historyDir, { withFileTypes: true })
            // Anything else is reported by findHistoryProblems
            .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
            .map((d) => d.name)
            .sort()
    )
}

const getAssetDirs = (slug, assetsDir = 'assets') => [
    slug,
    ...getHistoryYears(slug, assetsDir).map((year) =>
        join(slug, HISTORY_DIR, year),
    ),
]

// The marks an airline used before its current ones, oldest first:
// [{ since: 1984, assets: { logo: { color, mono, colors } } }]. Each entry
// was used from `since` until the next one's `since`, the last one until the
// current marks.
const getAirlineHistory = (slug, assetsDir = 'assets') =>
    getHistoryYears(slug, assetsDir).map((year) => ({
        since: Number(year),
        name: getMarkName(join(assetsDir, slug, HISTORY_DIR, year)),
        assets: getAirlineAssets(join(slug, HISTORY_DIR, year), assetsDir),
    }))

// The airline name on a set of marks: the <title> of its first SVG, which
// for an older mark may be a name the airline flew under before
const getMarkName = (dir) => {
    const file = readdirSync(dir)
        .filter((f) => f.endsWith('.svg'))
        .sort()[0]
    const title = file
        ? readFileSync(join(dir, file), 'utf8').match(/<title>([^<]*)<\/title>/)
        : null

    return title?.[1]
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
}

// What is wrong with an airline's history folders, as readable messages:
// a folder that isn't a year up to this one, a file other than the asset
// files, an empty folder, or a history/ folder holding files itself
const findHistoryProblems = (slug, assetsDir = 'assets') => {
    const historyDir = join(assetsDir, slug, HISTORY_DIR)
    if (!existsSync(historyDir)) return []
    const thisYear = new Date().getFullYear()

    return readdirSync(historyDir, { withFileTypes: true })
        .filter((d) => !d.name.startsWith('.'))
        .flatMap((d) => {
            const where = `${historyDir}/${d.name}`
            if (!d.isDirectory()) {
                return [
                    `${where} must be in a year folder, e.g. ${historyDir}/1984/`,
                ]
            }
            const year = Number(d.name)
            if (!/^\d{4}$/.test(d.name) || year < 1900 || year > thisYear) {
                return [
                    `${where}/ must be named after the year the mark was introduced, e.g. 1984`,
                ]
            }
            const files = readdirSync(join(historyDir, d.name)).filter(
                (f) => !f.startsWith('.'),
            )
            const wrong = files
                .filter((f) => !HISTORY_FILE.test(f))
                .map(
                    (f) =>
                        `${where}/${f} is not icon, logo or tail (.svg or -mono.svg)`,
                )
            const hasColor = files.some((f) =>
                /^(icon|logo|tail)\.svg$/.test(f),
            )

            return hasColor
                ? wrong
                : [...wrong, `${where}/ has no icon.svg, logo.svg or tail.svg`]
        })
}

export {
    HISTORY_DIR,
    getAssetDirs,
    getAirlineHistory,
    findHistoryProblems,
    assetTypes,
    toSlug,
    formerSlugs,
    toFullHex,
    getAirlineAssets,
    writeDerivedMonos,
    removeDerivedMonos,
}
