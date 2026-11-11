// Check that SVGs have been optimized, with `npm run optimize` or another
// SVGO-based tool such as SVGOMG: a file passes unless the project's SVGO
// config (svgo.config.mjs) would still make it more than 10% smaller at the
// precision the file is written with (its longest decimals, from three to
// five). A file kept at four decimals on purpose passes; only leftovers SVGO
// removes, or more than five decimals, count against it. `npm run optimize`
// may still pick fewer decimals, which is the smallest file.
// Different SVGO versions and settings round numbers and pick path commands
// a little differently, so an optimized file rarely matches this config byte
// for byte; one that was never optimized shrinks by far more.
//
//   node scripts/check-optimized.js                files changed since origin/main
//   node scripts/check-optimized.js --base <ref>   files changed since <ref>
//   node scripts/check-optimized.js <files...>     these files
//
// Only changed files are checked by default: some older SVGs are still over
// the limit (#54). Exits with 1 when a file needs optimizing.
import { readFileSync } from 'fs'
import { selectSvgs } from './lint/changed.js'
import { optimize } from 'svgo'
import svgoConfig from '../svgo.config.mjs'
import { PRECISIONS } from './lint/optimize.js'

const { files } = selectSvgs(process.argv.slice(2))

if (!files.length) {
    console.log('✅ No changed SVGs to check.')
    process.exit(0)
}

// Share of its size SVGO may still remove from an optimized file at its own
// precision. SVGOMG's output stays under 7%; unoptimized exports lose 15-40%.
const MAX_SAVING = 0.1

// The precision a file is written with: its longest decimals, kept within
// the three to five decimals `npm run optimize` writes
const precisionOf = (svg) =>
    Math.min(
        PRECISIONS.at(-1),
        Math.max(
            PRECISIONS[0],
            ...(svg.match(/\.\d+/g) ?? []).map((n) => n.length - 1),
        ),
    )

// GitHub Actions turns ::error lines into annotations on the pull request
const inCI = Boolean(process.env.GITHUB_ACTIONS)

const unoptimized = files
    .map((file) => {
        const svg = readFileSync(file, 'utf8')
        const optimized = optimize(svg, {
            ...svgoConfig,
            floatPrecision: precisionOf(svg),
            path: file,
        }).data

        return { file, saving: 1 - optimized.length / svg.length }
    })
    .filter(({ saving }) => saving > MAX_SAVING)

for (const { file, saving } of unoptimized) {
    const percent = Math.round(saving * 100)
    const fix = `npm run optimize -- ${file}`
    if (inCI) {
        console.log(
            `::error file=${file},title=SVG not optimized::SVGO would still make it ${percent}% smaller. Run \`${fix}\` (or optimize it with SVGOMG), then \`node scripts/lint-svg.js --fix\`, check that it still looks right, and commit the result.`,
        )
    } else {
        console.log(
            `❌ ${file} is not optimized: SVGO would still make it ${percent}% smaller. Run \`${fix}\``,
        )
    }
}

if (unoptimized.length) {
    console.log(
        `\n${unoptimized.length} of ${files.length} SVG(s) need optimizing (\`npm run optimize\` or SVGOMG), then \`node scripts/lint-svg.js --fix\`.`,
    )
    process.exitCode = 1
} else {
    console.log(`✅ ${files.length} SVG(s) checked, all optimized.`)
}
