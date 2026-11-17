import {
    copyFileSync,
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

// The names an airline flew under before, oldest first: the items of
// `former` that have one
const formerNames = (airline) =>
    (airline.former ?? []).flatMap(({ name }) => (name ? [name] : []))

// The slugs an airline's former names had, apart from its current one: the
// build keeps each working as an alias
const formerSlugs = (airline) => [
    ...new Set(
        formerNames(airline)
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

// A -mono.svg painted white, for a dark background
const toWhiteSvg = (svg) => svg.replace(/currentColor/g, '#ffffff')

// Marks on dark backgrounds: a color reads on one when it reaches WCAG's 3:1
// for graphics (1.4.11) against this dark gray, close to the dark themes of
// the website, Raycast and Figma
const DARK_BACKGROUND = '#1e1e1e'
const MIN_DARK_CONTRAST = 3

const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255

        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)

    return (hi + 0.05) / (lo + 0.05)
}

const readsOnDark = (color) =>
    contrastRatio(color, DARK_BACKGROUND) >= MIN_DARK_CONTRAST

// Where an asset's <type>-dark.svg comes from, following what airlines' brand
// guidelines do on dark backgrounds: 'dark' for the airline's own version
// drawn by hand; 'color' for the color file when the airline keeps its colors
// there (`keepColor`, from branding.dark_color); 'mono' for the monochrome
// file in white, the usual case; 'color' again for a mark with no monochrome
// file yet whose colors all read on dark; or null when there is none of those
const darkSource = ({ dark, colors, mono, keepColor = false }) => {
    if (dark) return 'dark'
    if (keepColor) return 'color'
    if (mono) return 'mono'

    return colors.length && colors.every(readsOnDark) ? 'color' : null
}

const assetTypes = ['icon', 'logo', 'tail']

// Alliance marks live apart from the airlines' assets/, in
// alliances/<slug>/, with the same file names and history/ folders; an
// alliance has no tail (index.js keeps its own copy of both type lists)
const ASSETS_DIR = 'assets'
const ALLIANCES_DIR = 'alliances'
const ALLIANCE_TYPES = ['icon', 'logo']
// Every folder of marks, for the tools that walk them all
const MARK_DIRS = [ASSETS_DIR, ALLIANCES_DIR]

// <type>.svg, <type>-mono.svg or <type>-dark.svg for one of the types, and
// the types as prose: "icon, logo or tail"
const markFile = (types) =>
    new RegExp(`^(${types.join('|')})(-mono|-dark)?\\.svg$`)
const VARIANTS = '.svg, -mono.svg or -dark.svg'
const typeList = (types) =>
    `${types.slice(0, -1).join(', ')} or ${types.at(-1)}`

// What is wrong with the files of alliances/<slug>/ itself (history/ is
// checked by findHistoryProblems): anything but icon and logo
const findAllianceFileProblems = (slug, assetsDir = ALLIANCES_DIR) => {
    const dir = join(assetsDir, slug)
    const file = markFile(ALLIANCE_TYPES)

    return readdirSync(dir, { withFileTypes: true })
        .filter((d) => !d.name.startsWith('.') && d.name !== HISTORY_DIR)
        .filter((d) => !d.isFile() || !file.test(d.name))
        .map(
            (d) =>
                `${dir}/${d.name} is not ${typeList(ALLIANCE_TYPES)} (${VARIANTS})`,
        )
}

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

// Write <type>-dark.svg, for dark backgrounds, for every asset without a
// hand-made one: the monochrome file in white, or the color file for the
// types in `keepColor` (branding.dark_color) and for marks with no monochrome
// file that read on dark (darkSource). Runs on dist after writeDerivedMonos,
// so the derived monos are there to paint; the repo keeps no copies.
const writeDerivedDarks = (slug, assetsDir, keepColor = []) => {
    for (const assetType of assetTypes) {
        const path = (suffix) =>
            join(assetsDir, slug, `${assetType}${suffix}.svg`)
        if (existsSync(path('-dark'))) continue
        const color = existsSync(path(''))
        const source = darkSource({
            dark: false,
            colors: color ? extractColorsFromSvg(path('')) : [],
            mono: existsSync(path('-mono')),
            keepColor: keepColor.includes(assetType),
        })
        if (source === 'color') {
            copyFileSync(path(''), path('-dark'))
        } else if (source === 'mono') {
            const mono = readFileSync(path('-mono'), 'utf8')
            writeFileSync(path('-dark'), toWhiteSvg(mono))
        }
    }
}

// Describe which files an airline publishes for each asset type:
// { logo: { color: true, mono: false, dark: true, colors: ['#d99e09'] } }
// `colors` comes from the color file and is empty when there is none. A
// single-color asset always has `mono`, since the build derives that file,
// and `dark` is true whenever the build ships a -dark.svg (darkSource, with
// `keepColor` the types of branding.dark_color).
// Repo tooling only: the published library reads this from airlines.json.
const getAirlineAssets = (slug, assetsDir = 'assets', keepColor = []) => {
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

        const dark =
            darkSource({
                dark: existsSync(join(airlineDir, `${assetType}-dark.svg`)),
                colors,
                mono,
                keepColor: keepColor.includes(assetType),
            }) !== null

        assets[assetType] = { color, mono, dark, colors }
    })

    return assets
}

