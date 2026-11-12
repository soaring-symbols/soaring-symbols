export interface SvgValidation {
    /** Section the check belongs to. */
    group: 'Structure' | 'Format' | 'Style' | 'Geometry'
    label: string
    /** A failed `warning` is advice and doesn't fail the SVG, as `lint-svg.js --check` never fails on warnings. Geometry checks fail as a warning when close to exact but within their tolerance. */
    level: 'error' | 'warning'
    pass: boolean
    detail: string
    /** Fill placement only: a color file with no color of its own (drawn in `currentColor` or default black), which `fixSvg` fixes given a `fillColor`. */
    noColor?: boolean
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
