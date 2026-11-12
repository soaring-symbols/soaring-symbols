export interface SvgFixOptions {
    /** The file name, so a `-mono.svg` is expected to use `fill="currentColor"`. */
    fileName?: string
    /** `'logo'` (64×64) or `'icon'` (24×24, tails included). Defaults to `'logo'`. */
    type?: 'logo' | 'icon'
    /** The name `<title>` should hold. Defaults to the current title; needed when the file has none. */
    airlineName?: string
    /** `airlineName` comes from the catalog, so a different title is renamed to it. Otherwise a title is only moved, never renamed. */
    isCatalogName?: boolean
    /** Names an older mark may keep as its title (the airline's `previous_names`). */
    formerNames?: string[]
    /** Also join neighbouring paths of one color, as `lint-svg.js --fix --merge-paths` does. Experimental. */
    mergePaths?: boolean
}

export interface SvgFixResult {
    /** The fixed SVG, or the source unchanged when nothing was fixed. */
    content: string
    /** Whether `content` differs from the source. */
    fixed: boolean
    /** What was wrong, as `lint-svg.js` reports it: fixed where a rule could, the rest (such as geometry) left for an editor. */
    issues: string[]
    /** Advice that never fails `lint-svg.js --check`. */
    warnings: string[]
    /** The number of `issues`. */
    errorCount: number
}

/**
 * Loads resvg's WebAssembly, which the render checks need, once: anything `initWasm` from `@resvg/resvg-wasm` takes, such as a URL or `Response` for its `index_bg.wasm`. Await it before calling `fixSvg`.
 */
export function initSvgFixer(
    wasm: string | URL | Response | ArrayBuffer | WebAssembly.Module,
): Promise<void>

/** Fixes one SVG's text as `lint-svg.js --fix` would. Runs in the browser, after `initSvgFixer`. */
export function fixSvg(source: string, options?: SvgFixOptions): SvgFixResult
