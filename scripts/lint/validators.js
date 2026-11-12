// Pure DOM check functions — no Node.js dependencies, works in any environment.
// Each function returns { pass, detail } (and extra fields where needed).
// These are the single source of truth for both the CLI linter and the browser checker.

const r = (n) => Math.round(n * 1000) / 1000

// Top-level constants are inlined by the build like the functions; only
// functions may be exported (see scripts/build.js)
const HEX = /^#(?:[0-9A-F]{3}){1,2}$/i
// A color as the repo writes it: six lowercase hex digits
const FULL_HEX = /^#[0-9a-f]{6}$/
// A fill painted with a gradient or pattern
const GRADIENT = /^url\(#[^)]+\)$/i
// Paint keywords that are not colors to check or move
const PAINT_KEYWORDS = /^(none|currentColor|transparent|inherit)$/i

// Whether a value is a color as the repo writes it (FULL_HEX)
export function isFullHex(value) {
    return FULL_HEX.test(value ?? '')
}

// Whether a file is a monochrome variant, drawn in currentColor
export function isMonoFile(name) {
    return name.toLowerCase().endsWith('-mono.svg')
}

// Check: <title> exists and has non-empty text content
export function validateTitle(svg) {
    const title = svg.querySelector('title')
    const pass = !!title && !!title.textContent?.trim()

    return { pass, detail: title?.textContent?.trim() ?? 'missing' }
}

// Check: viewBox value matches the expected size for the file type
export function validateViewBox(svg, type) {
    const expected = type === 'icon' ? '0 0 24 24' : '0 0 64 64'
    const viewBox = svg.getAttribute('viewBox')

    return {
        pass: viewBox === expected,
        detail: viewBox ?? 'missing',
        expected,
    }
}

// Check: required attributes — viewBox value, role="img", xmlns, and <title>.
// Returns a compound result suitable for the checker's "Required attributes" row.
export function validateRequiredAttrs(svg, type) {
    const vb = validateViewBox(svg, type)
    const title = validateTitle(svg)
    const role = svg.getAttribute('role')
    const xmlns = svg.getAttribute('xmlns')

    const items = [
        { label: 'viewBox', pass: vb.pass, detail: vb.detail },
        {
            label: 'role="img"',
            pass: role === 'img',
            detail: role ?? 'missing',
        },
        {
            label: 'xmlns',
            pass: xmlns === 'http://www.w3.org/2000/svg',
            detail: xmlns ?? 'missing',
        },
        { label: '<title>', pass: title.pass, detail: title.detail },
    ]
    const pass = items.every((c) => c.pass)
    const detail = pass
        ? 'all present'
        : items
              .filter((c) => !c.pass)
              .map((c) => `${c.label}: ${c.detail}`)
              .join(' · ')

    return { pass, detail }
}

// Check: no embedded <script> elements
export function validateNoScripts(svg) {
    const count = svg.querySelectorAll('script').length

    return {
        pass: count === 0,
        detail: count === 0 ? 'clean' : 'script element found',
    }
}

// Check: no [transform] attributes on any element
export function validateNoTransforms(svg) {
    const els = Array.from(svg.querySelectorAll('[transform]'))
    const pass = els.length === 0
    const detail = pass
        ? 'clean'
        : els
              .map(
                  (el) =>
                      `<${el.tagName.toLowerCase()} transform="${el.getAttribute('transform')}">`,
              )
              .join(', ')

    return { pass, detail }
}

// Check: no <g> inside another <g> (a single level is fine for shared attributes)
export function validateNoNestedGroups(svg) {
    const nested = svg.querySelectorAll('g g').length
    const pass = nested === 0

    return {
        pass,
        detail: pass ? 'clean' : `${nested} nested <g> found`,
    }
}

// Check: geometry - fills viewBox, fits within it, and is centered.
// Requires a pre-computed bbox (e.g. from getBBox() in the browser).
// Returns an array of SvgValidation-shaped objects (1 or 3 items). Each check
// has three outcomes: exact (within 0.01 of a viewBox unit) passes; off by
// more but within its tolerance fails as a `warning`, which doesn't fail the
// SVG but asks for a look; beyond the tolerance fails as an `error`.
export function validateGeometry(type, bbox) {
    if (!bbox) return []

    const exact = 0.01
    const size = type === 'logo' ? 64 : 24
    const half = size / 2
    const row = (label, offset, tolerance, okDetail, offDetail) => {
        if (offset <= exact)
            return { label, pass: true, level: 'error', detail: okDetail }

        return {
            label,
            pass: false,
            // 1e-9 absorbs float error: 24 - 23.976 is 0.024000000000001
            level: offset <= tolerance + 1e-9 ? 'warning' : 'error',
            detail: offDetail,
        }
    }
    const dims = `${r(bbox.width)} × ${r(bbox.height)}`
    const extent = `extends to (${r(bbox.x)}, ${r(bbox.y)}) → (${r(bbox.x + bbox.width)}, ${r(bbox.y + bbox.height)})`
    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2
    const center = `center (${r(cx)}, ${r(cy)})`

    // The larger side should equal the viewBox size; up to 0.1% short passes
    const short = size - Math.max(bbox.width, bbox.height)
    const fills = row(
        'Fills viewBox',
        Math.max(short, 0),
        size * 0.001,
        dims,
        `${dims}, ${r(short)} short of ${size} in the largest dimension`,
    )
    // Too small to judge the rest: they fail with it
    if (fills.level === 'error' && !fills.pass) {
        return [
            fills,
            {
                label: 'Fits viewBox',
                pass: false,
                level: 'error',
                detail: extent,
            },
            {
                label: 'Centered',
                pass: false,
                level: 'error',
                detail: `${center}, expected (${half}, ${half})`,
            },
        ]
    }

    // How far the artwork reaches past the viewBox's edges
    const overflow = Math.max(
        -bbox.x,
        -bbox.y,
        bbox.x + bbox.width - size,
        bbox.y + bbox.height - size,
        0,
    )
    const offCenter = Math.max(Math.abs(cx - half), Math.abs(cy - half))

    return [
        fills,
        row(
            'Fits viewBox',
            overflow,
            0.5,
            `${dims} at (${r(bbox.x)}, ${r(bbox.y)})`,
            `${extent}, ${r(overflow)} past the edge`,
        ),
        row(
            'Centered',
            offCenter,
            size * 0.05,
            center,
            `${center}, ${r(offCenter)} off (${half}, ${half})`,
        ),
    ]
}

// Check: <title> is the first element inside <svg>, so screen readers and
// the catalog read it before anything else
export function validateTitleFirst(svg) {
    const title = svg.querySelector('title')
    const first = svg.firstElementChild
    const pass = !!title && first === title

    return {
        pass,
        detail: pass
            ? 'first child'
            : title
              ? `<${first.tagName.toLowerCase()}> comes before <title>`
              : 'missing',
    }
}

// Check: no width or height on the root <svg>; the viewBox sets the size, so
// the marks scale to whatever box they are placed in
export function validateNoDimensions(svg) {
    const attrs = ['width', 'height'].filter((a) => svg.hasAttribute(a))

    return {
        pass: attrs.length === 0,
        detail: attrs.length
            ? attrs.map((a) => `${a}="${svg.getAttribute(a)}"`).join(' ')
            : 'clean',
        attrs,
    }
}

// Check: no comments, <metadata> or design-tool namespaces and attributes
// (Inkscape, Sketch, Illustrator…) inside <svg>
export function validateNoEditorData(svg) {
    const editorPrefix = /^(inkscape|sodipodi|sketch|serif|i|x|graph|a):/
    const editorNs = /^xmlns:(?!xlink$)/
    const walker = svg.ownerDocument.createTreeWalker(svg, 128) // comments
    const comments = []
    while (walker.nextNode()) comments.push(walker.currentNode)

    const leftovers = new Set()
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
        if (
            el.tagName.toLowerCase() === 'metadata' ||
            editorPrefix.test(el.tagName)
        ) {
            leftovers.add(`<${el.tagName}>`)
        }
        for (const { name } of el.attributes) {
            if (editorPrefix.test(name) || editorNs.test(name)) {
                leftovers.add(name)
            }
        }
    }
    const list = [...leftovers]
    const found = comments.length ? ['comments', ...list] : list

    return {
        pass: found.length === 0,
        detail: found.length ? found.join(', ') : 'clean',
        comments,
        leftovers: list,
    }
}

