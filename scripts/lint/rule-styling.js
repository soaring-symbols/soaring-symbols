import {
    isMonoFile,
    validateHexColors,
    validateFillPlacement,
    validateNoStrokes,
    validateNoStyles,
    orderPathAttrs,
    orderSvgAttrs,
} from './validators.js'
import { OPTIMIZE_HINT } from './rule-format.js'

// RULE: Colors must be six-digit lowercase hex, so the colors read from the
//       SVGs into airlines.json share one form. Short hex is expanded; color
//       names and rgb() values are left to SVGO (rule-optimize.js), which
//       turns them into hex.
export function ruleHexColors({ svgElement, issues }) {
    const { invalid, short } = validateHexColors(svgElement)
    for (const { attr, value } of invalid) {
        issues.push(
            `Style: Color "${value}" in ${attr} is not a hex color. Write it as six-digit lowercase hex (e.g. "#ff6600"). ${OPTIMIZE_HINT}`,
        )
    }
    for (const { el, attr, value, full } of short) {
        issues.push(`Style: Hex color "${value}" should be written "${full}".`)
        el.setAttribute(attr, full)
    }
}

// RULE: No styles. Style attributes become presentation attributes (a
//       declaration wins over an attribute of the same name, as in CSS);
//       <style> elements are left to SVGO (rule-optimize.js), which inlines
//       and removes them.
export function ruleNoStyles({ svgElement, issues }) {
    const { styleElements, styled } = validateNoStyles(svgElement)
    if (styleElements.length) {
        issues.push(`Style: <style> element found. ${OPTIMIZE_HINT}`)
    }
    for (const { el, decls } of styled) {
        issues.push(
            `Style: style="${el.getAttribute('style')}" on <${el.tagName.toLowerCase()}> should be written as attributes.`,
        )
        for (const [name, value] of decls) el.setAttribute(name, value)
        el.removeAttribute('style')
    }
}

// RULE: No strokes. A stroke that paints is not auto-fixable: turning it
//       into a filled outline changes the path data (e.g. Inkscape's
//       Path → Stroke to Path). Stroke attributes and style properties that
//       paint nothing (stroke="none", a lone stroke-width) are removed.
export function ruleNoStrokes({ svgElement, issues }) {
    const { found, leftovers } = validateNoStrokes(svgElement)
    for (const { el, value } of found) {
        issues.push(
            `Style: <${el.tagName.toLowerCase()}> is drawn with stroke="${value}". Convert it to a filled path (e.g. Inkscape's Path → Stroke to Path). Not fixable with --fix.`,
        )
    }
    for (const { el, attrs, props } of leftovers) {
        issues.push(
            `Style: Unused stroke properties on <${el.tagName.toLowerCase()}>: ${[...attrs, ...props].join(', ')}.`,
        )
        attrs.forEach((name) => el.removeAttribute(name))
        if (!props.length) continue
        const style = el
            .getAttribute('style')
            .split(';')
            .filter(
                (decl) =>
                    decl.trim() &&
                    !props.includes(decl.split(':')[0].trim().toLowerCase()),
            )
            .join(';')
        if (style) el.setAttribute('style', style)
        else el.removeAttribute('style')
    }
}

// RULE: fill should be on the root <svg> and removed from child elements when single-color.
//       Multi-color SVGs (a gradient counts as a color, #53) must not have a
//       fill on the root <svg>: the shapes painted with it get it on their
//       own. Non-hex fills (reported by ruleHexColors) are left alone:
//       moving those around would lose them.
export function ruleFillPlacement({ filePath, svgElement, issues }) {
    const { skipped, rootFill, rootOk, redundant, inheriting } =
        validateFillPlacement(svgElement, isMonoFile(filePath))
    if (skipped) return

    if (!rootOk && rootFill === null) {
        issues.push(
            'Fill: Root <svg> should not have a fill attribute in multi-color icons.',
        )
        const fill = svgElement.getAttribute('fill')
        for (const el of inheriting) el.setAttribute('fill', fill)
        svgElement.removeAttribute('fill')
    } else if (!rootOk) {
        issues.push(`Fill: Root <svg> should have fill="${rootFill}".`)
        svgElement.setAttribute('fill', rootFill)
    }
    for (const el of redundant) {
        issues.push(
            `Fill: Redundant fill on <${el.tagName.toLowerCase()}> should be removed.`,
        )
        el.removeAttribute('fill')
    }
}

// RULE: On <path> elements, the fill attribute must come before the d attribute
export function rulePathAttrOrder(svgString) {
    const content = orderPathAttrs(svgString)

    return {
        content,
        changed: content !== svgString,
        message: 'Style: `fill` attribute on <path> moved before `d`.',
    }
}

// RULE: Root <svg> attributes must follow the order: role, viewBox, xmlns, fill, ...rest
export function ruleSvgAttrOrder(svgString) {
    const content = orderSvgAttrs(svgString)

    return {
        content,
        changed: content !== svgString,
        message: 'Style: Root <svg> attributes reordered.',
    }
}
