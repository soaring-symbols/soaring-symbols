import { promises as fs } from 'fs'
import path from 'path'
import { writeDerivedMonos } from '../utils/index.js'

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

    // Copy required files and directories
    // The catalog ships minified: the repo copy is indented for review, but
    // consumers (bundlers, jsDelivr) only parse it
    const airlines = await fs.readFile('./airlines.json', 'utf-8')
    await fs.writeFile(
        path.join(distDir, 'airlines.json'),
        JSON.stringify(JSON.parse(airlines)),
    )

    const filesToCopy = [
        // The declarations have no default export, so the same file serves
        // both the import (.d.ts) and require (.d.cts) conditions
        { src: './index.d.ts', dest: 'index.d.ts' },
        { src: './index.d.ts', dest: 'index.d.cts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.ts' },
        { src: './svg-validator.d.ts', dest: 'svg-validator.d.cts' },
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

    const catalog = JSON.parse(airlines)
    // Single-color assets get their -mono.svg here, not in the repo
    for (const airline of catalog.filter((a) => !a.marks)) {
        writeDerivedMonos(airline.slug, path.join(distDir, 'assets'))
    }
    // After the monos, so airlines sharing marks get those too
    await copySharedMarks(catalog)
}

const escapeXml = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Airlines with `marks` use another airline's SVGs. Copy those files to their
// own slug in dist (never in the repo), titled with their own name, so every
// airline's files live at assets/<slug>/ like any other.
async function copySharedMarks(airlines) {
    for (const airline of airlines.filter((a) => a.marks)) {
        const src = path.join(distDir, 'assets', airline.marks)
        const dest = path.join(distDir, 'assets', airline.slug)
        await fs.mkdir(dest, { recursive: true })
        for (const file of await fs.readdir(src)) {
            const svg = await fs.readFile(path.join(src, file), 'utf-8')
            await fs.writeFile(
                path.join(dest, file),
                svg.replace(
                    /<title>[^<]*<\/title>/,
                    `<title>${escapeXml(airline.name)}</title>`,
                ),
            )
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

// Run all builds
async function build() {
    await copyFiles() // First copy all required files
    await Promise.all([buildESM(), buildCJS(), buildChecker()])
}

build().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})