// Check: path data is written the way SVGO writes it: at most five decimals,
// no negative zero and no leading zero (".5", not "0.5"). `paths` lists what
// each <path> breaks, with `trimmed` the d without leading zeros.
export function validateNumberFormat(svg) {
    const maxDecimals = 5
    const paths = []
    for (const el of svg.querySelectorAll('path[d]')) {
        const d = el.getAttribute('d')
        const long = d.match(new RegExp(`\\.\\d{${maxDecimals + 1},}`))
        const negativeZero = /-0(?![\d.])/.test(d)
        // "0.5" -> ".5" and "-0.5" -> "-.5": the same numbers, written shorter
        const trimmed = d.replace(/(?<![\d.])0\.(?=\d)/g, '.')
        if (long || negativeZero || trimmed !== d) {
            paths.push({
                el,
                long: long?.[0] ?? null,
                negativeZero,
                trimmed: trimmed !== d ? trimmed : null,
            })
        }
    }
    const problems = [
        paths.some((p) => p.long) &&
            `more than ${maxDecimals} decimals ("${paths.find((p) => p.long).long}")`,
        paths.some((p) => p.negativeZero) && 'negative zero',
        paths.some((p) => p.trimmed) && 'leading zeros ("0.5" → ".5")',
    ].filter(Boolean)

    return {
        pass: paths.length === 0,
        detail: problems.length ? problems.join(' · ') : 'clean',
        maxDecimals,
        paths,
    }
}

