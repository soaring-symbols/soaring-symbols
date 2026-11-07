import { toFullHex } from '../../utils/index.js'

const HEX_REGEX = /^#(?:[0-9A-F]{3}){1,2}$/i
const SVG_ATTR_ORDER = ['role', 'viewBox', 'xmlns', 'fill']

const PAINT_ATTRS = ['fill', 'stroke', 'stop-color']

// Paint values that are not colors to convert
const NON_COLORS = /^(none|currentColor|transparent|inherit|url\(.*\))$/i

// RULE: Colors must be six-digit lowercase hex, so the colors read from the
//       SVGs into airlines.json share one form. Short hex is expanded; color
//       names and rgb() values are left to `npm run optimize`, which turns
//       them into hex.
export function ruleHexColors({ document, issues }) {
    PAINT_ATTRS.forEach((attr) => {
        document.querySelectorAll(`[${attr}]`).forEach((el) => {
            const value = el.getAttribute(attr).trim()
            if (NON_COLORS.test(value)) return
            if (!HEX_REGEX.test(value)) {
                issues.push(
                    `Style: Color "${value}" in ${attr} is not a hex color. Run \`npm run optimize\` to convert color names and rgb() values, or write it as six-digit lowercase hex (e.g. "#ff6600"). Not fixable with --fix.`,
                )

                return
            }
            const full = toFullHex(value)
            if (value === full) return
            issues.push(
                `Style: Hex color "${value}" should be written "${full}".`,
            )
            el.setAttribute(attr, full)
        })
    })
}

// RULE: fill should be on the root <svg> and removed from child elements when single-color.
//       Multi-color SVGs must not have a fill on the root <svg>.
export function ruleFillPlacement({ filePath, svgElement, document, issues }) {
    const elementsWithFill = document.querySelectorAll('[fill]')

    // A fill that isn't hex is reported by ruleHexColors; moving it around
    // here would only lose it
    const hasUnknownFill = [...elementsWithFill].some((el) => {
        const value = el.getAttribute('fill').trim()

        return !HEX_REGEX.test(value) && !NON_COLORS.test(value)
    })
    if (hasUnknownFill) return

    const allColors = [
        ...new Set(
            [...elementsWithFill]
                .map((el) => el.getAttribute('fill').toLowerCase())
                .filter((f) => f.match(HEX_REGEX)),
        ),
    ]
    const isSingleColor = allColors.length <= 1

    if (isSingleColor) {
        const isMonoFile = filePath.includes('-mono.svg')
        const targetColor = allColors[0] || 'currentColor'
        const existingFill = svgElement.getAttribute('fill')

        if (isMonoFile) {
            if (existingFill !== 'currentColor') {
                issues.push('Fill: Root <svg> should have fill="currentColor".')
                svgElement.setAttribute('fill', 'currentColor')
            }
        } else {
            if (existingFill?.toLowerCase() !== targetColor) {
                issues.push(
                    `Fill: Root <svg> should have fill="${targetColor}".`,
                )
                svgElement.setAttribute('fill', targetColor)
            }
        }

        elementsWithFill.forEach((el) => {
            if (el.tagName.toLowerCase() !== 'svg') {
                issues.push(
                    `Fill: Redundant fill on <${el.tagName.toLowerCase()}> should be removed.`,
                )
                el.removeAttribute('fill')
            }
        })
    } else {
        if (svgElement.hasAttribute('fill')) {
            issues.push(
                'Fill: Root <svg> should not have a fill attribute in multi-color icons.',
            )
            svgElement.removeAttribute('fill')
        }
    }
}

// RULE: On <path> elements, the fill attribute must come before the d attribute
export function rulePathAttrOrder(svgString) {
    let changed = false
    const content = svgString.replace(
        /<path([^>]*?) (d="[^"]*?")([^>]*?) (fill="[^"]*?")/g,
        (match, before, dAttr, after, fillAttr) => {
            changed = true

            return `<path${before} ${fillAttr} ${dAttr}${after}`
        },
    )

    return {
        content,
        changed,
        message: 'Style: `fill` attribute on <path> moved before `d`.',
    }
}

// RULE: Root <svg> attributes must follow the order: role, viewBox, xmlns, fill, ...rest
export function ruleSvgAttrOrder(svgString) {
    const svgTagMatch = svgString.match(/<svg([^>]*)>/)
    if (!svgTagMatch) return { content: svgString, changed: false }

    const attributesString = svgTagMatch[1]
    const attributes = {}
    const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g
    let match
    while ((match = attrRegex.exec(attributesString)) !== null) {
        attributes[match[1]] = match[2]
    }

    const orderedAttrs = SVG_ATTR_ORDER.filter((k) => k in attributes).map(
        (k) => `${k}="${attributes[k]}"`,
    )
    const otherAttrs = Object.keys(attributes)
        .filter((k) => !SVG_ATTR_ORDER.includes(k))
        .map((k) => `${k}="${attributes[k]}"`)
    const finalAttrs = [...orderedAttrs, ...otherAttrs].join(' ')

    if (
        finalAttrs.replace(/\s+/g, '') ===
        attributesString.trim().replace(/\s+/g, '')
    ) {
        return { content: svgString, changed: false }
    }

    return {
        content: svgString.replace(svgTagMatch[0], `<svg ${finalAttrs}>`),
        changed: true,
        message: 'Style: Root <svg> attributes reordered.',
    }
}
