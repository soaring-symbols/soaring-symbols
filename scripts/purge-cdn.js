// Purge jsDelivr's cache of the files a release changed, so links to the
// release line (soaring-symbols@0.3/...) and to the bare package
// (soaring-symbols/...) serve them right away instead of after up to 12
// hours. Exact-release links (soaring-symbols@0.3.0/...) never need it.
//
// The release workflow (.github/workflows/release.yml) runs it once the
// release's tag is pushed. To run it again by hand:
//
//   node scripts/purge-cdn.js --since <previous version> [--version <version>] [--wait <minutes>] [--dry-run]
//
// It compares the published files of `version` (package.json's by default)
// with those of `previous` and purges only those that differ (added files
// were never cached). jsDelivr takes several minutes to resolve a release
// line to a new release, so it waits for that first, up to `--wait` minutes.
import { spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

const PACKAGE = 'soaring-symbols'
const DIST = 'dist'
const RESOLVE_URL = `https://data.jsdelivr.com/v1/packages/npm/${PACKAGE}/resolved?specifier=`
const PURGE_URL = `https://purge.jsdelivr.net/npm/${PACKAGE}`
// jsDelivr has taken six to seven minutes to resolve a new release line
const WAIT_MINUTES = 20
const POLL_MS = 15 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const listFiles = (dir) =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)))

// Download and unpack `version` into `dir`, returning its dist/ folder, or
// undefined when it can't be downloaded
function downloadDist(version, dir) {
    mkdirSync(dir, { recursive: true })
    const pack = spawnSync(
        'npm',
        ['pack', `${PACKAGE}@${version}`, '--pack-destination', dir],
        { encoding: 'utf8' },
    )
    const tarball = pack.stdout.trim().split('\n').at(-1)
    if (pack.status !== 0 || !tarball) return undefined
    const untar = spawnSync('tar', ['-xzf', join(dir, tarball), '-C', dir])
    if (untar.status !== 0) return undefined

    return join(dir, 'package', DIST)
}

// The files of `version`'s published dist/ (or of `distDir`, for a release
// not published yet) that differ from `previous`'s, or undefined when either
// release can't be downloaded
export function changedFiles(previous, { version, distDir } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'soaring-symbols-'))
    try {
        const oldDist = downloadDist(previous, join(root, 'previous'))
        const newDist = distDir ?? downloadDist(version, join(root, 'current'))
        if (!oldDist || !newDist) return undefined

        return listFiles(newDist).filter((file) => {
            try {
                return !readFileSync(join(oldDist, file)).equals(
                    readFileSync(join(newDist, file)),
                )
            } catch {
                // Added in this release: nothing cached to purge
                return false
            }
        })
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

const resolvesTo = async (specifier, version) => {
    try {
        const res = await fetch(`${RESOLVE_URL}${specifier}`)

        return res.ok && (await res.json()).version === version
    } catch {
        return false
    }
}

// Wait until jsDelivr resolves the release line and the bare package
// (`latest`) to `version`; purging before that would only cache the previous
// release's files again
async function waitForRelease(line, version, minutes) {
    const start = Date.now()
    const deadline = start + minutes * 60 * 1000
    let reported = 0
    while (Date.now() < deadline) {
        if (
            (await resolvesTo(line, version)) &&
            (await resolvesTo('latest', version))
        ) {
            return true
        }
        const elapsed = Math.floor((Date.now() - start) / 60000)
        if (elapsed > reported) {
            reported = elapsed
            console.log(`  still waiting after ${elapsed} min…`)
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
// line and the bare package. `distDir` compares a local build instead of
// the published `version` (for a dry run before publishing). Returns whether
// every purge succeeded.
export async function purgeRelease({
    version,
    previous,
    distDir,
    dryRun = false,
    wait = WAIT_MINUTES,
}) {
    const line = version.split('.').slice(0, 2).join('.')
    const changed = changedFiles(previous, { version, distDir })
    // Without both releases to compare, purge the file every consumer reads
    // first
    const files = changed ?? ['airlines.json']
    if (!changed) {
        console.log(
            `⚠️  Couldn't download ${PACKAGE}@${previous} or @${version}; purging airlines.json only.`,
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
        `Waiting up to ${wait} min for jsDelivr to resolve ${PACKAGE}@${line} and ${PACKAGE} to ${version}…`,
    )
    if (!(await waitForRelease(line, version, wait))) {
        console.log(
            `⚠️  jsDelivr still doesn't resolve @${line} to ${version}; nothing was purged. Rerun "node scripts/purge-cdn.js --since ${previous} --version ${version}" later.`,
        )

        return false
    }

    const failed = []
    for (const path of paths) {
        if (!(await purge(path))) failed.push(path)
    }
    if (failed.length) {
        console.log(
            `⚠️  ${failed.length} of ${paths.length} purge(s) failed; rerun "node scripts/purge-cdn.js --since ${previous} --version ${version}":`,
        )
        failed.forEach((path) => console.log(`  ${path}`))

        return false
    }
    console.log(`✅ Purged ${paths.length} path(s) from jsDelivr.`)

    return true
}

// Run on its own (see the top of this file)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { values } = parseArgs({
        options: {
            since: { type: 'string' },
            version: { type: 'string' },
            wait: { type: 'string', default: String(WAIT_MINUTES) },
            'dry-run': { type: 'boolean', default: false },
        },
    })
    const wait = Number(values.wait)
    if (!values.since || !(wait >= 0)) {
        console.error(
            'Usage: node scripts/purge-cdn.js --since <previous version> [--version <version>] [--wait <minutes>] [--dry-run]',
        )
        process.exit(1)
    }
    const version =
        values.version ??
        JSON.parse(readFileSync('package.json', 'utf8')).version
    const ok = await purgeRelease({
        version,
        previous: values.since,
        dryRun: values['dry-run'],
        wait,
    })
    process.exitCode = ok ? 0 : 1
}
