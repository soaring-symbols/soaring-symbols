// The release line links in the docs: README.md and API.md show
// copy-paste examples pinned to the current line (soaring-symbols@0.4/...),
// which must follow each minor release. release.js rewrites them when it
// bumps the version, and scripts/test.js fails when one points elsewhere.
// Exact releases (soaring-symbols@0.2.4/...) are left alone: they never
// change, so an older one still works as an example. Docs that only explain
// what a line is write it as soaring-symbols@0.<minor> instead.
import { readFileSync, writeFileSync } from 'fs'

export const LINE_DOCS = ['README.md', 'API.md']

// A line, not an exact release: @0.4 but not @0.4.1, of the package or of
// the draw.io libraries (@soaring-symbols/drawio), which share its version
const LINE_LINK = /(soaring-symbols(?:\/drawio)?)@(\d+\.\d+)(?![.\d])/g

// The release line of a version: '0.5' for 0.5.2 (a 0.x minor release is a
// new line)
export const releaseLine = (version) => version.split('.').slice(0, 2).join('.')

// The lines a text links to that aren't `line`, e.g. ['0.3']
export const staleLines = (text, line) => [
    ...new Set(
        [...text.matchAll(LINE_LINK)]
            .map((match) => match[2])
            .filter((found) => found !== line),
    ),
]

// The text with every line link pointing at `line`
export const setLine = (text, line) => text.replace(LINE_LINK, `$1@${line}`)

// Point the line links of LINE_DOCS at `line`; returns the files it changed
export const updateLineDocs = (line) =>
    LINE_DOCS.filter((file) => {
        const text = readFileSync(file, 'utf8')
        const updated = setLine(text, line)
        if (updated === text) return false
        writeFileSync(file, updated)

        return true
    })
