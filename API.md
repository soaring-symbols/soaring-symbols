# Soaring Symbols: API Reference

The functions the `soaring-symbols` package exports and the data they return. Upgrading from `0.1.0-alpha.14` or earlier? See [Migrating from the old API](#migrating-from-the-old-api).

```js
import { listAirlines, getAirline, findAirlines, getAssetPath } from 'soaring-symbols'
```

It works in ESM (`import`) and CommonJS (`require`). The library only reads the bundled `airlines.json` and `alliances.json`, so it runs in Node, browsers and edge runtimes.

## Functions

### `listAirlines()`

Returns every airline, sorted by name.

- **Returns:** `Airline[]` (see [Airline](#airline))

The array is a fresh copy on each call, safe to sort or filter in place. The airline objects are frozen; copy one (`{ ...airline }`) to change it.

```js
const all = listAirlines()
const skyTeam = all.filter((airline) => airline.alliance === 'SkyTeam')
```

### `getAirline(query)`

Finds one airline. `query` is matched, ignoring case and surrounding whitespace, against the IATA code, ICAO code, slug, full name, other names (`aliases`) and their slugs, and last the codes it used before (`former`), in that order.

Codes of ceased airlines get reassigned: a code held by an active and a defunct airline (`defunct: true`) finds the active one; find the defunct one by slug or name. A brand flying under its parent's codes (Hawaiian Airlines under Alaska Airlines) shares them with its `parent`, which the code finds. IATA may also give one code to two airlines whose services don't overlap (a controlled duplicate, e.g. SL for Thai Lion Air and SAS Connect): the code finds the holder without `iata_duplicate`, and the code with IATA's asterisk (`SL*`) finds the one with it, as do its ICAO code, slug and name. A renamed airline is also found by its former names and slugs, and one whose codes changed by its former codes when no airline holds them now (`former`); one that merged into another stays in the catalog with a `successor` (see [Renames and mergers](#renames-and-mergers)).

- **Argument:** `query` (string)
- **Returns:** `Airline`, or `undefined` if nothing matches.

```js
// All of these find Vietnam Airlines
getAirline('VN')
getAirline('hvn')
getAirline('vietnam-airlines')
getAirline('Vietnam Airlines')

getAirline('XX') // undefined

// SL is an IATA controlled duplicate
getAirline('SL').slug // 'thai-lion-air'
getAirline('SL*').slug // 'sas-connect'
```

### `findAirlines(code, options?)`

Finds every airline holding an IATA or ICAO code, for when `getAirline()` returns one of several: a code reassigned from a defunct airline, shared by a brand and its parent, or an IATA controlled duplicate. Matching ignores case and surrounding whitespace.

The airline `getAirline()` finds by the code comes first, then other active airlines, then defunct ones, each sorted by name.

- **Arguments:**
  - `code`: an IATA or ICAO code (string)
  - `options.former` (boolean, default `false`): also return its former holders (`former`), after the current ones, in the same order
- **Returns:** `Airline[]`, a fresh array, empty when no airline holds the code.

```js
findAirlines('SL').map((a) => a.slug) // ['thai-lion-air', 'sas-connect']
findAirlines('AS').map((a) => a.slug) // ['alaska-airlines', 'hawaiian-airlines']
findAirlines('BL').map((a) => a.slug) // ['pacific-airlines', 'jetstar-pacific']

findAirlines('HA') // [], Hawaiian Airlines' former IATA code
findAirlines('HA', { former: true }).map((a) => a.slug) // ['hawaiian-airlines']
```

### `getAssetPath(airline, type, options?)`

Returns the package path of one SVG, ready for `require.resolve`, `import.meta.resolve` or your bundler.

- **Arguments:**
  - `airline`: an `Airline` object, or any `query` accepted by `getAirline()`
  - `type`: `'icon'`, `'logo'`, `'logo-stacked'` or `'tail'` (anything else throws a `TypeError`). `'logo'` is the horizontal lockup, or the only one; `'logo-stacked'` the vertical one (name under the mark), only for airlines with both, so fall back to `'logo'` when it returns `undefined`
  - `options.mono` (boolean, default `false`): return the `-mono.svg` variant
  - `options.dark` (boolean, default `false`): return the `-dark.svg` variant for dark backgrounds (see [Dark backgrounds](#dark-backgrounds)); combined with `mono` it throws a `TypeError`
  - `options.since` (number, optional): return the file of the older mark introduced that year, from the airline's [`history`](#history)
- **Returns:** `string`, or `undefined` if the airline is unknown, has no older mark from `since`, or the file doesn't exist.

```js
getAssetPath('VN', 'logo') // 'soaring-symbols/airlines/vietnam-airlines/logo.svg'
getAssetPath('VN', 'logo', { mono: true }) // 'soaring-symbols/airlines/vietnam-airlines/logo-mono.svg'
getAssetPath('VN', 'logo', { dark: true }) // 'soaring-symbols/airlines/vietnam-airlines/logo-dark.svg'
getAssetPath('VN', 'tail') // undefined: Vietnam Airlines has no tail asset

// The stacked logo for a square slot, else the horizontal one
getAssetPath('VN', 'logo-stacked') ?? getAssetPath('VN', 'logo')

// An older mark, once the airline has one in its history
getAssetPath('9G', 'logo', { since: 2025 }) // 'soaring-symbols/airlines/sun-phuquoc-airways/history/2025/logo.svg'
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
import logoUrl from 'soaring-symbols/airlines/vietnam-airlines/logo.svg'
```

For a browser URL, link the file on jsDelivr or unpkg by the airline's `slug`, with no install:

```js
const url = `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/airlines/${airline.slug}/logo.svg`
const unpkgUrl = `https://unpkg.com/soaring-symbols/dist/airlines/${airline.slug}/logo.svg`
```

Without a bundler, a page can import the library from unpkg as an ES module. Name `dist/index.js`: the bare `https://unpkg.com/soaring-symbols` serves the CommonJS build.

```js
import { getAirline } from 'https://unpkg.com/soaring-symbols@0.5/dist/index.js'
```

### `listAlliances()`

Returns every alliance an airline may name in `alliance`, sorted by name, as [`Alliance`](#alliance) objects. One whose logos aren't in the collection yet has empty `assets`. In releases after 0.3.3.

### `getAlliance(query)`

Finds an alliance by name (as airlines write it in `alliance`) or slug, ignoring case. Returns the [`Alliance`](#alliance), or `undefined`.

```js
getAlliance('Star Alliance').slug // 'star-alliance'
getAlliance(getAirline('VN').alliance).name // 'SkyTeam'
```

### `getAllianceAssetPath(alliance, type, options?)`

[`getAssetPath()`](#getassetpathairline-type-options) for an alliance: `alliance` is an `Alliance` or any `getAlliance()` query, `type` is `'icon'` or `'logo'` (no tail; anything else throws a `TypeError`), and `options.mono`, `options.dark` and `options.since` work the same.

```js
getAllianceAssetPath('Star Alliance', 'logo') // 'soaring-symbols/alliances/star-alliance/logo.svg', once it has one
```

On jsDelivr: `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/alliances/${alliance.slug}/logo.svg`.

### Fixing an SVG in the browser

`soaring-symbols/svg-fixer` runs `node scripts/lint-svg.js --fix` on SVG text in the browser, as the website's validate page does. It is ESM only and bundles SVGO and resvg (a few hundred kilobytes), so import it on demand. Install its optional peer dependency [`@resvg/resvg-wasm`](https://www.npmjs.com/package/@resvg/resvg-wasm) 2.6.2 and load its WebAssembly once with `initSvgFixer`.

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

Without a bundler, import it from unpkg with `?module`, which rewrites its `@resvg/resvg-wasm` import to an unpkg URL for the pinned version:

```js
import { initSvgFixer, fixSvg } from 'https://unpkg.com/soaring-symbols@0.5/dist/svg-fixer.js?module'

await initSvgFixer(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'))
```

`content` is the fixed SVG, or the unchanged text when `fixed` is false. `issues` lists problems as `lint-svg.js` reports them, including geometry it leaves for an editor; `warnings` never fail `--check`. Two more options:

- `mergePaths: true` also joins neighbouring paths of one color, like `--merge-paths` (experimental).
- `fillColor: '#c30b12'` fills a color file with no color of its own (only `currentColor` or default black); without it, such a file is reported and left alone.

## Data Models

### Airline

Returned by `getAirline()` and in `listAirlines()`'s array.

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
        "guidelines": "https://web.archive.org/web/20210515192059/https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf",
        "dark_color": ["icon"]
    },
    "assets": {
        "icon": {
            "color": true,
            "mono": true,
            "dark": true,
            "colors": ["#d99e09"]
        },
        "logo": {
            "color": true,
            "mono": true,
            "dark": true,
            "colors": ["#d99e09", "#005e80"]
        }
    }
}
```

| Field                    | Type        | Description                                                                                                                                                                                 |
| :----------------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                   | `string`    | Full airline name.                                                                                                                                                                          |
| `slug`                   | `string`    | URL-friendly name and asset folder name; the same in the repo's `airlines.json`. Follows the current name.                                                                                  |
| `aliases`                | `object[]?` | Other names the airline uses now, e.g. `SWISS` (see [Aliases](#aliases)). No key when there are none.                                                                                       |
| `iata`                   | `string`    | 2-character IATA code.                                                                                                                                                                      |
| `iata_duplicate`         | `true?`     | `true` when IATA gave the code to another airline too and marks this one with an asterisk (`"SL*"`); `getAirline()` finds the other by the code.                                            |
| `icao`                   | `string`    | 3-letter ICAO code.                                                                                                                                                                         |
| `callsign`               | `string?`   | ICAO radiotelephony callsign, uppercase, e.g. `"VIET NAM AIRLINES"`.                                                                                                                        |
| `former`                 | `object[]?` | Names and codes it used before, oldest first (see [Renames and mergers](#renames-and-mergers)). No key when there are none.                                                                 |
| `country`                | `string`    | ISO 3166-1 alpha-2 code of the country the airline is based in, e.g. `"SE"` for Scandinavian Airlines.                                                                                      |
| `website`                | `string?`   | Official website.                                                                                                                                                                           |
| `flag_carrier`           | `boolean?`  | `true` for a national flag carrier: of its `country`, or of each in `flag_carrier_countries`.                                                                                               |
| `flag_carrier_countries` | `string[]?` | Only on a joint flag carrier: its countries, including its own `country`, e.g. `["DK", "NO", "SE"]` for Scandinavian Airlines.                                                              |
| `cargo`                  | `true?`     | `true` for a freight-only airline, such as Cargolux, or a passenger airline's cargo brand. Filter on it to list them.                                                                       |
| `alliance`               | `string?`   | `"oneworld"`, `"SkyTeam"` or `"Star Alliance"`: its alliance now, or when it ceased. An affiliate flying under another member's membership has none.                                        |
| `alliance_history`       | `object[]?` | Earlier alliances, oldest first: `{ alliance, since?, until }`, e.g. `{ "alliance": "Star Alliance", "since": 1997, "until": 2024 }` for Scandinavian Airlines. No key when there are none. |
| `parent`                 | `string?`   | Slug of the group this airline is a subsidiary of, e.g. `"airasia"` for Thai AirAsia; filter on it to list a group's airlines.                                                              |
| `marks`                  | `string?`   | Slug of the airline whose logos this one uses. Its files are still published under its own slug, so nothing else changes.                                                                   |
| `marks_types`            | `string[]?` | With `marks`, the only types taken from that airline, e.g. `["icon"]`; the rest are its own. `assets` lists both.                                                                           |
| `hubs`                   | `string[]?` | IATA codes of its hubs, e.g. `["HAN", "SGN"]`.                                                                                                                                              |
| `founded`                | `number?`   | Year founded, counting from the predecessor its history starts with (e.g. 1956 for Vietnam Airlines).                                                                                       |
| `defunct`                | `boolean?`  | `true` if the airline has ceased operations.                                                                                                                                                |
| `ceased`                 | `number?`   | Year a defunct airline ceased operations.                                                                                                                                                   |
| `successor`              | `string?`   | Slug of the airline that carried on a defunct one after a merger, refounding or brand move (see [Renames and mergers](#renames-and-mergers)).                                               |
| `predecessors`           | `string[]?` | Slugs of defunct airlines whose `successor` is this one, earliest ceased first. No key when there are none.                                                                                 |
| `branding`               | `object?`   | `primary_color`, `tagline`, `guidelines` (brand guidelines link), `since` (year the current marks came in) and `dark_color` (types kept in color on dark backgrounds), all optional.        |
| `assets`                 | `object`    | One [`AssetInfo`](#assetinfo) per available type (`icon`, `logo`, `logo-stacked`, `tail`). Missing types have no key.                                                                       |
| `history`                | `object[]?` | Marks used before the current ones, oldest first (see [History](#history)). No key when there are none.                                                                                     |

### AssetInfo

Which files exist for one asset type.

| Field    | Type       | Description                                                                                                 |
| :------- | :--------- | :---------------------------------------------------------------------------------------------------------- |
| `color`  | `boolean`  | `<type>.svg`, the full-color version, exists.                                                               |
| `mono`   | `boolean`  | `<type>-mono.svg`, the monochrome version in `currentColor`, exists. Always `true` for single-color assets. |
| `dark`   | `boolean`  | `<type>-dark.svg`, the version for dark backgrounds, exists (see [Dark backgrounds](#dark-backgrounds)).    |
| `colors` | `string[]` | Lowercase hex colors in the color file: fills, strokes and gradient stops. Empty without a color file.      |

Every single-color asset ships a `-mono.svg` generated from its color file; a multi-color one only when drawn by hand, so check `mono` (or whether `getAssetPath(..., { mono: true })` returns a path) before offering a monochrome version.

The asset folder:

```plaintext
airlines/<slug>/
├── icon.svg
├── icon-mono.svg   # generated when icon.svg is single-color
├── icon-dark.svg   # generated, or the airline's own version
├── logo.svg
├── logo-mono.svg   # hand-made for a multi-color logo, optional
└── logo-dark.svg
```

### Dark backgrounds

Most marks are drawn for light backgrounds, and brand guidelines show them in white on dark ones. `<type>-dark.svg` is the file for dark backgrounds, chosen in this order:

1. **The airline's own version**, drawn from what it uses on dark backgrounds, when it changes only part of the mark (Air Canada's black lettering in white, its maple leaf still red).
2. **The color file**, unchanged, for the types in `branding.dark_color`, which the airline keeps in color on dark backgrounds.
3. **The monochrome file in white** (`#ffffff`), what most airlines use on dark backgrounds.
4. **The color file** of a multi-color mark without a `-mono.svg` yet, when all its colors reach 3:1 against `#1e1e1e` (WCAG's contrast for graphics).

An asset with none of these (a multi-color mark with dark parts and no `-mono.svg` yet) has no `-dark.svg` and `dark: false`. So on a dark background, use `getAssetPath(airline, type, { dark: true })` and, when it returns `undefined`, show the color file on a light tile.

### History

An airline that changed its logo may list its older marks in `history`, oldest first, each used from `since` until `until`. The current marks in `assets` came in the year in `branding.since`, when the last older mark ended. Airlines that borrow another's marks (`marks`) have no history.

| Field    | Type     | Description                                                                                                               |
| :------- | :------- | :------------------------------------------------------------------------------------------------------------------------ |
| `since`  | `number` | Year the mark came in; also its folder name.                                                                              |
| `until`  | `number` | Year the next mark replaced it.                                                                                           |
| `name`   | `string` | The airline's name on the mark: its current name, or a former one (a `name` in `former`) for a mark from before a rename. |
| `assets` | `object` | One [`AssetInfo`](#assetinfo) per type the mark has, like the airline's `assets`.                                         |

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

`until` and `name` are in releases after 0.2.4; treat them as optional if you support older ones.

The files sit under `history/<since>/` next to the current ones; `getAssetPath(airline, type, { since })` returns their path:

```plaintext
airlines/<slug>/history/<since>/
├── icon.svg
└── logo.svg
```

On jsDelivr: `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/airlines/${airline.slug}/history/${mark.since}/logo.svg`; on unpkg, the same path after `https://unpkg.com/soaring-symbols/`.

### Hub coordinates

`dist/airports.json` holds the latitude and longitude of every hub in an airline's `hubs`, by IATA code, for a map or globe. The library doesn't read it; load it from the package or a CDN.

```json
{
    "HAN": { "lat": 21.22, "lon": 105.81 },
    "SGN": { "lat": 10.82, "lon": 106.65 }
}
```

Every hub in the catalog has an entry, and only hubs do. Coordinates come from Wikidata, rounded to two decimals (about a kilometre). On jsDelivr: `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/airports.json`. In releases after 0.3.2.

### Alliance

`dist/alliances.json`, which `listAlliances()` returns, has one entry per alliance, its marks in `alliances/<slug>/`, laid out like an airline's.

| Field      | Type        | Description                                                                                                     |
| :--------- | :---------- | :-------------------------------------------------------------------------------------------------------------- |
| `name`     | `string`    | As airlines write it in `alliance`, e.g. `"Star Alliance"`.                                                     |
| `slug`     | `string`    | The slugified name, e.g. `"star-alliance"`, and its marks' folder.                                              |
| `website`  | `string?`   | Official website.                                                                                               |
| `founded`  | `number?`   | Year founded.                                                                                                   |
| `defunct`  | `boolean?`  | The alliance was dissolved.                                                                                     |
| `ceased`   | `number?`   | Year a defunct alliance was dissolved.                                                                          |
| `branding` | `object?`   | As for an airline, e.g. `tagline` (its slogan); `primary_color` is missing only while it has no SVGs.           |
| `assets`   | `object`    | One [`AssetInfo`](#assetinfo) per available type (`icon`, `logo`). Empty until its logos are in the collection. |
| `history`  | `object[]?` | Its older marks, as for an airline ([History](#history)). No key when there are none.                           |

### Aliases

`name` is the full name. Other names the airline goes by, such as the short name on its logo, are in `aliases`, each with:

| Field  | Type      | Description                                                                          |
| :----- | :-------- | :----------------------------------------------------------------------------------- |
| `name` | `string`  | Another name the airline uses now.                                                   |
| `slug` | `string?` | That name's slug, when it differs from the airline's. `getAirline()` finds it by it. |

`getAirline()` finds the airline by an alias or its slug, as by its name. When an alias's slug was the airline's own in a release (before it took its full name), its files ship there too, as for a [former name](#renames-and-mergers).

```js
// SWISS is the short name of Swiss International Air Lines
getAirline('SWISS').slug // 'swiss-international-air-lines'
getAirline('swiss').aliases // [{ name: 'SWISS', slug: 'swiss' }]
getAssetPath('swiss', 'logo') // 'soaring-symbols/airlines/swiss-international-air-lines/logo.svg'
```

### Renames and mergers

Each entry is one airline. A renamed airline takes the new name and its slug and lists the old name in `former`; changed codes, with or without a new name, go there too. Each `former` item holds what the airline used before and the year it stopped:

| Field      | Type      | Description                                                                          |
| :--------- | :-------- | :----------------------------------------------------------------------------------- |
| `name`     | `string?` | A name it flew under before.                                                         |
| `slug`     | `string?` | That name's slug, when it differs from the airline's. `getAirline()` finds it by it. |
| `iata`     | `string?` | A former IATA code.                                                                  |
| `icao`     | `string?` | A former ICAO code.                                                                  |
| `callsign` | `string?` | A former callsign.                                                                   |
| `until`    | `number`  | Year it stopped using them.                                                          |

An item has at least one of `name`, `iata`, `icao` and `callsign`, and only what changed then. Old slugs stay valid: `getAirline()` finds the airline by them or an old name, and by an old code no airline holds now. When an old slug shipped in a release, the package also ships the airline's files at `airlines/<old slug>/`, so links keep working.

An old slug follows the airline like a redirect: its files are the airline's **current** marks under its current name, so `airlines/tway-air/logo.svg` shows Trinity Airways' logo after the rename. The logo it had then is in [`history`](#history) (`airlines/trinity-airways/history/2010/logo.svg`). To keep a file exactly as it was, link an exact release (`soaring-symbols@0.2.4/dist/assets/tway-air/logo.svg`), which never changes.

```js
// Trinity Airways flew as Hansung Airlines, then T'way Air until 2026
getAirline('tway-air').former
// [{ name: 'Hansung Airlines', slug: 'hansung-airlines', until: 2010 },
//  { name: "T'way Air", slug: 'tway-air', until: 2026 }]
getAirline("T'way Air").slug // 'trinity-airways'
getAssetPath('tway-air', 'logo') // 'soaring-symbols/airlines/trinity-airways/logo.svg'
getAssetPath('TW', 'logo', { since: 2010 }) // the T'way Air logo

// Air Serbia flew as Jat Airways, ICAO JAT, until 2013
getAirline('JAT').slug // 'air-serbia'

// Hawaiian Airlines flies under Alaska Airlines' codes since 2026
getAirline('AS').slug // 'alaska-airlines'
getAirline('HA').slug // 'hawaiian-airlines', by its former code
```

When an airline merges into another, is refounded, or moves into or out of a group's brand, the old entry stays under its own slug with `defunct: true`, the year in `ceased`, its marks, and `successor` set to the airline that carried on, which lists it in `predecessors`. A code they share finds the active airline.

```js
// Pacific Airlines flew as Jetstar Pacific, in the Jetstar group, from 2008 to 2020
getAirline('Jetstar Pacific') // { slug: 'jetstar-pacific', defunct: true, ceased: 2020, successor: 'pacific-airlines', ... }
getAirline('BL') // Pacific Airlines, the active one
getAirline('pacific-airlines').predecessors // ['jetstar-pacific']

// The airline flying today, after any merger or move
const current = (airline) =>
    airline.successor ? current(getAirline(airline.successor)) : airline
```

## Versioning

Any release, a patch included, may add to the package without breaking code written for the one before. Two kinds of additions need code ready for them:

- **Lists of values grow.** A new asset type (as `'logo-stacked'` was) or alliance can come in any release, so `AssetType`, the keys of `assets` and `AllianceName` may hold a value your code doesn't know. Skip it or fall back to a default instead of throwing:

  ```js
  const LABELS = { icon: 'Icon', logo: 'Logo', 'logo-stacked': 'Stacked logo', tail: 'Tail' }

  for (const [type, info] of Object.entries(airline.assets)) {
      const label = LABELS[type]
      if (!label) continue // a type added in a later release
      // ...
  }
  ```

  In TypeScript, a `switch` covering every value (with `assertNever` in `default`) stops compiling after such a release until it has the new case; one with a plain `default` keeps working.

- **SVG rules tighten.** `soaring-symbols/svg-validator` and `soaring-symbols/svg-fixer` hold files to the [contribution guidelines](CONTRIBUTING.md), so a release may add or change a rule and an SVG that passed may fail. That isn't a breaking change: fix the file. The shape of their results (`issues`, `warnings`, each check's `group`, `level` and `fixable`) changes only in a breaking release.

## Changes in 0.6

Airline marks moved from `assets/` to `airlines/`, beside `alliances/`, `airlines.json` and `alliances.json`. Nothing else in the data changed: the `assets` field keeps its name.

- **`getAssetPath()` returns `soaring-symbols/airlines/<slug>/…`.** Code that passes its result to `require.resolve`, `import.meta.resolve` or a bundler keeps working; a path written out by hand (`import logo from 'soaring-symbols/assets/…'`) needs `airlines/` instead.
- **CDN links use `dist/airlines/`.** `https://cdn.jsdelivr.net/npm/soaring-symbols@0.5/dist/airlines/vietnam-airlines/logo.svg`. Links to an earlier release (`soaring-symbols@0.5.2/dist/assets/…`) keep working, and so do those on its release line until you move to this one; a link without a version broke with this release.
- **Alliance marks are unchanged**, in `alliances/<slug>/`, and so is the website's image API (`/api/airlines/VN/logo.svg`).

## Changes in 0.5

0.5 gives every airline its full name and moves one wrongly kept name out of the catalog. Look airlines up by IATA or ICAO code where you can: codes didn't change.

- **`name` is the full name.** Shorter names in current use are in the new [`aliases`](#aliases), which `getAirline()` also searches. Four airlines change name and slug; only SWISS keeps its old slug:

  | Up to 0.4                     | From 0.5                                                        | Still found by                                                         |
  | :---------------------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------------- |
  | Azul (`azul`)                 | Azul Brazilian Airlines (`azul-brazilian-airlines`)             | `AD`, `AZU`                                                            |
  | GOL (`gol`)                   | Gol Linhas Aéreas (`gol-linhas-aereas`)                         | `G3`, `GLO`                                                            |
  | SWISS (`swiss`)               | Swiss International Air Lines (`swiss-international-air-lines`) | `LX`, `SWR`, the alias `SWISS` and its slug `swiss`                    |
  | Thai Airways (`thai-airways`) | Thai Airways International (`thai-airways-international`)       | `TG`, `THA` and the alias `THAI`, not `Thai Airways` or `thai-airways` |

  Files are published under the new slugs, and under `assets/swiss/` too; `assets/azul/`, `assets/gol/` and `assets/thai-airways/` are gone.

- **LATAM Airlines Chile no longer answers to `LATAM Airlines`.** That name was never its own, so `getAirline('latam-airlines')` returns `undefined` and `assets/latam-airlines/` is gone: use `latam-airlines-chile`, `LA` or `LAN`.
- **`Gulf Aviation` finds Gulf Air, not Oman Air.** It was Gulf Air's name until 1974; Oman Air's former name is now `Oman Aviation Services` (until 1993, ICAO `OAS`), and its `founded` is 1970, not 1949.
- **A new asset type.** `AssetType` adds `'logo-stacked'`, the vertical lockup some airlines have beside their `logo`, with its own key in `assets`. A `switch` over every `AssetType`, or code reading each `assets` key as one of three types, needs the new case.
- **Types for TypeScript.** `alliance`, `alliance_history[].alliance` and an alliance's `name` are typed `AllianceName`, the alliances the catalog knows, instead of `string`, so a misspelt `'Skyteam'` fails to compile. `AirlineBranding` is now `Branding`, shared with alliances; the old name remains as a deprecated alias.

Nothing else changes for 0.4 code: the marks for dark backgrounds (`<type>-dark.svg`, `assets.<type>.dark`, `getAssetPath(..., { dark: true })` and `branding.dark_color`) are additions.

## Joint flag carriers in 0.4.1

0.4.1 gives every airline one `country`. Scandinavian Airlines, the only entry with several, is now `"SE"`, where it is based, and lists the three countries it is flag carrier of in the new `flag_carrier_countries`:

| Up to 0.4.0                   | From 0.4.1                                                                          |
| :---------------------------- | :---------------------------------------------------------------------------------- |
| `country: "DK,NO,SE"`         | `country: "SE"`, `flag_carrier_countries: ["DK", "NO", "SE"]`                       |
| `airline.country.split(',')`  | `[airline.country]`                                                                 |
| Flag carrier of which nations | `airline.flag_carrier_countries ?? (airline.flag_carrier ? [airline.country] : [])` |

## Changes in 0.4

0.4 removes what 0.3 marked for removal:

- **`previous_names` and `previous_slugs` are gone.** Read the names and slugs in `former` instead, as the table below shows. `getAirline()` still finds a renamed airline by former names and slugs, and files under a former slug still ship.

## `former` in 0.3.2

0.3.2 adds `former`, holding an airline's former names together with its former codes. `previous_names` and `previous_slugs` stayed in 0.3 with the same values and are removed in 0.4:

| Up to 0.3.1              | From 0.3.2                                              |
| :----------------------- | :------------------------------------------------------ |
| `airline.previous_names` | `airline.former.flatMap((f) => f.name ? [f.name] : [])` |
| `airline.previous_slugs` | `airline.former.flatMap((f) => f.slug ? [f.slug] : [])` |

## Changes in 0.3

0.3 removes what 0.2 marked for removal and fixes a name, so 0.2 code may need two changes:

- **`vectorized` is gone.** It said an airline's SVGs were vectorized by hand. Nothing in the package read it; each SVG's source is now recorded in its pull request.
- **Binter is Binter Canarias**, the name its website uses, with the slug `binter-canarias`. The old `binter` slug and its `assets/binter/` files are gone; `getAirline('NT')` and `getAirline('IBB')` find it either way.

## Subsidiaries in 0.2.2

`0.2.2` drops the `subsidiaries` field, in a patch release since nothing known read it. Each airline listed there is now its own entry, with its own codes, country, website and callsign, returned by `listAirlines()` and `getAirline()`. Its `parent` holds the slug of the airline that owns it.

| Up to 0.2.1                              | From 0.2.2                                                         |
| :--------------------------------------- | :----------------------------------------------------------------- |
| `getAirline('AK').subsidiaries`          | `listAirlines().filter((a) => a.parent === 'airasia')`             |
| `getAirline('FD')` returns `undefined`   | Returns Thai AirAsia; `getAssetPath('FD', 'logo')` gives its logo. |
| A subsidiary used its parent's SVG files | It has files under its own slug: `assets/thai-airasia/logo.svg`.   |

## Migrating from the old API

Versions up to `0.1.0-alpha.14` exported `getAssets()`, `getAssetContent()`, a default export and a `soaring-symbols/utils` subpath. They are gone: asset information now ships precomputed in each airline's `assets`, so the library no longer touches the file system.

| Old                                              | New                                                                        |
| :----------------------------------------------- | :------------------------------------------------------------------------- |
| `getAirline(key)` returns `null` when missing    | Returns `undefined`.                                                       |
| `airline.branding.colors.logo`                   | `airline.assets.logo.colors`                                               |
| `getAssets(key)`                                 | `getAirline(key).assets` for metadata, `getAssetPath()` for paths.         |
| `getAssets(key).logo.color`                      | `getAssetPath(key, 'logo')`                                                |
| `getAssets(key).logo.monochrome`                 | `getAssetPath(key, 'logo', { mono: true })`                                |
| `getAssets(key).logo.colors`                     | `getAirline(key).assets.logo.colors`                                       |
| `getAssets(key).logo.color_model`                | `assets.logo.colors.length > 1 ? 'multi' : 'single'`                       |
| `getAssetContent(key).logo.color`                | Read the file: see [Using the path](#using-the-path).                      |
| `import soaringSymbols from 'soaring-symbols'`   | `import { listAirlines, getAirline, getAssetPath } from 'soaring-symbols'` |
| `import { toSlug } from 'soaring-symbols/utils'` | Use `airline.slug`; look an airline up by name with `getAirline(name)`.    |

Two behaviors changed:

- **Paths are package paths.** `getAssets()` returned `assets/<slug>/logo.svg`, relative to the package's `dist/` folder; `getAssetPath()` returns `soaring-symbols/assets/<slug>/logo.svg`, which `require.resolve`, `import.meta.resolve` and bundlers resolve directly.
- **No path for a missing file.** `getAssets()` always set `color`, even for an asset with only a `-mono.svg`; `getAssetPath()` returns `undefined`.

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
