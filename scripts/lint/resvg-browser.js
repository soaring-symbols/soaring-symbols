// What the browser build (svg-fixer.js) loads in place of @resvg/resvg-js,
// which is a native Node module: the same resvg version as WebAssembly, so
// the render checks decide as they do in lint-svg.js. Its wasm is loaded by
// initSvgFixer().
export { Resvg } from '@resvg/resvg-wasm'
