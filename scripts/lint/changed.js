// Pick the SVGs a script works on from its arguments: the files listed, or
// those added or changed since a git ref (`--base <ref>`, origin/main by
// default). Shared by check-optimized.js and lint-svg.js --changed.
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { relative, resolve } from 'path'

const git = (...gitArgs) =>
    execFileSync('git', gitArgs, { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)

// SVGs under assets/ and alliances/ added or modified since `ref`, including
// uncommitted and untracked files
const SVG_DIRS = ['assets', 'alliances']

export const changedSince = (ref) => {
    const since = git('merge-base', ref, 'HEAD')[0]

    return [
        ...git(
            'diff',
            '--name-only',
            '--diff-filter=d',
            since,
            '--',
            ...SVG_DIRS,
        ),
        ...git('ls-files', '--others', '--exclude-standard', '--', ...SVG_DIRS),
    ]
}

// Splits `args` into `--base <ref>`, flags (`--…`) and listed files, and
// returns the SVGs to work on: the listed ones if any, else those changed
// since the base
export const selectSvgs = (args) => {
    const baseIndex = args.indexOf('--base')
    const base = baseIndex === -1 ? 'origin/main' : args[baseIndex + 1]
    const listed = args.filter(
        (arg, i) =>
            !arg.startsWith('--') && (baseIndex === -1 || i !== baseIndex + 1),
    )
    const files = listed.length ? listed : changedSince(base)

    return {
        base,
        listed: listed.length > 0,
        files: [
            ...new Set(
                files.map((f) => relative('.', resolve(f)).replace(/\\/g, '/')),
            ),
        ].filter((file) => file.endsWith('.svg') && existsSync(file)),
    }
}
