import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { JSDOM } from 'jsdom'
import { toSlug } from '../utils/index.js'

import {
    ruleTitle,
    ruleViewBox,
    ruleRequiredAttrs,
    ruleNoTransforms,
    ruleSinglePath,
    ruleNoNestedGroups,
} from './lint/rule-structure.js'
import { ruleNoScripts } from './lint/rule-security.js'
import { ruleGeometry } from './lint/rule-geometry.js'
import {
    ruleHexColors,
    ruleFillPlacement,
    rulePathAttrOrder,
    ruleSvgAttrOrder,
} from './lint/rule-styling.js'

// --- CONFIGURATION ---
const ASSETS_DIR = 'assets'
const DRY_RUN = !process.argv.includes('--fix')
// Exit with 1 when any file has an issue (warnings never fail), for CI
const CHECK = process.argv.includes('--check')

const EXCLUDE_FILES = [
    'assets/british-airways/icon.svg',
    'assets/iberia/icon.svg',
    'assets/iberia/logo.svg',
    'assets/southwest-airlines/icon.svg',
]
// ---------------------

// DOM rules run against the parsed SVG element (may mutate DOM to fix issues).
// Each rule: (ctx) => void, pushing strings to ctx.issues
const DOM_RULES = [
    ruleTitle,
    ruleViewBox,
    ruleRequiredAttrs,
    ruleNoScripts,
    ruleNoTransforms,
    ruleSinglePath,
    ruleNoNestedGroups,
    ruleHexColors,
    ruleFillPlacement,
]

// String rules run against the serialized SVG string (regex-based fixes).
// Each rule: (svgString, ctx) => { content, changed, message? }
const STRING_RULES = [rulePathAttrOrder, ruleSvgAttrOrder]

// Airline names from the catalog, keyed by asset folder (slug)
const catalogNames = new Map(
    JSON.parse(readFileSync('airlines.json', 'utf8')).map((a) => [
        toSlug(a.name),
        a.name,
    ]),
)

// Folder names only approximate the airline name (e.g. "jet2com" for "Jet2.com"),
// so prefer the catalog and fall back to the folder for airlines not added yet
const getAirlineName = (filePath) => {
    const dirName = basename(dirname(filePath))
    if (catalogNames.has(dirName)) return catalogNames.get(dirName)

    return dirName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

const lintSvgFile = (filePath) => {
    const originalContent = readFileSync(filePath, 'utf8')
    const dom = new JSDOM(originalContent, { contentType: 'image/svg+xml' })
    const document = dom.window.document
    const svgElement = document.querySelector('svg')

    if (!svgElement) {
        return {
            issues: ['Invalid SVG: Missing <svg> element.'],
            errorCount: 1,
            fixedContent: null,
        }
    }

    const isIcon =
        basename(filePath).includes('icon') ||
        basename(filePath).includes('tail')

    const ctx = {
        filePath,
        svgElement,
        document,
        isIcon,
        airlineName: getAirlineName(filePath),
        isCatalogName: catalogNames.has(basename(dirname(filePath))),
        issues: [],
        // Reported only; never trigger a rewrite in --fix mode
        warnings: [],
    }

    // Phase 1: DOM rules
    for (const rule of DOM_RULES) rule(ctx)

    let fixedContent =
        ctx.issues.length > 0 ? svgElement.outerHTML : originalContent
    let hasStructuralFixes = ctx.issues.length > 0

    // Phase 2: String rules
    for (const rule of STRING_RULES) {
        const result = rule(fixedContent, ctx)
        if (result.changed) {
            if (!hasStructuralFixes && result.message)
                ctx.issues.push(result.message)
            fixedContent = result.content
            hasStructuralFixes = true
        }
    }

    // Phase 3: Geometry rules
    ruleGeometry(fixedContent, ctx)

    return {
        issues: [...ctx.issues, ...ctx.warnings],
        errorCount: ctx.issues.length,
        fixedContent: hasStructuralFixes ? fixedContent : null,
    }
}

const main = () => {
    console.log('===================================')
    console.log('=      SVG Linter & Fixer         =')
    console.log('===================================')
    console.log()

    if (DRY_RUN) {
        console.log('--- 🔬 DRY RUN MODE: No files will be changed. ---\n')
    }

    let filesChecked = 0
    let filesWithIssues = 0
    let filesFixed = 0
    let filesWithErrors = 0

    const airlineDirs = readdirSync(ASSETS_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)

    for (const dir of airlineDirs) {
        const airlinePath = join(ASSETS_DIR, dir)
        const issuesInDir = []
        let wasFixedInDir = false

        readdirSync(airlinePath)
            .filter((f) => f.endsWith('.svg'))
            .forEach((file) => {
                filesChecked++
                const fullPath = join(airlinePath, file)

                const relativePath = join(dir, file).replace(/\\/g, '/')
                if (EXCLUDE_FILES.includes(`assets/${relativePath}`)) {
                    console.log(`🟡 Skipping excluded file: ${relativePath}\n`)

                    return
                }

                const result = lintSvgFile(fullPath)

                if (result.errorCount > 0) filesWithErrors++

                if (result.issues.length > 0) {
                    filesWithIssues++
                    result.issues.forEach((issue) =>
                        issuesInDir.push(`${file}: ${issue}`),
                    )

                    if (!DRY_RUN && result.fixedContent) {
                        writeFileSync(fullPath, result.fixedContent)
                        wasFixedInDir = true
                        filesFixed++
                    }
                }
            })

        if (issuesInDir.length > 0) {
            console.log(`📁 Checking "${dir}"...`)
            console.log()
            issuesInDir.forEach((issue) => console.log(`  ${issue}`))
            console.log()
            if (wasFixedInDir) {
                console.log('  🔧 Issues fixed.')
                console.log()
            }
        }
    }

    console.log('--- ✨ Linter finished! ---')
    console.log(`Checked ${filesChecked} files.`)
    if (filesWithIssues > 0) {
        console.log(`Found issues in ${filesWithIssues} file(s).`)
        if (!DRY_RUN) console.log(`Fixed ${filesFixed} file(s).`)
    } else {
        console.log('✅ All files are compliant.')
    }

    if (CHECK && DRY_RUN && filesWithErrors > 0) {
        console.log(
            `\n❌ ${filesWithErrors} file(s) need fixing. Run \`node scripts/lint-svg.js --fix\` and commit the result.`,
        )
        process.exitCode = 1
    }
}

main()
