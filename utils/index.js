import { readFileSync, existsSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import slugify from 'slugify'
import { toFullHex } from '../scripts/lint/validators.js'

const toSlug = (name) => {
    return slugify(name, {
        lower: true,
        strict: true,
    })
}

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

export {
    assetTypes,
    toSlug,
    toFullHex,
    getAirlineAssets,
    writeDerivedMonos,
    removeDerivedMonos,
}
