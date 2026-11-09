// Purge jsDelivr's cache of the files a release changed, so links to the
// release line (soaring-symbols@0.2/...) and to the bare package
// (soaring-symbols/...) serve them right away instead of after up to 12
// hours. Exact-release links (soaring-symbols@0.2.4/...) never need it.
//
// `npm run release` runs it after publishing. To run it again by hand, from
// a checkout whose dist/ matches the published release:
//
//   node scripts/purge-cdn.js --since <previous version> [--dry-run]
//
// It compares dist/ with the previous release's published files and purges
// only those that differ (added files were never cached). A purge failure
// is reported, never fatal: the release is out either way.
import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

const PACKAGE = 'soaring-symbols'
const DIST = 'dist'
const RESOLVE_URL = `https://data.jsdelivr.com/v1/packages/npm/${PACKAGE}/resolved?specifier=`
const PURGE_URL = `https://purge.jsdelivr.net/npm/${PACKAGE}`
// jsDelivr notices a new npm release within a minute or two
const WAIT_MS = 5 * 60 * 1000
const POLL_MS = 10 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const listFiles = (dir) =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)))

// The files under dist/ that differ from `previous`'s published ones, or
// undefined when that release can't be downloaded
export function changedFiles(previous, distDir = DIST) {
    const dir = mkdtempSync(join(tmpdir(), 'soaring-symbols-'))
    try {
        const pack = spawnSync(
            'npm',
            ['pack', `${PACKAGE}@${previous}`, '--pack-destination', dir],
            { encoding: 'utf8' },
        )
        const tarball = pack.stdout.trim().split('\n').at(-1)
        if (pack.status !== 0 || !tarball) return undefined
        const untar = spawnSync('tar', ['-xzf', join(dir, tarball), '-C', dir])
        if (untar.status !== 0) return undefined

        const oldDist = join(dir, 'package', DIST)

        return listFiles(distDir).filter((file) => {
            try {
                return !readFileSync(join(oldDist, file)).equals(
                    readFileSync(join(distDir, file)),
                )
            } catch {
                // Added in this release: nothing cached to purge
                return false
            }
        })
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

// Wait until jsDelivr resolves `line` to `version`; purging the line before
// that would only cache the previous release's files again
async function waitForRelease(line, version) {
    const deadline = Date.now() + WAIT_MS
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${RESOLVE_URL}${line}`)
            if (res.ok && (await res.json()).version === version) return true
        } catch {
            // Retry until the deadline
        }
        await sleep(POLL_MS)
    }

    return false
}

const purge = async (path) => {
    try {
        const res = await fetch(`${PURGE_URL}${path}`)

        return res.ok && (await res.json()).status === 'finished'
    } catch {
        return false
    }
}

// Purge every file `version` changed since `previous`, under the release
// line and the bare package. Returns whether every purge succeeded.
export async function purgeRelease({ version, previous, dryRun = false }) {
    const line = version.split('.').slice(0, 2).join('.')
    const changed = changedFiles(previous)
    // Without the previous release to compare, purge the file every
    // consumer reads first
    const files = changed ?? ['airlines.json']
    if (!changed) {
        console.log(
            `⚠️  Couldn't download ${PACKAGE}@${previous}; purging airlines.json only.`,
        )
    }
    const paths = files.flatMap((file) => [
        `@${line}/${DIST}/${file}`,
        `/${DIST}/${file}`,
    ])
    console.log(
        `${files.length} file(s) changed since ${previous}, ${paths.length} path(s) to purge on jsDelivr.`,
    )
    if (dryRun || !paths.length) {
        files.forEach((file) => console.log(`  ${file}`))

        return true
    }

    console.log(
        `Waiting for jsDelivr to resolve ${PACKAGE}@${line} to ${version}…`,
    )
    if (!(await waitForRelease(line, version))) {
        console.log(
            `⚠️  jsDelivr still doesn't resolve @${line} to ${version}; nothing was purged. Run "node scripts/purge-cdn.js --since ${previous}" in a few minutes.`,
        )

        return false
    }

    const failed = []
    for (const path of paths) {
        if (!(await purge(path))) failed.push(path)
    }
    if (failed.length) {
        console.log(
            `⚠️  ${failed.length} of ${paths.length} purge(s) failed; run "node scripts/purge-cdn.js --since ${previous}" again:`,
        )
        failed.forEach((path) => console.log(`  ${path}`))

        return false
    }
    console.log(`✅ Purged ${paths.length} path(s) from jsDelivr.`)

    return true
}

// Run on its own: node scripts/purge-cdn.js --since <version> [--dry-run]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { values } = parseArgs({
        options: {
            since: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
        },
    })
    if (!values.since) {
        console.error(
            'Usage: node scripts/purge-cdn.js --since <previous version> [--dry-run]',
        )
        process.exit(1)
    }
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
    const ok = await purgeRelease({
        version,
        previous: values.since,
        dryRun: values['dry-run'],
    })
    process.exitCode = ok ? 0 : 1
}
