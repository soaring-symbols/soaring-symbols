import {
    validateViewBox,
    validateNoTransforms,
    validateNoNestedGroups,
    validateOnePathPerColor,
} from './validators.js'

// RULE: <title> must exist, be the first child and match the airline name
export function ruleTitle({
    svgElement,
    document,
    airlineName,
    isCatalogName,
    issues,
}) {
    let titleElement = svgElement.querySelector('title')
    if (!titleElement) {
        issues.push('Accessibility: Missing <title> element.')
        titleElement = document.createElement('title')
        titleElement.textContent = airlineName
        svgElement.prepend(titleElement)
    } else if (svgElement.firstElementChild !== titleElement) {
        issues.push(
            'Accessibility: <title> must be the first element inside <svg>.',
        )
        svgElement.prepend(titleElement)
    }

    if (isCatalogName && titleElement.textContent !== airlineName) {
        issues.push(
            `Accessibility: <title> should be "${airlineName}", not "${titleElement.textContent}".`,
        )
        titleElement.textContent = airlineName
    }
}

// RULE: viewBox must match expected size (64×64 for logos, 24×24 for icons/tails)
export function ruleViewBox({ svgElement, isIcon, issues }) {
    const { pass, expected } = validateViewBox(
        svgElement,
        isIcon ? 'icon' : 'logo',
    )
    if (!pass) {
        issues.push(`ViewBox: Should be "${expected}".`)
        svgElement.setAttribute('viewBox', expected)
    }
}

// RULE: role, viewBox, and xmlns must be present on the root <svg>.
//       A missing role="img" (SVGOMG drops it) is added back.
export function ruleRequiredAttrs({ svgElement, issues }) {
    for (const attr of ['role', 'viewBox', 'xmlns']) {
        if (!svgElement.hasAttribute(attr)) {
            issues.push(`Structure: Missing required attribute \`${attr}\`.`)
            if (attr === 'role') svgElement.setAttribute('role', 'img')
        }
    }
}

// RULE: No transform attributes allowed on any element
export function ruleNoTransforms({ svgElement, issues }) {
    const { pass, detail } = validateNoTransforms(svgElement)
    if (!pass) {
        issues.push(`Structure: Transform attributes found: ${detail}`)
    }
}

// RULE (warning): groups may share attributes such as fill or clip-path,
// but shouldn't be nested. Not auto-fixable: flattening needs a visual check.
export function ruleNoNestedGroups({ svgElement, warnings }) {
    const { pass, detail } = validateNoNestedGroups(svgElement)
    if (!pass)
        warnings.push(`Structure: Groups should not be nested, ${detail}.`)
}

// RULE (warning): each color should be drawn in one <path>, so a
// single-color SVG has one shape and a multi-color one a shape per color
// (where shapes of the same color are drawn one after another). Not
// auto-fixable: merging paths can leave holes where shapes overlap, so it
// needs a visual check.
export function ruleOnePathPerColor({ svgElement, warnings }) {
    const { pass, count, merges, colors } = validateOnePathPerColor(svgElement)
    if (pass) return
    warnings.push(
        colors === 1
            ? `Structure: Single-color SVG should use one <path>, found ${count} shapes.`
            : `Structure: ${merges} shape${merges === 1 ? '' : 's'} share${merges === 1 ? 's' : ''} a color with the shape before; merge each run into one <path>.`,
    )
}
