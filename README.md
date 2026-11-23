# Soaring Symbols

A curated collection of airline logos, icons and tail designs in SVG, for travelers, aviation enthusiasts and designers.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines, are not covered by this project's license, and may need their owner's permission to use: read the [Disclaimer](DISCLAIMER.md) first.

## Features

- Airline logos, icons and tail designs as SVG, drawn to one set of rules ([CONTRIBUTING.md](CONTRIBUTING.md)), with a stacked logo beside the horizontal one where the airline has its own, a monochrome version in `currentColor` for every single-color mark and many multi-color ones, and a dark-background version wherever one can be made.
- A catalog of every airline with its IATA and ICAO codes, callsign, country, hubs, alliance, founding year, brand color, shorter names (SWISS, THAI) and whether it flies only cargo, plus a small JS API to look airlines up by code, slug or name ([API.md](API.md)).
- Earlier logos, by the year each came in, in `airlines/<slug>/history/<year>/` ([Older marks](CONTRIBUTING.md#older-marks-logo-history)).
- Renames and mergers: an old name or slug still finds the airline and its files, and a merged airline points to its `successor` ([Renames and mergers](CONTRIBUTING.md#renames-and-mergers)).
- Alliance marks, starting with the oneworld, SkyTeam and Star Alliance icons, in `alliances/<slug>/` ([Alliance marks](CONTRIBUTING.md#alliance-marks)).
- Hub coordinates in `airports.json`, for maps.
- The SVG validator and fixer behind the website's validate page, for any browser app (`soaring-symbols/svg-validator`, `soaring-symbols/svg-fixer`).

## Website

Browse the collection, download any airline's or alliance's marks from its page, and check new SVGs against the contribution guidelines at <https://soaringsymbols.org>. The site's source is in [soaring-symbols/website](https://github.com/soaring-symbols/website).

The site also serves a JSON and image API, no key needed: [`/api/airlines/VN`](https://soaringsymbols.org/api/airlines/VN) for an airline's data and links to its marks, [`/api/airlines/VN/icon.png`](https://soaringsymbols.org/api/airlines/VN/icon.png) for a mark as SVG, or PNG for apps that can't render SVG, with monochrome marks in any color and `?viewbox=auto` to crop a mark to its drawing, [`/api/airlines?code=SL`](https://soaringsymbols.org/api/airlines?code=SL) for every airline holding a code, and alliances at [`/api/alliances`](https://soaringsymbols.org/api/alliances) and [`/api/alliances/skyteam/icon.png`](https://soaringsymbols.org/api/alliances/skyteam/icon.png). The [ecosystem page](https://soaringsymbols.org/ecosystem) lists every parameter.

## Roadmap

The one roadmap for the collection and every integration around it, including those in other repositories (the website's API, the Raycast extension, the Figma plugin, the draw.io libraries). What exists is under [Features](#features), [Website](#website) and [Ecosystem](#ecosystem); plans for the website itself are in the [website's README](https://github.com/soaring-symbols/website#roadmap).

- [ ] Figma plugin, to search airlines by name or IATA code and drop their marks into designs: built in [soaring-symbols/figma](https://github.com/soaring-symbols/figma), [in review on the Figma Community](https://www.figma.com/community/plugin/1701522206126108009)
- [ ] Automatic patch releases, so a merged airline reaches npm, the CDNs, the website and the apps without a manual release
- [ ] Tails on one shared fin shape, so they line up in a grid: each airline's livery placed on a common outline instead of the fin of the aircraft it was drawn from, with the outline as a template in the repository

### Not planned

- Iconify icon set: Iconify declined the collection, as airline logos are too niche for its users ([iconify/icon-sets#223](https://github.com/iconify/icon-sets/issues/223)). A self-published Iconify JSON would miss what makes Iconify useful (its API, search and auto-installed `@iconify-json` packages), so use the SVGs from npm or a CDN.
- Swift and Android packages: bundled marks go stale until the app ships an update, and Android needs every SVG converted to a VectorDrawable. Native apps can load the marks by URL instead, from jsDelivr, unpkg or the image endpoint. We'll reconsider if someone asks.

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

| Tool / Integration                                                                                                                                                                                     | Author                                    |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| [npm Package](https://www.npmjs.com/package/soaring-symbols) <img src="https://cdn.simpleicons.org/npm/000/CB3837" alt="npm" align=left width=24 height=24 />                                          | [anhthang]                                |
| [jsDelivr CDN](https://www.jsdelivr.com/package/npm/soaring-symbols) <img src="https://cdn.simpleicons.org/jsdelivr/000/E84D3D" alt="jsDelivr" align=left width=24 height=24 />                        | [jsDelivr](https://www.jsdelivr.com)      |
| [unpkg CDN](https://app.unpkg.com/soaring-symbols) <img src="https://cdn.simpleicons.org/unpkg/000/000000" alt="unpkg" align=left width=24 height=24 />                                                | [unpkg](https://unpkg.com)                |
| [Raycast Extension](https://www.raycast.com/anhthang/soaring-symbols) <img src="https://cdn.simpleicons.org/raycast/000/FF6363" alt="Raycast" align=left width=24 height=24 />                         | [anhthang]                                |
| [draw.io Libraries](https://github.com/soaring-symbols/drawio) <img src="https://cdn.simpleicons.org/diagramsdotnet/000/F08705" alt="draw.io" align=left width=24 height=24 />                         | [anhthang]                                |
| [Home Assistant](https://github.com/Springvar/home-assistant-flightradar24-card) <img src="https://cdn.simpleicons.org/homeassistant/000/18BCF2" alt="Home Assistant" align=left width=24 height=24 /> | [Springvar](https://github.com/Springvar) |

The Raycast extension also works in launchers that run Raycast extensions, such as [Vicinae](https://www.vicinae.com), [SuperCmd](https://supercmd.sh) and [Tinycast](https://tinycast.dev). The [ecosystem page on the website](https://soaringsymbols.org/ecosystem#raycast) explains how to use each.

The draw.io libraries (`@soaring-symbols/drawio`) hold every airline's icons, logos and tails, and the alliance marks, searchable by name or code in draw.io's shape search, with mono versions that can be recolored: [open them in app.diagrams.net](https://app.diagrams.net/?clibs=Uhttps://cdn.jsdelivr.net/npm/@soaring-symbols/drawio@0.6/dist/icons.xml;Uhttps://cdn.jsdelivr.net/npm/@soaring-symbols/drawio@0.6/dist/logos.xml;Uhttps://cdn.jsdelivr.net/npm/@soaring-symbols/drawio@0.6/dist/tails.xml;Uhttps://cdn.jsdelivr.net/npm/@soaring-symbols/drawio@0.6/dist/alliances.xml), or see [soaring-symbols/drawio](https://github.com/soaring-symbols/drawio) for each library's link.

In Home Assistant, the [Flightradar24 card](https://github.com/Springvar/home-assistant-flightradar24-card) can show each flight's airline beside it, loaded from the image API by the flight's ICAO code: the [ecosystem page](https://soaringsymbols.org/ecosystem#home-assistant) has templates to paste into the card's YAML.

### CDN

Link any mark from the npm package through jsDelivr or unpkg, with nothing to install. `<slug>` is the airline's name in lowercase with hyphens (e.g. `vietnam-airlines`; every airline's page on [soaringsymbols.org](https://soaringsymbols.org) shows it); swap `logo` for `icon` or `tail` for the other marks, or `logo-stacked` for the vertical lockup of an airline that has one.

```text
https://cdn.jsdelivr.net/npm/soaring-symbols/dist/airlines/<slug>/logo.svg
https://unpkg.com/soaring-symbols/dist/airlines/<slug>/logo.svg
```

Alliance marks sit beside them under `alliances/`, with an icon and, for some, a logo:

```text
https://cdn.jsdelivr.net/npm/soaring-symbols/dist/alliances/skyteam/icon.svg
```

> [!NOTE]
> Until 0.6, airline marks were in `dist/assets/`: links to an earlier release keep that path, and [Changes in 0.6](API.md#changes-in-06) says what to update.

Both serve any release: add a release line (`soaring-symbols@0.6`) for fixes without breaking changes, or an exact release (`soaring-symbols@0.4.0`) to freeze the files. jsDelivr caches a release line for up to 12 hours, so each release purges the files it changed there; unpkg redirects a release line to the exact release and caches that redirect only a few minutes.

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
        "icon": { "color": true, "mono": true, "dark": true, "colors": ["#d99e09"] },
        "logo": { "color": true, "mono": true, "dark": true, "colors": ["#d99e09", "#005e80"] }
    }
}
*/

// Package path of an SVG, or undefined if the airline has no such file
getAssetPath('VN', 'logo') // 'soaring-symbols/airlines/vietnam-airlines/logo.svg'
getAssetPath('VN', 'logo', { mono: true }) // '.../logo-mono.svg'
getAssetPath('VN', 'logo', { dark: true }) // '.../logo-dark.svg', for dark backgrounds

// Read the markup in Node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(
    fileURLToPath(import.meta.resolve(getAssetPath('VN', 'logo'))),
    'utf8',
)

// Alliances work the same way, by name or slug
import { getAlliance, getAllianceAssetPath } from 'soaring-symbols'

getAlliance(vna.alliance).slug // 'skyteam'
getAllianceAssetPath('SkyTeam', 'icon') // 'soaring-symbols/alliances/skyteam/icon.svg'
```

For every function and the data it returns, see the [API Reference](./API.md). Upgrading from `0.1.0-alpha.14` or earlier, which had `getAssets()` and `getAssetContent()`? See its [migration guide](./API.md#migrating-from-the-old-api).

## Contributing

Contributions are welcome!

Add new logos, improve existing ones or suggest features: see the [Contribution Guidelines](https://github.com/soaring-symbols/soaring-symbols/blob/main/CONTRIBUTING.md) for how.

## License

The source code and the catalog data (`airlines.json`, `alliances.json`, `airports.json`) are MIT licensed, see [LICENSE](./LICENSE). The logos, icons and tail designs are not: they belong to their airlines and alliances, and the [Disclaimer](./DISCLAIMER.md) explains what that means for using them and how an owner can ask for a mark's removal.

[anhthang]: https://github.com/anhthang
