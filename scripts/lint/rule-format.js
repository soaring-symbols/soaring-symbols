// Rules that catch SVGs which were never optimized, whichever SVGO version
// or tool optimized the rest: they check what an optimized file looks like
// instead of comparing it with one SVGO output.

import {
    validateNoDimensions,
    validateNoEditorData,
    validateNumberFormat,
    stripProlog,
} from './validators.js'

const OPTIMIZE_HINT = 'Run `npm run optimize`; not fixable with --fix.'

// RULE: No width or height on the root <svg>; the viewBox sets the size, so
//       the marks scale to whatever box they are placed in
export function ruleNoDimensions({ svgElement, issues }) {
    for (const attr of validateNoDimensions(svgElement).attrs) {
        issues.push(`Format: Root <svg> should not have \`${attr}\`.`)
        svgElement.removeAttribute(attr)
    }
}

// RULE: No comments, metadata or design-tool namespaces
export function ruleNoEditorData({ svgElement, issues }) {
    const { comments, leftovers } = validateNoEditorData(svgElement)
    if (comments.length) {
        issues.push('Format: Comments should be removed.')
        comments.forEach((node) => node.remove())
    }
    if (leftovers.length) {
        issues.push(
            `Format: Design-tool data found: ${leftovers.join(', ')}. ${OPTIMIZE_HINT}`,
        )
    }
}

// RULE: Path data is written the way SVGO writes it: at most five decimals,
//       no leading zero (".5", not "0.5") and no negative zero
export function ruleNumberFormat({ svgElement, issues }) {
    const { paths, maxDecimals } = validateNumberFormat(svgElement)
    for (const { el, long, negativeZero, trimmed } of paths) {
        if (long) {
            issues.push(
                `Format: Path data has more than ${maxDecimals} decimals ("${long}"). ${OPTIMIZE_HINT}`,
            )
        }
        if (negativeZero) {
            issues.push(
                `Format: Path data has a negative zero. ${OPTIMIZE_HINT}`,
            )
        }
        if (trimmed) {
            issues.push(
                'Format: Path data has leading zeros ("0.5" should be ".5").',
            )
            el.setAttribute('d', trimmed)
        }
    }
}

// RULE: The file starts with <svg>: no XML declaration, DOCTYPE or comment
//       before it
export function ruleNoProlog(svgString) {
    const content = stripProlog(svgString)
    if (content === svgString) return { content, changed: false }

    return {
        content,
        changed: true,
        message:
            'Format: XML declaration, DOCTYPE or comment before <svg> removed.',
    }
}
