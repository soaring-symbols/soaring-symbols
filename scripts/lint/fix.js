// What `lint-svg.js --fix` does to one SVG, apart from reading and writing
// files: SVGO for the problems only it fixes, then the DOM and string rules,
// then the geometry checks, which only report. `lint-svg.js` runs it with
// jsdom, and the browser build (`svg-fixer.js`) with the browser's
// DOMParser, so both fix a file the same way.

import { DOM_RULES, STRING_RULES } from './rules.js'
import { ruleGeometry } from './rule-geometry.js'
import { ruleOptimize } from './rule-optimize.js'

// Fixes `source` and returns { content, fixed, issues, warnings, errorCount }:
// `content` is the fixed SVG (the source itself when nothing changed),
// `issues` what was wrong (fixed where a rule could), `warnings` advice that
// never fails --check. Options:
// - parse: (source) => Document, an XML document of the SVG
// - fileName: the file's name, which tells a -mono.svg apart
// - isIcon: an icon or tail (24×24) rather than a logo (64×64)
// - airlineName: the name <title> should hold; defaults to the current
//   title, and is needed when the file has none
// - isCatalogName: the name comes from the catalog, so a different title is
//   renamed to it (otherwise a title is only moved, never renamed)
// - formerNames: names an older mark may keep as its title
// - mergePaths: also join neighbouring paths of one color (experimental)
// - fillColor: the hex color (#rrggbb, lowercase) to draw a color file in
//   when it has none of its own (drawn in currentColor or default black)
export function fixSvg(
    source,
    {
        parse,
        fileName = '',
        isIcon = false,
        airlineName,
        isCatalogName = false,
        formerNames,
        mergePaths = false,
        fillColor,
    },
) {
    let document = parse(source)
    let svgElement = document.querySelector('svg')

    if (!svgElement) {
        return {
            content: source,
            fixed: false,
            issues: ['Invalid SVG: Missing <svg> element.'],
            warnings: [],
            errorCount: 1,
        }
    }

    const ctx = {
        filePath: fileName,
        svgElement,
        document,
        isIcon,
        airlineName:
            airlineName ?? svgElement.querySelector('title')?.textContent ?? '',
        isCatalogName,
        formerNames,
        mergePaths,
        fillColor: fillColor?.toLowerCase(),
        issues: [],
        // Reported only; never trigger a rewrite
        warnings: [],
    }

    // Phase 0: SVGO, for the problems only it fixes; the rules lint its result
    const optimized = ruleOptimize(source, svgElement, ctx)
    if (optimized !== source) {
        document = parse(optimized)
        svgElement = document.querySelector('svg')
        Object.assign(ctx, { document, svgElement })
    }

    // Phase 1: DOM rules
    for (const rule of DOM_RULES) rule(ctx)

    let content = ctx.issues.length > 0 ? svgElement.outerHTML : source
    let fixed = ctx.issues.length > 0

    // Phase 2: String rules
    for (const rule of STRING_RULES) {
        const result = rule(content, ctx)
        if (result.changed) {
            if (!fixed && result.message) ctx.issues.push(result.message)
            content = result.content
            fixed = true
        }
    }

    // Phase 3: Geometry, measured on the fixed content (reports only)
    ruleGeometry(content, ctx)

    // A rule that only reports (geometry, a missing color) still counts as an
    // issue; the file is fixed only when its text actually changed
    const changed = fixed && content !== source

    return {
        content: changed ? content : source,
        fixed: changed,
        issues: ctx.issues,
        warnings: ctx.warnings,
        errorCount: ctx.issues.length,
    }
}
