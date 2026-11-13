# Soaring Symbols: API Reference

This document details the functions exported by the `soaring-symbols` package and the data structures they return. Upgrading from `0.1.0-alpha.14` or earlier? See [Migrating from the old API](#migrating-from-the-old-api).

```js
import { listAirlines, getAirline, getAssetPath } from 'soaring-symbols'
```

The package works in both ESM (`import`) and CommonJS (`require`). The library itself only reads the bundled `airlines.json`, so it runs in Node, in the browser and in edge runtimes alike.

## Functions

### `listAirlines()`

Returns every airline, sorted by name.

- **Returns:** `Airline[]` (see [Airline](#airline))

The array is a fresh copy on each call, so you can sort or filter it in place. The airline objects inside are frozen; copy one (`{ ...airline }`) before changing it.

```js
const all = listAirlines()
const skyTeam = all.filter((airline) => airline.alliance === 'SkyTeam')
```

### `getAirline(query)`

Finds one airline. `query` is matched, ignoring case and surrounding whitespace, against the IATA code, then the ICAO code, then the slug, then the full name, and last against the codes it used before (`former`).

Codes of airlines that ceased operations get reassigned. When a code belongs to both an active airline and a defunct one (`defunct: true`), the code finds the active airline; find the defunct one by its slug or name. A brand that flies under its parent's codes (Hawaiian Airlines under Alaska Airlines) shares them with its `parent`, and the code finds the parent. A renamed airline is also found by its former names and slugs, and an airline whose codes changed by its former codes when no airline has them now (`former`), and one that merged into another stays in the catalog with a `successor` (see [Renames and mergers](#renames-and-mergers)).

- **Argument:** `query` (string)
- **Returns:** `Airline`, or `undefined` if nothing matches.

```js
// All of these find Vietnam Airlines
getAirline('VN')
getAirline('hvn')
getAirline('vietnam-airlines')
getAirline('Vietnam Airlines')

getAirline('XX') // undefined
```

### `getAssetPath(airline, type, options?)`

Returns the package path of one SVG file, ready to pass to `require.resolve`, `import.meta.resolve` or your bundler.

- **Arguments:**
  - `airline`: an `Airline` object, or any `query` accepted by `getAirline()`
  - `type`: `'icon'`, `'logo'` or `'tail'` (any other value throws a `TypeError`)
  - `options.mono` (boolean, default `false`): return the `-mono.svg` variant
  - `options.since` (number, optional): return the file of an older mark from the airline's [`history`](#history), the one introduced that year
- **Returns:** `string`, or `undefined` if the airline is unknown, it has no older mark from `since`, or that file does not exist.

```js
getAssetPath('VN', 'logo') // 'soaring-symbols/assets/vietnam-airlines/logo.svg'
getAssetPath('VN', 'logo', { mono: true }) // 'soaring-symbols/assets/vietnam-airlines/logo-mono.svg'
getAssetPath('VN', 'tail') // undefined: Vietnam Airlines has no tail asset

// An older mark, once the airline has one in its history
getAssetPath('9G', 'logo', { since: 2025 }) // 'soaring-symbols/assets/sun-phuquoc-airways/history/2025/logo.svg'
```

#### Using the path

```js
// Node: read the SVG markup
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(
    fileURLToPath(import.meta.resolve(getAssetPath('VN', 'logo'))),
    'utf8',
)

// CommonJS
const svg = readFileSync(require.resolve(getAssetPath('VN', 'logo')), 'utf8')

// Bundlers (Vite, webpack, ...) take the same path as a static import
import logoUrl from 'soaring-symbols/assets/vietnam-airlines/logo.svg'
```

For a URL in the browser, link the file from jsDelivr or unpkg with the airline's `slug`; you don't need the package installed:

```js
const url = `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/assets/${airline.slug}/logo.svg`
const unpkgUrl = `https://unpkg.com/soaring-symbols/dist/assets/${airline.slug}/logo.svg`
```

Without a bundler, a page can import the library itself from unpkg as an ES module. Name `dist/index.js`: the bare `https://unpkg.com/soaring-symbols` serves the CommonJS build.

```js
import { getAirline } from 'https://unpkg.com/soaring-symbols@0.3/dist/index.js'
```

### Fixing an SVG in the browser

`soaring-symbols/svg-fixer` runs `node scripts/lint-svg.js --fix` on an SVG's text in the browser; the website's validate page uses it. It is ESM only and bundles SVGO and resvg (a few hundred kilobytes), so import it when needed. Install its optional peer dependency [`@resvg/resvg-wasm`](https://www.npmjs.com/package/@resvg/resvg-wasm) 2.6.2 and load its WebAssembly once with `initSvgFixer`.

```js
import { initSvgFixer, fixSvg } from 'soaring-symbols/svg-fixer'
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url' // Vite

await initSvgFixer(fetch(wasmUrl))

const { content, fixed, issues, warnings } = fixSvg(svgText, {
    type: 'logo', // or 'icon' or 'tail'
    mono: true, // the -mono.svg (defaults to fileName ending in -mono.svg)
    airlineName: 'Vietnam Airlines', // what <title> should hold
    isCatalogName: true, // rename a different title to it
})
```

Without a bundler, import it from unpkg with `?module`, which turns its `@resvg/resvg-wasm` import into an unpkg URL for the pinned version:

```js
import { initSvgFixer, fixSvg } from 'https://unpkg.com/soaring-symbols@0.3/dist/svg-fixer.js?module'

await initSvgFixer(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'))
```

`content` is the fixed SVG, or the unchanged text when `fixed` is false. `issues` lists what was wrong as `lint-svg.js` reports it, including geometry it leaves for an editor; `warnings` never fail `--check`. Two more options:

- `mergePaths: true` also joins neighbouring paths of one color, like `--merge-paths` (experimental).
- `fillColor: '#c30b12'` fills a color file that has no color of its own (only `currentColor` or default black). Without it, such a file is reported and left alone.

## Data Models

### Airline

The object returned by `getAirline()` and found in the array from `listAirlines()`.

```json
{
    "name": "Vietnam Airlines",
    "slug": "vietnam-airlines",
    "iata": "VN",
    "icao": "HVN",
    "callsign": "VIET NAM AIRLINES",
    "country": "VN",
    "flag_carrier": true,
    "website": "https://www.vietnamairlines.com",
    "alliance": "SkyTeam",
    "hubs": ["HAN", "SGN"],
    "founded": 1956,
    "branding": {
        "primary_color": "#d99e09",
        "tagline": "Reach Further",
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf"
    },
    "assets": {
        "icon": { "color": true, "mono": true, "colors": ["#d99e09"] },
        "logo": {
            "color": true,
            "mono": true,
            "colors": ["#d99e09", "#005e80"]
        }
    }
}
```

| Field              | Type        | Description                                                                                                                                                                                                   |
| :----------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`             | `string`    | Full airline name.                                                                                                                                                                                            |
| `slug`             | `string`    | URL-friendly name, also the asset folder name; the same in the repo's `airlines.json`. Follows the current name.                                                                                              |
| `iata`             | `string`    | 2-character IATA code.                                                                                                                                                                                        |
| `icao`             | `string`    | 3-letter ICAO code.                                                                                                                                                                                           |
| `callsign`         | `string?`   | ICAO radiotelephony callsign, uppercase, e.g. `"VIET NAM AIRLINES"`.                                                                                                                                          |
| `former`           | `object[]?` | The names and codes the airline used before, oldest first (see [Renames and mergers](#renames-and-mergers)). No key when there are none.                                                                      |
| `previous_names`   | `string[]?` | **Deprecated**, removed in 0.4: the names in `former`.                                                                                                                                                        |
| `previous_slugs`   | `string[]?` | **Deprecated**, removed in 0.4: the `slug`s in `former`.                                                                                                                                                      |
| `country`          | `string`    | ISO 3166-1 alpha-2 code; comma-separated when the airline belongs to several.                                                                                                                                 |
| `website`          | `string?`   | Official website.                                                                                                                                                                                             |
| `flag_carrier`     | `boolean?`  | `true` for a national flag carrier.                                                                                                                                                                           |
| `alliance`         | `string?`   | `"oneworld"`, `"SkyTeam"` or `"Star Alliance"`: the alliance it is a member of now, or was when it ceased. An affiliate flying under another member's membership has none.                                    |
| `alliance_history` | `object[]?` | Alliances it was a member of before, oldest first: `{ alliance, since?, until }`, e.g. `{ "alliance": "Star Alliance", "since": 1997, "until": 2024 }` for Scandinavian Airlines. No key when there are none. |
| `parent`           | `string?`   | Slug of the airline group this one is a subsidiary of, e.g. `"airasia"` for Thai AirAsia; filter on it to list a group's airlines.                                                                            |
| `marks`            | `string?`   | Slug of the airline whose logos this one uses. The files are still published under this airline's own slug, so nothing else changes.                                                                          |
| `hubs`             | `string[]?` | IATA codes of its hub airports, e.g. `["HAN", "SGN"]`. Low-cost carriers often have bases rather than hubs, and none listed.                                                                                  |
| `founded`          | `number?`   | Year founded, counting from the predecessor its history starts with (e.g. 1956 for Vietnam Airlines).                                                                                                         |
| `defunct`          | `boolean?`  | `true` if the airline has ceased operations.                                                                                                                                                                  |
| `ceased`           | `number?`   | Year a defunct airline ceased operations.                                                                                                                                                                     |
| `successor`        | `string?`   | Slug of the airline that carried on a defunct one after a merger, refounding or brand move (see [Renames and mergers](#renames-and-mergers)).                                                                 |
| `predecessors`     | `string[]?` | Slugs of the defunct airlines whose `successor` is this one, the earliest to cease first. No key when there are none.                                                                                         |
| `branding`         | `object?`   | `primary_color`, `tagline`, `guidelines` (link to the brand guidelines) and `since` (year the current marks came in), each optional.                                                                          |
| `assets`           | `object`    | One [`AssetInfo`](#assetinfo) per available type (`icon`, `logo`, `tail`). Missing types have no key.                                                                                                         |
| `history`          | `object[]?` | The marks the airline used before its current ones, oldest first (see [History](#history)). No key when there are none.                                                                                       |

### AssetInfo

Describes which files exist for one asset type.

| Field    | Type       | Description                                                                                                            |
| :------- | :--------- | :--------------------------------------------------------------------------------------------------------------------- |
| `color`  | `boolean`  | `<type>.svg`, the full-color version, exists.                                                                          |
| `mono`   | `boolean`  | `<type>-mono.svg`, the monochrome version (drawn in `currentColor`), exists. Always `true` for single-color assets.    |
| `colors` | `string[]` | Lowercase hex colors the color file paints with: fills, strokes and gradient stops. Empty when there is no color file. |

Every single-color asset ships a `-mono.svg`, generated from its color file. Multi-color assets have one only when it was drawn by hand, so check `mono` (or whether `getAssetPath(..., { mono: true })` returns a path) before offering a monochrome version.

The asset folder follows this structure:

```plaintext
assets/<slug>/
├── icon.svg
├── icon-mono.svg   # generated when icon.svg is single-color
├── logo.svg
└── logo-mono.svg   # hand-made for a multi-color logo, optional
```

### History

An airline that changed its logo may list its older marks in `history`, oldest first, each used from `since` until `until`. The current marks in `assets` came in the year in `branding.since`, when the last older mark ended. Airlines that borrow another airline's marks (`marks`) have no history.

| Field    | Type     | Description                                                                                                           |
| :------- | :------- | :-------------------------------------------------------------------------------------------------------------------- |
| `since`  | `number` | Year the mark was introduced; also the name of its folder.                                                            |
| `until`  | `number` | Year the next mark replaced it.                                                                                       |
| `name`   | `string` | The airline's name on the mark: its current name, or a former one (`previous_names`) for a mark used before a rename. |
| `assets` | `object` | One [`AssetInfo`](#assetinfo) per type that mark has, like the airline's `assets`.                                    |

```json
"branding": { "primary_color": "#686058", "since": 2026 },
"history": [
    {
        "since": 2010,
        "until": 2026,
        "name": "T'way Air",
        "assets": {
            "logo": { "color": true, "mono": true, "colors": ["#d22c25", "#82ab42"] }
        }
    }
]
```

`until` and `name` are in releases after 0.2.4; read them as optional if you also support older ones.

The files sit next to the current ones, under `history/<since>/`, and `getAssetPath(airline, type, { since })` returns their path:

```plaintext
assets/<slug>/history/<since>/
├── icon.svg
└── logo.svg
```

On jsDelivr: `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/assets/${airline.slug}/history/${mark.since}/logo.svg`, and the same path after `https://unpkg.com/soaring-symbols/` on unpkg.

### Hub coordinates

`dist/airports.json` holds the latitude and longitude of every hub an airline lists in `hubs`, by IATA code, to place them on a map or a globe. The library doesn't read it; load it from the package or a CDN.

```json
{
    "HAN": { "lat": 21.22, "lon": 105.81 },
    "SGN": { "lat": 10.82, "lon": 106.65 }
}
```

Every hub in the catalog has an entry, and only hubs do. The coordinates come from Wikidata, rounded to two decimals (about a kilometre). On jsDelivr: `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/airports.json`. It is in releases after 0.3.2.

### Renames and mergers

Each entry is one airline. When an airline is renamed, its entry takes the new name and the slug of that name, and lists the old name in `former`. When its codes change, with the name or without it, `former` lists the old ones. Each item of `former` holds what the airline used before and the year it stopped:

| Field      | Type      | Description                                                                               |
| :--------- | :-------- | :---------------------------------------------------------------------------------------- |
| `name`     | `string?` | A name it flew under before.                                                              |
| `slug`     | `string?` | The slug of that name, when it differs from the airline's. `getAirline()` finds it by it. |
| `iata`     | `string?` | An IATA code it used before.                                                              |
| `icao`     | `string?` | An ICAO code it used before.                                                              |
| `callsign` | `string?` | A callsign it used before.                                                                |
| `until`    | `number`  | Year it stopped using them.                                                               |

An item has at least one of `name`, `iata`, `icao` and `callsign`, and only what changed then. The old slugs stay valid: `getAirline()` finds the airline by them or by an old name, and by an old code when no airline holds it now. When an old slug was in a release, the package also ships the airline's files at `assets/<old slug>/`, so links to it keep working.

An old slug follows the airline, as a redirect would: its files are the airline's **current** marks under its current name, so `assets/tway-air/logo.svg` shows Trinity Airways' logo once it is renamed. The logo it had then is in [`history`](#history) (`assets/trinity-airways/history/2010/logo.svg`). To keep a file exactly as it was, link an exact release (`soaring-symbols@0.2.4/dist/assets/tway-air/logo.svg`), which never changes.

```js
// Trinity Airways flew as Hansung Airlines, then T'way Air until 2026
getAirline('tway-air').former
// [{ name: 'Hansung Airlines', slug: 'hansung-airlines', until: 2010 },
//  { name: "T'way Air", slug: 'tway-air', until: 2026 }]
getAirline("T'way Air").slug // 'trinity-airways'
getAssetPath('tway-air', 'logo') // 'soaring-symbols/assets/trinity-airways/logo.svg'
getAssetPath('TW', 'logo', { since: 2010 }) // the T'way Air logo

// Air Serbia flew as Jat Airways, ICAO JAT, until 2013
getAirline('JAT').slug // 'air-serbia'

// Hawaiian Airlines flies under Alaska Airlines' codes since 2026
getAirline('AS').slug // 'alaska-airlines'
getAirline('HA').slug // 'hawaiian-airlines', by its former code
```

When an airline merges into another, is refounded, or moves into or out of a group's brand, the old one stays in the catalog under its own slug with `defunct: true`, the year in `ceased`, its marks, and `successor` set to the airline that carried on. That airline lists the old entries in `predecessors`. A code they share finds the active airline.

```js
// Pacific Airlines flew as Jetstar Pacific, in the Jetstar group, from 2008 to 2020
getAirline('Jetstar Pacific') // { slug: 'jetstar-pacific', defunct: true, ceased: 2020, successor: 'pacific-airlines', ... }
getAirline('BL') // Pacific Airlines, the active one
getAirline('pacific-airlines').predecessors // ['jetstar-pacific']

// The airline flying today, after any merger or move
const current = (airline) =>
    airline.successor ? current(getAirline(airline.successor)) : airline
```

## `former` in 0.3.2

0.3.2 adds `former`, which holds an airline's former names together with its former codes. `previous_names` and `previous_slugs` stay in 0.3 with the same values, and are removed in 0.4:

| Up to 0.3.1              | From 0.3.2                                              |
| :----------------------- | :------------------------------------------------------ |
| `airline.previous_names` | `airline.former.flatMap((f) => f.name ? [f.name] : [])` |
| `airline.previous_slugs` | `airline.former.flatMap((f) => f.slug ? [f.slug] : [])` |

## Changes in 0.3

0.3 removes what 0.2 had marked for removal and fixes a name, so code written for 0.2 may need two changes:

- **`vectorized` is gone.** It said an airline's SVGs were vectorized by hand. Nothing in the package read it; each SVG's source is recorded in its pull request instead.
- **Binter is Binter Canarias**, the name its website uses, with the slug `binter-canarias`. The old `binter` slug and its `assets/binter/` files are gone; `getAirline('NT')` and `getAirline('IBB')` find it either way.

## Subsidiaries in 0.2.2

`0.2.2` drops the `subsidiaries` field, in a patch release since nothing known reads it. Each airline that used to be listed there is now an entry of its own, with its own codes, country, website and callsign, returned by `listAirlines()` and `getAirline()`. Its `parent` field holds the slug of the airline that owns it.

| Up to 0.2.1                              | From 0.2.2                                                         |
| :--------------------------------------- | :----------------------------------------------------------------- |
| `getAirline('AK').subsidiaries`          | `listAirlines().filter((a) => a.parent === 'airasia')`             |
| `getAirline('FD')` returns `undefined`   | Returns Thai AirAsia; `getAssetPath('FD', 'logo')` gives its logo. |
| A subsidiary used its parent's SVG files | It has files under its own slug: `assets/thai-airasia/logo.svg`.   |

## Migrating from the old API

Versions up to `0.1.0-alpha.14` exported `getAssets()`, `getAssetContent()`, a default export and a `soaring-symbols/utils` subpath. They are gone; the asset information now ships precomputed in each airline's `assets` field, so the library no longer touches the file system.

| Old                                              | New                                                                        |
| :----------------------------------------------- | :------------------------------------------------------------------------- |
| `getAirline(key)` returns `null` when missing    | Returns `undefined`.                                                       |
| `airline.branding.colors.logo`                   | `airline.assets.logo.colors`                                               |
| `getAssets(key)`                                 | `getAirline(key).assets` for metadata, `getAssetPath()` for file paths.    |
| `getAssets(key).logo.color`                      | `getAssetPath(key, 'logo')`                                                |
| `getAssets(key).logo.monochrome`                 | `getAssetPath(key, 'logo', { mono: true })`                                |
| `getAssets(key).logo.colors`                     | `getAirline(key).assets.logo.colors`                                       |
| `getAssets(key).logo.color_model`                | `assets.logo.colors.length > 1 ? 'multi' : 'single'`                       |
| `getAssetContent(key).logo.color`                | Read the file yourself, see [Using the path](#using-the-path).             |
| `import soaringSymbols from 'soaring-symbols'`   | `import { listAirlines, getAirline, getAssetPath } from 'soaring-symbols'` |
| `import { toSlug } from 'soaring-symbols/utils'` | Use `airline.slug`; look an airline up by name with `getAirline(name)`.    |

Two behaviors changed along the way:

- **Paths are package paths.** `getAssets()` returned `assets/<slug>/logo.svg`, relative to the package's `dist/` folder. `getAssetPath()` returns `soaring-symbols/assets/<slug>/logo.svg`, which `require.resolve`, `import.meta.resolve` and bundlers resolve directly.
- **No path for a missing file.** `getAssets()` always set `color`, even for an asset with only a `-mono.svg` file (for example the Qantas icon). `getAssetPath()` returns `undefined` instead.

### Example: reading every logo

Before:

```js
import { listAirlines, getAssetContent } from 'soaring-symbols'

for (const airline of listAirlines()) {
    const svg = getAssetContent(airline.slug)?.logo?.color
    if (svg) save(airline.slug, svg)
}
```

After:

```js
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { listAirlines, getAssetPath } from 'soaring-symbols'

const require = createRequire(import.meta.url)

for (const airline of listAirlines()) {
    const path = getAssetPath(airline, 'logo')
    if (path) save(airline.slug, readFileSync(require.resolve(path), 'utf8'))
}
```
