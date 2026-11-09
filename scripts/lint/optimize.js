// Optimize one SVG with the project's SVGO config (svgo.config.mjs) at the
// lowest number precision that still renders like the original. Three
// decimals, SVGOMG's default, is enough for almost every logo and keeps files
// smallest; a few shapes (e.g. small circles drawn as arcs) move visibly at
// three, so those get four or five. Shared by `npm run optimize`,
// `lint-svg.js --fix` (rule-optimize.js) and `npm run optimize:check`.
import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { rendersAlike } from './render.js'

// Tried in order; the last one is used even when it doesn't render alike,
// so callers can tell the result from the original with `alike`
export const PRECISIONS = [3, 4, 5]

// Returns { data, precision, alike }. `data` is the optimized markup,
// `precision` the floatPrecision it was written with, and `alike` whether it
// renders like `source`.
export function optimizeSvg(source, path) {
    let result
    for (const precision of PRECISIONS) {
        const data = optimize(source, {
            ...svgoConfig,
            floatPrecision: precision,
            path,
        }).data
        result = { data, precision, alike: rendersAlike(source, data) }
        if (result.alike) return result
    }

    return result
}
