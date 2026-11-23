// Optimize SVGs in place: npm run optimize -- airlines/<slug>/*.svg
//
// Runs svgo.config.mjs at the lowest precision that still renders like the
// original with the artwork's edges in place (see scripts/lint/optimize.js).
// A file that changes even at the highest precision is left as it is and
// reported.
//
// The checks catch what resvg sees, so it also prints any bounding box value
// (as the validator page shows it) that changed, to compare each result with
// the original before it is committed.
import { readFileSync, writeFileSync } from 'fs'
import {
    bboxChanges,
    optimizeSvg,
    precisionArgOrExit,
    PRECISIONS,
} from './lint/optimize.js'

const args = process.argv.slice(2)
const files = args.filter((arg) => arg.endsWith('.svg'))
// --precision=4 or 5: the fewest decimals to write (precisionArg)
const fewest = precisionArgOrExit(args)

if (!files.length) {
    console.log('Usage: npm run optimize -- [--precision=4] <files.svg...>')
    process.exit(1)
}

console.log(
    '--- 🔍 Compare each result with the original (the bounding box changes listed below, the validator page, the rendering) before committing it, and revert any file that looks even slightly off. ---\n',
)

for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const { data, precision, alike } = optimizeSvg(source, file, {
        precision: fewest,
    })
    if (!alike) {
        console.log(
            `⚠️  ${file}: optimizing changes how it renders or moves the artwork even at ${PRECISIONS.at(-1)} decimals, so it was left as it is; fix it in your editor.`,
        )
        process.exitCode = 1
        continue
    }
    writeFileSync(file, data)
    const saving = Math.round((1 - data.length / source.length) * 100)
    console.log(
        `✅ ${file}: ${source.length} → ${data.length} bytes (-${saving}%), ${precision} decimals`,
    )
    const moved = bboxChanges(source, data)
    if (moved.length)
        console.log(`   ↳ bounding box changed: ${moved.join(', ')}`)
}
