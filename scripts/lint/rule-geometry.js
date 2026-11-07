import { validateGeometry } from './validators.js'
import { Resvg } from '@resvg/resvg-js'

// RULE: The SVG's geometry must fill the viewBox, fit within it, and be centered.
export function ruleGeometry(svgString, { isIcon, issues }) {
    const bbox = new Resvg(svgString, {
        font: { loadSystemFonts: false },
    }).getBBox()
    const validations = validateGeometry(isIcon ? 'icon' : 'logo', bbox)
    for (const validation of validations) {
        if (!validation.pass) {
            issues.push(
                `Geometry: ${validation.label} check failed: ${validation.detail}`,
            )
        }
    }
}
