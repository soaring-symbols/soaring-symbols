import { initWasm } from '@resvg/resvg-wasm'
import { fixSvg as fixWith } from './scripts/lint/fix.js'

// `lint-svg.js --fix` in the browser, exported as `soaring-symbols/svg-fixer`
// for the website's validate page. The build bundles the lint rules and
// SVGO's browser build, and swaps @resvg/resvg-js for @resvg/resvg-wasm
// (a peer dependency), so a file is fixed as the CLI would fix it.

let ready

// Loads resvg's WebAssembly, which the render checks need, once. `wasm` is
// anything initWasm takes: a URL or Response for `index_bg.wasm`, its bytes,
// or a compiled WebAssembly.Module. Await it before calling fixSvg.
export function initSvgFixer(wasm) {
    ready ??= initWasm(wasm).catch((error) => {
        // resvg-wasm refuses a second init, e.g. when the page loaded it too
        if (!/already initialized/i.test(String(error?.message ?? error))) {
            ready = undefined
            throw error
        }
    })

    return ready
}

// Fixes one SVG's text as `lint-svg.js --fix` would; see scripts/lint/fix.js
// for the options and the result. `fileName` tells a -mono.svg apart, and
// `type` is 'logo' or 'icon' (tails are checked as icons).
export function fixSvg(source, options = {}) {
    const { type = 'logo', ...rest } = options
    const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml')

    return fixWith(source, { ...rest, isIcon: type !== 'logo', parse })
}
