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
- **Monochrome Assets (Optional)**: A monochrome version is only required for multi-color assets. It should be named with a `-mono` suffix (e.g., `icon-mono.svg` or `logo-mono.svg`).

**Correct Structure Example:**

```plaintext
assets/
└── vietnam-airways/
    ├── icon.svg         # Color version (default)
    ├── icon-mono.svg    # Mono version (optional)
    ├── logo.svg         # Color version (default)
    └── logo-mono.svg    # Mono version (optional)
```

### 2. SVG Specifications

- **SVG Optimization**: All submitted SVGs must be optimized with [SVGO](https://github.com/svg/svgo) using the project's config, which keeps `role="img"`, strips editor metadata (Inkscape, Sodipodi) and avoids path merging that can shift shapes:

  ```bash
  npm run optimize -- assets/vietnam-airways/*.svg
  ```

  Online tools such as [SVGOMG](https://svgomg.net) use SVGO's defaults, which remove `role="img"` and can leave editor metadata behind, so prefer the command above.

- **Single-Color Assets**: A single-color SVG (including every `-mono` file) should draw everything in one `<path>`. Combine the shapes in your editor (e.g. Inkscape's *Path → Combine*) and check that overlapping shapes don't leave holes; `npm run lint:svg` warns about single-color files with more than one shape.

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

When adding a new airline, you only need to add an entry to the `airlines.json` file with the base information. The `generate.js` script will then analyze your SVG files and automatically generate the detailed `branding.assets` object.

#### Information to Add Manually

| Field Name     | Required | Description                                                                            |
| :------------- | :------: | :------------------------------------------------------------------------------------- |
| `name`         |   Yes    | Full name of the airline. **Keep the JSON array sorted alphabetically by this field.** |
| `iata`         |   Yes    | The airline's two-character IATA code.                                                 |
| `icao`         |   Yes    | The airline's three-character ICAO code.                                               |
| `country`      |   Yes    | The airline's country of origin, using [ISO country codes](https://countrycode.org).   |
| `website`      |   Yes    | The official website of the airline.                                                   |
| `flag_carrier` |    No    | `true` or `false`.                                                                     |
| `alliance`     |    No    | e.g., "oneworld", "SkyTeam", "Star Alliance".                                          |
| `defunct`      |    No    | `true` if the airline has ceased operations.                                           |
| `vectorized`   |    No    | `true` if you manually vectorized the SVG.                                             |
| `branding`     |   Yes    | An object containing brand-specific details like `primary_color`.                      |

#### Generated Asset Metadata

After you run the script, the `branding.assets` object will be populated with the following data for each available asset:

| Field Name      | Description                                                              |
| :-------------- | :----------------------------------------------------------------------- |
| `has_mono_file` | `true` if a corresponding `-mono.svg` variant exists.                    |
| `color_model`   | `"single"` or `"multi"`, based on the number of colors found in the SVG. |
| `colors`        | An array of the hexadecimal color codes found in the SVG file.           |

Additional behavior:

- If `has_mono_file` is `false` but `color_model` is `"single"`, this means the color SVG uses a single solid color — the colored SVG can be treated as a monochrome asset (it can be filled or used anywhere a mono version is expected).

This behavior is detected automatically by the `generate.js` script when it inspects the airline's assets.

### 4. Pull Requests

1. Prepare your SVG files according to the naming and specification guidelines, optimize them with `npm run optimize`, and check them with `npm run lint:svg`.
2. Add the new airline's base information to the `airlines.json` file, ensuring the list remains sorted alphabetically.
3. **You must run the `generate.js` script** (`npm run generate` or `node generate.js`). This script is essential as it will:
    - Analyze your new SVG files.
    - **Automatically generate the `branding.colors` metadata.**
    - Update the `AIRLINES.md` documentation file.
    - Refresh the Swift package (`Catalog.swift` and the PNG/SVG resources). Install `rsvg-convert` first when SVG bytes changed (`apt install librsvg2-bin` or `brew install librsvg`).
4. Submit a pull request that includes the new SVG files and the updated `airlines.json`, `AIRLINES.md`, and Swift package files. Please provide a clear description of your changes.

### Example JSON Data (After Script is Run)

This is what a complete entry for an airline looks like after the `generate.js` script has run and populated the `assets` object.

```json
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
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf",
        "colors": {
            "icon": {
                "has_mono_file": false,
                "color_model": "single",
                "colors": [
                    "#d99e09"
                ]
            },
            "logo": {
                "has_mono_file": true,
                "color_model": "multi",
                "colors": [
                    "#d99e09",
                    "#005e80"
                ]
            }
        }
    }
}
```
