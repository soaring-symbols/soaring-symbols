// SVGO config for airline assets: npm run optimize -- assets/<slug>/*.svg
// runs it through scripts/lint/optimize.js, which tries three decimals first
// and four or five for the few shapes that move at three. Used on its own
// (svgo --config svgo.config.mjs), it writes three.
//
// Differs from SVGO's defaults so the output passes lint-svg and renders the same:
// - keeps role="img" (removeUnknownsAndDefaults drops it by default)
// - strips Inkscape/Sodipodi metadata even when the namespace is declared on the
//   element itself, which removeEditorsNSData misses
// - keeps paths separate, since mergePaths visibly shifts some logos
// - writes hex colors in full (#000000, not #000 or black), as lint-svg expects
// - orders attributes the way lint-svg expects (role, viewBox, xmlns, fill, d)
// - drops width/height, raster images, off-canvas paths, <style> and scripts
const EDITOR_NS = /inkscape\.org|sodipodi\.sourceforge\.net/
const EDITOR_PREFIX = /^(ns\d+|sodipodi|inkscape)$/

const removeEditorMetadata = {
    name: 'removeEditorMetadata',
    fn: () => ({
        element: {
            enter: (node, parent) => {
                if (/^(sodipodi|inkscape):/.test(node.name)) {
                    parent.children = parent.children.filter((c) => c !== node)

                    return
                }

                // Prefixes bound to editor namespaces on this element
                const prefixes = Object.entries(node.attributes)
                    .filter(
                        ([k, v]) => k.startsWith('xmlns:') && EDITOR_NS.test(v),
                    )
                    .map(([k]) => k.slice(6))

                for (const [name, value] of Object.entries(node.attributes)) {
                    const prefix = name.split(':')[0]
                    const isEditorNs =
                        name.startsWith('xmlns:') && EDITOR_NS.test(value)
                    const isEditorAttr =
                        name.includes(':') &&
                        !name.startsWith('xmlns:') &&
                        (prefixes.includes(prefix) ||
                            EDITOR_PREFIX.test(prefix))
                    if (isEditorNs || isEditorAttr) delete node.attributes[name]
                }
            },
        },
    }),
}

// Black is SVG's default fill, so removeUnknownsAndDefaults drops it when it
// is written as #000 or black (convertColors turns black into #000 first),
// and minifyStyles shortens #000000 inside style="…" before
// convertStyleToAttrs runs. A multi-color logo would then lose its black
// parts' fill. This runs before preset-default: it writes 3-digit hex and
// black as six-digit hex, which SVGO keeps, and moves color declarations out
// of style="…" into attributes. Other named colors become short hex in
// convertColors and are expanded here on the next multipass pass.
const COLOR_PROPS = [
    'fill',
    'stroke',
    'stop-color',
    'flood-color',
    'lighting-color',
    'color',
]

const expandColor = (value) => {
    const color = value.trim().toLowerCase()
    if (color === 'black') return '#000000'
    const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)

    return short
        ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
        : value
}

const expandColors = {
    name: 'expandColors',
    fn: () => ({
        element: {
            enter: (node) => {
                const { attributes } = node
                if (attributes.style) {
                    const kept = []
                    for (const decl of attributes.style.split(';')) {
                        const i = decl.indexOf(':')
                        const prop = decl.slice(0, i).trim().toLowerCase()
                        const value = decl.slice(i + 1).trim()
                        if (
                            i > 0 &&
                            COLOR_PROPS.includes(prop) &&
                            !/!important/i.test(value)
                        ) {
                            // style="…" outranks the attribute it replaces
                            attributes[prop] = value
                        } else if (decl.trim()) kept.push(decl.trim())
                    }
                    if (kept.length) attributes.style = kept.join(';')
                    else delete attributes.style
                }
                for (const prop of COLOR_PROPS) {
                    if (attributes[prop] != null)
                        attributes[prop] = expandColor(attributes[prop])
                }
            },
        },
    }),
}

export default {
    multipass: true,
    floatPrecision: 3,
    plugins: [
        removeEditorMetadata,
        expandColors,
        {
            name: 'preset-default',
            params: {
                overrides: {
                    removeUnknownsAndDefaults: { keepRoleAttr: true },
                    mergePaths: false,
                    convertColors: { shorthex: false, shortname: false },
                },
            },
        },
        'removeDimensions',
        'removeRasterImages',
        'removeOffCanvasPaths',
        'removeStyleElement',
        'removeScripts',
        // Inlined CSS becomes fill="…" attributes, which lint-svg reads
        'convertStyleToAttrs',
        {
            name: 'sortAttrs',
            params: {
                order: ['role', 'viewBox', 'xmlns', 'fill', 'd'],
                xmlnsOrder: 'alphabetical',
            },
        },
    ],
}