const viewBoxOf = (svg) => svg.match(/viewBox="([^"]*)"/)?.[1]

// What is wrong with the hand-made <type>-dark.svg files in an airline's or
// alliance's folder (one of getAssetDirs): one without its color file, with
// another viewBox, a copy of the color file, one color only, which is a
// monochrome version, or a type branding.dark_color (`keepColor`) keeps in
// color. `warnings` lists colors that hardly read on dark.
const findDarkProblems = (dir, assetsDir = 'assets', keepColor = []) => {
    const problems = []
    const warnings = []
    for (const assetType of assetTypes) {
        const path = (suffix) =>
            join(assetsDir, dir, `${assetType}${suffix}.svg`)
        const where = path('-dark')
        if (!existsSync(where)) continue
        if (keepColor.includes(assetType)) {
            problems.push(
                `${where} is there, but branding.dark_color keeps the ${assetType} in color; keep one`,
            )
        }
        if (!existsSync(path(''))) {
            problems.push(`${where} has no ${assetType}.svg beside it`)
            continue
        }
        const dark = readFileSync(where, 'utf8')
        const color = readFileSync(path(''), 'utf8')
        const colors = extractColorsFromSvg(where)
        if (viewBoxOf(dark) !== viewBoxOf(color)) {
            problems.push(
                `${where} has viewBox "${viewBoxOf(dark)}", ${assetType}.svg "${viewBoxOf(color)}"`,
            )
        }
        if (dark === color) {
            problems.push(
                `${where} is the same as ${assetType}.svg; leave it out, the build adds it when the colors read on dark`,
            )
        } else if (colors.length < 2) {
            problems.push(
                `${where} has one color: draw it as ${assetType}-mono.svg in currentColor, the build makes the white -dark.svg from it`,
            )
        }
        const faint = colors.filter((c) => !readsOnDark(c))
        if (faint.length) {
            warnings.push(
                `${where}: ${faint.join(', ')} under ${MIN_DARK_CONTRAST}:1 on ${DARK_BACKGROUND}; check it against the airline's own version`,
            )
        }
    }

    return { problems, warnings }
}

// Older marks live in assets/<slug>/history/<year>/, one folder per year a
// mark was introduced, with the same file names as the current ones. The
// current files stay in assets/<slug>/, so nothing that links them changes.
const HISTORY_DIR = 'history'

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

    // The reverse of escapeXml in scripts/build.js
    return title?.[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
}

// What is wrong with an airline's history folders, as readable messages:
// a folder that isn't a year up to this one, a file other than the asset
// files, an empty folder, or a history/ folder holding files itself.
// `types` are the marks the folder may hold: an alliance's have no tail.
const findHistoryProblems = (
    slug,
    assetsDir = 'assets',
    types = assetTypes,
) => {
    const historyDir = join(assetsDir, slug, HISTORY_DIR)
    if (!existsSync(historyDir)) return []
    const thisYear = new Date().getFullYear()
    const file = markFile(types)
    const colorFile = new RegExp(`^(${types.join('|')})\\.svg$`)

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
                .filter((f) => !file.test(f))
                .map(
                    (f) =>
                        `${where}/${f} is not ${typeList(types)} (${VARIANTS})`,
                )
            const hasColor = files.some((f) => colorFile.test(f))

            return hasColor
                ? wrong
                : [
                      ...wrong,
                      `${where}/ has no ${typeList(types.map((t) => `${t}.svg`))}`,
                  ]
        })
}

export {
    ALLIANCE_TYPES,
    ALLIANCES_DIR,
    ASSETS_DIR,
    MARK_DIRS,
    findAllianceFileProblems,
    HISTORY_DIR,
    getAssetDirs,
    getAirlineHistory,
    findHistoryProblems,
    assetTypes,
    toSlug,
    formerNames,
    formerSlugs,
    toFullHex,
    getAirlineAssets,
    writeDerivedMonos,
    removeDerivedMonos,
    writeDerivedDarks,
    findDarkProblems,
    darkSource,
    contrastRatio,
    DARK_BACKGROUND,
    MIN_DARK_CONTRAST,
}
