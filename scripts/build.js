import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { build as esbuild } from 'esbuild'
import {
    AIRLINES_DIR,
    ALLIANCES_DIR,
    assetTypes,
    borrowedMarksFolder,
    borrowedTypes,
    getAssetDirs,
    hasOwnMarks,
    markFile,
    writeDerivedDarks,
    writeDerivedMonos,
} from '../utils/index.js'
import { publishAlliances, publishCatalog } from '../utils/catalog.js'
import { validateAirlines, validateAlliances } from '../utils/schema.js'
import { findAirportProblems, normalizeAirports } from '../utils/airports.js'

const inputFile = './index.js'
const distDir = './dist'

// Helper to recursively copy a directory
async function copyDir(src, dest) {
    // Skip OS junk such as .DS_Store so it never reaches the package
    const entries = (await fs.readdir(src, { withFileTypes: true })).filter(
        (entry) => !entry.name.startsWith('.'),
    )
    // Empty folders (e.g. left behind locally; git can't track them) are not
    // copied either
    if (!entries.length) return
    await fs.mkdir(dest, { recursive: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath)
        } else {
            await fs.copyFile(srcPath, destPath)
        }
    }
}

// Copy required files and directories
async function copyFiles() {
    await fs.mkdir(distDir, { recursive: true })

    // The repo keeps only hand-written fields; the published catalog adds
    // the generated ones (utils/catalog.js). It ships minified: consumers (bundlers, jsDelivr)
    // only parse it
    const catalog = publishCatalog(
        JSON.parse(await fs.readFile('./airlines.json', 'utf-8')),
    )
    const problems = validateAirlines(catalog, { published: true })
    if (problems.length) {
        throw new Error(
            `airlines.json does not match airlines.schema.json:\n  - ${problems.join('\n  - ')}`,
        )
    }
    await fs.writeFile(
        path.join(distDir, 'airlines.json'),
        JSON.stringify(catalog),
    )

    // The alliances airlines name in `alliance`, with the `assets` of their
    // marks in alliances/<slug>/, minified like the airlines
    const alliances = publishAlliances(
        JSON.parse(await fs.readFile('./alliances.json', 'utf-8')),
    )
    const allianceProblems = validateAlliances(alliances, { published: true })
    if (allianceProblems.length) {
        throw new Error(
            `alliances.json does not match alliances.schema.json:\n  - ${allianceProblems.join('\n  - ')}`,
        )
    }
    await fs.writeFile(
        path.join(distDir, 'alliances.json'),
        JSON.stringify(alliances),
    )

    // Where each hub is, for maps and globes: minified like the catalog
    const airports = JSON.parse(await fs.readFile('./airports.json', 'utf-8'))
    const airportProblems = findAirportProblems(airports, catalog)
    if (airportProblems.length) {
        throw new Error(
            `airports.json is missing or has wrong coordinates:\n  - ${airportProblems.join('\n  - ')}`,
        )
    }
    await fs.writeFile(
        path.join(distDir, 'airports.json'),
        JSON.stringify(normalizeAirports(airports, catalog)),
    )

    const filesToCopy = [
        // The declarations have no default export, so the same file serves
        // both the import (.d.ts) and require (.d.cts) conditions
        { src: './index.d.ts', dest: 'index.d.ts' },
        { src: './index.d.ts', dest: 'index.d.cts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.ts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.cts' },
        { src: './svg-fixer.d.ts', dest: 'svg-fixer.d.ts' },
    ]

    const dirsToCopy = [
        { src: `./${AIRLINES_DIR}`, dest: AIRLINES_DIR },
        { src: `./${ALLIANCES_DIR}`, dest: ALLIANCES_DIR },
    ]

    // Copy individual files
    for (const file of filesToCopy) {
        await fs.copyFile(file.src, path.join(distDir, file.dest))
    }

    // Copy directories (alliances/ only once an alliance has SVGs)
    for (const dir of dirsToCopy.filter((d) => existsSync(d.src))) {
        await copyDir(dir.src, path.join(distDir, dir.dest))
    }

    // Every folder of marks, older marks included (an alliance without SVGs
    // yet has no folder, which finds nothing): single-color assets get their
    // -mono.svg here, not in the repo; then every asset without a hand-made
    // -dark.svg gets one, from its mono in white or its color file where
    // branding.dark_color keeps it (current marks only) or it has no mono
    // but reads on dark
    const sources = [
        {
            entries: catalog.filter(hasOwnMarks),
            root: AIRLINES_DIR,
        },
        { entries: alliances, root: ALLIANCES_DIR },
    ]
    for (const { entries, root } of sources) {
        const dest = path.join(distDir, root)
        for (const entry of entries) {
            const [current, ...older] = getAssetDirs(entry.slug, root)
            for (const dir of [current, ...older]) writeDerivedMonos(dir, dest)
            writeDerivedDarks(current, dest, entry.branding?.dark_color)
            for (const dir of older) writeDerivedDarks(dir, dest)
        }
    }
    // After the monos and darks, so airlines sharing marks get those too, and after
    // those, so an alias or former slug gets whatever its airline ships
    await copySharedMarks(catalog)
    await copyFormerSlugs(catalog)
}

