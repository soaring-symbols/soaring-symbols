import { optimize } from 'svgo'
import svgoConfig from '../../svgo.config.mjs'
import { rendersAlike } from './render.js'
import {
    validateHexColors,
    validateNoEditorData,
    validateNoStyles,
    validateNoTransforms,
    validateNumberFormat,
} from './validators.js'

// The problems the other rules can only send to `npm run optimize`, by what
// they are called in the lint output
const NEEDS_SVGO = [
    ['design-tool data', (svg) => validateNoEditorData(svg).leftovers.length],
    [
        'long decimals or -0 in path data',
        (svg) =>
            validateNumberFormat(svg).paths.some(
                (p) => p.long || p.negativeZero,
            ),
    ],
    ['non-hex colors', (svg) => validateHexColors(svg).invalid.length],
    ['<style> elements', (svg) => validateNoStyles(svg).styleElements.length],
    ['transforms', (svg) => !validateNoTransforms(svg).pass],
]

// PRE-PHASE: an SVG with a problem only SVGO fixes (see NEEDS_SVGO) is run
// through the project's svgo.config.mjs, as `npm run optimize` would, and
// the rules then lint the result. The result is kept only when it renders
// like the original; otherwise the file is linted as it is and the rules
// report each problem. Returns the content the rules should lint.
export function ruleOptimize(source, svgElement, { issues, warnings }) {
    const found = NEEDS_SVGO.filter(([, has]) => has(svgElement)).map(
        ([name]) => name,
    )
    if (!found.length) return source

    let optimized
    try {
        optimized = optimize(source, svgoConfig).data
        if (optimized === source) return source
        if (!rendersAlike(source, optimized)) {
            warnings.push(
                `Format: Optimizing with svgo.config.mjs (for ${found.join(', ')}) changes the rendering, so --fix left it; fix it in your editor.`,
            )

            return source
        }
    } catch (error) {
        warnings.push(
            `Format: Could not optimize with svgo.config.mjs (for ${found.join(', ')}): ${error.message}`,
        )

        return source
    }
    issues.push(
        `Format: Optimized with svgo.config.mjs for ${found.join(', ')}.`,
    )

    return optimized
}
