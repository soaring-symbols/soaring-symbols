import {
    validateRequiredAttrs,
    validateTitleFirst,
    validateNoScripts,
    validateNoTransforms,
    validateNoNestedGroups,
    validateSinglePath,
    validateNoDimensions,
    validateNoEditorData,
    validateNumberFormat,
    validateNoProlog,
    validateAttrOrder,
    validateHexColors,
    validateFillPlacement,
    validateGeometry,
} from './scripts/lint/validators.js'

// The same checks as `scripts/lint-svg.js`, in the browser. `fileName` tells
// a -mono.svg apart (its fill is currentColor); `source`, the file's text,
// adds the checks that need it (nothing before <svg>, attribute order).
export function runSvgValidations(svg, type, bbox = null, options = {}) {
    const { fileName = '', source = null } = options
    const isMono = fileName.toLowerCase().endsWith('-mono.svg')
    const row = (group, label, result, level = 'error') => ({
        group,
        label,
        level,
        pass: result.pass,
        detail: result.detail,
    })

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
            'Single path',
            validateSinglePath(svg, isMono),
            'warning',
        ),
        row('Format', 'No width or height', validateNoDimensions(svg)),
        row('Format', 'No editor data', validateNoEditorData(svg)),
        row('Format', 'Number format', validateNumberFormat(svg)),
        ...(source === null
            ? []
            : [
                  row('Format', 'Starts with <svg>', validateNoProlog(source)),
                  row('Format', 'Attribute order', validateAttrOrder(source)),
              ]),
        row('Style', 'Hex colors', validateHexColors(svg)),
        row('Style', 'Fill placement', validateFillPlacement(svg, isMono)),
        ...validateGeometry(type, bbox).map((check) => ({
            group: 'Geometry',
            level: 'error',
            ...check,
        })),
    ]
}
