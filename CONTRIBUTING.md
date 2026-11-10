# Soaring Symbols: Contribution Guidelines

This document outlines the guidelines for contributing logos and icons to the Soaring Symbols project, a curated collection of airline logos in SVG format.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines.

---

## Contribution Process

We welcome contributions from the community to enrich the Soaring Symbols collection. Here's how you can get involved:

### 1. Folder & File Naming

This project uses a "color-first" approach, where the default asset is the full-color version.

- **Folder Structure**: Each airline's assets must be placed in their own folder under `assets/`. The folder name is the airline's `slug` in `airlines.json`: its name slugified, in lowercase with hyphens (e.g., `assets/vietnam-airlines/`).
- **Color Assets (Default)**: The standard color version of an asset should be named simply `icon.svg` or `logo.svg`.
- **Monochrome Assets**: Monochrome versions are named with a `-mono` suffix (e.g., `icon-mono.svg` or `logo-mono.svg`) and drawn with `fill="currentColor"`.
  - **Single-color assets:** don't add one. The build writes it into the published package from the color file (its one color becomes `currentColor`), and `npm run generate` deletes any committed copy.
  - **Multi-color assets:** a hand-made monochrome version is optional but welcome. If a single-color asset becomes multi-color, its mono version is no longer generated: draw one by hand if you want it.

**Correct Structure Example:**

```plaintext
assets/
└── vietnam-airways/
    ├── icon.svg         # Color version (default); single-color, so the
    │                    #   build adds icon-mono.svg to the package
    ├── logo.svg         # Color version (default)
    └── logo-mono.svg    # Mono version (hand-made, optional for multi-color)
```

#### Older Marks (Logo History)

