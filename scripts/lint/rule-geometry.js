import { Resvg } from '@resvg/resvg-js'
import { validateGeometry } from './validators.js'

// RULE: the artwork must fill the viewBox, fit within it and be centered.
// jsdom has no layout, so resvg measures the bounding box the browser gets
// from getBBox() (both leave strokes out, and ruleNoStrokes bans them anyway).
// Not auto-fixable; near misses only warn (see validateGeometry).
export function ruleGeometry(svgString, { isIcon, issues, warnings }) {
    const bbox = new Resvg(svgString, {
        // No SVG uses <text>, and loading system fonts is the slow part
        font: { loadSystemFonts: false },
    }).getBBox()

    for (const check of validateGeometry(isIcon ? 'icon' : 'logo', bbox)) {
        if (check.pass) continue
        const target = check.level === 'warning' ? warnings : issues
        target.push(`Geometry: ${check.label} check failed: ${check.detail}`)
    }
}
