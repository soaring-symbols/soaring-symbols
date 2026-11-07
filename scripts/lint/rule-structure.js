import {
    validateViewBox,
    validateNoTransforms,
    validateNoNestedGroups,
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

// RULE: role, viewBox, and xmlns must be present on the root <svg>
export function ruleRequiredAttrs({ svgElement, issues }) {
    for (const attr of ['role', 'viewBox', 'xmlns']) {
        if (!svgElement.hasAttribute(attr)) {
            issues.push(`Structure: Missing required attribute \`${attr}\`.`)
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

const SHAPES = 'path, circle, rect, ellipse, polygon, polyline, line'
const HEX_FILL = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi

// RULE (warning): a single-color SVG should draw everything in one <path>.
// Not auto-fixable: merging paths safely needs a visual check.
export function ruleSinglePath({ svgElement, filePath, warnings }) {
    const markup = svgElement.outerHTML
    const isMono = filePath.endsWith('-mono.svg')
    const usesPaint = /url\(#|stroke=|stroke:|<(clipPath|mask)\b/i.test(markup)
    const fills = new Set(
        [...svgElement.querySelectorAll('[fill], [style]')].flatMap((el) =>
            (
                `${el.getAttribute('fill') || ''} ${el.getAttribute('style') || ''}`.match(
                    HEX_FILL,
                ) || []
            ).map((c) => c.toLowerCase()),
        ),
    )
    if (!isMono && (usesPaint || fills.size > 1)) return

    const shapes = [...svgElement.querySelectorAll(SHAPES)].filter(
        (el) => !el.closest('defs, clipPath, mask'),
    )
    if (shapes.length > 1) {
        warnings.push(
            `Structure: Single-color SVG should use one <path>, found ${shapes.length} shapes.`,
        )
    }
}
