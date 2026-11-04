import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import slugify from 'slugify'

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
                color.toLowerCase(),
            ),
        ),
    ]
}

const assetTypes = ['icon', 'logo', 'tail']

// Describe which files exist for each asset type of an airline:
// { logo: { color: true, mono: false, colors: ['#d99e09'] }, ... }
// `colors` comes from the color file and is empty when there is none.
// Repo tooling only: the published library reads this from airlines.json.
const getAirlineAssets = (slug, assetsDir = 'assets') => {
    const airlineDir = join(assetsDir, slug)

    const assets = {}
    assetTypes.forEach((assetType) => {
        const colorPath = join(airlineDir, `${assetType}.svg`)
        const color = existsSync(colorPath)
        const mono = existsSync(join(airlineDir, `${assetType}-mono.svg`))

        if (!color && !mono) return

        assets[assetType] = {
            color,
            mono,
            colors: color ? extractColorsFromSvg(colorPath) : [],
        }
    })

    return assets
}

export { assetTypes, toSlug, getAirlineAssets }
