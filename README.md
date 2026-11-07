# Soaring Symbols

This project aims to create a meticulously curated collection of airline logos, icons and tail designs entirely in SVG format, serving as a valuable resource for travelers, aviation enthusiasts, and designers.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines.

## Project Scope

The initial phase will focus on building a core collection of high-quality SVG logos from major airlines. The collection will be expanded progressively to include regional and potentially historical airlines.

The inclusion of monochrome versions will depend on the airline's brand guidelines and the feasibility of converting their original logos to a simple, one-color format.

## Website

Browse the collection, open a page for any airline to download its marks, and check new SVGs against the contribution guidelines at <https://soaringsymbols.org>. The site's source lives in [soaring-symbols/website](https://github.com/soaring-symbols/website).

## Roadmap

This is the one roadmap for the collection and every integration around it, including the ones built in other repositories (the API on the website, the Raycast extension). Plans that only concern the website itself, such as its pages and tooling, are tracked in the [website's README](https://github.com/soaring-symbols/website#roadmap).

- [x] npm package
- [x] A `branding.primary_color` for every airline
- [x] jsDelivr CDN
- [x] Website with a browsable catalog, a page per airline and an SVG validator
- [x] JSON API on the website, such as [`/api/airlines/VN`](https://soaringsymbols.org/api/airlines/VN)
- [x] Raycast extension
- [x] Image endpoint on the website, to load a mark by IATA or ICAO code, with monochrome marks in a chosen color and PNG for apps that can't render SVG, such as [`/api/airlines/VN/icon.png`](https://soaringsymbols.org/api/airlines/VN/icon.png)
- [ ] Figma plugin, to search airlines by name or IATA code and drop their marks into designs

### Not planned

- Iconify icon set: Iconify declined to add the collection, as airline logos are too niche for its users ([iconify/icon-sets#223](https://github.com/iconify/icon-sets/issues/223)). A self-published Iconify JSON would miss what makes Iconify useful (its API, search and auto-installed `@iconify-json` packages), so the SVGs from npm or jsDelivr remain the way to use the marks.
- Swift and Android packages: bundled marks go stale until the app ships an update, and Android needs every SVG converted to a VectorDrawable. Native apps can load the marks by URL instead, from jsDelivr or the image endpoint. We'll reconsider if someone asks for a package.

## Installation

```bash
# Using npm
npm install soaring-symbols

# Using yarn
yarn add soaring-symbols

# Using pnpm
pnpm add soaring-symbols

# Using bun
bun add soaring-symbols
```

## Ecosystem

| Tool / Integration                                                                                                                                                              | Author                               |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------- |
| [npm Package](https://www.npmjs.com/package/soaring-symbols) <img src="https://cdn.simpleicons.org/npm/000/CB3837" alt="npm" align=left width=24 height=24 />                   | [anhthang]                           |
| [jsDelivr CDN](https://www.jsdelivr.com/package/npm/soaring-symbols) <img src="https://cdn.simpleicons.org/jsdelivr/000/E84D3D" alt="jsDelivr" align=left width=24 height=24 /> | [jsDelivr](https://www.jsdelivr.com) |
| [Raycast Extension](https://www.raycast.com/anhthang/soaring-symbols) <img src="https://cdn.simpleicons.org/raycast/000/FF6363" alt="Raycast" align=left width=24 height=24 />  | [anhthang]                           |

The Raycast extension also works in launchers that run Raycast extensions, such as [Vicinae](https://www.vicinae.com), [SuperCmd](https://supercmd.sh) and [Tinycast](https://tinycast.dev). See the [ecosystem section on the website](https://soaringsymbols.org/#ecosystem) for how to use each one.

### CDN

Link any mark straight from the npm package through jsDelivr, with nothing to install. `<slug>` is the airline's name in lowercase with hyphens (e.g. `vietnam-airlines`, see [AIRLINES.md](./AIRLINES.md)); swap `logo` for `icon` or `tail` to get the other marks.

```text
https://cdn.jsdelivr.net/npm/soaring-symbols/dist/assets/<slug>/logo.svg
```

## Usage

```js
import { listAirlines, getAirline, getAssetPath } from 'soaring-symbols'

// Every airline, sorted by name
const all = listAirlines()

// One airline, by IATA code, ICAO code, slug or name
const vna = getAirline('VN')

/* output example
{
    "name": "Vietnam Airlines",
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
    "slug": "vietnam-airlines",
    "assets": {
        "icon": { "color": true, "mono": true, "colors": ["#d99e09"] },
        "logo": { "color": true, "mono": true, "colors": ["#d99e09", "#005e80"] }
    }
}
*/

// Package path of an SVG, or undefined if the airline has no such file
getAssetPath('VN', 'logo') // 'soaring-symbols/assets/vietnam-airlines/logo.svg'
getAssetPath('VN', 'logo', { mono: true }) // '.../logo-mono.svg'

// Read the markup in Node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(
    fileURLToPath(import.meta.resolve(getAssetPath('VN', 'logo'))),
    'utf8',
)
```

For a full list of functions and the data structures they return, please see the [API Reference](./API.md). Upgrading from `0.1.0-alpha.14` or earlier, which had `getAssets()` and `getAssetContent()`? The reference has a [migration guide](./API.md#migrating-from-the-old-api).

## Contributing

Contributions are welcome!

Whether through adding new logos, improving existing ones, or suggesting features to enhance usability. Please refer to our [Contribution Guidelines](https://github.com/soaring-symbols/soaring-symbols/blob/main/CONTRIBUTING.md) for detailed instructions on how to contribute effectively.

## License

This repository is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

[anhthang]: https://github.com/anhthang
