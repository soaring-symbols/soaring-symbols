# Soaring Symbols

This project aims to create a meticulously curated collection of airline logos, icons and tail designs entirely in SVG format, serving as a valuable resource for travelers, aviation enthusiasts, and designers.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines.

## Project Scope

The initial phase will focus on building a core collection of high-quality SVG logos from major airlines. The collection will be expanded progressively to include regional and potentially historical airlines.

The inclusion of monochrome versions will depend on the airline's brand guidelines and the feasibility of converting their original logos to a simple, one-color format.

## Website

Browse the collection, open a page for any airline to download its marks, and check new SVGs against the contribution guidelines at <https://soaring-symbols.anhthang.workers.dev>. The site's source lives in [soaring-symbols/website](https://github.com/soaring-symbols/website).

## Roadmap

- [x] npm package
- [x] Website with a browsable catalog, a page per airline and an SVG validator
- [x] Raycast extension
- [x] jsDelivr CDN
- [ ] Iconify icon set, for Iconify, Nuxt Icon, UnoCSS, Tailwind and Astro
- [ ] Figma plugin, to search airlines by name or IATA code and drop their marks into designs
- [ ] Swift Package, with an asset catalog and a SwiftUI view
- [ ] JSON API on the website, such as `/api/airlines/VN`
- [ ] A `branding.primary_color` for every airline (Iberia and Qantas have none yet)

Plans for the website itself are tracked in the [website's README](https://github.com/soaring-symbols/website#roadmap).

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

| Tool / Integration | Author |
| :-- | :-- |
| [npm Package](https://www.npmjs.com/package/soaring-symbols) <img src="https://cdn.simpleicons.org/npm/000/CB3837" alt="npm" align=left width=24 height=24 /> | [anhthang]|
| [Raycast Extension](https://www.raycast.com/anhthang/soaring-symbols) <img src="https://cdn.simpleicons.org/raycast/000/FF6363" alt="Raycast" align=left width=24 height=24 /> | [anhthang]|
| [jsDelivr CDN](https://www.jsdelivr.com/package/npm/soaring-symbols) <img src="https://cdn.simpleicons.org/jsdelivr/000/E84D3D" alt="jsDelivr" align=left width=24 height=24 /> | [jsDelivr](https://www.jsdelivr.com) |

### CDN

Link any mark straight from the npm package through jsDelivr, with nothing to install. `<slug>` is the airline's name in lowercase with hyphens (e.g. `vietnam-airlines`, see [AIRLINES.md](./AIRLINES.md)); swap `logo` for `icon` or `tail` to get the other marks.

```text
https://cdn.jsdelivr.net/npm/soaring-symbols/dist/assets/<slug>/logo.svg
```

## Usage

```js
import { listAirlines, getAirline, getAssets, getAssetContent } from 'soaring-symbols'

// Get a list of all airlines
const all = listAirlines()

// Get a specific airline's data
const vna = getAirline('VN') 

/* output example
{
    "name": "Vietnam Airlines",
    "iata": "VN",
    "icao": "HVN",
    "country": "VN",
    "flag_carrier": true,
    "website": "https://www.vietnamairlines.com",
    "alliance": "SkyTeam",
    "branding": {
        "primary_color": "#d99e09",
        "tagline": "Reach Further",
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf"
    },
    "slug": "vietnam-airlines"
}
*/

// Get asset paths for an airline
const assets = getAssets('VN')

/* output example
{
    "icon": {
        "color": "assets/vietnam-airlines/icon.svg",
        "monochrome": null,
        "color_model": "single",
        "colors": [
            "#d99e09"
        ]
    },
    "logo": {
        "color": "assets/vietnam-airlines/logo.svg",
        "monochrome": "assets/vietnam-airlines/logo-mono.svg",
        "color_model": "multi",
        "colors": [
            "#d99e09",
            "#005e80"
        ]
    }
}
*/

// Get SVG content for an airline
const content = getAssetContent('VN')

/* output example - SVG content is truncated for brevity
{
    "icon": {
        "color": "<svg>...</svg>",
        "monochrome": null,
        "color_model": "single",
        "colors": ["#d99e09"]
    },
    "logo": {
        "color": "<svg>...</svg>",
        "monochrome": "<svg>...</svg>",
        "color_model": "multi",
        "colors": ["#d99e09", "#005e80"]
    }
}
*/
```

For a full list of functions and the data structures they return, please see the [API Reference](./API.md).

## Contributing

Contributions are welcome!

Whether through adding new logos, improving existing ones, or suggesting features to enhance usability. Please refer to our [Contribution Guidelines](https://github.com/soaring-symbols/soaring-symbols/blob/main/CONTRIBUTING.md) for detailed instructions on how to contribute effectively.

## License

This repository is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

[anhthang]: https://github.com/anhthang
