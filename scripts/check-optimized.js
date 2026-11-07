// Check that SVGs are already optimized with the project's SVGO config
// (svgo.config.mjs), i.e. `npm run optimize` would leave them unchanged.
//
//   node scripts/check-optimized.js                files changed since origin/main
//   node scripts/check-optimized.js --base <ref>   files changed since <ref>
//   node scripts/check-optimized.js <files...>     these files
//
// Only changed files are checked by default: many older SVGs were optimized
// with other tools and still differ by a few bytes, which is not worth a
// visual review each. Exits with 1 when a file needs optimizing.
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

const config = await loadConfig('svgo.config.mjs')
// GitHub Actions turns ::error lines into annotations on the pull request
const inCI = Boolean(process.env.GITHUB_ACTIONS)

const unoptimized = files.filter((file) => {
    const svg = readFileSync(file, 'utf8')

    return optimize(svg, { ...config, path: file }).data !== svg
})

for (const file of unoptimized) {
    const fix = `npm run optimize -- ${file}`
    if (inCI) {
        console.log(
            `::error file=${file},title=SVG not optimized::Run \`${fix}\`, then \`node scripts/lint-svg.js --fix\`, check that it still looks right, and commit the result.`,
        )
    } else {
        console.log(`❌ ${file} is not optimized: run \`${fix}\``)
    }
}

if (unoptimized.length) {
    console.log(
        `\n${unoptimized.length} of ${files.length} SVG(s) need \`npm run optimize\`, then \`node scripts/lint-svg.js --fix\`.`,
    )
    process.exitCode = 1
} else {
    console.log(`✅ ${files.length} SVG(s) checked, all optimized.`)
}
