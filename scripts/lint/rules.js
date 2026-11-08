// The rules lint-svg.js runs, in order, and the browser check each one
// shares with runSvgValidations (svg-validator.js). scripts/test.js fails
// when a rule has no browser check or a browser check no rule, so a new
// rule must be listed here, in BROWSER_CHECKS too.

import {
    ruleTitle,
    ruleViewBox,
    ruleRequiredAttrs,
    ruleNoTransforms,
    ruleSinglePath,
    ruleNoNestedGroups,
} from './rule-structure.js'
import { ruleNoScripts } from './rule-security.js'
import {
    ruleNoDimensions,
    ruleNoEditorData,
    ruleNumberFormat,
    ruleNoProlog,
} from './rule-format.js'
import {
    ruleHexColors,
    ruleFillPlacement,
    ruleNoStrokes,
    rulePathAttrOrder,
    ruleSvgAttrOrder,
} from './rule-styling.js'

// DOM rules run against the parsed SVG element (may mutate DOM to fix issues).
// Each rule: (ctx) => void, pushing strings to ctx.issues
export const DOM_RULES = [
    ruleTitle,
    ruleViewBox,
    ruleRequiredAttrs,
    ruleNoScripts,
    ruleNoTransforms,
    ruleSinglePath,
    ruleNoNestedGroups,
    ruleHexColors,
    ruleFillPlacement,
    ruleNoStrokes,
    ruleNoDimensions,
    ruleNoEditorData,
    ruleNumberFormat,
]

// String rules run against the serialized SVG string (regex-based fixes).
// Each rule: (svgString, ctx) => { content, changed, message? }
export const STRING_RULES = [ruleNoProlog, rulePathAttrOrder, ruleSvgAttrOrder]

// Rule -> the labels of its browser checks, and `warning` for the rules that
// push to ctx.warnings (never fail --check)
export const BROWSER_CHECKS = new Map([
    [ruleTitle, { labels: ['Required attributes', 'Title first'] }],
    [ruleViewBox, { labels: ['Required attributes'] }],
    [ruleRequiredAttrs, { labels: ['Required attributes'] }],
    [ruleNoScripts, { labels: ['No embedded scripts'] }],
    [ruleNoTransforms, { labels: ['No transforms'] }],
    [ruleSinglePath, { labels: ['Single path'], warning: true }],
    [ruleNoNestedGroups, { labels: ['No nested groups'], warning: true }],
    [ruleHexColors, { labels: ['Hex colors'] }],
    [ruleFillPlacement, { labels: ['Fill placement'] }],
    [ruleNoStrokes, { labels: ['No strokes'] }],
    [ruleNoDimensions, { labels: ['No width or height'] }],
    [ruleNoEditorData, { labels: ['No editor data'] }],
    [ruleNumberFormat, { labels: ['Number format'] }],
    [ruleNoProlog, { labels: ['Starts with <svg>'] }],
    [rulePathAttrOrder, { labels: ['Attribute order'] }],
    [ruleSvgAttrOrder, { labels: ['Attribute order'] }],
])
