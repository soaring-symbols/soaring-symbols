// --fix steps for the structure warnings that used to need an editor:
// flattening nested groups and merging the paths of a single-color SVG.
// Both work on a copy of the SVG and are kept only when the copy renders
// like the original (rendersAlike), so a merge that would punch a hole where
// shapes overlap, or a flattening that changes how a clip or an opacity
// applies, leaves the file alone and the warning in place.

import { rendersAlike } from './render.js'

// Attributes a group passes on to its children, so they can move onto them
const INHERITED = new Set(['fill', 'fill-rule', 'fill-opacity', 'clip-rule'])
// Attributes that apply to the group as a whole, which can only move onto a
// parent group the nested one fills alone. Their order matters with filter,
// so a group with one is left alone.
const OWN = new Set(['opacity', 'clip-path', 'mask'])

const NUMBER = /^[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/

// Applies `fix` to a copy of `svg` and, when it renders the same, moves the
// result into `svg`. Returns 'unchanged', 'fixed' or 'renders differently'.
export function applyIfAlike(svg, fix) {
    const copy = svg.cloneNode(true)
    fix(copy)
    if (copy.outerHTML === svg.outerHTML) return 'unchanged'
    if (!rendersAlike(svg.outerHTML, copy.outerHTML))
        return 'renders differently'
    svg.replaceChildren(...copy.childNodes)

    return 'fixed'
}

// Unwraps every <g> inside another <g>, innermost first: its inherited
// attributes go onto its children, and the rest onto the parent group when
// the nested one is its only child and the parent doesn't set them.
export function flattenGroups(svg) {
    for (const group of [...svg.querySelectorAll('g g')].reverse()) {
        const parent = group.parentElement
        const attrs = [...group.attributes]
        const own = attrs.filter((attr) => !INHERITED.has(attr.name))

        if (own.length === 0) {
            for (const child of group.children) {
                for (const { name, value } of attrs) {
                    if (!child.hasAttribute(name))
                        child.setAttribute(name, value)
                }
            }
        } else if (
            parent.children.length === 1 &&
            !parent.hasAttribute('filter') &&
            own.every(({ name }) => OWN.has(name) && !parent.hasAttribute(name))
        ) {
            // The nested group's inherited attributes win over the parent's
            for (const { name, value } of attrs)
                parent.setAttribute(name, value)
        } else {
            continue
        }
        group.replaceWith(...group.childNodes)
    }
}

// `d` with its first moveto made absolute, so it can follow another path's
// data: a path's first `m` is absolute whatever its case, but not once it
// comes second. Pairs after a relative first moveto are relative linetos, so
// they get an explicit `l`. Returns null for data it can't read.
export function absoluteStart(d) {
    const start = /^\s*([Mm])/.exec(d)
    if (!start) return null
    if (start[1] === 'M') return d.trim()

    let rest = d.slice(start[0].length)
    const [x, y] = [0, 1].map(() => {
        const number = NUMBER.exec(rest)
        if (!number) return null
        rest = rest.slice(number[0].length)

        return number[1]
    })
    if (x === null || y === null) return null
    const linetos = NUMBER.test(rest)
    rest = rest.replace(/^[\s,]*/, '')

    return `M${x}${y.startsWith('-') ? '' : ' '}${y}${linetos ? 'l' : ''}${rest}`
}

// Every attribute but `d` and the inherited paint, which a single-color SVG
// resolves to the same values on every shape
const sameAttrs = (a, b) => {
    const own = (el) =>
        [...el.attributes]
            .filter(
                ({ name }) =>
                    name !== 'd' &&
                    !['fill', 'fill-rule', 'fill-opacity'].includes(name),
            )
            .map(({ name, value }) => `${name}=${value}`)
            .sort()
            .join(' ')

    return own(a) === own(b)
}

// Joins each <path> into the <path> right before it. Only for a
// single-color SVG, where every shape has the same paint; shapes other than
// <path> are left for the editor.
export function mergePaths(svg) {
    for (const path of [...svg.querySelectorAll('path')]) {
        if (path.closest('defs, clipPath, mask')) continue
        const prev = path.previousElementSibling
        if (prev?.tagName !== 'path' || !sameAttrs(prev, path)) continue
        const d = absoluteStart(path.getAttribute('d') ?? '')
        if (d === null) continue
        prev.setAttribute('d', prev.getAttribute('d') + d)
        path.remove()
    }
}
