// Optimize one SVG with the project's SVGO config (svgo.config.mjs) at the
// lowest number precision that still draws the original: it must render
// alike and keep the artwork where it was. Three decimals, SVGOMG's default,
// keeps files smallest and is enough for most logos. Some shapes move at
// three, either visibly (small circles drawn as arcs) or by a few
// thousandths that take the artwork off the edge of the viewBox it filled
// (63.999 instead of 64), so those get four or five. Shared by
// `npm run optimize`, `lint-svg.js --fix` (rule-optimize.js) and
// `npm run optimize:check`.
import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { measureBBox, rendersAlike } from './render.js'

// Tried in order; the last one is used even when it doesn't draw alike, so
// callers can tell the result from the original with `alike`
export const PRECISIONS = [3, 4, 5]

// How far an edge of the artwork may move, in viewBox units. Rounding to
// three decimals moves an edge by up to 0.0005 on its own; more means the
// rounding errors added up.
const MAX_EDGE_SHIFT = 0.001
// An edge this close to the viewBox's counts as on it, and has to stay on it
const ON_VIEWBOX = 1e-4

// The artwork's edges as [left, top, right, bottom], undefined when it draws
// nothing
const edgesOf = (svg) => {
    const box = measureBBox(svg)

    return box && [box.x, box.y, box.x + box.width, box.y + box.height]
}

// The viewBox's edges in the same order
const viewBoxEdges = (svg) => {
    const [x, y, width, height] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number)

    return [x, y, x + width, y + height]
}

// Whether `after` keeps the artwork where `source` drew it: no edge moves by
// MAX_EDGE_SHIFT or more, and none that was on the viewBox leaves it
const keepsEdges = (before, after, viewBox) => {
    if (!before || !after) return before === after

    return before.every((edge, i) => {
        const onViewBox = Math.abs(edge - viewBox[i]) < ON_VIEWBOX

        return (
            Math.abs(after[i] - edge) < MAX_EDGE_SHIFT &&
            (!onViewBox || Math.abs(after[i] - viewBox[i]) < ON_VIEWBOX)
        )
    })
}

// Returns { data, precision, alike }. `data` is the optimized markup,
// `precision` the floatPrecision it was written with, and `alike` whether it
// renders like `source` with the artwork's edges in place.
export function optimizeSvg(source, path) {
    const edges = edgesOf(source)
    const viewBox = viewBoxEdges(source)
    let result
    for (const precision of PRECISIONS) {
        const data = optimize(source, {
            ...svgoConfig,
            floatPrecision: precision,
            path,
        }).data
        const alike =
            rendersAlike(source, data) &&
            keepsEdges(edges, edgesOf(data), viewBox)
        result = { data, precision, alike }
        if (alike) return result
    }

    return result
}
