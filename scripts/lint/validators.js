// Pure DOM check functions — no Node.js dependencies, works in any environment.
// Each function returns { pass, detail } (and extra fields where needed).
// These are the single source of truth for both the CLI linter and the browser checker.

const r = (n) => Math.round(n * 1000) / 1000

// Top-level constants are inlined by the build like the functions; only
// functions may be exported (see scripts/build.js)
const HEX = /^#(?:[0-9A-F]{3}){1,2}$/i
// Paint keywords that are not colors to check or move
const PAINT_KEYWORDS = /^(none|currentColor|transparent|inherit)$/i

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

// Check: geometry — fills viewBox, fits within it, and is centered.
// Requires a pre-computed bbox (e.g. from getBBox() in the browser).
// Returns an array of SvgValidation-shaped objects (may be 1–3 items).
export function validateGeometry(type, bbox) {
    if (!bbox) return []

    const size = type === 'logo' ? 64 : 24
    const maxDim = Math.max(bbox.width, bbox.height)
    const fills = maxDim / size >= 0.999

    const results = [
        {
            label: 'Fills viewBox',
            pass: fills,
            detail: fills
                ? `${r(bbox.width)} × ${r(bbox.height)}`
                : `${r(bbox.width)} × ${r(bbox.height)}, need ${size}px in largest dimension`,
        },
    ]

    if (!fills) {
        results.push(
            {
                label: 'Fits viewBox',
                pass: false,
                detail: `extends to (${r(bbox.x)}, ${r(bbox.y)}) → (${r(bbox.x + bbox.width)}, ${r(bbox.y + bbox.height)})`,
            },
            {
                label: 'Centered',
                pass: false,
                detail: `center (${r(bbox.x + bbox.width / 2)}, ${r(bbox.y + bbox.height / 2)}), expected (${size / 2}, ${size / 2})`,
            },
        )
    } else {
        const tolerance = 0.5
        const fits =
            bbox.x >= -tolerance &&
            bbox.y >= -tolerance &&
            bbox.x + bbox.width <= size + tolerance &&
            bbox.y + bbox.height <= size + tolerance

        results.push({
            label: 'Fits viewBox',
            pass: fits,
            detail: fits
                ? `${r(bbox.width)} × ${r(bbox.height)} at (${r(bbox.x)}, ${r(bbox.y)})`
                : `extends to (${r(bbox.x)}, ${r(bbox.y)}) → (${r(bbox.x + bbox.width)}, ${r(bbox.y + bbox.height)})`,
        })

        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height / 2
        const maxOffset = size * 0.05
        const isCentered =
            Math.abs(cx - size / 2) <= maxOffset &&
            Math.abs(cy - size / 2) <= maxOffset

        results.push({
            label: 'Centered',
            pass: isCentered,
            detail: isCentered
                ? `center (${r(cx)}, ${r(cy)})`
                : `center (${r(cx)}, ${r(cy)}), expected (${size / 2}, ${size / 2})`,
        })
    }

    return results
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

// Check: a single-color SVG sets its fill once, on the root <svg>
// (currentColor for a -mono file), and none of its children has one; a
// multi-color SVG has no fill on the root. Gradients and non-hex fills are
// left alone (`skipped`): validateHexColors reports the latter.
// `rootFill` is the fill the root should have (null for none), `rootOk`
// whether it has it, and `redundant` the children whose fill should go.
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
        ...rest,
    })

    if (fills.some((f) => !HEX.test(f) && !PAINT_KEYWORDS.test(f))) {
        return result(true, 'skipped: gradient or non-hex fill', {
            skipped: true,
        })
    }

    const colors = new Set(
        fills.filter((f) => HEX.test(f)).map((f) => f.toLowerCase()),
    )
    const existing = svg.getAttribute('fill')

    if (colors.size > 1) {
        const rootOk = existing === null

        return result(
            rootOk,
            rootOk
                ? `${colors.size} colors, no root fill`
                : 'root <svg> should have no fill in a multi-color SVG',
            { rootOk },
        )
    }

    const rootFill = isMono ? 'currentColor' : [...colors][0] || 'currentColor'
    const rootOk = isMono
        ? existing === rootFill
        : existing?.toLowerCase() === rootFill
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

// Check (warning): a single-color SVG draws everything in one <path>
export function validateSinglePath(svg, isMono = false) {
    const hexFill = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi
    const markup = svg.outerHTML
    const usesPaint = /url\(#|stroke=|stroke:|<(clipPath|mask)\b/i.test(markup)
    const fills = new Set(
        [...svg.querySelectorAll('[fill], [style]')].flatMap((el) =>
            (
                `${el.getAttribute('fill') || ''} ${el.getAttribute('style') || ''}`.match(
                    hexFill,
                ) || []
            ).map((c) => c.toLowerCase()),
        ),
    )
    if (!isMono && (usesPaint || fills.size > 1)) {
        return { pass: true, detail: 'multi-color', count: 0 }
    }

    const count = [
        ...svg.querySelectorAll(
            'path, circle, rect, ellipse, polygon, polyline, line',
        ),
    ].filter((el) => !el.closest('defs, clipPath, mask')).length

    return {
        pass: count <= 1,
        detail: count <= 1 ? 'one shape' : `${count} shapes`,
        count,
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
