// What `lint-svg.js --fix` does to one SVG, apart from reading and writing
// files: SVGO for the problems only it fixes, then the DOM and string rules,
// then the geometry checks, which only report. `lint-svg.js` runs it with
// jsdom, and the browser build (`svg-fixer.js`) with the browser's
// DOMParser, so both fix a file the same way.

import { DOM_RULES, STRING_RULES } from './rules.js'
import { ruleGeometry } from './rule-geometry.js'
import { ruleOptimize } from './rule-optimize.js'
import { isMonoFile } from './validators.js'

// Fixes `source` and returns { content, fixed, issues, warnings, errorCount }:
// `content` is the fixed SVG (the source itself when nothing changed),
// `fixed` whether it differs, `issues` what was wrong (fixed where a rule
// could), `warnings` advice that never fails --check. Options:
// - parse: (source) => Document, an XML document of the SVG
// - type: 'logo' (64×64), or 'icon' or 'tail' (24×24)
// - mono: the monochrome version, drawn in currentColor; defaults to
//   whether fileName ends in -mono.svg
// - fileName: the file's name, for that default
// - airlineName: the name <title> should hold; when missing or empty, the
//   current title, so it is needed when the file has none
// - isCatalogName: the name comes from the catalog, so a different title is
//   renamed to it (otherwise a title is only moved, never renamed)
// - formerNames: names an older mark may keep as its title
// - mergePaths: also join neighbouring paths of one color (experimental)
// - fillColor: the hex color (#rrggbb) to draw a color file in when it has
//   none of its own (drawn in currentColor or default black); any other
//   value is reported and the file left alone
export function fixSvg(
    source,
    {
        parse,
        type = 'logo',
        fileName = '',
        mono = isMonoFile(fileName),
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
        svgElement,
        document,
        isIcon: type !== 'logo',
        isMono: mono,
        // An empty name (no airline picked yet) keeps the current title
        airlineName:
            airlineName || svgElement.querySelector('title')?.textContent || '',
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

    // Phase 1: DOM rules. Some only report (a missing color), so the SVG is
    // written out again only when SVGO or a rule changed it.
    const before = svgElement.outerHTML
    for (const rule of DOM_RULES) rule(ctx)
    let content =
        optimized !== source || svgElement.outerHTML !== before
            ? svgElement.outerHTML
            : source

    // Phase 2: String rules. When SVGO or the DOM rules rewrote the file,
    // its serialization is theirs and the string rules' messages would only
    // describe that; otherwise each change is reported.
    const rewritten = content !== source
    for (const rule of STRING_RULES) {
        const result = rule(content, ctx)
        if (result.changed) {
            if (!rewritten && result.message) ctx.issues.push(result.message)
            content = result.content
        }
    }

    // Phase 3: Geometry, measured on the fixed content (reports only)
    ruleGeometry(content, ctx)

    return {
        content,
        fixed: content !== source,
        issues: ctx.issues,
        warnings: ctx.warnings,
        errorCount: ctx.issues.length,
    }
}
