import { promises as fs } from 'fs'
import path from 'path'

const inputFile = './index.js'
const distDir = './dist'

// Helper to recursively copy a directory
async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
        // Skip OS junk such as .DS_Store so it never reaches the package
        if (entry.name.startsWith('.')) continue
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
    const filesToCopy = [
        { src: './airlines.json', dest: 'airlines.json' },
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
}

// ESM version (as-is, just copy to dist)
async function buildESM() {
    const content = await fs.readFile(inputFile, 'utf-8')
    await fs.mkdir(distDir, { recursive: true })
    await fs.writeFile(path.join(distDir, 'index.js'), content)
}

// Transform the ESM code to CJS format. index.js only imports airlines.json
// and has a single named export list, so two replacements are enough; fail
// loudly if either stops matching.
function transformToCJS(content) {
    const replacements = [
        [
            /import\s+airlines\s+from\s+['"]\.\/airlines\.json['"]\s+with\s*{\s*type:\s*['"]json['"]\s*}/,
            "const airlines = require('./airlines.json')",
        ],
        [/^export\s*{([^}]+)}/m, 'module.exports = {$1}'],
    ]

    let out = content
    for (const [pattern, replacement] of replacements) {
        if (!pattern.test(out)) {
            throw new Error(`transformToCJS: ${pattern} did not match index.js`)
        }
        out = out.replace(pattern, replacement)
    }
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
