import { promises as fs } from 'fs'
import path from 'path'
import { build as esbuild } from 'esbuild'
import { getAssetDirs, writeDerivedMonos } from '../utils/index.js'
import { publishCatalog } from '../utils/catalog.js'
import { validateAirlines } from '../utils/schema.js'

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

    const filesToCopy = [
        // The declarations have no default export, so the same file serves
        // both the import (.d.ts) and require (.d.cts) conditions
        { src: './index.d.ts', dest: 'index.d.ts' },
        { src: './index.d.ts', dest: 'index.d.cts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.ts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.cts' },
        { src: './svg-fixer.d.ts', dest: 'svg-fixer.d.ts' },
    ]

    const dirsToCopy = [{ src: './assets', dest: 'assets' }]

    // Copy individual files
    for (const file of filesToCopy) {
        await fs.copyFile(file.src, path.join(distDir, file.dest))
    }

    // Copy directories
    for (const dir of dirsToCopy) {
        await copyDir(dir.src, path.join(distDir, dir.dest))
    }

    // Single-color assets, older marks included, get their -mono.svg here,
    // not in the repo
    for (const airline of catalog.filter((a) => !a.marks)) {
        for (const dir of getAssetDirs(airline.slug)) {
            writeDerivedMonos(dir, path.join(distDir, 'assets'))
        }
    }
    // After the monos, so airlines sharing marks get those too, and after
    // those, so a former slug gets whatever its airline ships
    await copySharedMarks(catalog)
    await copyFormerSlugs(catalog)
}

const escapeXml = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Copy an airline's current files (never history/) from dist/assets/<from>/
// to dist/assets/<to>/, titled with the airline's name
async function copyCurrentMarks(from, to, name) {
    const src = path.join(distDir, 'assets', from)
    const dest = path.join(distDir, 'assets', to)
    await fs.mkdir(dest, { recursive: true })
    const files = (await fs.readdir(src, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
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

// Airlines with `marks` use another airline's SVGs. Copy those files to their
// own slug in dist (never in the repo), titled with their own name, so every
// airline's files live at assets/<slug>/ like any other. Only the current
// marks are shared, never the history/ folder.
async function copySharedMarks(airlines) {
    for (const airline of airlines.filter((a) => a.marks)) {
        await copyCurrentMarks(airline.marks, airline.slug, airline.name)
    }
}

// A renamed airline's slug follows its new name. Links to an old slug keep
// working: when a release shipped that slug (published-slugs.json), the
// airline's current files are also published there. A former name that was
// never a slug in the package (Air Pacific for Fiji Airways) has no links to
// keep, so it gets no copy; getAirline() still finds it.
async function copyFormerSlugs(airlines) {
    const published = new Set(
        JSON.parse(await fs.readFile('./published-slugs.json', 'utf-8')),
    )
    for (const airline of airlines) {
        for (const { slug } of airline.former ?? []) {
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
// and has a single named export list; fail loudly if anything else is left.
function transformToCJS(content) {
    const out = content
        .replace(
            /import\s+airlines\s+from\s+['"]\.\/airlines\.json['"]\s+with\s*{\s*type:\s*['"]json['"]\s*}/,
            "const airlines = require('./airlines.json')",
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
