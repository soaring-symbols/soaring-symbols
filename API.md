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

Finds one airline. `query` is matched, ignoring case and surrounding whitespace, against the IATA code, then the ICAO code, then the slug, then the full name.

Codes of airlines that ceased operations get reassigned. When a code belongs to both an active airline and a defunct one (`defunct: true`), the code finds the active airline; find the defunct one by its slug or name.

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
- **Returns:** `string`, or `undefined` if the airline is unknown or that file does not exist.

```js
getAssetPath('VN', 'logo') // 'soaring-symbols/assets/vietnam-airlines/logo.svg'
getAssetPath('VN', 'logo', { mono: true }) // 'soaring-symbols/assets/vietnam-airlines/logo-mono.svg'
getAssetPath('VN', 'tail') // undefined: Vietnam Airlines has no tail asset
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

For a URL in the browser, link the file from jsDelivr with the airline's `slug`; you don't need the package installed:

```js
const url = `https://cdn.jsdelivr.net/npm/soaring-symbols/dist/assets/${airline.slug}/logo.svg`
```

## Data Models

### Airline

The object returned by `getAirline()` and found in the array from `listAirlines()`.

```json
{
    "name": "Vietnam Airlines",
    "iata": "VN",
    "icao": "HVN",
    "callsign": "VIET NAM AIRLINES",
    "country": "VN",
    "flag_carrier": true,
    "website": "https://www.vietnamairlines.com",
    "alliance": "SkyTeam",
    "branding": {
        "primary_color": "#d99e09",
        "tagline": "Reach Further",
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf"
    },
    "slug": "vietnam-airlines",
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

| Field          | Type            | Description                                                                                                                         |
| :------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`        | Full airline name.                                                                                                                  |
| `iata`         | `string`        | 2-character IATA code.                                                                                                              |
| `icao`         | `string`        | 3-letter ICAO code.                                                                                                                 |
| `callsign`     | `string?`       | ICAO radiotelephony callsign, uppercase, e.g. `"VIET NAM AIRLINES"`.                                                                |
| `country`      | `string`        | ISO 3166-1 alpha-2 code; comma-separated when the airline belongs to several.                                                       |
| `slug`         | `string`        | URL-friendly name, also the asset folder name.                                                                                      |
| `website`      | `string?`       | Official website.                                                                                                                   |
| `flag_carrier` | `boolean?`      | `true` for a national flag carrier.                                                                                                 |
| `alliance`     | `string?`       | `"oneworld"`, `"SkyTeam"` or `"Star Alliance"`.                                                                                     |
| `defunct`      | `boolean?`      | `true` if the airline has ceased operations.                                                                                        |
| `vectorized`   | `boolean?`      | `true` if the SVG was vectorized by hand.                                                                                           |
| `branding`     | `object?`       | `primary_color`, `tagline` and `guidelines` (link to the brand guidelines), each optional.                                          |
| `assets`       | `object`        | One [`AssetInfo`](#assetinfo) per available type (`icon`, `logo`, `tail`). Missing types have no key.                               |
| `subsidiaries` | `Subsidiary[]?` | Airlines sharing this airline's marks: `name`, `iata`, `icao`, `country`, `flag_carrier?`. They are not returned by `getAirline()`. |

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
