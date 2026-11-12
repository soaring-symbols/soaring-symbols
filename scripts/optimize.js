// Optimize SVGs in place: npm run optimize -- assets/<slug>/*.svg
//
// Runs svgo.config.mjs at the lowest precision that still renders like the
// original with the artwork's edges in place (see scripts/lint/optimize.js).
// A file that changes even at the highest precision is left as it is and
// reported.
//
// Experimental: the checks catch what resvg sees, not every slight shift, so
// it prints any bounding box value (as the validator page shows it) that
// changed, and each result needs a look before it is committed.
import { readFileSync, writeFileSync } from 'fs'
import { optimizeSvg, PRECISIONS } from './lint/optimize.js'
import { measureBBox } from './lint/render.js'

// x, y, width and height at three decimals, as the validator page shows them
const shownBBox = (svg) => {
    const box = measureBBox(svg)
    if (!box) return {}
    const show = (value) => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3)

    return {
        x: show(box.x),
        y: show(box.y),
        width: show(box.width),
        height: show(box.height),
    }
}

const files = process.argv.slice(2).filter((arg) => arg.endsWith('.svg'))

if (!files.length) {
    console.log('Usage: npm run optimize -- <files.svg...>')
    process.exit(1)
}

console.log(
    '--- 🧪 EXPERIMENTAL: compare each result with the original (the bounding box changes listed below, the validator page, the rendering) before committing it, and revert any file that looks even slightly off. ---\n',
)

for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const { data, precision, alike } = optimizeSvg(source, file)
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
    const before = shownBBox(source)
    const after = shownBBox(data)
    const moved = Object.keys(before).filter(
        (key) => before[key] !== after[key],
    )
    if (moved.length) {
        console.log(
            `   ↳ bounding box changed: ${moved.map((key) => `${key} ${before[key]} → ${after[key]}`).join(', ')}`,
        )
    }
}
