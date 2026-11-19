// Optimize one SVG with the project's SVGO config (svgo.config.mjs) at the
// lowest number precision that still draws the original: it must render
// alike and keep the artwork on the viewBox. Three decimals, SVGOMG's
// default, keeps files smallest and is enough for most logos. Some shapes
// move at three, either visibly (small circles drawn as arcs) or by the few
// thousandths that rounding errors add up to, enough to take the artwork
// off an edge of the viewBox it filled (63.999 instead of 64) or off the
// center it sat on (12.001 instead of 12), so those get four or five. Shared by `npm run optimize` and `lint-svg.js --fix`
// (rule-optimize.js); `npm run optimize:check` uses `optimizeAt` and
// `precisionOf`.
import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { measureBBox, rendersAlike } from './render.js'
import { validateGeometry } from './validators.js'

// Tried in order; the last one is used even when it doesn't draw alike, so
// callers can tell the result from the original with `alike`
export const PRECISIONS = [3, 4, 5]

// The project's SVGO config at one precision
export const optimizeAt = (svg, precision, path) =>
    optimize(svg, { ...svgoConfig, floatPrecision: precision, path }).data

// The precision a file is written with: the most decimals any of its numbers
// has, kept within PRECISIONS
export const precisionOf = (svg) =>
    PRECISIONS.findLast((p) => new RegExp(String.raw`\.\d{${p}}`).test(svg)) ??
    PRECISIONS[0]

// A measurement this close to the viewBox's reads as equal to it at three
// decimals (64.000), as the validator page shows it
const ON_VIEWBOX = 0.0005
// An edge or center this close to the viewBox's is meant to sit on it, as
// a near miss rule-geometry.js only warns about
const EXACT = 0.01

const viewBoxOf = (svg) =>
    (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number)

// How far the artwork's edges ([left, top, right, bottom]) and center
// ([x, y]) are from the viewBox's, or null when nothing renders
const placementOf = (svg) => {
    const box = measureBBox(svg)
    if (!box) return null
    const [x, y, width, height] = viewBoxOf(svg)

    return [
        box.x - x,
        box.y - y,
        box.x + box.width - (x + width),
        box.y + box.height - (y + height),
        box.x + box.width / 2 - (x + width / 2),
        box.y + box.height / 2 - (y + height / 2),
    ]
}

// What a file's geometry looks like, to compare before and after: which of
// the artwork's edges ([left, top, right, bottom]) and sides (width, height)
// match the viewBox's, and which geometry checks fail, as lint-svg.js would
// report them. Both are measured against the viewBox, never against the
// file being optimized, so optimizing a result again gives the same answer.
const geometryOf = (svg) => {
    const box = measureBBox(svg)
    if (!box) return ''
    const [x, y, width, height] = viewBoxOf(svg)
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
// same geometry checks passing. Of the results that are alike, the first
// (fewest decimals) that keeps the artwork as exactly on the edges and
// center it sat on as the source does wins; when none does, the one closest
// to them.
export function optimizeSvg(source, path) {
    const geometry = geometryOf(source)
    const keeps = (data) =>
        rendersAlike(source, data) && geometryOf(data) === geometry
    const run = (svg, precision) => optimizeAt(svg, precision, path)

    // The edges and center the source sits on (within EXACT), and how far
    // a result is from them: the source's own offset, plus what reads as
    // equal at three decimals, is exact enough
    const aimed = (placementOf(source) ?? []).map((d) => Math.abs(d) <= EXACT)
    const missOf = (svg) =>
        Math.max(
            0,
            ...(placementOf(svg) ?? [])
                .filter((_, i) => aimed[i])
                .map(Math.abs),
        )
    const tolerance = missOf(source) + ON_VIEWBOX

    let closest
    let result
    for (const precision of PRECISIONS) {
        const data = run(source, precision)
        if (!keeps(data)) {
            result = { data, precision, alike: false }
            continue
        }
        // Rounding the result again at fewer decimals can keep the edges
        // where rounding the original couldn't, and is smaller
        const candidates = PRECISIONS.filter((p) => p < precision)
            .map((lower) => ({ data: run(data, lower), precision: lower }))
            .filter((again) => again.data.length < data.length)
            .concat({ data, precision })
        for (const candidate of candidates) {
            if (candidate.data !== data && !keeps(candidate.data)) continue
            const miss = missOf(candidate.data)
            if (miss <= tolerance) return { ...candidate, alike: true }
            if (!closest || miss < closest.miss)
                closest = { ...candidate, miss }
        }
    }
    if (closest) {
        return { data: closest.data, precision: closest.precision, alike: true }
    }

    return result
}
