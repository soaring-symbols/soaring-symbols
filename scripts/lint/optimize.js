// Optimize one SVG with the project's SVGO config (svgo.config.mjs) at the
// lowest number precision that still draws the original: it must render
// alike and keep the artwork on the viewBox. Three decimals, SVGOMG's
// default, keeps files smallest and is enough for most logos. Some shapes
// move at three, either visibly (small circles drawn as arcs) or by the few
// thousandths that rounding errors add up to, enough to take the artwork
// off an edge of the viewBox it filled (63.999 instead of 64), so those get
// four or five. Shared by `npm run optimize`, `lint-svg.js --fix`
// (rule-optimize.js) and `npm run optimize:check`.
import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { measureBBox, rendersAlike } from './render.js'
import { validateGeometry } from './validators.js'

// Tried in order; the last one is used even when it doesn't draw alike, so
// callers can tell the result from the original with `alike`
export const PRECISIONS = [3, 4, 5]

// A measurement this close to the viewBox's reads as equal to it at three
// decimals (64.000), as the validator page shows it
const ON_VIEWBOX = 0.0005

// What a file's geometry looks like, to compare before and after: which of
// the artwork's edges ([left, top, right, bottom]) and sides (width, height)
// match the viewBox's, and which geometry checks fail, as lint-svg.js would
// report them. Both are measured against the viewBox, never against the
// file being optimized, so optimizing a result again gives the same answer
// and `optimize:check` agrees with `npm run optimize`.
const geometryOf = (svg) => {
    const box = measureBBox(svg)
    if (!box) return ''
    const [x, y, width, height] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    const measured = [
        box.x,
        box.y,
        box.x + box.width,
        box.y + box.height,
        box.width,
        box.height,
    ]
    const viewBox = [x, y, x + width, y + height, width, height]
    const matches = measured.map((value, i) =>
        Math.abs(value - viewBox[i]) < ON_VIEWBOX ? 1 : 0,
    )
    const failing = validateGeometry(width === 64 ? 'logo' : 'icon', box)
        .filter((check) => !check.pass)
        .map((check) => check.label)

    return `${matches.join('')} ${failing.join()}`
}

// Returns { data, precision, alike }. `data` is the optimized markup,
// `precision` the floatPrecision it was written with, and `alike` whether it
// renders like `source` with the artwork on the same viewBox edges and the
// same geometry checks passing.
export function optimizeSvg(source, path) {
    const geometry = geometryOf(source)
    const keeps = (data) =>
        rendersAlike(source, data) && geometryOf(data) === geometry
    const run = (svg, precision) =>
        optimize(svg, { ...svgoConfig, floatPrecision: precision, path }).data

    let result
    for (const precision of PRECISIONS) {
        const data = run(source, precision)
        if (!keeps(data)) {
            result = { data, precision, alike: false }
            continue
        }
        // Rounding the result again at fewer decimals can keep the edges
        // where rounding the original couldn't, and is smaller
        for (const lower of PRECISIONS.filter((p) => p < precision)) {
            const again = run(data, lower)
            if (again.length < data.length && keeps(again)) {
                return { data: again, precision: lower, alike: true }
            }
        }

        return { data, precision, alike: true }
    }

    return result
}