// The six-digit lowercase form of a hex color: #F60 -> #ff6600
export function toFullHex(hex) {
    return (
        hex.length === 4
            ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
            : hex
    ).toLowerCase()
}

// Check: colors in fill, stroke and stop-color are six-digit lowercase hex.
// `invalid` holds values that aren't hex at all (color names, rgb()), `short`
// hex that only needs rewriting.
export function validateHexColors(svg) {
    const invalid = []
    const short = []
    for (const attr of ['fill', 'stroke', 'stop-color']) {
        const els = [svg, ...svg.querySelectorAll(`[${attr}]`)]
        for (const el of els.filter((e) => e.hasAttribute(attr))) {
            const value = el.getAttribute(attr).trim()
            if (PAINT_KEYWORDS.test(value) || /^url\(.*\)$/.test(value))
                continue
            if (!HEX.test(value)) {
                invalid.push({ el, attr, value })
                continue
            }
            const full = toFullHex(value)
            if (value !== full) short.push({ el, attr, value, full })
        }
    }
    const problems = [
        ...invalid.map((c) => `${c.attr}="${c.value}" is not hex`),
        ...short.map((c) => `"${c.value}" should be "${c.full}"`),
    ]

    return {
        pass: problems.length === 0,
        detail: problems.length ? problems.join(' · ') : 'clean',
        invalid,
        short,
    }
}

// Check: no <style> elements and no style attributes: every paint and
// property is a presentation attribute (fill="…"), the one form the color,
// fill and stroke checks and the catalog read. `styled` lists each element's
// declarations as [name, value] pairs, which --fix turns into attributes.
export function validateNoStyles(svg) {
    const styleElements = [...svg.querySelectorAll('style')]
    const styled = [svg, ...svg.querySelectorAll('[style]')]
        .filter((el) => el.hasAttribute('style'))
        .map((el) => ({
            el,
            decls: el
                .getAttribute('style')
                .split(';')
                .map((decl) => decl.split(':'))
                .filter(([name, ...value]) => name.trim() && value.length)
                .map(([name, ...value]) => [
                    name.trim().toLowerCase(),
                    value
                        .join(':')
                        .replace(/!important/i, '')
                        .trim(),
                ]),
        }))
    const problems = [
        styleElements.length && `${styleElements.length} <style> element(s)`,
        ...styled.map(
            ({ el }) =>
                `<${el.tagName.toLowerCase()} style="${el.getAttribute('style')}">`,
        ),
    ].filter(Boolean)

    return {
        pass: problems.length === 0,
        detail: problems.length ? problems.join(' · ') : 'clean',
        styleElements,
        styled,
    }
}

