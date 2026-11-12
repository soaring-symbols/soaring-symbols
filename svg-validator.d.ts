export interface SvgValidation {
    /** Section the check belongs to. */
    group: 'Structure' | 'Format' | 'Style' | 'Geometry'
    label: string
    /** A failed `warning` is advice and doesn't fail the SVG, as `lint-svg.js --check` never fails on warnings. Geometry checks fail as a warning when close to exact but within their tolerance. */
    level: 'error' | 'warning'
    pass: boolean
    detail: string
    /** What `lint-svg.js --fix` (and `fixSvg` from `soaring-symbols/svg-fixer`) does about a failure: `true`, it fixes it, where its render check allows; the name of a `fixSvg` option, it does once that option is given (`'mergePaths'` for One path per color, `'fillColor'` for a color file with no color of its own); `false`, it is left for an editor (geometry, strokes that paint). */
    fixable: boolean | 'mergePaths' | 'fillColor'
}

export interface SvgValidationOptions {
    /** The monochrome version, held to `fill="currentColor"`. Defaults to whether `fileName` ends in `-mono.svg`. */
    mono?: boolean
    /** The file name, for the `mono` default. */
    fileName?: string
    /** The file's text: adds the check for anything before `<svg>`, and the attribute order is read from it rather than the parsed element. */
    source?: string | null
}

export function runSvgValidations(
    svg: SVGSVGElement,
    type: 'logo' | 'icon',
    bbox?: DOMRect | null,
    options?: SvgValidationOptions,
): SvgValidation[]
