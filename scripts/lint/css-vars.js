// CSS custom properties in paint, as SVGs copied from a web page or a design
// system carry them: fill="var(--color-icon-brand-green)". A mark has to
// stand alone, so --fix writes each var() as the value it takes in the file:
// a custom property the SVG defines itself (in a <style> rule or a
// style="--name: …" on an ancestor), else the var()'s fallback
// (var(--green, #00a651)). One with neither has no value outside the page it
// came from: the browser and resvg both ignore it, so the shape takes the
// paint it inherits (black for a fill when nothing sets one). --fix writes
// that, so the drawing stays the same, except in a file with no other
// color: there it drops the var()s, and the file, now with no color of its
// own, is reported and takes one from fillColor.

// The properties a var() is resolved in, and what an ignored one draws with
// when no ancestor sets it (null: nothing to write, the default applies)
const INITIAL = {
    fill: '#000000',
    stroke: null,
    'stop-color': '#000000',
    color: null,
    opacity: null,
    'fill-opacity': null,
    'stroke-opacity': null,
    'stop-opacity': null,
}
// Of those, the ones a child inherits
const INHERITED = new Set([
    'fill',
    'stroke',
    'color',
    'fill-opacity',
    'stroke-opacity',
])
const PAINTS = ['fill', 'stroke', 'stop-color']
const NOT_A_COLOR = /^(none|transparent|inherit|currentColor)$/i

// Writes each var() in `value` as what `defs` gives it or its fallback,
// recursively; null when one has neither
export function resolveVars(value, defs, depth = 0) {
    if (depth > 8) return null
    let out = ''
    let rest = value
    for (;;) {
        const start = rest.indexOf('var(')
        if (start < 0) return out + rest
        out += rest.slice(0, start)
        // The var()'s arguments, up to its own closing parenthesis
        let level = 0
        let end = start + 4
        for (; end < rest.length; end++) {
            if (rest[end] === '(') level++
            else if (rest[end] === ')') {
                if (level === 0) break
                level--
            }
        }
        if (end >= rest.length) return null
        const args = rest.slice(start + 4, end)
        const comma = args.indexOf(',')
        const name = (comma < 0 ? args : args.slice(0, comma)).trim()
        const fallback = comma < 0 ? null : args.slice(comma + 1).trim()
        const raw = defs.get(name) ?? fallback
        const resolved = raw == null ? null : resolveVars(raw, defs, depth + 1)
        if (resolved == null) return null
        out += resolved
        rest = rest.slice(end + 1)
    }
}

const declarations = (style) =>
    style
        .split(';')
        .map((decl) => {
            const colon = decl.indexOf(':')

            return colon < 0
                ? null
                : [decl.slice(0, colon).trim(), decl.slice(colon + 1).trim()]
        })
        .filter((decl) => decl?.[0])

// What `property` is on `el` once its own value is ignored: the nearest
// ancestor's, or the initial value
function inheritedValue(el, property) {
    if (INHERITED.has(property)) {
        for (let node = el.parentElement; node; node = node.parentElement) {
            const value = node.getAttribute(property)
            if (value && !value.includes('var(')) return value
        }
    }

    return INITIAL[property]
}

// Resolves the var()s in an SVG's paint, in place. Returns one entry per
// value: { property, value, resolved, inherited }, where `resolved` is what
// the file gives it and, when it gives none, `inherited` what was written
// instead (null: dropped).
export function resolveCssVars(svg) {
    const changes = []
    // var()s with no value, set aside until every paint is known
    const unresolved = []
    // Custom properties a <style> defines, whatever the selector: a mark is
    // one drawing, and design tools put them on :root or svg
    const sheetDefs = new Map()
    for (const style of svg.querySelectorAll('style')) {
        for (const [, name, value] of style.textContent.matchAll(
            /(--[\w-]+)\s*:\s*([^;}]+)/g,
        )) {
            sheetDefs.set(name, value.trim())
        }
    }

    const walk = (el, inherited) => {
        const defs = new Map(inherited)
        const style = el.getAttribute('style')
        // A style="" var() becomes an attribute, as SVGO would make it, so
        // it resolves like the rest; custom properties go once read
        if (style && /var\(|--/.test(style)) {
            const kept = []
            for (const [name, value] of declarations(style)) {
                if (name.startsWith('--')) defs.set(name, value)
                else if (name in INITIAL && value.includes('var('))
                    el.setAttribute(name, value)
                else kept.push(`${name}:${value}`)
            }
            if (kept.length) el.setAttribute('style', kept.join(';'))
            else el.removeAttribute('style')
        }

        for (const property of Object.keys(INITIAL)) {
            const value = el.getAttribute(property)
            if (!value?.includes('var(')) continue
            const resolved = resolveVars(value, defs)
            if (resolved == null) {
                unresolved.push({ el, property, value })
                continue
            }
            el.setAttribute(property, resolved)
            changes.push({ property, value, resolved })
        }

        for (const child of el.children) walk(child, defs)
    }
    walk(svg, sheetDefs)

    // var()s in a <style>'s rules, which SVGO would inline as they are; one
    // with no value is left out, as the browser leaves it
    for (const style of svg.querySelectorAll('style')) {
        const text = style.textContent
            .replace(/--[\w-]+\s*:[^;}]*;?/g, '')
            .replace(
                /([\w-]+)\s*:\s*([^;}]*var\([^;}]*)(;?)/g,
                (decl, name, value, semi) => {
                    const resolved = resolveVars(value.trim(), sheetDefs)
                    changes.push({
                        property: name,
                        value: value.trim(),
                        resolved,
                        inherited: null,
                    })

                    return resolved == null ? '' : `${name}:${resolved}${semi}`
                },
            )
        if (text !== style.textContent) style.textContent = text
    }

    if (unresolved.length) {
        // Another color in the file: keep each shape drawn as it is
        const hasColor = [svg, ...svg.querySelectorAll('*')].some((el) =>
            PAINTS.some((property) => {
                const value = el.getAttribute(property)

                return (
                    value &&
                    !value.includes('var(') &&
                    !NOT_A_COLOR.test(value.trim())
                )
            }),
        )
        for (const { el, property, value } of unresolved) {
            const inherited = hasColor ? inheritedValue(el, property) : null
            if (inherited == null) el.removeAttribute(property)
            else el.setAttribute(property, inherited)
            changes.push({ property, value, resolved: null, inherited })
        }
    }

    return changes
}
