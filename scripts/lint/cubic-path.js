// FIXME: remove once @resvg/resvg-js (and @resvg/resvg-wasm) measure a
// quadratic curve's bounds right. Tracked in
// https://github.com/thx/resvg-js/issues/282, which waits for resvg-js to
// take the upstream fix (https://github.com/linebender/resvg/issues/687).
// To check after an upgrade: make measureBBox (render.js) pass the SVG
// as it is, and if npm test's "measures quadratic curves as the browser
// does" still passes, delete this file.
//
// resvg-js 2.6.2 measures a quadratic Bézier's bounding box wrong:
// Aerolíneas Argentinas' icon reaches 24.000 in the browser's getBBox() but
// 24.0075 in resvg's, while the same curve written as a cubic measures
// 24.000 in both. So measureBBox hands resvg its paths with every quadratic
// segment (Q, T) written as the cubic that draws the same curve. Only the
// measurement uses it; the SVG itself is never rewritten.

// How many numbers each command takes
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
const COMMAND = /^[\s,]*([MmZzLlHhVvCcSsQqTtAa])/
const NUMBER = /^[\s,]*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/
// An arc's two flags may be written without a separator (a1 1 0 01.5.5)
const FLAG = /^[\s,]*([01])/

// Splits path data into [command, ...numbers] segments, one per command, with
// the implicit repeats (M 0 0 1 1 is M 0 0 L 1 1) made explicit. Returns
// null for data it can't read, so the caller measures it as it is.
function parsePath(d) {
    const segments = []
    let rest = d
    let command = null
    while (rest.trim()) {
        const named = COMMAND.exec(rest)
        if (named) {
            command = named[1]
            rest = rest.slice(named[0].length)
            if (/z/i.test(command)) {
                segments.push([command])
                command = null
                continue
            }
        }
        if (!command) return null
        const args = []
        for (let i = 0; i < ARGS[command.toLowerCase()]; i++) {
            const arcFlag = /a/i.test(command) && (i === 3 || i === 4)
            const match = (arcFlag ? FLAG : NUMBER).exec(rest)
            if (!match) return null
            args.push(Number(match[1]))
            rest = rest.slice(match[0].length)
        }
        segments.push([command, ...args])
        // Pairs after a moveto are linetos
        if (command === 'M') command = 'L'
        else if (command === 'm') command = 'l'
    }

    return segments
}

// The same path in absolute commands, with Q and T (and S, whose reflected
// control point depends on the segment before it) as C
export function toCubicPath(d) {
    const segments = parsePath(d)
    if (!segments) return d
    const out = []
    let x = 0
    let y = 0
    let startX = 0
    let startY = 0
    // The last segment's control points, for S and T to reflect
    let cubic = null
    let quad = null
    const cubicFromQuad = (qx, qy, ex, ey) => [
        'C',
        x + (2 / 3) * (qx - x),
        y + (2 / 3) * (qy - y),
        ex + (2 / 3) * (qx - ex),
        ey + (2 / 3) * (qy - ey),
        ex,
        ey,
    ]

    for (const [command, ...a] of segments) {
        const relative = command === command.toLowerCase()
        const dx = relative ? x : 0
        const dy = relative ? y : 0
        let nextCubic = null
        let nextQuad = null
        switch (command.toLowerCase()) {
            case 'm':
                x = a[0] + dx
                y = a[1] + dy
                startX = x
                startY = y
                out.push(['M', x, y])
                break
            case 'l':
                x = a[0] + dx
                y = a[1] + dy
                out.push(['L', x, y])
                break
            case 'h':
                x = a[0] + dx
                out.push(['L', x, y])
                break
            case 'v':
                y = a[0] + dy
                out.push(['L', x, y])
                break
            case 'c':
                nextCubic = [a[2] + dx, a[3] + dy]
                out.push(['C', a[0] + dx, a[1] + dy, ...nextCubic])
                x = a[4] + dx
                y = a[5] + dy
                out.at(-1).push(x, y)
                break
            case 's': {
                const [c1x, c1y] = cubic
                    ? [2 * x - cubic[0], 2 * y - cubic[1]]
                    : [x, y]
                nextCubic = [a[0] + dx, a[1] + dy]
                out.push(['C', c1x, c1y, ...nextCubic])
                x = a[2] + dx
                y = a[3] + dy
                out.at(-1).push(x, y)
                break
            }
            case 'q':
            case 't': {
                const [qx, qy] =
                    command.toLowerCase() === 'q'
                        ? [a[0] + dx, a[1] + dy]
                        : quad
                          ? [2 * x - quad[0], 2 * y - quad[1]]
                          : [x, y]
                const end = command.toLowerCase() === 'q' ? a.slice(2) : a
                const ex = end[0] + dx
                const ey = end[1] + dy
                out.push(cubicFromQuad(qx, qy, ex, ey))
                nextQuad = [qx, qy]
                x = ex
                y = ey
                break
            }
            case 'a':
                x = a[5] + dx
                y = a[6] + dy
                out.push(['A', ...a.slice(0, 5), x, y])
                break
            case 'z':
                x = startX
                y = startY
                out.push(['Z'])
                break
        }
        cubic = nextCubic
        quad = nextQuad
    }

    return out.map(([command, ...a]) => command + a.join(' ')).join('')
}

// The SVG with every path that has a quadratic segment written in cubics
export const withCubicPaths = (svg) =>
    svg.replace(
        /(\sd=")([^"]*[QqTt][^"]*)"/g,
        (_, attr, d) => `${attr}${toCubicPath(d)}"`,
    )