When an airline changes its logo but keeps its name (e.g. Sun PhuQuoc Airways' 2026 logo), the new marks replace the files in `assets/<slug>/`, so everyone linking them gets the current logo. The old marks are welcome too: put them in `assets/<slug>/history/<year>/`, where `<year>` is the year that mark was **introduced**, with the same file names as the current ones.

```plaintext
assets/
└── sun-phuquoc-airways/
    ├── icon.svg         # current marks (2026)
    ├── logo.svg
    ├── logo-mono.svg
    └── history/
        └── 2025/        # the logo introduced in 2025, used until 2026
            ├── logo.svg
            └── logo-mono.svg
```

- **One folder per mark**, named after the four-digit year it was introduced (look it up in the airline's Wikipedia article or press release). A mark is taken to be used until the next one's year; the newest history folder until the current marks.
- **Only `icon`, `logo` and `tail`** (`.svg`, or a hand-made `-mono.svg` for a multi-color mark) belong in a year folder. A mark can have fewer types than the current ones, e.g. only a logo.
- **Same rules as current marks:** the SVG specifications below, optimized with `npm run optimize`, and `<title>` set to the airline's **current** name (`lint-svg.js --fix` writes it). Single-color marks get their `-mono.svg` from the build, as in `assets/<slug>/`.
- **Nothing to add to `airlines.json`:** the build reads the folders and publishes them as the airline's `history`. `npm run generate` stops if a folder isn't a year up to this one, holds a file other than the asset files, or has no color file.
- **Never move the current files into `history/` without new ones:** `assets/<slug>/` always holds the marks in use today, and an airline that borrows another's marks (`marks`) gets only the current ones.
- **When the name changes too**, rename the airline first (see [Renames and mergers](#renames-and-mergers)); its old marks then go in the new slug's `history/`.
- Say in the pull request where each old mark came from, as for any SVG.

### 2. SVG Specifications

- **SVG Optimization**: All submitted SVGs must be optimized with [SVGO](https://github.com/svg/svgo). The simplest way is the project's config, which keeps `role="img"`, strips editor metadata (Inkscape, Sodipodi), `width`/`height`, raster images, `<style>` and scripts, and avoids path merging that can shift shapes. It writes three decimals, like SVGOMG, and four or five only for a file whose shapes would move at three, visibly or just enough to take the artwork off the edge of the viewBox (63.999 instead of 64):

  ```bash
  npm run optimize -- assets/vietnam-airways/*.svg
  ```

  Online tools such as [SVGOMG](https://svgomg.net) work too. They use SVGO's defaults, which drop `role="img"` and may write a color as a name (`red`); run `node scripts/lint-svg.js --fix` afterwards to add `role="img"` back and turn any named color into hex.

  `node scripts/lint-svg.js` checks that every SVG looks optimized, whichever tool produced it: no `width`/`height`, no XML declaration, comments or design-tool data, at most five decimals in path data, and no leading zeros (`.5`, not `0.5`) or `-0`. When a file still has design-tool data, longer decimals or `-0`, color names or `rgb()`, a `<style>` element or a `transform`, `node scripts/lint-svg.js --fix` runs it through the project's config, as `npm run optimize` would, and keeps the result only if it renders the same; otherwise it reports what to fix by hand. An SVG that a pull request adds or changes must also be optimized: CI fails it if the project's config would still make it more than 10% smaller, which only happens to files that were never optimized (`npm run optimize:check` runs that check locally).

- **Colors**: Write colors as six-digit lowercase hex (`#ff6600`, not `#F60` or `orange`). `npm run optimize` (and `node scripts/lint-svg.js --fix`, which runs it on such files) turns color names and `rgb()` values into hex, and `node scripts/lint-svg.js --fix` expands short hex colors in fills, strokes and gradient stops.

- **One Path per Color**: Draw each color in one `<path>`, so a single-color SVG (including every `-mono` file) has one `<path>` and a multi-color SVG one per color. In a single-color SVG you can try the experimental `node scripts/lint-svg.js --fix --merge-paths`: it joins neighbouring `<path>`s only when the result renders the same, and leaves them apart (still warning) when overlapping shapes would leave a hole. Open the result and check it before committing. Otherwise combine the shapes in your editor (e.g. Inkscape's _Path → Combine_) and check that overlapping shapes don't leave holes. Only combine shapes drawn one after another: if another color sits between two shapes of the same color, merging them would change which one is drawn on top, so they stay apart. `npm run lint:svg` warns about shapes that could join the one before them.

- **ViewBox Dimensions**:

  - **Logos** should use a `viewBox` of `0 0 64 64`.
  - **Icons/Symbols** should use a `viewBox` of `0 0 24 24`.

- **Geometry**: The artwork should fill the `viewBox` without padding: scale it so its larger side equals the `viewBox` size (64 for logos, 24 for icons and tails), keep it fully inside the `viewBox`, and center it on both axes. Within 0.01 of a viewBox unit counts as exact; a small offset within the tolerance shows as a warning, a larger one as an error. `npm run lint:svg` and the [validator page](https://soaringsymbols.org/validate) check this.

- **No Transforms or Scripts**: Don't leave `transform` attributes in the file; apply them to the path data instead (SVGO bakes most of them, and ungrouping in your editor often helps). `<script>` elements and `on*` event attributes are not allowed either. `npm run lint:svg` reports transforms and `<script>` elements.

- **No Styles**: Write every color and property as an attribute (`fill="#ff6600"`, `stop-color="#ff6600"`), not in a `style` attribute or a `<style>` element. `npm run optimize` and `node scripts/lint-svg.js --fix` both turn `style` attributes into attributes; `npm run optimize` also inlines `<style>` elements, and so does `--fix` when the result renders the same.

- **No Strokes**: Draw every shape as a filled outline and leave no `stroke` behind: strokes don't take the single fill color of the derived `-mono` files and throw off the geometry checks. Convert them in your editor (e.g. Inkscape's _Path → Stroke to Path_). `npm run lint:svg` reports any `stroke` or `stroke-*` attribute or style property; `node scripts/lint-svg.js --fix` removes the ones that paint nothing (`stroke="none"`, a lone `stroke-width`), but can't convert a stroke that paints.

- **Groups**: A `<g>` is fine for sharing attributes such as `fill`, `fill-rule` or `clip-path`, but don't nest groups. `node scripts/lint-svg.js --fix` flattens them when the result renders the same; otherwise flatten them in your editor (e.g. Inkscape's _Object → Ungroup_). `npm run lint:svg` warns about nested groups.

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

When adding a new airline, you only need to add an entry to the `airlines.json` file with the base information, including its `slug`. The `assets` the package publishes about the airline are found in its SVGs by the build, so the repository's `airlines.json` never holds them.

Every entry must match [`airlines.schema.json`](airlines.schema.json). `npm run generate` sorts the file, puts every entry's fields in the schema's order, and checks the whole file against the schema. It stops, without writing anything, if an entry has an unknown field, a malformed code or color, or an alliance it does not know. VS Code picks the schema up from the workspace settings, so it autocompletes fields and underlines mistakes as you type. A new field or alliance goes into the schema in the same pull request.

Every airline needs its own `slug`, defunct or not: it names the `assets/<slug>/` folder and is what `parent` and `marks` point at. It must be the name slugified, exactly as `npm run generate` writes it when you leave it out; any other value is rejected, as is a slug another airline already has. `npm run generate` also stops when an airline without `marks` has no `assets/<slug>/` folder.

IATA and ICAO codes must be unique among active airlines. A defunct airline may keep a code that has since been reassigned; `getAirline()` then finds the active airline by that code.

#### Information to Add Manually

| Field Name       | Required | Description                                                                                   |
| :--------------- | :------: | :-------------------------------------------------------------------------------------------- |
| `name`           |   Yes    | Full name of the airline. **Keep the JSON array sorted alphabetically by this field.**        |
| `slug`           |   Yes    | The name slugified, e.g. "vietnam-airlines"; also the `assets/<slug>/` folder name.           |
| `previous_names` |    No    | Names it flew under before, oldest first (see [Renames and mergers](#renames-and-mergers)).   |
| `iata`           |   Yes    | The airline's two-character IATA code.                                                        |
| `icao`           |   Yes    | The airline's three-character ICAO code.                                                      |
| `country`        |   Yes    | The airline's country of origin, using [ISO country codes](https://countrycode.org).          |
| `website`        |   Yes    | The official website of the airline.                                                          |
| `callsign`       |    No    | The ICAO radiotelephony callsign in uppercase, e.g. "VIET NAM AIRLINES".                      |
| `flag_carrier`   |    No    | `true` or `false`.                                                                            |
| `alliance`       |    No    | One of the alliances listed in the schema, e.g. "oneworld", "SkyTeam", "Star Alliance".       |
| `parent`         |    No    | Slug of the airline group this one is a subsidiary of, e.g. "airasia".                        |
| `marks`          |    No    | Slug of the airline whose SVGs this one uses, when it has none of its own (see below).        |
| `hubs`           |    No    | IATA codes of its hub airports, e.g. `["HAN", "SGN"]`. Not a low-cost carrier's bases.        |
| `founded`        |    No    | Year founded, as the first date in the airline's Wikipedia infobox.                           |
| `defunct`        |    No    | `true` if the airline has ceased operations.                                                  |
| `ceased`         |    No    | Year a defunct airline ceased operations; requires `defunct`.                                 |
| `successor`      |    No    | Slug of the airline that carried on a defunct one (a merger, refounding or brand move).       |
| `branding`       |   Yes    | An object containing brand-specific details like `primary_color`, as six-digit lowercase hex. |

#### Generated Asset Metadata

In the published package (`dist/airlines.json`), each airline also has an `assets` object with one entry per available asset type (`icon`, `logo`, `tail`):

| Field Name | Description                                                                                                     |
| :--------- | :-------------------------------------------------------------------------------------------------------------- |
| `color`    | `true` if the full-color `<type>.svg` exists.                                                                   |
| `mono`     | `true` if a corresponding `-mono.svg` variant exists; always `true` for single-color assets.                    |
| `colors`   | The hexadecimal colors the color SVG paints with (fills, strokes and gradient stops); empty when there is none. |

Don't add `assets` to `airlines.json`: `npm run generate` removes it. The same goes for `history` (from `assets/<slug>/history/`), `previous_slugs` (the slugs of `previous_names`) and `predecessors` (the slugs of the airlines whose `successor` is this one), which the build adds too.

### 4. Pull Requests

1. Prepare your SVG files according to the naming and specification guidelines, optimize them with `npm run optimize`, and check them with `npm run lint:svg`.
2. Add the new airline's base information to the `airlines.json` file, ensuring the list remains sorted alphabetically.
3. Run `node scripts/lint-svg.js --fix` and `npm run generate`, which sorts `airlines.json`, checks it against the schema and removes `-mono.svg` files the build makes itself (and `AIRLINES.md`, which is no longer kept).
4. Submit a pull request with the new SVG files and your `airlines.json` entry. Fill in the pull request template: for each SVG, link the file or page it came from (the airline's website, brand guideline or press kit first; Wikimedia Commons or Wikipedia only when the airline publishes no SVG; never a third-party logo site) and say what you changed, such as recoloring, cropping the icon from the logo or vectorizing a PNG by hand.

Every pull request runs the CI workflow (`.github/workflows/ci.yml`): ESLint, Prettier, `node scripts/lint-svg.js --check`, a check that every SVG the pull request adds or changes has been optimized (`npm run optimize:check` runs the same check locally), `npm test`, and a check that running the tooling leaves no uncommitted changes. If it fails on SVG lint or on uncommitted changes, run `node scripts/lint-svg.js --fix` and `npm run generate` locally and commit what they change.

To lint and fix only your own SVGs, try the experimental `node scripts/lint-svg.js --changed --fix`: it works on the SVGs added or changed since `origin/main` (`--base <ref>` picks another ref; listing files, as in `node scripts/lint-svg.js --fix assets/<slug>/icon.svg`, works too) and leaves every other file alone; the run starts with a `🧪 EXPERIMENTAL` line so you know it was limited. Without `--changed`, `--base` or file names, `node scripts/lint-svg.js` lints every SVG as before. It is a shortcut, not the final check: before opening the pull request, run `node scripts/lint-svg.js --check` on every SVG, as CI does, or check your files on the [validator page](https://soaringsymbols.org/validate).

#### Subsidiaries and shared logos

A subsidiary is an airline entry of its own, with its own codes, country and website, plus `parent` set to the slug of the airline group it is a subsidiary of. Listing an airline's subsidiaries means finding the entries whose `parent` is its slug. `parent` holds one airline, even when several own a share, so pick it this way:

- **Flies under a group's brand** (its name or logo, as Jetstar Japan, Thai AirAsia or LATAM Airlines Brasil do): that group, even when another shareholder owns more. Jetstar Japan is `jetstar`, although Japan Airlines holds 50% and Qantas a third.
- **A brand of its own:** its largest shareholder that is an airline in the catalog, e.g. `vietnam-airlines` for Pacific Airlines or `air-china` for Shenzhen Airlines. None, no `parent`.
- **Each name is an entry:** when a subsidiary leaves a group's brand, its new name is a new entry with its own `parent` (see [Renames and mergers](#renames-and-mergers)). Jetstar Pacific stays under `jetstar`, and Pacific Airlines, its name since 2020, is under `vietnam-airlines`.

A subsidiary needs SVGs only when its logo differs:

- **Same logo as another airline:** add no `assets/<slug>/` folder; set `marks` to the slug of the airline whose SVGs it uses, usually the parent. The build copies those files to the subsidiary's own slug in the published package, so the repository keeps one copy.
- **Its own logo:** add `assets/<slug>/` as for any airline, and leave out `marks`.
- **A logo shared by sister airlines but not the parent:** put the SVGs in one of them, and point the others' `marks` at it. `marks` must name an airline with SVGs of its own.

#### Renames and mergers

Each entry is one airline, not one brand: a new name or logo for the same airline changes its entry, and only a different airline gets a new one.

**A new name** (Binter Canarias became Binter in 2014; T'way Air became Trinity Airways):

1. Change `name` and add the old one to `previous_names`, oldest first.
2. Let `npm run generate` give it the slug of the new name, and rename its folder to match (`git mv assets/<old slug> assets/<new slug>`), along with any `parent`, `marks` or `successor` that points at the old slug.
3. If the logo changed too, put the new SVGs in the folder and the old ones in `history/<year introduced>/` ([Older Marks](#older-marks-logo-history)).

```json
{
    "name": "Binter",
    "slug": "binter",
    "previous_names": ["Binter Canarias"],
    ...
}
```

Nothing breaks, so it ships as a patch release: the build publishes the slugs of the old names as `previous_slugs` and copies the airline's current files to `assets/<old slug>/` in the package, so links to the old slug keep working, and `getAirline()` finds the airline by an old slug or name. An old slug can't be another airline's, and `npm run generate` stops if it is.

**A different airline** gets a new entry, and the old one becomes `"defunct": true` with `"ceased": <year>` and `"successor": "<new slug>"`. That is the case when:

- it merged into another airline (Vistara into `air-india`); several airlines can share one successor;
- the company was refounded under a new name (Swissair and SWISS);
- it moved into or out of a group's brand, so its `parent` and `marks` changed with the name: Pacific Airlines flew as Jetstar Pacific, with the Jetstar logo, from 2008 to 2020, then went back to its own name under Vietnam Airlines.

```json
{
    "name": "Jetstar Pacific",
    "slug": "jetstar-pacific",
    "iata": "BL",
    "icao": "PIC",
    "callsign": "PACIFIC EXPRESS",
    "country": "VN",
    "website": "https://www.jetstar.com/vn/en/home",
    "parent": "jetstar",
    "marks": "jetstar",
    "founded": 2008,
    "defunct": true,
    "ceased": 2020,
    "successor": "pacific-airlines",
    "branding": { "primary_color": "#ff5111" }
},
{
    "name": "Pacific Airlines",
    "slug": "pacific-airlines",
    "iata": "BL",
    "icao": "PIC",
    "callsign": "PACIFIC",
    "country": "VN",
    "website": "https://www.pacificairlines.com",
    "parent": "vietnam-airlines",
    "founded": 1990,
    "branding": { "primary_color": "#324471" }
}
```

`founded` and `ceased` give the years each entry flew. Codes can stay the same on both: a code shared with an active airline finds the active one. Following `successor` must end at an airline without one, and the build lists the old entries in the successor's `predecessors`, so the link is written once.

#### When an airline changes

| What changed                              | What to do                                                                                                         |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| The logo, not the name                    | New SVGs in `assets/<slug>/`, old ones in `history/<year introduced>/` ([Older Marks](#older-marks-logo-history)). |
| The name, with or without the logo        | Rename in place with `previous_names` and the new slug ([Renames and mergers](#renames-and-mergers)).              |
| Moves into or out of a group's brand      | New entry; the old one defunct with `successor`.                                                                   |
| Merged into another airline, or refounded | The old airline defunct with `successor` set to the one that carried on.                                           |
| Shut down                                 | `defunct` and `ceased`, keeping the entry and its SVGs.                                                            |
| A code, website, hub, alliance or color   | Edit the entry; `npm run sync:data` suggests code and hub changes from Wikipedia.                                  |
| Becomes another airline's subsidiary      | Set `parent`, and `marks` if it now flies the parent's logo ([Subsidiaries](#subsidiaries-and-shared-logos)).      |
| A name an unrelated airline used (Pan Am) | Not decided yet, since two airlines can't share a slug: ask in an issue or discussion first.                       |

### Example JSON Data

This is what a complete entry looks like in `airlines.json`:

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
        "guidelines": "https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf"
    }
}
```

The published copy in `dist/airlines.json` adds the generated `assets`:

```json
{
    "name": "Vietnam Airlines",
    ...
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
