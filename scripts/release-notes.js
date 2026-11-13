// Draft a release's notes from the Conventional Commits since the previous
// tag. `release.js` puts them in the release's annotated tag, and the release
// workflow (.github/workflows/release.yml) publishes the tag's notes as the
// GitHub release once the tag is pushed.
//
// Usage: node scripts/release-notes.js [--from <ref>] [--to <ref>] [--version <x.y.z>]
//   --from:    the previous release (default: the latest v* tag before --to)
//   --to:      the release commit (default: HEAD)
//   --version: the release the notes are for (default: package.json's)
//
// Commits are grouped by type: breaking changes (`!` or a `BREAKING CHANGE:`
// footer), airlines (commits that touch only the catalog and the SVGs),
// features and fixes. Docs, chores, CI, refactors, tests and the release
// commits are left out; edit the notes before pushing the tag when a commit
// subject doesn't read well on its own.
import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

export const REPO_URL = 'https://github.com/soaring-symbols/soaring-symbols'

// Files that make a commit an airline change rather than a tooling one
const DATA_FILE =
    /^(airlines\.json|airports\.json|published-slugs\.json|assets\/)/

const SUBJECT =
    /^(?<type>\w+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?: (?<summary>.+)$/

const SECTIONS = [
    ['breaking', 'Breaking changes'],
    ['airlines', 'Airlines'],
    ['features', 'Features'],
    ['fixes', 'Fixes'],
]

// Sort commits into the release notes' sections, oldest first.
// Each commit is { subject, body, files }.
export function groupCommits(commits) {
    const groups = Object.fromEntries(SECTIONS.map(([key]) => [key, []]))
    for (const { subject, body = '', files = [] } of commits) {
        const match = SUBJECT.exec(subject.trim())
        if (!match) continue
        const { type, scope, bang, summary } = match.groups
        if (type === 'chore' && scope === 'release') continue

        const entry = summary.charAt(0).toUpperCase() + summary.slice(1)
        const breaking = bang || /^BREAKING[ -]CHANGE: /m.test(body)
        const dataOnly =
            files.length > 0 && files.every((file) => DATA_FILE.test(file))

        if (breaking) groups.breaking.push(entry)
        else if (dataOnly && ['feat', 'fix', 'chore'].includes(type))
            groups.airlines.push(entry)
        else if (type === 'feat') groups.features.push(entry)
        else if (type === 'fix' || type === 'perf') groups.fixes.push(entry)
    }

    return groups
}

// Markdown for a GitHub release body
export function renderNotes(groups, { from, version }) {
    const sections = SECTIONS.filter(([key]) => groups[key].length).map(
        ([key, title]) =>
            `### ${title}\n\n${groups[key].map((entry) => `- ${entry}`).join('\n')}`,
    )
    if (!sections.length)
        sections.push('Maintenance release with no user-facing changes.')

    const compare = from
        ? `${REPO_URL}/compare/${from}...v${version}`
        : `${REPO_URL}/commits/v${version}`

    return `${sections.join('\n\n')}\n\n**Full Changelog**: <${compare}>\n`
}

const git = (args) => {
    const result = spawnSync('git', args, { encoding: 'utf8' })
    if (result.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
    }

    return result.stdout
}

// The latest v* tag before `to` (so `to` may be a tagged release), or
// undefined before the first one
export function previousTag(to = 'HEAD') {
    const result = spawnSync(
        'git',
        ['describe', '--tags', '--abbrev=0', '--match', 'v*', `${to}^`],
        { encoding: 'utf8' },
    )

    return result.status === 0 ? result.stdout.trim() : undefined
}

// Commits in from..to (all of `to` without `from`), oldest first
export function readCommits(from, to = 'HEAD') {
    const range = from ? `${from}..${to}` : to
    const out = git([
        'log',
        '--reverse',
        '--no-merges',
        '--name-only',
        '--format=%x1e%s%x1f%b%x1f',
        range,
    ])

    return out
        .split('\x1e')
        .filter(Boolean)
        .map((record) => {
            const [subject, body, files] = record.split('\x1f')

            return {
                subject,
                body: body.trim(),
                files: files.split('\n').filter(Boolean),
            }
        })
}

export function releaseNotes({ from, to = 'HEAD', version }) {
    return renderNotes(groupCommits(readCommits(from, to)), { from, version })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { values } = parseArgs({
        options: {
            from: { type: 'string' },
            to: { type: 'string', default: 'HEAD' },
            version: { type: 'string' },
        },
    })
    const version =
        values.version ??
        JSON.parse(readFileSync('package.json', 'utf8')).version
    const from = values.from ?? previousTag(values.to)
    process.stdout.write(releaseNotes({ from, to: values.to, version }))
}
