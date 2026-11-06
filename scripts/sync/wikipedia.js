// Fetching and parsing English Wikipedia airline infoboxes for
// scripts/sync-data.js. The parsing helpers are pure so tests can use them.

const USER_AGENT =
    'soaring-symbols-sync/1.0 (+https://github.com/soaring-symbols/soaring-symbols)'

// Templates whose arguments are the value itself (lists, wrappers); every
// other template (citations, footnotes, dates...) is dropped
const LIST_TEMPLATES = new Set([
    'ubl',
    'unbulleted list',
    'plainlist',
    'plain list',
    'flatlist',
    'hlist',
    'nowrap',
    'small',
])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Index just past the "}}" or "]]" that closes the bracket pair at `start`
const closingIndex = (text, start) => {
    let depth = 0
    for (let i = start; i < text.length - 1; i++) {
        const pair = text.slice(i, i + 2)
        if (pair === '{{' || pair === '[[') {
            depth++
            i++
        } else if (pair === '}}' || pair === ']]') {
            depth--
            i++
            if (depth === 0) return i + 1
        }
    }

    return text.length
}

// Split on `separator` only outside nested templates and links
const splitTopLevel = (text, separator) => {
    const parts = []
    let start = 0
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('{{', i) || text.startsWith('[[', i)) {
            i = closingIndex(text, i) - 1
        } else if (text[i] === separator) {
            parts.push(text.slice(start, i))
            start = i + 1
        }
    }
    parts.push(text.slice(start))

    return parts
}

const stripComments = (text) =>
    text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<ref[^>/]*\/>/gi, '')
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')

// The "{{Infobox airline ...}}" block of a page, or '' when there is none
export function extractInfobox(wikitext) {
    const start = wikitext.search(/\{\{\s*Infobox airline/i)
    if (start < 0) return ''

    return wikitext.slice(start, closingIndex(wikitext, start))
}

// Infobox parameters as { lowercased name: raw value }
export function infoboxParams(infobox) {
    const inner = infobox.slice(2, -2)
    const params = {}
    for (const part of splitTopLevel(inner, '|').slice(1)) {
        const eq = part.indexOf('=')
        if (eq > 0) {
            params[part.slice(0, eq).trim().toLowerCase()] = part
                .slice(eq + 1)
                .trim()
        }
    }

    return params
}

// Plain text of a wikitext value: list templates keep their items (one per
// line), other templates, references and markup are removed
function stripMarkup(value = '') {
    const text = stripComments(value)
    let out = ''
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('{{', i)) {
            const end = closingIndex(text, i)
            const inner = text.slice(i + 2, end - 2)
            const [name, ...args] = splitTopLevel(inner, '|')
            if (LIST_TEMPLATES.has(name.trim().toLowerCase())) {
                out +=
                    '\n' +
                    args
                        .filter((arg) => !/^\s*[\w-]+\s*=/.test(arg))
                        .map((arg) => stripMarkup(arg))
                        .join('\n') +
                    '\n'
            }
            i = end - 1
        } else {
            out += text[i]
        }
    }

    return out
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/'{2,}/g, '')
        .replace(/&nbsp;/g, ' ')
}

// The separate items of a value: lines, bullets and ;/,-separated parts,
// without parenthetical notes such as "(formerly J5)"
export function listItems(value) {
    return stripMarkup(value)
        .replace(/\([^)]*\)/g, '')
        .split(/[\n;,]+/)
        .map((item) =>
            item
                .replace(/^[\s*#:]+/, '')
                .replace(/\s+/g, ' ')
                .trim(),
        )
        .filter(Boolean)
}

// Targets of the wiki links in a value, e.g. hub airport page titles
export function linkTargets(value = '') {
    return [...stripComments(value).matchAll(/\[\[([^\]|#]+)/g)].map((match) =>
        match[1].trim().replace(/_/g, ' '),
    )
}

// The first four-digit year in a value, e.g. a "ceased" date
export function firstYear(value = '') {
    const match = stripComments(value).match(/\b(1[89]\d\d|20\d\d)\b/)

    return match ? Number(match[1]) : undefined
}

// GET a MediaWiki API, retrying with backoff when rate limited
async function api(host, params) {
    const url =
        `https://${host}/w/api.php?` +
        new URLSearchParams({ format: 'json', formatversion: '2', ...params })
    for (let attempt = 1; attempt <= 6; attempt++) {
        await sleep(attempt === 1 ? 1000 : 5000 * attempt)
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        const body = await res.text()
        if (res.ok) {
            try {
                return JSON.parse(body)
            } catch {
                // Rate-limit notices come back as plain text; retry
            }
        }
    }
    throw new Error(`MediaWiki API kept failing: ${url.slice(0, 200)}`)
}

// Follow normalization and redirects reported by a query response
const resolver = (query) => {
    const alias = {}
    for (const entry of [
        ...(query.normalized ?? []),
        ...(query.redirects ?? []),
    ]) {
        alias[entry.from] = entry.to
    }

    return (title) => {
        let current = title
        const seen = new Set()
        while (alias[current] && !seen.has(current)) {
            seen.add(current)
            current = alias[current]
        }

        return current
    }
}

// One value per requested page title, read with `pick` from a batched
// query (redirects followed); `pick` gets undefined for missing pages
async function queryPages(titles, params, pick, batchSize) {
    const result = {}
    for (let i = 0; i < titles.length; i += batchSize) {
        const batch = titles.slice(i, i + batchSize)
        const { query } = await api('en.wikipedia.org', {
            action: 'query',
            redirects: '1',
            titles: batch.join('|'),
            ...params,
        })
        const resolve = resolver(query)
        const byTitle = Object.fromEntries(
            query.pages.map((page) => [page.title, page]),
        )
        for (const title of batch) result[title] = pick(byTitle[resolve(title)])
    }

    return result
}

// Wikitext of each page, keyed by the requested title; '' for missing pages
export const fetchPages = (titles) =>
    queryPages(
        titles,
        { prop: 'revisions', rvprop: 'content', rvslots: 'main' },
        (page) => page?.revisions?.[0]?.slots?.main?.content ?? '',
        20,
    )

// IATA airport code (Wikidata P238) of each airport page title, or
// undefined when it can't be found
export async function fetchAirportCodes(titles) {
    const unique = [...new Set(titles)]
    const itemByTitle = await queryPages(
        unique,
        { prop: 'pageprops', ppprop: 'wikibase_item' },
        (page) => page?.pageprops?.wikibase_item,
        50,
    )

    const items = [...new Set(Object.values(itemByTitle).filter(Boolean))]
    const codeByItem = {}
    for (let i = 0; i < items.length; i += 50) {
        const { entities } = await api('www.wikidata.org', {
            action: 'wbgetentities',
            ids: items.slice(i, i + 50).join('|'),
            props: 'claims',
            formatversion: '1',
        })
        for (const [id, entity] of Object.entries(entities)) {
            codeByItem[id] =
                entity.claims?.P238?.[0]?.mainsnak?.datavalue?.value
        }
    }

    return Object.fromEntries(
        unique.map((title) => [title, codeByItem[itemByTitle[title]]]),
    )
}

export const pageUrl = (title) =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
