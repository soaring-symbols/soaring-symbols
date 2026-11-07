// Pure DOM check functions — no Node.js dependencies, works in any environment.
// Each function returns { pass, detail } (and extra fields where needed).
// These are the single source of truth for both the CLI linter and the browser checker.

const r = (n) => Math.round(n * 1000) / 1000

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
