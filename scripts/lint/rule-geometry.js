import { measureBBox } from './render.js'
import { validateGeometry } from './validators.js'

// RULE: the artwork must fill the viewBox, fit within it and be centered.
// measureBBox gives the bounding box the browser gets from getBBox() (strokes
// left out, and ruleNoStrokes bans them anyway).
// Not auto-fixable; near misses only warn (see validateGeometry).
export function ruleGeometry(svgString, { isIcon, issues, warnings }) {
    const bbox = measureBBox(svgString)

    for (const check of validateGeometry(isIcon ? 'icon' : 'logo', bbox)) {
        if (check.pass) continue
        const target = check.level === 'warning' ? warnings : issues
        target.push(`Geometry: ${check.label} check failed: ${check.detail}`)
    }
}