// Check: no stroke at all: every shape is a filled outline, so it scales
// with the artwork, takes one fill color (the derived -mono files recolor
// fills only) and has a bounding box that matches what is drawn. `found`
// lists the strokes that paint; `leftovers` the stroke attributes and style
// properties that paint nothing (stroke="none", a lone stroke-width), which
// can simply be removed.
export function validateNoStrokes(svg) {
    const isStroke = (name) => /^stroke(-|$)/i.test(name)
    const paints = (value) =>
        value !== '' && !/^(none|transparent)$/i.test(value.trim())
    const found = []
    const leftovers = []
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
        const attrs = [...el.attributes].map((a) => a.name).filter(isStroke)
        const props = (el.getAttribute('style') || '')
            .split(';')
            .map((decl) => decl.split(':'))
            .filter(([name]) => isStroke(name.trim()))
            .map(([name, ...value]) => [
                name.trim().toLowerCase(),
                value.join(':').trim(),
            ])
        if (!attrs.length && !props.length) continue
        const paint = el.hasAttribute('stroke')
            ? el.getAttribute('stroke').trim()
            : (props.find(([name]) => name === 'stroke')?.[1] ?? '')
        if (paints(paint)) found.push({ el, value: paint })
        else leftovers.push({ el, attrs, props: props.map(([name]) => name) })
    }
    const tag = (el) => `<${el.tagName.toLowerCase()}>`
    const problems = [
        ...found.map((s) => `${tag(s.el)} stroke="${s.value}"`),
        ...leftovers.map(
            (s) => `${tag(s.el)} unused ${[...s.attrs, ...s.props].join(', ')}`,
        ),
    ]

    return {
        pass: problems.length === 0,
        detail: problems.length ? problems.join(' · ') : 'clean',
        found,
        leftovers,
    }
}

// Check: a single-color SVG sets its fill once, on the root <svg>
// (currentColor for a -mono file), and none of its children has one; a
// multi-color SVG has no fill on the root. A gradient (url(#…)) counts as a
// color, so an SVG with one is multi-color unless it is its only fill, which
// is left where it is. Other non-hex fills are left alone (`skipped`):
// validateHexColors reports them.
// `rootFill` is the fill the root should have (null for none), `rootOk`
// whether it has it, `redundant` the children whose fill should go and
// `inheriting` the shapes of a multi-color SVG that are painted with the
// root's fill, which has to move onto them.
export function validateFillPlacement(svg, isMono = false) {
    // The root counts: a single-color SVG keeps its fill there
    const withFill = [svg, ...svg.querySelectorAll('[fill]')].filter((el) =>
        el.hasAttribute('fill'),
    )
    const fills = withFill.map((el) => el.getAttribute('fill').trim())
    const result = (pass, detail, rest) => ({
        pass,
        detail,
        skipped: false,
        rootFill: null,
        rootOk: true,
        redundant: [],
        inheriting: [],
        noColor: false,
        ...rest,
    })

    if (
        fills.some(
            (f) => !HEX.test(f) && !PAINT_KEYWORDS.test(f) && !GRADIENT.test(f),
        )
    ) {
        return result(true, 'skipped: non-hex fill', { skipped: true })
    }

    const colors = new Set(
        fills
            .filter((f) => HEX.test(f) || GRADIENT.test(f))
            .map((f) => f.toLowerCase()),
    )
    const existing = svg.getAttribute('fill')

    if (colors.size > 1) {
        const rootOk = existing === null
        const ownFill = (el) => {
            for (let node = el; node && node !== svg; node = node.parentElement)
                if (node.hasAttribute('fill')) return true

            return false
        }
        const inheriting = rootOk
            ? []
            : [
                  ...svg.querySelectorAll(
                      'path, circle, rect, ellipse, polygon, polyline, line',
                  ),
              ].filter(
                  (el) => !el.closest('defs, clipPath, mask') && !ownFill(el),
              )

        return result(
            rootOk,
            rootOk
                ? `${colors.size} colors, no root fill`
                : 'root <svg> should have no fill in a multi-color SVG',
            { rootOk, inheriting },
        )
    }

    if (GRADIENT.test([...colors][0] ?? '')) {
        return result(true, 'one gradient fill', {})
    }

    // A color file without a color of its own (drawn in currentColor, or
    // in nothing but the default black) is a mono file under the wrong name,
    // or lost its brand color: neither can be fixed without knowing which
    if (!isMono && colors.size === 0) {
        return result(
            false,
            'no color of its own: draw it in its hex color, or name it -mono.svg if it is the monochrome version',
            { noColor: true },
        )
    }

    const rootFill = isMono ? 'currentColor' : [...colors][0]
    // Exactly as written in the repo: lowercase hex, `currentColor` in camel
    // case. Any other spelling (#C30B12, currentcolor) is rewritten by --fix.
    const rootOk = existing === rootFill
    const redundant = withFill.filter((el) => el !== svg)
    const problems = [
        !rootOk && `root <svg> should have fill="${rootFill}"`,
        redundant.length &&
            `remove fill from ${redundant.length} child element${redundant.length > 1 ? 's' : ''}`,
    ].filter(Boolean)

    return result(
        problems.length === 0,
        problems.length ? problems.join(' · ') : `fill="${rootFill}"`,
        { rootFill, rootOk, redundant },
    )
}

