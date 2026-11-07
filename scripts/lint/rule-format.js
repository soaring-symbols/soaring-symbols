// Rules that catch SVGs which were never optimized, whichever SVGO version
// or tool optimized the rest. Modeled on Simple Icons' svglint rules
// (icon-precision, negative-zeros): they check what an optimized file looks
// like instead of comparing it with one SVGO output. Leading zeros ("0.5")
// are left to the optimize check on the SVGs a pull request changes: some
// older files still have them, and they render the same.

const MAX_DECIMALS = 5
const OPTIMIZE_HINT = 'Run `npm run optimize`; not fixable with --fix.'

// Attribute and element prefixes design tools leave behind
const EDITOR_PREFIX = /^(inkscape|sodipodi|sketch|serif|i|x|graph|a):/
const EDITOR_NS = /^xmlns:(?!xlink$)/

const pathData = (document) =>
    [...document.querySelectorAll('path[d]')].map((el) => el.getAttribute('d'))

// RULE: No width or height on the root <svg>; the viewBox sets the size, so
//       the marks scale to whatever box they are placed in
export function ruleNoDimensions({ svgElement, issues }) {
    for (const attr of ['width', 'height']) {
        if (svgElement.hasAttribute(attr)) {
            issues.push(`Format: Root <svg> should not have \`${attr}\`.`)
            svgElement.removeAttribute(attr)
        }
    }
}

// RULE: No comments, metadata or design-tool namespaces
export function ruleNoEditorData({ svgElement, document, issues }) {
    const walker = document.createTreeWalker(svgElement, 128) // comments
    const comments = []
    while (walker.nextNode()) comments.push(walker.currentNode)
    if (comments.length) {
        issues.push('Format: Comments should be removed.')
        comments.forEach((node) => node.remove())
    }

    const leftovers = new Set()
    for (const el of [svgElement, ...svgElement.querySelectorAll('*')]) {
        if (
            el.tagName.toLowerCase() === 'metadata' ||
            EDITOR_PREFIX.test(el.tagName)
        ) {
            leftovers.add(`<${el.tagName}>`)
        }
        for (const { name } of el.attributes) {
            if (EDITOR_PREFIX.test(name) || EDITOR_NS.test(name)) {
                leftovers.add(name)
            }
        }
    }
    if (leftovers.size) {
        issues.push(
            `Format: Design-tool data found: ${[...leftovers].join(', ')}. ${OPTIMIZE_HINT}`,
        )
    }
}

// RULE: Path data has at most five decimals and no negative zero
export function ruleNumberFormat({ document, issues }) {
    for (const d of pathData(document)) {
        const long = d.match(new RegExp(`\\.\\d{${MAX_DECIMALS + 1},}`))
        if (long) {
            issues.push(
                `Format: Path data has more than ${MAX_DECIMALS} decimals ("${long[0]}"). ${OPTIMIZE_HINT}`,
            )
        }

        const negativeZero = d.match(/-0(?![\d.])/)
        if (negativeZero) {
            issues.push(
                `Format: Path data has a negative zero. ${OPTIMIZE_HINT}`,
            )
        }
    }
}

// RULE: The file starts with <svg>: no XML declaration, DOCTYPE or comment
//       before it
export function ruleNoProlog(svgString) {
    const start = svgString.indexOf('<svg')
    if (start <= 0) return { content: svgString, changed: false }

    return {
        content: svgString.slice(start),
        changed: true,
        message:
            'Format: XML declaration, DOCTYPE or comment before <svg> removed.',
    }
}
