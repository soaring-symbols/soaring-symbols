import { Resvg } from '@resvg/resvg-js'

// Size the SVGs are compared at, large enough that a hole or a lost shape
// covers many pixels
const SIZE = 256
// Largest channel difference (0-255) a pixel may show and still look the
// same. Drawing two touching or overlapping shapes apart instead of as one
// path changes an antialiased edge pixel by at most a quarter of its alpha
// (the seam between them), so 96 lets seams go and catches holes.
const TOLERANCE = 96

// No SVG uses <text>, and loading system fonts is the slow part
const FONT = { loadSystemFonts: false }

const render = (svgString) =>
    new Resvg(svgString, {
        fitTo: { mode: 'width', value: SIZE },
        font: FONT,
    }).render().pixels

// The artwork's bounding box in viewBox units ({ x, y, width, height }), as
// the browser's getBBox() gives it (both leave strokes out); undefined for an
// SVG that draws nothing. jsdom has no layout, so resvg measures it.
export function measureBBox(svgString) {
    return new Resvg(svgString, { font: FONT }).getBBox()
}

// Whether two SVGs render the same, apart from antialiasing along the edges
// shapes share. The --fix steps that rewrite shapes or groups check their
// result with it and keep the original when it doesn't.
export function rendersAlike(before, after) {
    const a = render(before)
    const b = render(after)
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) > TOLERANCE) return false
    }

    return true
}
