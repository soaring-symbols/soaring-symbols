// Check that SVGs have been optimized, with `npm run optimize` or another
// SVGO-based tool such as SVGOMG: a file passes unless the project's SVGO
// config (svgo.config.mjs) would still make it more than 10% smaller.
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
import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { loadConfig, optimize } from 'svgo'

const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const base = baseIndex === -1 ? null : args[baseIndex + 1]
const listed = args.filter(
    (arg, i) => arg !== '--base' && (baseIndex === -1 || i !== baseIndex + 1),
)

const git = (...gitArgs) =>
    execFileSync('git', gitArgs, { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)

// SVGs under assets/ added or modified since `ref`, including uncommitted and
// untracked files
const changedSince = (ref) => {
    const since = git('merge-base', ref, 'HEAD')[0]

    return [
        ...git('diff', '--name-only', '--diff-filter=d', since, '--', 'assets'),
        ...git('ls-files', '--others', '--exclude-standard', '--', 'assets'),
    ]
}

const files = [
    ...new Set(listed.length ? listed : changedSince(base ?? 'origin/main')),
].filter((file) => file.endsWith('.svg') && existsSync(file))

if (!files.length) {
    console.log('✅ No changed SVGs to check.')
    process.exit(0)
}

// Share of its size SVGO may still remove from an optimized file. SVGOMG's
// output stays under 7% with any precision; unoptimized exports lose 15-40%.
const MAX_SAVING = 0.1

const config = await loadConfig('svgo.config.mjs')
// GitHub Actions turns ::error lines into annotations on the pull request
const inCI = Boolean(process.env.GITHUB_ACTIONS)

const unoptimized = files
    .map((file) => {
        const svg = readFileSync(file, 'utf8')
        const optimized = optimize(svg, { ...config, path: file }).data

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
