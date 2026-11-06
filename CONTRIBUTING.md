# Soaring Symbols: Contribution Guidelines

This document outlines the guidelines for contributing logos and icons to the Soaring Symbols project, a curated collection of airline logos in SVG format.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines.

---

## Contribution Process

We welcome contributions from the community to enrich the Soaring Symbols collection. Here's how you can get involved:

### 1. Folder & File Naming

This project uses a "color-first" approach, where the default asset is the full-color version.

- **Folder Structure**: Each airline's assets must be placed in their own folder under `assets/`. The folder name must be a slugified, lowercase version of the airline's name (e.g., `assets/vietnam-airways/`).
- **Color Assets (Default)**: The standard color version of an asset should be named simply `icon.svg` or `logo.svg`.
- **Monochrome Assets**: Monochrome versions are named with a `-mono` suffix (e.g., `icon-mono.svg` or `logo-mono.svg`) and drawn with `fill="currentColor"`.
    - **Single-color assets:** don't draw one. `npm run generate` writes it from the color file (its one color becomes `currentColor`) and overwrites it on every run, so commit it but never edit it.
    - **Multi-color assets:** a hand-made monochrome version is optional but welcome. If a single-color asset becomes multi-color, replace its generated `-mono.svg` by hand or delete it.

**Correct Structure Example:**

```plaintext
assets/
└── vietnam-airways/
    ├── icon.svg         # Color version (default)
    ├── icon-mono.svg    # Mono version (generated: icon.svg is single-color)
    ├── logo.svg         # Color version (default)
    └── logo-mono.svg    # Mono version (hand-made, optional for multi-color)
```

### 2. SVG Specifications

