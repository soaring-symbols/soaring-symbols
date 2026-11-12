import {
    validateViewBox,
    validateNoTransforms,
    validateNoNestedGroups,
    validateOnePathPerColor,
} from './validators.js'
import { applyIfAlike, flattenGroups, mergePaths } from './fix-structure.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

// RULE: <title> must exist, be the first child and match the airline name
// (an older mark in history/ may keep one of its previous_names).
// It is created in the SVG namespace: document.createElement() would give it
// no namespace, which serializes as <title xmlns="">.
export function ruleTitle({
    svgElement,
    document,
    airlineName,
    isCatalogName,
    formerNames = [],
    issues,
}) {
    let titleElement = svgElement.querySelector('title')
    if (titleElement && titleElement.namespaceURI !== SVG_NS) {
        issues.push('Accessibility: <title> must not set its own xmlns.')
        const replacement = document.createElementNS(SVG_NS, 'title')
        replacement.textContent = titleElement.textContent
        titleElement.replaceWith(replacement)
        titleElement = replacement
    }
    if (!titleElement) {
        issues.push('Accessibility: Missing <title> element.')
        titleElement = document.createElementNS(SVG_NS, 'title')
        titleElement.textContent = airlineName
        svgElement.prepend(titleElement)
    } else if (svgElement.firstElementChild !== titleElement) {
        issues.push(
            'Accessibility: <title> must be the first element inside <svg>.',
        )
        svgElement.prepend(titleElement)
    }

    // An older mark keeps the name it was used under, when that is one of
    // the airline's previous_names; anything else gets the current name
    const allowed = [airlineName, ...formerNames]
    if (isCatalogName && !allowed.includes(titleElement.textContent)) {
        const expected = allowed.map((name) => `"${name}"`).join(' or ')
        issues.push(
            `Accessibility: <title> should be ${expected}, not "${titleElement.textContent}".`,
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
// but shouldn't be nested. --fix flattens them when the result renders the
// same (fix-structure.js), and leaves the warning otherwise.
export function ruleNoNestedGroups({ svgElement, issues, warnings }) {
    if (validateNoNestedGroups(svgElement).pass) return
    const outcome = applyIfAlike(svgElement, flattenGroups)
    if (outcome === 'fixed') issues.push('Structure: Nested groups flattened.')
    const { pass, detail } = validateNoNestedGroups(svgElement)
    if (!pass) {
        warnings.push(
            `Structure: Groups should not be nested, ${detail}${outcome === 'renders differently' ? ' (--fix left them: flattening changes the rendering)' : ''}.`,
        )
    }
}

// RULE (warning): each color should be drawn in one <path>, so a
// single-color SVG has one shape and a multi-color one a shape per color
// (where shapes of the same color are drawn one after another). Merging is
// experimental: only `--fix --merge-paths` joins neighbouring <path>s of the
// same color, in single- and multi-color SVGs alike, when the result renders
// the same (fix-structure.js), and the result still needs a look. Without
// the flag the warning says whether it would.
export function ruleOnePathPerColor({
    svgElement,
    mergePaths: merge,
    issues,
    warnings,
}) {
    let result = validateOnePathPerColor(svgElement)
    if (result.pass) return
    let outcome = applyIfAlike(svgElement, mergePaths, { apply: merge })
    if (merge && outcome === 'fixed') {
        const { count } = result
        result = validateOnePathPerColor(svgElement)
        issues.push(
            `Structure: Merged ${count} shapes into ${result.count} (experimental, check the result).`,
        )
        if (result.pass) return
        outcome = 'unchanged'
    }
    const hint = {
        fixed: ' (`--fix --merge-paths` can merge them, experimental: check the result)',
        'renders differently':
            ' (merging changes the rendering, e.g. a hole where shapes overlap)',
        unchanged: '',
    }[outcome]
    const { count, merges, colors } = result
    warnings.push(
        colors === 1
            ? `Structure: Single-color SVG should use one <path>, found ${count} shapes${hint}.`
            : `Structure: ${merges} shape${merges === 1 ? '' : 's'} share${merges === 1 ? 's' : ''} a color with the shape before; merge each run into one <path>${hint}.`,
    )
}
