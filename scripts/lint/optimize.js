// Optimize one SVG with the project's SVGO config (svgo.config.mjs) at the
// lowest number precision that still draws the original: it must render
// alike and keep the artwork on the viewBox. Three decimals, SVGOMG's
// default, keeps files smallest and is enough for most logos. Some shapes
// move at three, either visibly (small circles drawn as arcs) or by the few
// thousandths that rounding errors add up to, enough to take the artwork
// off an edge of the viewBox it filled (63.999 instead of 64) or off the
// center it sat on (12.001 instead of 12), so those get four or five. Shared by `npm run optimize` and `lint-svg.js --fix`
// (rule-optimize.js); `npm run optimize:check` uses `savingOf`.
import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { measureBBox, rendersAlike } from './render.js'
import { validateGeometry } from './validators.js'

// Tried in order; the last one is used even when it doesn't draw alike, so
// callers can tell the result from the original with `alike`
export const PRECISIONS = [3, 4, 5]

// The project's SVGO config at one precision
const optimizeAt = (svg, precision, path) =>
    optimize(svg, { ...svgoConfig, floatPrecision: precision, path }).data

// The precision a file is written with: the most decimals any of its numbers
// has, kept within PRECISIONS
const precisionOf = (svg) =>
    PRECISIONS.findLast((p) => new RegExp(String.raw`\.\d{${p}}`).test(svg)) ??
    PRECISIONS[0]

// The fewest decimals SVGO may write, from a script's `--precision=4`
// argument (with `=`, as an argument without `--` names a file): three
// when there is none. Throws on any other value; `precisionArgOrExit` is
// the scripts' form, which prints that and exits.
export function precisionArg(args) {
    const arg = args.find((a) => a.startsWith('--precision='))
    if (!arg) return PRECISIONS[0]
    const precision = Number(arg.slice('--precision='.length))
    if (!PRECISIONS.includes(precision))
        throw new Error(
            `--precision takes ${PRECISIONS.join(', ')}, as --precision=4`,
        )

    return precision
}

// `precisionArg` for `lint-svg.js --fix` and `npm run optimize`
export function precisionArgOrExit(args) {
    try {
        return precisionArg(args)
    } catch (error) {
        console.error(error.message)
        process.exit(1)
    }
}

// Share of its size SVGO may still remove from an optimized file at its own
// precision. SVGOMG's output stays under 7%; unoptimized exports lose 15-40%.
export const MAX_SAVING = 0.1

// How much smaller the project's SVGO config would still make an SVG at the
// precision it is written with: over MAX_SAVING, it was never optimized
// (`npm run optimize:check`, and `lint-svg.js` on the files it is given)
export const savingOf = (svg, path) =>
    1 - optimizeAt(svg, precisionOf(svg), path).length / svg.length

// A measurement this close to the viewBox's reads as equal to it at three
// decimals (64.000), as the validator page shows it
const ON_VIEWBOX = 0.0005

// x, y, width and height at three decimals, as the validator page shows them
const shownBBox = (svg) => {
    const box = measureBBox(svg)
    if (!box) return {}
    const show = (value) =>
        (Math.abs(value) < ON_VIEWBOX ? 0 : value).toFixed(3)

    return {
        x: show(box.x),
        y: show(box.y),
        width: show(box.width),
        height: show(box.height),
    }
}

// The bounding box values that read differently at three decimals after
// optimizing, as "y 28.253 → 28.254": what to compare with the original.
// Shared by `npm run optimize` and `lint-svg.js --fix`.
export function bboxChanges(before, after) {
    const was = shownBBox(before)
    const now = shownBBox(after)

    return Object.keys(was)
        .filter((key) => was[key] !== now[key])
        .map((key) => `${key} ${was[key]} → ${now[key]}`)
}

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
    // The nearer size: a viewBox a hair off (0 0 63.999999 64, from
    // Inkscape) is a logo's, which SVGO rounds to 64, and judging it as an
    // icon's would make every result differ from it
    const type = Math.abs(width - 64) < Math.abs(width - 24) ? 'logo' : 'icon'
    const failing = validateGeometry(type, box)
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
// to them. `precision` is the fewest decimals to try (3, the default, or 4
// or 5), for keeping more decimals than placement alone asks for.
export function optimizeSvg(source, path, { precision: fewest = 3 } = {}) {
    const precisions = PRECISIONS.filter((p) => p >= fewest)
    const geometry = geometryOf(source)
    const keeps = (data) =>
        rendersAlike(source, data) && geometryOf(data) === geometry
    const run = (svg, precision) => optimizeAt(svg, precision, path)

    // The edges and center the source sits on (within EXACT), and how far
    // a result is from them: up to the source's own offset plus what reads
    // as equal at three decimals is exact enough, but reaching that full
    // amount is not. Rounding to three decimals moves a coordinate by up to
    // 0.0005, so a mark centered exactly can come out 0.0005 off (12 →
    // 11.9995, Nordwind's icon); four decimals keep it on. Misses are
    // rounded to 1e-5, as rule-geometry.js does, so resvg's float32 boxes
    // don't decide which side of the line they fall on.
    const aimed = (placementOf(source) ?? []).map((d) => Math.abs(d) <= EXACT)
    const snap = (n) => Math.round(n * 1e5) / 1e5
    const missOf = (svg) =>
        snap(
            Math.max(
                0,
                ...(placementOf(svg) ?? [])
                    .filter((_, i) => aimed[i])
                    .map(Math.abs),
            ),
        )
    const tolerance = snap(missOf(source) + ON_VIEWBOX)

    let closest
    let result
    for (const precision of precisions) {
        const data = run(source, precision)
        if (!keeps(data)) {
            result = { data, precision, alike: false }
            continue
        }
        // Rounding the result again at fewer decimals can keep the edges
        // where rounding the original couldn't, and is smaller
        const candidates = precisions
            .filter((p) => p < precision)
            .map((lower) => ({ data: run(data, lower), precision: lower }))
            .filter((again) => again.data.length < data.length)
            .concat({ data, precision })
        for (const candidate of candidates) {
            if (candidate.data !== data && !keeps(candidate.data)) continue
            const miss = missOf(candidate.data)
            if (miss < tolerance) return { ...candidate, alike: true }
            if (!closest || miss < closest.miss)
                closest = { ...candidate, miss }
        }
    }
    if (closest) {
        return { data: closest.data, precision: closest.precision, alike: true }
    }

    return result
}
