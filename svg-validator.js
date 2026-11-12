import {
    isMonoFile,
    validateRequiredAttrs,
    validateTitleFirst,
    validateNoScripts,
    validateNoTransforms,
    validateNoNestedGroups,
    validateOnePathPerColor,
    validateNoDimensions,
    validateNoEditorData,
    validateNumberFormat,
    validateNoProlog,
    validateAttrOrder,
    validateHexColors,
    validateFillPlacement,
    validateNoStrokes,
    validateNoStyles,
    validateGeometry,
} from './scripts/lint/validators.js'

// The same checks as `scripts/lint-svg.js`, in the browser. `mono` holds the
// file to the monochrome rules (its fill is currentColor), and defaults to
// whether `fileName` ends in -mono.svg; `source`, the file's text,
// adds the check that needs it (nothing before <svg>) and is what the
// attribute order is read from, falling back to the parsed element as the
// CLI does.
export function runSvgValidations(svg, type, bbox = null, options = {}) {
    const {
        fileName = '',
        source = null,
        mono = isMonoFile(fileName),
    } = options
    const row = (group, label, result, level = 'error') => ({
        group,
        label,
        level,
        pass: result.pass,
        detail: result.detail,
    })
    const fill = validateFillPlacement(svg, mono)

    return [
        row(
            'Structure',
            'Required attributes',
            validateRequiredAttrs(svg, type),
        ),
        row('Structure', 'Title first', validateTitleFirst(svg)),
        row('Structure', 'No embedded scripts', validateNoScripts(svg)),
        row('Structure', 'No transforms', validateNoTransforms(svg)),
        row(
            'Structure',
            'No nested groups',
            validateNoNestedGroups(svg),
            'warning',
        ),
        row(
            'Structure',
            'One path per color',
            validateOnePathPerColor(svg),
            'warning',
        ),
        row('Format', 'No width or height', validateNoDimensions(svg)),
        row('Format', 'No editor data', validateNoEditorData(svg)),
        row('Format', 'Number format', validateNumberFormat(svg)),
        ...(source === null
            ? []
            : [row('Format', 'Starts with <svg>', validateNoProlog(source))]),
        row(
            'Format',
            'Attribute order',
            validateAttrOrder(source ?? svg.outerHTML),
        ),
        row('Style', 'No styles', validateNoStyles(svg)),
        row('Style', 'Hex colors', validateHexColors(svg)),
        // noColor: a color file with no color of its own, which a fill color
        // given to the fixer (fillColor) can fix
        { ...row('Style', 'Fill placement', fill), noColor: fill.noColor },
        row('Style', 'No strokes', validateNoStrokes(svg)),
        ...validateGeometry(type, bbox).map((check) => ({
            group: 'Geometry',
            level: 'error',
            ...check,
        })),
    ]
}
