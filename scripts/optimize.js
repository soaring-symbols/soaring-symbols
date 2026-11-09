// Optimize SVGs in place: npm run optimize -- assets/<slug>/*.svg
//
// Runs svgo.config.mjs at the lowest precision that still renders like the
// original (see scripts/lint/optimize.js). A file that renders differently
// even at the highest precision is left as it is and reported.
import { readFileSync, writeFileSync } from 'fs'
import { optimizeSvg, PRECISIONS } from './lint/optimize.js'

const files = process.argv.slice(2).filter((arg) => arg.endsWith('.svg'))

if (!files.length) {
    console.log('Usage: npm run optimize -- <files.svg...>')
    process.exit(1)
}

for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const { data, precision, alike } = optimizeSvg(source, file)
    if (!alike) {
        console.log(
            `⚠️  ${file}: optimizing changes how it renders even at ${PRECISIONS.at(-1)} decimals, so it was left as it is; fix it in your editor.`,
        )
        process.exitCode = 1
        continue
    }
    writeFileSync(file, data)
    const saving = Math.round((1 - data.length / source.length) * 100)
    console.log(
        `✅ ${file}: ${source.length} → ${data.length} bytes (-${saving}%), ${precision} decimals`,
    )
}
