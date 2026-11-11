// Release to npm: test, bump the version in package.json, publish, then commit the bump.
// No git tag or GitHub release is created.
//
// Usage: npm run release -- [bump] [--dry-run]
//   bump: patch (default), minor, major or an exact version such as 0.2.0.
//
// While on 0.x, patch is for anything that keeps compatibility (new airlines
// and assets, fixes, additions) and minor for breaking API or data changes.
// Every release goes to the `latest` dist-tag; prereleases are not used.
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { parseArgs } from 'util'

const BRANCH = 'main'
const REMOTE = 'origin'
const RELEASE_FILES = [
    'package.json',
    'package-lock.json',
    'published-slugs.json',
]

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        'dry-run': { type: 'boolean', default: false },
    },
})

const bump = positionals[0] || 'patch'
const dryRun = values['dry-run']

const fail = (message) => {
    console.error(`\n❌ ${message}`)
    process.exit(1)
}

const step = (message) => console.log(`\n▶ ${message}`)

// Run a command with inherited stdio (so npm can prompt for an OTP); exit on failure
const run = (cmd, args, { allowFail = false } = {}) => {
    console.log(`$ ${cmd} ${args.join(' ')}`)
    const result = spawnSync(cmd, args, { stdio: 'inherit' })
    if (result.status !== 0 && !allowFail) {
        fail(`Command failed: ${cmd} ${args.join(' ')}`)
    }

    return result.status === 0
}

// Run a command and return its trimmed stdout
const read = (cmd, args) => {
    const result = spawnSync(cmd, args, { encoding: 'utf8' })
    if (result.status !== 0) {
        fail(`Command failed: ${cmd} ${args.join(' ')}\n${result.stderr}`)
    }

    return result.stdout.trim()
}

const readVersion = () =>
    JSON.parse(readFileSync('package.json', 'utf8')).version

const restoreReleaseFiles = () =>
    run('git', ['checkout', '--', ...RELEASE_FILES])

const ensureCleanTree = (hint) => {
    if (read('git', ['status', '--porcelain'])) {
        run('git', ['status', '--short'])
        fail(`Working tree is not clean. ${hint}`)
    }
}

// --- Preflight ---
if (
    !['patch', 'minor', 'major'].includes(bump) &&
    !/^\d+\.\d+\.\d+$/.test(bump)
) {
    fail(
        `Unknown bump "${bump}". Use patch, minor, major or an exact version like 0.2.0.`,
    )
}

const currentVersion = readVersion()
// From a prerelease, npm resolves patch and minor to its base version
// (0.1.0-alpha.14 -> 0.1.0), which may not be what was meant
if (currentVersion.includes('-') && !/^\d/.test(bump)) {
    fail(
        `${currentVersion} is a prerelease; pass the version to release, e.g. "npm run release -- 0.2.0".`,
    )
}

step('Checking repository state')

const branch = read('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== BRANCH)
    fail(`Releases are cut from "${BRANCH}", not "${branch}".`)

ensureCleanTree('Commit or stash your changes first.')

run('git', ['fetch', REMOTE, BRANCH])
const behind = read('git', ['rev-list', '--count', `HEAD..${REMOTE}/${BRANCH}`])
if (behind !== '0') fail(`"${BRANCH}" is ${behind} commit(s) behind ${REMOTE}.`)

if (!dryRun) {
    const user = read('npm', ['whoami'])
    console.log(`Logged in to npm as ${user}`)
}

// --- Test (also lints SVGs and tidies airlines.json) ---
step('Running tests')
run('npm', ['test'])
ensureCleanTree(
    'The build regenerated tracked files; review and commit them before releasing.',
)

// --- Version bump ---
step(`Bumping version from ${currentVersion} (${bump})`)
run('npm', ['version', bump, '--no-git-tag-version'])

const version = readVersion()
console.log(`\n  version:   ${version}\n  dist-tag:  latest`)

if (dryRun) {
    step('Dry run: showing the package contents')
    run('npm', ['pack', '--dry-run'])
    restoreReleaseFiles()
    console.log('\n✅ Dry run finished; no changes were kept.')
    process.exit(0)
}

// --- Publish (prepublishOnly rebuilds dist/) ---
step(`Publishing ${version} to npm`)
if (!run('npm', ['publish', '--tag', 'latest'], { allowFail: true })) {
    restoreReleaseFiles()
    fail('npm publish failed; the version bump was reverted.')
}

// --- Record the slugs this release shipped, so a later rename keeps their
// links working (scripts/build.js copies files only to published slugs) ---
const shipped = JSON.parse(readFileSync('dist/airlines.json', 'utf8')).map(
    (airline) => airline.slug,
)
const known = JSON.parse(readFileSync('published-slugs.json', 'utf8'))
writeFileSync(
    'published-slugs.json',
    `${JSON.stringify([...new Set([...known, ...shipped])].sort(), null, 4)}\n`,
)

// --- Commit the bump (not pushed) ---
step('Committing the version bump')
run('git', ['add', ...RELEASE_FILES])
run('git', ['commit', '-m', `chore(release): v${version}`])

console.log(
    `\n✅ Published soaring-symbols@${version}. Push the release commit with "git push ${REMOTE} ${BRANCH}".`,
)