// Check (warning): each color is drawn in one <path>. A shape painted like
// the shape right before it, in the same parent, could be merged into it; in
// a single-color SVG (and every -mono file) that means one shape in all.
// Only neighbours count: merging past a shape of another color would change
// which one is drawn on top. `count` is the number of shapes, `merges` how
// many of them could join the one before.
export function validateOnePathPerColor(svg) {
    const inherited = ['fill', 'fill-rule', 'fill-opacity']
    const own = ['opacity', 'clip-path', 'mask', 'filter']
    const resolve = (el, attr) => {
        for (let node = el; node; node = node.parentElement) {
            if (node.hasAttribute(attr)) {
                return node.getAttribute(attr).trim().toLowerCase()
            }
            if (node === svg) break
        }

        return ''
    }
    const paint = (el) =>
        [
            ...inherited.map((attr) => resolve(el, attr)),
            ...own.map((attr) => el.getAttribute(attr) ?? ''),
        ].join('|')
    const shapes = [
        ...svg.querySelectorAll(
            'path, circle, rect, ellipse, polygon, polyline, line',
        ),
    ].filter((el) => !el.closest('defs, clipPath, mask'))
    const merges = shapes.filter(
        (el, i) =>
            i > 0 &&
            el.parentElement === shapes[i - 1].parentElement &&
            paint(el) === paint(shapes[i - 1]),
    ).length
    const colors = new Set(shapes.map(paint)).size
    const count = shapes.length

    return {
        pass: merges === 0,
        detail:
            merges === 0
                ? `${count} shape${count === 1 ? '' : 's'}, ${colors} color${colors === 1 ? '' : 's'}`
                : colors === 1
                  ? `${count} shapes in one color`
                  : `${merges} of ${count} shapes share a color with the one before`,
        count,
        merges,
        colors,
    }
}

// The file with anything before <svg> (XML declaration, DOCTYPE, comment)
// removed
export function stripProlog(source) {
    const start = source.indexOf('<svg')

    return start > 0 ? source.slice(start) : source
}

// The file with fill before d on every <path>
export function orderPathAttrs(source) {
    return source.replace(
        /<path([^>]*?) (d="[^"]*?")([^>]*?) (fill="[^"]*?")/g,
        (match, before, dAttr, after, fillAttr) =>
            `<path${before} ${fillAttr} ${dAttr}${after}`,
    )
}

// The file with the root <svg> attributes ordered role, viewBox, xmlns, fill,
// then the rest
export function orderSvgAttrs(source) {
    const first = ['role', 'viewBox', 'xmlns', 'fill']
    const svgTag = source.match(/<svg([^>]*)>/)
    if (!svgTag) return source

    const attributes = {}
    const attrRegex = /([a-zA-Z0-9:-]+)="([^"]*)"/g
    let match
    while ((match = attrRegex.exec(svgTag[1])) !== null) {
        attributes[match[1]] = match[2]
    }
    const ordered = [
        ...first.filter((k) => k in attributes),
        ...Object.keys(attributes).filter((k) => !first.includes(k)),
    ]
        .map((k) => `${k}="${attributes[k]}"`)
        .join(' ')
    if (ordered.replace(/\s+/g, '') === svgTag[1].trim().replace(/\s+/g, '')) {
        return source
    }

    return source.replace(svgTag[0], `<svg ${ordered}>`)
}

// Check: the file starts with <svg>, with nothing before it
export function validateNoProlog(source) {
    const pass = stripProlog(source) === source

    return {
        pass,
        detail: pass ? 'clean' : 'content before <svg>',
    }
}

// Check: root <svg> attributes come as role, viewBox, xmlns, fill, then the
// rest, and fill comes before d on <path>
export function validateAttrOrder(source) {
    const svgOk = orderSvgAttrs(source) === source
    const pathOk = orderPathAttrs(source) === source
    const problems = [
        !svgOk && 'root <svg>: role, viewBox, xmlns, fill first',
        !pathOk && '<path>: fill before d',
    ].filter(Boolean)

    return {
        pass: problems.length === 0,
        detail: problems.length ? problems.join(' · ') : 'clean',
    }
}
