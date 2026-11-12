import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative } from 'path'
import { JSDOM } from 'jsdom'
import { HISTORY_DIR, getAssetDirs, toSlug } from '../utils/index.js'
import { selectSvgs } from './lint/changed.js'
import { EXCLUDE_FILES } from './lint/exclude.js'
import { fixSvg } from './lint/fix.js'

// --- CONFIGURATION ---
const ASSETS_DIR = 'assets'
const DRY_RUN = !process.argv.includes('--fix')
// Exit with 1 when any file has an issue (warnings never fail), for CI
const CHECK = process.argv.includes('--check')
// Experimental: join the paths of single-color SVGs (see ruleOnePathPerColor)
const MERGE_PATHS = process.argv.includes('--merge-paths')
// Experimental: lint only the SVGs listed, or with --changed those added or
// changed since origin/main (or --base <ref>), so a pull request's own files
// can be fixed without touching or reporting the others. `--base <ref>` alone
// counts too (its ref is not a flag). With none of these, every SVG is linted,
// as CI does.
const ARGS = process.argv.slice(2)
const SCOPED =
    ARGS.includes('--changed') || ARGS.some((arg) => !arg.startsWith('--'))

// ---------------------

// Catalog entries, keyed by asset folder (slug)
const catalog = new Map(
    JSON.parse(readFileSync('airlines.json', 'utf8')).map((a) => [
        a.slug ?? toSlug(a.name),
        a,
    ]),
)

// The airline folder an SVG belongs to: assets/<slug>/logo.svg and
// assets/<slug>/history/<year>/logo.svg both give <slug>
const getSlugOf = (filePath) => relative(ASSETS_DIR, filePath).split(/[\\/]/)[0]

// Folder names only approximate the airline name (e.g. "jet2com" for "Jet2.com"),
// so prefer the catalog and fall back to the folder for airlines not added yet
const getAirlineName = (filePath) => {
    const dirName = getSlugOf(filePath)
    if (catalog.has(dirName)) return catalog.get(dirName).name

    return dirName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

const parse = (source) =>
    new JSDOM(source, { contentType: 'image/svg+xml' }).window.document

const lintSvgFile = (filePath) => {
    const [slug, folder] = relative(ASSETS_DIR, filePath).split(/[\\/]/)
    const airline = catalog.get(slug)
    const inHistory = folder === HISTORY_DIR
    const name = basename(filePath)
    const result = fixSvg(readFileSync(filePath, 'utf8'), {
        parse,
        fileName: filePath,
        type: ['icon', 'tail'].find((kind) => name.includes(kind)) ?? 'logo',
        airlineName: getAirlineName(filePath),
        isCatalogName: Boolean(airline),
        // Only an older mark (assets/<slug>/history/<year>/) may keep a
        // former name as its title
        formerNames: inHistory ? airline?.previous_names : undefined,
        mergePaths: MERGE_PATHS,
    })

    return {
        issues: [...result.issues, ...result.warnings],
        errorCount: result.errorCount,
        fixedContent: result.fixed ? result.content : null,
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

    const selection = SCOPED ? selectSvgs(ARGS) : null
    if (selection) {
        const from = selection.listed
            ? 'listed'
            : `changed since ${selection.base}`
        console.log(
            `--- 🧪 EXPERIMENTAL: only the ${selection.files.length} SVG(s) ${from}. CI still lints every SVG. ---\n`,
        )
    }

    // Files grouped by folder (<slug> or <slug>/history/<year>), in folder
    // order
    const byDir = new Map()
    const files = selection
        ? selection.files.filter((f) => f.startsWith(`${ASSETS_DIR}/`))
        : readdirSync(ASSETS_DIR, { withFileTypes: true })
              .filter((dirent) => dirent.isDirectory())
              .flatMap((dirent) => getAssetDirs(dirent.name, ASSETS_DIR))
              .flatMap((dir) =>
                  readdirSync(join(ASSETS_DIR, dir))
                      .filter((f) => f.endsWith('.svg'))
                      .map((f) => `${ASSETS_DIR}/${dir}/${f}`),
              )
    for (const file of files.sort()) {
        const dir = relative(ASSETS_DIR, dirname(file))
        if (!byDir.has(dir)) byDir.set(dir, [])
        byDir.get(dir).push(file)
    }

    for (const [dir, dirFiles] of byDir) {
        const issuesInDir = []
        let wasFixedInDir = false

        dirFiles.forEach((fullPath) => {
            filesChecked++
            const file = basename(fullPath)

            if (EXCLUDE_FILES.includes(fullPath)) {
                console.log(`🟡 Skipping excluded file: ${dir}/${file}\n`)

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

    if (selection) {
        console.log(
            '\n🧪 Only some SVGs were linted. Before opening a pull request, run `node scripts/lint-svg.js --check` on all of them (as CI does) or check your files on https://soaringsymbols.org/validate.',
        )
    }

    if (CHECK && DRY_RUN && filesWithErrors > 0) {
        console.log(
            `\n❌ ${filesWithErrors} file(s) need fixing. Run \`node scripts/lint-svg.js --fix\` and commit the result; geometry issues need a manual fix.`,
        )
        process.exitCode = 1
    }
}

main()