- **SVG Optimization**: All submitted SVGs must be optimized with [SVGO](https://github.com/svg/svgo) using the project's config, which keeps `role="img"`, strips editor metadata (Inkscape, Sodipodi) and avoids path merging that can shift shapes:

    ```bash
    npm run optimize -- assets/vietnam-airways/*.svg
    ```

    Online tools such as [SVGOMG](https://svgomg.net) use SVGO's defaults, which remove `role="img"` and can leave editor metadata behind, so prefer the command above.

- **Colors**: Write colors as six-digit lowercase hex (`#ff6600`, not `#F60` or `orange`). `node scripts/lint-svg.js --fix` expands short hex colors in fills, strokes and gradient stops.

- **Single-Color Assets**: A single-color SVG (including every `-mono` file) should draw everything in one `<path>`. Combine the shapes in your editor (e.g. Inkscape's _Path → Combine_) and check that overlapping shapes don't leave holes; `npm run lint:svg` warns about single-color files with more than one shape.

- **ViewBox Dimensions**:

    - **Logos** should use a `viewBox` of `0 0 64 64`.
    - **Icons/Symbols** should use a `viewBox` of `0 0 24 24`.

- **Accessibility Attributes**: To ensure accessibility, all SVGs must include the following attributes and elements:

    - `role="img"`
    - `viewBox="0 0 64 64"` or `viewBox="0 0 24 24"`
    - `xmlns="http://www.w3.org/2000/svg"`
    - A `<title>Airline Name</title>` element providing a text description.

> [\!WARNING]
> **Note on SVG Integrity:**
>
> - **Preserve White Paths:** Please ensure that legitimate white paths within a logo are preserved and not removed or filled during optimization.
> - **Visual Verification:** It's highly recommended to double-check the visual appearance of the logo/icon after optimization to ensure color accuracy and alignment within the `viewBox`.

### 3. JSON Data Updates

When adding a new airline, you only need to add an entry to the `airlines.json` file with the base information. The `generate.js` script will then analyze your SVG files and automatically generate the `assets` object.

Every entry must match [`airlines.schema.json`](airlines.schema.json). `npm run generate` checks the whole file against it and stops, without writing anything, if an entry has an unknown field, a malformed code or color, or an alliance it does not know. VS Code picks the schema up from the workspace settings, so it autocompletes fields and underlines mistakes as you type. A new field or alliance goes into the schema in the same pull request.

IATA and ICAO codes must be unique among active airlines and their subsidiaries. A defunct airline may keep a code that has since been reassigned; `getAirline()` then finds the active airline by that code.

#### Information to Add Manually

| Field Name     | Required | Description                                                                                   |
| :------------- | :------: | :-------------------------------------------------------------------------------------------- |
| `name`         |   Yes    | Full name of the airline. **Keep the JSON array sorted alphabetically by this field.**        |
| `iata`         |   Yes    | The airline's two-character IATA code.                                                        |
| `icao`         |   Yes    | The airline's three-character ICAO code.                                                      |
| `country`      |   Yes    | The airline's country of origin, using [ISO country codes](https://countrycode.org).          |
| `website`      |   Yes    | The official website of the airline.                                                          |
| `callsign`     |    No    | The ICAO radiotelephony callsign in uppercase, e.g. "VIET NAM AIRLINES".                      |
| `flag_carrier` |    No    | `true` or `false`.                                                                            |
| `alliance`     |    No    | One of the alliances listed in the schema, e.g. "oneworld", "SkyTeam", "Star Alliance".       |
| `hubs`         |    No    | IATA codes of its hub airports, e.g. `["HAN", "SGN"]`. Not a low-cost carrier's bases.        |
| `founded`      |    No    | Year founded, as the first date in the airline's Wikipedia infobox.                           |
| `defunct`      |    No    | `true` if the airline has ceased operations.                                                  |
| `ceased`       |    No    | Year a defunct airline ceased operations; requires `defunct`.                                 |
| `vectorized`   |    No    | `true` if you manually vectorized the SVG.                                                    |
| `branding`     |   Yes    | An object containing brand-specific details like `primary_color`, as six-digit lowercase hex. |

#### Generated Asset Metadata

After you run the script, each airline gets an `assets` object with one entry per available asset type (`icon`, `logo`, `tail`):

| Field Name | Description                                                                                                     |
| :--------- | :-------------------------------------------------------------------------------------------------------------- |
| `color`    | `true` if the full-color `<type>.svg` exists.                                                                   |
| `mono`     | `true` if a corresponding `-mono.svg` variant exists; always `true` for single-color assets.                    |
| `colors`   | The hexadecimal colors the color SVG paints with (fills, strokes and gradient stops); empty when there is none. |

`generate.js` also writes `slug` (from `name`) and puts every entry's fields in the schema's order. Never edit `assets` or `slug` by hand; `generate.js` rewrites them on every run.

### 4. Pull Requests

1. Prepare your SVG files according to the naming and specification guidelines, optimize them with `npm run optimize`, and check them with `npm run lint:svg`.
2. Add the new airline's base information to the `airlines.json` file, ensuring the list remains sorted alphabetically.
3. **You must run the `generate.js` script** (`npm run generate` or `node generate.js`). This script is essential as it will:
    - Analyze your new SVG files.
    - **Automatically generate the `assets` metadata.**
    - Update the `AIRLINES.md` documentation file.
4. Submit a pull request that includes the new SVG files and the updated `airlines.json` and `AIRLINES.md` files. Please provide a clear description of your changes.

### Example JSON Data (After Script is Run)

This is what a complete entry for an airline looks like after the `generate.js` script has run and populated the `slug` and `assets` fields.

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
    "hubs": ["HAN", "SGN"],
    "founded": 1956,
    "branding": {
        "primary_color": "#d99e09",
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf"
    },
    "slug": "vietnam-airlines",
    "assets": {
        "icon": {
            "color": true,
            "mono": true,
            "colors": ["#d99e09"]
        },
        "logo": {
            "color": true,
            "mono": true,
            "colors": ["#d99e09", "#005e80"]
        }
    }
}
```
