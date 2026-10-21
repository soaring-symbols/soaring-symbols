// SVGO config for airline assets: npm run optimize -- assets/<slug>/*.svg
//
// Differs from SVGO's defaults so the output passes lint-svg and renders the same:
// - keeps role="img" (removeUnknownsAndDefaults drops it by default)
// - strips Inkscape/Sodipodi metadata even when the namespace is declared on the
//   element itself, which removeEditorsNSData misses
// - keeps paths separate and 5 decimals, since mergePaths and the default
//   precision visibly shift some logos
// - keeps six-digit hex colors, because a shortened #000 equals SVG's default
//   fill and removeUnknownsAndDefaults would then drop black from multi-color logos
// - orders attributes the way lint-svg expects (role, viewBox, xmlns, fill, d)
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

export default {
    multipass: true,
    floatPrecision: 5,
    plugins: [
        removeEditorMetadata,
        {
            name: 'preset-default',
            params: {
                overrides: {
                    removeUnknownsAndDefaults: { keepRoleAttr: true },
                    mergePaths: false,
                    convertColors: { shorthex: false },
                },
            },
        },
        {
            name: 'sortAttrs',
            params: {
                order: ['role', 'viewBox', 'xmlns', 'fill', 'd'],
                xmlnsOrder: 'alphabetical',
            },
        },
    ],
}