const escapeXml = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Copy an airline's current files (never history/) from dist/airlines/<from>/,
// or those of one of its history/<year>/ folders when `from` names it,
// to dist/airlines/<to>/, titled with the airline's name: those of `types`
// (icon.svg, icon-mono.svg, icon-dark.svg), by default every type's
async function copyCurrentMarks(from, to, name, types = assetTypes) {
    const src = path.join(distDir, AIRLINES_DIR, from)
    const dest = path.join(distDir, AIRLINES_DIR, to)
    await fs.mkdir(dest, { recursive: true })
    const ofTypes = markFile(types)
    const files = (await fs.readdir(src, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && ofTypes.test(entry.name))
        .map((entry) => entry.name)
    for (const file of files) {
        const svg = await fs.readFile(path.join(src, file), 'utf-8')
        await fs.writeFile(
            path.join(dest, file),
            svg.replace(
                /<title>[^<]*<\/title>/,
                `<title>${escapeXml(name)}</title>`,
            ),
        )
    }
}

// Airlines with `marks` use another airline's SVGs: all of them, or only the
// types in `marks_types` beside their own. Copy those files to their own
// slug in dist (never in the repo), titled with their own name, so every
// airline's files live at airlines/<slug>/ like any other. Only the current
// marks are shared, never the history/ folder, except for a defunct airline
// that ceased before them, which gets the older ones it flew with
// (borrowedMarksFolder). They are copied from dist, so
// an airline that borrows from one that itself borrows some types
// (`marks_types`) is copied after it and gets those types too.
async function copySharedMarks(airlines) {
    const bySlug = new Map(airlines.map((a) => [a.slug, a]))
    const sharing = airlines.filter((a) => a.marks)
    const chained = (a) => Boolean(bySlug.get(a.marks)?.marks)
    for (const airline of [
        ...sharing.filter((a) => !chained(a)),
        ...sharing.filter(chained),
    ]) {
        await copyCurrentMarks(
            borrowedMarksFolder(airline, bySlug.get(airline.marks)),
            airline.slug,
            airline.name,
            borrowedTypes(airline),
        )
    }
}

// A renamed airline's slug follows its new name. Links to an old slug keep
// working: when a release shipped that slug (published-slugs.json), the
// airline's current files are also published there, as for the slug of an
// alias (SWISS, before the airline took its full name). A name that was
// never a slug in the package (Air Pacific for Fiji Airways) has no links to
// keep, so it gets no copy; getAirline() still finds it.
async function copyFormerSlugs(airlines) {
    const published = new Set(
        JSON.parse(await fs.readFile('./published-slugs.json', 'utf-8')),
    )
    for (const airline of airlines) {
        const names = [...(airline.aliases ?? []), ...(airline.former ?? [])]
        for (const { slug } of names) {
            if (slug && published.has(slug)) {
                await copyCurrentMarks(airline.slug, slug, airline.name)
            }
        }
    }
}

// ESM version (as-is, just copy to dist)
async function buildESM() {
    const content = await fs.readFile(inputFile, 'utf-8')
    await fs.mkdir(distDir, { recursive: true })
    await fs.writeFile(path.join(distDir, 'index.js'), content)
}

// Transform the ESM code to CJS format. index.js only imports airlines.json
// and alliances.json and has a single named export list; fail loudly if
// anything else is left.
function transformToCJS(content) {
    const out = content
        .replace(
            /import\s+(airlines|alliances)\s+from\s+['"]\.\/\1\.json['"]\s+with\s*{\s*type:\s*['"]json['"]\s*}/g,
            "const $1 = require('./$1.json')",
        )
        .replace(/^export\s*{([^}]+)}/m, 'module.exports = {$1}')
    if (/^\s*(import|export)\s/m.test(out)) {
        throw new Error(
            'transformToCJS: index.js has an unhandled import/export',
        )
    }

    return out
}

// CJS version
async function buildCJS() {
    const content = await fs.readFile(inputFile, 'utf-8')
    const cjsContent = transformToCJS(content)
    await fs.mkdir(distDir, { recursive: true })
    await fs.writeFile(path.join(distDir, 'index.cjs'), cjsContent)
}

// SVG Validator: browser-compatible SVG validation (no Node.js deps).
// lint/validators.js is inlined so the distributed svg-validator is a single self-contained file.
async function buildChecker() {
    const checksRaw = await fs.readFile('./scripts/lint/validators.js', 'utf-8')
    const checkerRaw = await fs.readFile('./svg-validator.js', 'utf-8')

    // Strip the export keyword from validate functions (they become private helpers)
    // and remove the import line from svg-validator.js before bundling
    const inlinedChecks = checksRaw.replace(/^export function /gm, 'function ')
    const checkerBody = checkerRaw.replace(
        /^import\s*{[^}]*}\s*from\s*['"][^'"]*validators\.js['"];?\n/m,
        '',
    )
    const bundledESM = inlinedChecks + '\n' + checkerBody

    // CJS: strip remaining export keywords, append module.exports
    const bundledCJS =
        bundledESM.replace(/^export function (\w+)/gm, 'function $1') +
        '\nmodule.exports = { runSvgValidations }\n'

    await fs.writeFile(path.join(distDir, 'svg-validator.js'), bundledESM)
    await fs.writeFile(path.join(distDir, 'svg-validator.cjs'), bundledCJS)
}

// SVG Fixer: `lint-svg.js --fix` for the browser, ESM only. Unlike the
// validator it needs the lint rules, SVGO and resvg, so esbuild bundles it:
// SVGO's browser build in place of its Node one, and @resvg/resvg-wasm (left
// to the consumer, a peer dependency) in place of the native @resvg/resvg-js.
async function buildFixer() {
    await esbuild({
        entryPoints: ['./svg-fixer.js'],
        outfile: path.join(distDir, 'svg-fixer.js'),
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        external: ['@resvg/resvg-wasm'],
        alias: {
            '@resvg/resvg-js': './scripts/lint/resvg-browser.js',
            svgo: 'svgo/browser',
        },
        minify: true,
        legalComments: 'none',
        logLevel: 'warning',
    })
}

// Run all builds
async function build() {
    await copyFiles() // First copy all required files
    await Promise.all([buildESM(), buildCJS(), buildChecker(), buildFixer()])
}

build().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})
