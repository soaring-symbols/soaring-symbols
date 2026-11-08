export interface SvgValidation {
    /** Section the check belongs to. */
    group: 'Structure' | 'Format' | 'Style' | 'Geometry'
    label: string
    /** A failed `warning` is advice and doesn't fail the SVG, as `lint-svg.js --check` never fails on warnings. Geometry checks fail as a warning when close to exact but within their tolerance. */
    level: 'error' | 'warning'
    pass: boolean
    detail: string
}

export interface SvgValidationOptions {
    /** The file name, so a `-mono.svg` is expected to use `fill="currentColor"`. */
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
