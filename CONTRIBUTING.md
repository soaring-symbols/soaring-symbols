# Soaring Symbols: Contribution Guidelines

How to contribute logos and icons to Soaring Symbols, a curated collection of airline logos in SVG format.

> [!IMPORTANT]
> "Soaring Symbols" provides airline logos/icons in SVG for informational and reference purposes only. We do not claim ownership of any trademarks or copyrighted materials. The logos remain the intellectual property of their respective airlines.
>
> The MIT License covers your contributions to the code and the catalog data. The marks you add stay their owners' (see the [Disclaimer](DISCLAIMER.md)), so only submit SVGs taken or traced from a public source, never one you were given under a confidentiality or brand-partner agreement.

---

## Contribution Process

Contributions from the community are welcome. Here's how:

### 1. Folder & File Naming

The project is "color-first": the default asset is the full-color version.

- **Folder Structure**: Each airline's assets go in their own folder under `airlines/`, named after the airline's `slug` in `airlines.json`: its name slugified, lowercase with hyphens (e.g., `airlines/vietnam-airlines/`).
- **Color Assets (Default)**: The color version is named after its type: `icon.svg`, `logo.svg` or `tail.svg`.
- **Horizontal and Stacked Logos**: `logo.svg` is the horizontal lockup, the name beside the mark. When the airline also has an official vertical (stacked) lockup, the name under the mark, add it as `logo-stacked.svg`, with its own `-mono.svg` and `-dark.svg` as for any type. An airline with only a vertical lockup keeps it in `logo.svg`, so every stacked logo has a horizontal one to fall back on (`npm run generate` stops otherwise). Add only a lockup the airline itself uses (brand guidelines, its website or app, signage), never one built by rearranging its mark and name, and link the source in the pull request.
- **Monochrome Assets**: Named with a `-mono` suffix (`icon-mono.svg`, `logo-mono.svg`) and drawn with `fill="currentColor"`.
  - **Single-color assets:** don't add one. The build writes it into the published package from the color file (its one color becomes `currentColor`), and `npm run generate` deletes any committed copy.
  - **Multi-color assets:** a hand-made mono is optional but welcome. A single-color asset that becomes multi-color no longer gets a generated mono: draw one by hand if you want it. When the airline has an all-white version (on dark or colored backgrounds), draw the mono from that artwork, as one path, even where it differs from the color mark.
- **Dark Background Assets**: `<type>-dark.svg` is the version for dark backgrounds. Brand guidelines keep the full-color mark for light backgrounds and show it in white on dark ones, so the build makes it from the mono file in white; a multi-color mark without a mono gets its color file when every color reads on dark (3:1 against `#1e1e1e`), and none otherwise. Two exceptions, each only with a source showing what the airline does on a dark background:
  - **The airline keeps its colors:** list the type in `branding.dark_color` in `airlines.json` (`"dark_color": ["icon"]`), and the build uses the color file. `npm run generate` warns about any of its colors under 3:1 on `#1e1e1e` so the pull request can confirm it against the source, but what the airline does wins.
  - **The airline changes part of the mark** and keeps other colors (Air Canada's black lettering in white, its maple leaf still red): add `<type>-dark.svg` by hand:
    - **Follow the airline:** draw it from what the airline itself shows on a dark background (its brand guidelines, a dark website header, its app), and link the source in the pull request. Never recolor a mark yourself.

      > **Note:** a version on a background in the brand's own color (white lettering on a red header) is made for that color and may not be what the airline does on dark backgrounds. When it is your only source, say so in the pull request, so it can be checked again once a dark one turns up.

    - **Several colors:** a one-color version is a monochrome one: draw it as `<type>-mono.svg` instead, and the build makes the white `-dark.svg` from it.
    - **Same canvas:** the same `viewBox`, `<title>` and SVG specifications as the color file. `npm run generate` stops on a dark file without its color file, with another `viewBox`, identical to the color file, in one color or for a type in `branding.dark_color`, and warns about colors that hardly read on dark.

**Correct Structure Example:**

```plaintext
airlines/
└── vietnam-airlines/
    ├── icon.svg         # Color version (default); single-color, so the
    │                    #   build adds icon-mono.svg to the package
    ├── logo.svg         # Color version (default)
    ├── logo-mono.svg    # Mono version (hand-made, optional for multi-color)
    ├── logo-dark.svg    # Dark version (hand-made only for the airline's own
    │                    #   partial recolor; the build adds the others)
    └── logo-stacked.svg # Vertical lockup (optional, only beside logo.svg)
```

#### Older Marks (Logo History)

When an airline changes its logo but keeps its name (e.g. Sun PhuQuoc Airways' 2026 logo), the new marks replace the files in `airlines/<slug>/`, so everyone linking them gets the current logo. Old marks are welcome too: put them in `airlines/<slug>/history/<year>/`, where `<year>` is the year that mark was **introduced**, with the same file names as the current ones.

```plaintext
airlines/
└── sun-phuquoc-airways/
    ├── icon.svg         # current marks (2026)
    ├── logo.svg
    ├── logo-mono.svg
    └── history/
        └── 2025/        # the logo introduced in 2025, used until 2026
            ├── logo.svg
            └── logo-mono.svg
```

- **One folder per mark**, named after the four-digit year it was introduced (see the airline's Wikipedia article or press release). A mark counts as used until the next one's year; the newest history folder until the current marks.
- **Only `icon`, `logo`, `logo-stacked` and `tail`** (`.svg`, or a hand-made `-mono.svg` or `-dark.svg`) belong in a year folder. A mark can have fewer types than the current ones, e.g. only a logo.
- **Same rules as current marks:** the SVG specifications below, optimized with `npm run optimize`, and `<title>` set to the airline's name, or to the name the mark was used under when the airline was renamed and lists it in `former` (T'way Air for Trinity Airways' 2010 logo); `lint-svg.js --fix` writes the current name when it is neither. As in `airlines/<slug>/`, the build adds `-mono.svg` for single-color marks and `-dark.svg` wherever one can be made.
- **Set `branding.since`** in `airlines.json` to the year the current marks came in: the last older mark was used until then. The build publishes the folders as the airline's `history`, each mark with the years it was used (`since`, `until`) and the name on it. `npm run generate` stops if a folder isn't a year up to this one, holds a file other than the asset files or has no color file, or if `branding.since` is missing or not after the last folder's year.
- **Never move the current files into `history/` without new ones:** `airlines/<slug>/` always holds the marks in use today, and an airline that borrows another's marks (`marks`) gets only the current ones.
- **When the name changes too**, rename the airline first (see [Renames and mergers](#renames-and-mergers)); its old marks then go in the new slug's `history/`.
- Say in the pull request where each old mark came from, as for any SVG.

### 2. SVG Specifications

- **SVG Optimization**: Optimize every SVG with [SVGO](https://github.com/svg/svgo). The simplest way is the project's config, which keeps `role="img"`, strips editor metadata (Inkscape, Sodipodi), `width`/`height`, raster images, `<style>` and scripts, and avoids path merging that can shift shapes. It writes three decimals, like SVGOMG, and four or five only when shapes would move at three, visibly or just enough to take the artwork off the viewBox edge (63.999 instead of 64) or its center (31.9995 instead of 32):

  ```bash
  npm run optimize -- airlines/vietnam-airlines/*.svg
  ```

  If you optimized with another tool and the artwork sits 0.0005 off an edge or the center where your original was exact, the [validator page](https://soaringsymbols.org/validate) says so: optimize the original again with `npm run optimize -- <file>`, which keeps the decimals it needs. `--precision=4` (or `5`) keeps at least that many in any case.

  Online tools such as [SVGOMG](https://svgomg.net) work too, but SVGO's defaults drop `role="img"` and may write a color as a name (`red`); run `node scripts/lint-svg.js --fix` afterwards to add `role="img"` back and turn named colors into hex.

  `node scripts/lint-svg.js` checks that every SVG looks optimized, whichever tool produced it: no `width`/`height`, XML declaration, comments or design-tool data, at most five decimals in path data, and no leading zeros (`.5`, not `0.5`) or `-0`. When a file still has design-tool data, longer decimals or `-0`, color names or `rgb()`, a `<style>` element or a `transform`, `--fix` runs it through the project's config, as `npm run optimize` would, and keeps the result only if it renders the same; otherwise it reports what to fix by hand. SVGs a pull request adds or changes must also be optimized: CI fails one that the project's config would still make more than 10% smaller at the file's own precision (up to five decimals), which only happens to files never optimized (`npm run optimize:check` runs the check locally). A file kept at four decimals passes, though `npm run optimize` may write a smaller one at three.

- **Colors**: Six-digit lowercase hex (`#ff6600`, not `#F60` or `orange`). `npm run optimize` (and `node scripts/lint-svg.js --fix`, which runs it on such files) turns color names and `rgb()` values into hex, and `--fix` expands short hex colors in fills, strokes and gradient stops. A color file (`logo.svg`, `icon.svg`, `tail.svg`) uses its own colors: one with none (only `currentColor` or default black) is reported, since only you know whether it lost its brand color or belongs in `<type>-mono.svg`. Spell `currentColor` in camel case; `--fix` rewrites other spellings. A CSS variable (`fill="var(--brand)"`, from a web page or a design system) is written as the value the file gives it (a `<style>`, a `style="--brand: …"` or the `var()`'s fallback); one the file never defines has no color outside its page, so `--fix` drops it, or draws it black beside other colors as browsers do: give those shapes their hex color.

- **One Path per Color**: Draw each color in one `<path>`: a single-color SVG (every `-mono` file included) has one `<path>`, a multi-color SVG one per color. The experimental `node scripts/lint-svg.js --fix --merge-paths` joins neighbouring `<path>`s of the same color, in single- and multi-color SVGs alike, only when the result renders the same, and leaves them apart (still warning) when overlapping shapes would leave a hole; open and check the result before committing. Otherwise combine the shapes in your editor (e.g. Inkscape's _Path → Combine_), checking that overlaps leave no holes. Only combine shapes drawn one after another: merging two shapes of the same color with another color between them would change which is drawn on top, so they stay apart. `npm run lint:svg` warns about shapes that could join the one before them.

- **ViewBox Dimensions**:
  - **Logos** (`logo.svg` and `logo-stacked.svg`): `viewBox` of `0 0 64 64`.
  - **Icons and tails** (`icon.svg`, `tail.svg`): `viewBox` of `0 0 24 24`.

- **Geometry**: The artwork fills the `viewBox` without padding: its larger side equals the `viewBox` size (64 for logos, 24 for icons and tails), fully inside the `viewBox` and centered on both axes. Up to 0.0005 off counts as exact; a small offset within the tolerance is a warning, a larger one an error. `npm run lint:svg` and the [validator page](https://soaringsymbols.org/validate) check this.

- **No Trademark Symbols**: Leave out the ® and ™ an airline prints beside its logo. They are legal notices, not part of the mark, can't be read at icon size, and pull the artwork off center, since the geometry checks measure them with the rest. Keep one only when the airline's brand guidelines make it part of the mark itself, and link them in the pull request. Remove it from every version of a mark (color, `-mono`, `-dark`, stacked) alike.

- **No Transforms or Scripts**: Apply `transform` attributes to the path data instead of leaving them in the file (SVGO bakes most of them, and ungrouping in your editor often helps). No `<script>` elements or `on*` event attributes either. `npm run lint:svg` reports transforms and `<script>` elements.

- **No Styles**: Write every color and property as an attribute (`fill="#ff6600"`, `stop-color="#ff6600"`), not in a `style` attribute or a `<style>` element. `npm run optimize` and `node scripts/lint-svg.js --fix` both turn `style` attributes into attributes; `npm run optimize` also inlines `<style>` elements, as does `--fix` when the result renders the same.

- **No Strokes**: Draw every shape as a filled outline, with no `stroke` left: strokes don't take the single fill color of the derived `-mono` files and throw off the geometry checks. Convert them in your editor (e.g. Inkscape's _Path → Stroke to Path_). `npm run lint:svg` reports any `stroke` or `stroke-*` attribute or style property; `node scripts/lint-svg.js --fix` removes those that paint nothing (`stroke="none"`, a lone `stroke-width`), but can't convert a stroke that paints.
- **Fill Rules**: Keep `fill-rule="evenodd"` where a path needs it for its holes (the inside of an O), and nothing else: `npm run lint:svg` reports a `fill-rule` or `clip-rule` that changes nothing (one equal to what the element inherits, such as `nonzero` with no `evenodd` around it) and a `clip-rule` outside any `<clipPath>`, the only place it applies, which design tools often leave behind. `node scripts/lint-svg.js --fix` removes them.
- **Known Attributes**: Keep only what draws the mark: `<path>` and the basic shapes, `<g>`, `<defs>`, gradients with their `<stop>`s, `<clipPath>` and `<mask>`, and their geometry and paint attributes (`fill`, `fill-rule`, `opacity`, `clip-path`, `mask`, `gradientTransform`…). `npm run lint:svg` reports anything else. `node scripts/lint-svg.js --fix` removes what changes nothing drawn, as design tools leave behind: `class` with no `<style>`, an `id` nothing refers to, `data-*`, `<desc>`, `baseProfile`, `xml:space` and rendering hints; it rewrites `xlink:href` as `href` and drops `xmlns:xlink`. It removes any other attribute or element too when the SVG renders the same without it; one that changes the drawing stays reported, for you to redraw without it.

- **Groups**: A `<g>` may share attributes such as `fill`, `fill-rule` or `clip-path`, but don't nest groups. `node scripts/lint-svg.js --fix` flattens them when the result renders the same; otherwise flatten them in your editor (e.g. Inkscape's _Object → Ungroup_). `npm run lint:svg` warns about nested groups.

- **Accessibility Attributes**: Every SVG must include:
  - `role="img"`
  - `viewBox="0 0 64 64"` or `viewBox="0 0 24 24"`
  - `xmlns="http://www.w3.org/2000/svg"`
  - A `<title>Airline Name</title>` element as a text description, the first child of `<svg>`.

> [!WARNING]
> **Note on SVG Integrity:**
>
> - **Preserve White Paths:** Keep legitimate white paths in a logo; don't let optimization remove or fill them.
> - **Visual Verification:** Check the logo/icon visually after optimization for color accuracy and alignment within the `viewBox`.
> - **Check what `npm run optimize` changed:** it only keeps a result that resvg renders like the original with the artwork on the same viewBox edges and center, and lists any bounding box value that changed (e.g. `y 28.253 → 28.254`), as `node scripts/lint-svg.js --fix` does when it optimizes a file. Compare each file with the original on the [validator page](https://soaringsymbols.org/validate) or in your editor before committing, and revert any that is even slightly off.

### 3. JSON Data Updates

For a new airline, add only an entry with its base information to `airlines.json`, including its `slug`. The build finds the `assets` the package publishes in the airline's SVGs, so the repository's `airlines.json` never holds them.

Every entry must match [`airlines.schema.json`](airlines.schema.json). `npm run generate` sorts the file, puts each entry's fields in the schema's order and checks the whole file against the schema, stopping without writing anything on an unknown field, a malformed code or color, or an unknown alliance. VS Code picks the schema up from the workspace settings to autocomplete fields and underline mistakes as you type. A new field or alliance goes into the schema in the same pull request.

Every airline, defunct or not, needs its own `slug`: it names the `airlines/<slug>/` folder and is what `parent` and `marks` point at. It must be the name slugified, exactly as `npm run generate` writes it when you leave it out; any other value is rejected, as is a slug another airline already has. `npm run generate` also stops when an airline without `marks` has no `airlines/<slug>/` folder.

IATA and ICAO codes must be unique among active airlines, with three exceptions:

- **A defunct airline** may keep a code that has since been reassigned; `getAirline()` then finds the active airline by that code.
- **A brand that flies under its parent's codes** (Hawaiian Airlines under Alaska Airlines since 2026) may share them with its `parent`; `getAirline()` then finds the parent by them, and the brand by its slug, its name or its codes from before (`former`).
- **An IATA controlled duplicate:** IATA gives one code to two airlines whose services don't overlap, and its code search marks all holders but one with an asterisk (`SL*` for SAS Connect; Thai Lion Air also holds SL). Set `iata_duplicate: true` on each starred holder. `getAirline()` then finds the holder without the asterisk by the code, and a starred one by the code with the asterisk (`SL*`), its ICAO code, slug or name.

#### Information to Add Manually

| Field Name               | Required | Description                                                                                                                                                                     |
| :----------------------- | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                   |   Yes    | Full name of the airline. **Keep the array sorted alphabetically by this field.**                                                                                               |
| `slug`                   |   Yes    | The name slugified, e.g. "vietnam-airlines"; also the `airlines/<slug>/` folder name.                                                                                           |
| `aliases`                |    No    | Other names the airline uses now beside its full one, e.g. `[{ "name": "SWISS" }]` for Swiss International Air Lines ([Aliases](#aliases)).                                     |
| `iata`                   |   Yes    | Two-character IATA code.                                                                                                                                                        |
| `iata_duplicate`         |    No    | `true` when the IATA code is a controlled duplicate shown with an asterisk on IATA's code search, e.g. `SL*` for SAS Connect.                                                   |
| `icao`                   |   Yes    | Three-character ICAO code.                                                                                                                                                      |
| `country`                |   Yes    | The one country the airline is based in, as an [ISO country code](https://countrycode.org).                                                                                     |
| `website`                |   Yes    | Official website.                                                                                                                                                               |
| `callsign`               |    No    | ICAO radiotelephony callsign in uppercase, e.g. "VIET NAM AIRLINES".                                                                                                            |
| `former`                 |    No    | Names and codes it used before, oldest first, each with the year it stopped ([Renames and mergers](#renames-and-mergers)).                                                      |
| `flag_carrier`           |    No    | `true` or `false`; `true` makes it the flag carrier of its `country`.                                                                                                           |
| `flag_carrier_countries` |    No    | Joint flag carriers only: all its countries' codes, its own `country` included, e.g. `["DK", "NO", "SE"]` for Scandinavian Airlines. Needs `flag_carrier: true`.                |
| `cargo`                  |    No    | `true` for an airline that flies only freight, or a passenger airline's cargo brand ([Cargo airlines](#cargo-airlines)).                                                        |
| `alliance`               |    No    | One of the schema's alliances, e.g. "oneworld", "SkyTeam", "Star Alliance", when the airline is a member itself; an affiliate flying under its parent's membership has none.    |
| `alliance_history`       |    No    | Former alliances, oldest first, each with the year it left (`until`) and, when known, joined (`since`), e.g. `[{ "alliance": "Star Alliance", "since": 1997, "until": 2024 }]`. |
| `parent`                 |    No    | Slug of the airline group it is a subsidiary of, e.g. "airasia".                                                                                                                |
| `marks`                  |    No    | Slug of the airline whose SVGs it uses, when it has none of its own (see below).                                                                                                |
| `marks_types`            |    No    | With `marks`, only these types come from that airline, e.g. `["icon"]`; the others are in its own folder (see below).                                                           |
| `hubs`                   |    No    | IATA codes of its hub airports, e.g. `["HAN", "SGN"]`. Each needs coordinates in `airports.json`: `npm run sync:data -- --write` adds them from Wikidata, else by hand.         |
| `founded`                |    No    | Year founded, as the first date in the airline's Wikipedia infobox.                                                                                                             |
| `defunct`                |    No    | `true` if the airline has ceased operations.                                                                                                                                    |
| `ceased`                 |    No    | Year a defunct airline ceased operations; requires `defunct`.                                                                                                                   |
| `successor`              |    No    | Slug of the airline that carried on a defunct one (a merger, refounding or brand move).                                                                                         |
| `branding`               |   Yes    | `primary_color` (six-digit lowercase hex), and optionally `tagline`, `guidelines`, `since` and `dark_color`.                                                                    |

#### Alliance Marks

Alliance logos live apart from the airlines, in `alliances/<slug>/`, where `<slug>` is the slugified name of the alliance's entry in `alliances.json` (`alliances/star-alliance/`). That file lists every alliance `airlines.json` may name in `alliance`, so the entry exists before its SVGs do: add the folder and fill in the entry.

```plaintext
alliances/
└── star-alliance/
    ├── icon.svg         # the mark alone, viewBox 0 0 24 24
    ├── logo.svg         # the mark with the name, viewBox 0 0 64 64
    └── history/         # older marks, as for an airline
        └── 1997/
            └── logo.svg
```

- **The icon first:** alliances show their symbol far more often than a logo with the name, so start with `icon.svg`. Add `logo.svg` only for an official lockup of the symbol and name; an alliance without one is fine, and apps should show the icon when `assets.logo` is missing.
- **Only `icon` and `logo`**, with a hand-made `-mono.svg` for a multi-color one (and `-dark.svg` as for an airline); alliances have no tail. `npm run generate` stops on any other file, and on a folder that matches no alliance.
- **Same rules as airline marks:** the SVG specifications below, `<title>` set to the alliance's name exactly as `alliances.json` writes it (`oneworld`, `SkyTeam`), and older marks in `history/<year>/` with `branding.since` set.
- **Fields in `alliances.json`:** `name` and `slug` are required; `website`, `founded`, `defunct`, `ceased` and `branding` are optional. `branding` is as for an airline, with the alliance's slogan as `tagline`; `primary_color` can wait until its SVGs are added (`npm run generate` stops when an alliance has SVGs but no `primary_color`, as for any airline). A new alliance goes into the `alliance` list in `airlines.schema.json` and into `alliances.json` in the same pull request.

#### Generated Asset Metadata

In the published package (`dist/airlines.json`), each airline also has an `assets` object with one entry per available asset type (`icon`, `logo`, `logo-stacked`, `tail`):

| Field Name | Description                                                                               |
| :--------- | :---------------------------------------------------------------------------------------- |
| `color`    | `true` if the full-color `<type>.svg` exists.                                             |
| `mono`     | `true` if a `-mono.svg` variant exists; always `true` for single-color assets.            |
| `dark`     | `true` if a `-dark.svg` variant for dark backgrounds exists, hand-made or from the build. |
| `colors`   | The hex colors the color SVG paints with (fills, strokes, gradient stops); may be empty.  |

Don't add `assets` to `airlines.json`: `npm run generate` removes it, as it does the other fields the build adds: `history` (from `airlines/<slug>/history/`), the `slug` of each name in `aliases` and `former`, and `predecessors` (the slugs of the airlines whose `successor` is this one).

### 4. Pull Requests

1. Prepare your SVGs following the naming and specifications above, optimize them with `npm run optimize`, and check them with `npm run lint:svg`.
2. Add the airline's base information to `airlines.json`, keeping it sorted alphabetically.
3. Run `node scripts/lint-svg.js --fix` and `npm run generate`, which sorts `airlines.json`, checks it against the schema and removes the `-mono.svg` files the build makes itself (and `AIRLINES.md`, which is no longer kept).
4. Open a pull request with the SVGs and your `airlines.json` entry. In the pull request template, link each SVG's source file or page (the airline's website, brand guidelines or press kit first; Wikimedia Commons or Wikipedia only when the airline publishes no SVG; never a third-party logo site) and say what you changed, such as recoloring, cropping the icon from the logo or vectorizing a PNG by hand.

Every pull request runs CI (`.github/workflows/ci.yml`): ESLint, Prettier, `node scripts/lint-svg.js --check`, a check that every SVG it adds or changes is optimized (`npm run optimize:check` locally), `npm test`, and a check that the tooling leaves no uncommitted changes. If SVG lint or uncommitted changes fail, run `node scripts/lint-svg.js --fix` and `npm run generate` locally and commit what they change.

To lint and fix only your own SVGs, try the experimental `node scripts/lint-svg.js --changed --fix`: it works on the SVGs added or changed since `origin/main` (`--base <ref>` picks another ref; listing files, as in `node scripts/lint-svg.js --fix airlines/<slug>/icon.svg`, works too), leaves every other file alone, and starts with a `🧪 EXPERIMENTAL` line so you know it was limited. Without `--changed`, `--base` or file names, it lints every SVG as before. It is a shortcut, not the final check: before opening the pull request, run `node scripts/lint-svg.js --check` on every SVG, as CI does, or check your files on the [validator page](https://soaringsymbols.org/validate).

#### Subsidiaries and shared logos

A subsidiary is an entry of its own, with its own codes, country and website, plus `parent` set to the slug of its airline group; an airline's subsidiaries are the entries whose `parent` is its slug. `parent` holds one airline even when several own a share, so pick it this way:

- **Flies under a group's brand** (its name or logo, as Jetstar Japan or Thai AirAsia do): that group, even when another shareholder owns more. Jetstar Japan is `jetstar`, although Japan Airlines holds 50% and Qantas a third. When the group is a holding company rather than an airline in the catalog, none: LATAM Airlines Brasil and LATAM Airlines Chile are sisters under LATAM Airlines Group, so neither is the other's `parent`, and they share the brand through `marks`.
- **A brand of its own:** its largest shareholder that is an airline in the catalog, e.g. `vietnam-airlines` for Pacific Airlines or `air-china` for Shenzhen Airlines. If there is none, no `parent`.
- **Each name is an entry:** when a subsidiary leaves a group's brand, its new name is a new entry with its own `parent` (see [Renames and mergers](#renames-and-mergers)). Jetstar Pacific stays under `jetstar`, and Pacific Airlines, its name since 2020, is under `vietnam-airlines`.

A subsidiary needs SVGs only when its logo differs:

- **Same logo as another airline:** no `airlines/<slug>/` folder; set `marks` to the slug of the airline whose SVGs it uses, usually the parent. The build copies those files to the subsidiary's slug in the published package, so the repository keeps one copy.
- **Its own logo:** add `airlines/<slug>/` as for any airline, without `marks`.
- **A logo shared by sister airlines but not the parent:** put the SVGs in one of them and point the others' `marks` at it. `marks` must name an airline with SVGs of its own.
- **Its own logo, another airline's icon or tail:** add `airlines/<slug>/` with its own files, set `marks` to the airline it shares the rest with, and list the shared types in `marks_types`, e.g. `["icon"]` for Cargolux Italia, which flies Cargolux's icon beside its own logo. Only the listed types are copied, so a mark it has but nobody has drawn yet stays missing instead of showing the other airline's. Its folder holds no file of a listed type. Its sister airlines can share all of it, its own files and the types it takes, by pointing `marks` at it: LATAM Cargo Brasil and LATAM Cargo Colombia share LATAM Cargo Chile's cargo logo and the LATAM icon it takes from LATAM Airlines Chile. That is the only chain allowed: an airline that takes every type from another can't be shared on.

#### Cargo airlines

Set `cargo: true` on an airline that flies only freight (Cargolux) and on a passenger airline's cargo brand, not on a passenger airline that also carries cargo in its holds. Otherwise a cargo airline is added like any other: a cargo subsidiary (Cargolux Italia, Lufthansa Cargo) takes `parent`, as above, and a cargo brand that flies under its parent's codes (Qatar Airways Cargo) takes them, as any brand may (see [JSON Data Updates](#3-json-data-updates)).

- **A cargo brand needs a logo of its own:** add one only when the airline shows a cargo logo; freighters in the parent's livery need no entry. It usually takes its parent's icon and tail through `marks_types` (see [Subsidiaries and shared logos](#subsidiaries-and-shared-logos)).
- **Brands without codes of their own** (DHL, Amazon Air), whose aircraft other airlines fly under their own codes, have no entry yet.

#### Aliases

`name` is the airline's full name, as on its Wikipedia page. A shorter name it also goes by, often the one on its logo, goes in `aliases`: Swiss International Air Lines flies as SWISS, Thai Airways International as THAI.

```json
{
    "name": "Swiss International Air Lines",
    "slug": "swiss-international-air-lines",
    "aliases": [{ "name": "SWISS" }],
    ...
}
```

- Only names the airline itself uses now. A name it stopped using goes in `former`, never in both, and a misspelling or a code is no alias.
- `getAirline()` finds the airline by each alias and its slug, so an alias's slug can't be another airline's slug, alias or former name; `npm run generate` stops if it is.
- When an entry used the short name and takes its full name, keep the short one as an alias, not in `former`: the build adds the alias's slug and, when a release shipped it (`published-slugs.json`), copies the airline's current files there, so old links keep working and the change ships as a patch.

#### Renames and mergers

Each entry is one airline, not one brand: a new name or logo for the same airline changes its entry; only a different airline gets a new one.

**A new name** (T'way Air became Trinity Airways in 2026, with a new logo):

1. Change `name` and add the old one to `former`, after any older ones, with the year it stopped being used (`until`) and any code or callsign that changed with it.
2. Let `npm run generate` give it the new name's slug, and rename its folder to match (`git mv airlines/<old slug> airlines/<new slug>`), along with any `parent`, `marks` or `successor` pointing at the old slug.
3. If the logo changed too, put the new SVGs in the folder and the old ones in `history/<year introduced>/` ([Older Marks](#older-marks-logo-history)).

```json
{
    "name": "Trinity Airways",
    "slug": "trinity-airways",
    "former": [
        { "name": "Hansung Airlines", "until": 2010 },
        { "name": "T'way Air", "until": 2026 }
    ],
    ...
}
```

```plaintext
airlines/trinity-airways/
├── icon.svg, logo.svg   # Trinity Airways' marks
└── history/
    └── 2010/            # the T'way Air logo, introduced in 2010
        └── logo.svg
```

Nothing breaks, so it ships as a patch release: the build adds each old name's slug to its `former` item and, for each one a release has shipped (`published-slugs.json`), copies the airline's current files to `airlines/<old slug>/` in the package, so old links keep working; `getAirline()` finds the airline by an old slug or name. An old slug can't be another airline's; `npm run generate` stops if it is.

**A different airline** gets a new entry, and the old one becomes `"defunct": true` with `"ceased": <year>` and `"successor": "<new slug>"`, when:

- it merged into another airline (Vistara into `air-india`); several airlines can share one successor;
- the company was refounded under a new name (Swissair and Swiss International Air Lines);
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

**New codes without a new name** go in `former` too: an item holds what changed (the old `iata`, `icao` or `callsign`) and the year it stopped. `getAirline()` finds the airline by a former code only when no airline holds that code now. Air Serbia kept JU when it stopped flying as Jat Airways, but its ICAO code and callsign changed:

```json
"former": [{ "name": "Jat Airways", "icao": "JAT", "callsign": "JAT", "until": 2013 }]
```

`founded` and `ceased` give the years each entry flew. Both entries can keep the same codes: a code shared with an active airline finds the active one. Following `successor` must end at an airline without one, and the build lists the old entries in the successor's `predecessors`, so the link is written once.

#### When an airline changes

| What changed                                    | What to do                                                                                                           |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| The logo, not the name                          | New SVGs in `airlines/<slug>/`, old ones in `history/<year introduced>/` ([Older Marks](#older-marks-logo-history)). |
| The name, with or without the logo              | Rename in place with `former` and the new slug ([Renames and mergers](#renames-and-mergers)).                        |
| Goes by a short name beside its full one        | Full name in `name`, the short one in `aliases` ([Aliases](#aliases)).                                               |
| Moves into or out of a group's brand            | New entry; the old one defunct with `successor`.                                                                     |
| Merged into another airline, or refounded       | The old airline defunct with `successor` set to the one that carried on.                                             |
| Shut down                                       | `defunct` and `ceased`, keeping the entry and its SVGs.                                                              |
| Should not be in the collection at all          | Open a pull request removing it; it waits for the next minor release ([Removing an airline](#removing-an-airline)).  |
| A code or callsign                              | Edit the entry and add the old one to `former`; `npm run sync:data` suggests code changes from Wikipedia.            |
| A website, hub, alliance or color               | Edit the entry; `npm run sync:data` suggests hub and alliance changes from Wikipedia.                                |
| Flies under its parent's codes, keeps its brand | Take the parent's codes, set `parent`, and add its own old codes to `former` (Hawaiian Airlines).                    |
| Becomes another airline's subsidiary            | Set `parent`, and `marks` if it now flies the parent's logo ([Subsidiaries](#subsidiaries-and-shared-logos)).        |
| A name an unrelated airline used (Pan Am)       | Not decided yet, since two airlines can't share a slug: ask in an issue or discussion first.                         |

#### Removing an airline

An airline that shut down keeps its entry (see the table above). Removing one, added by mistake or a duplicate, breaks whoever uses it: `getAirline()` no longer finds it and its files disappear from the release line (`soaring-symbols@0.<minor>/...`). So the pull request stays open, labeled `breaking`, until the next minor release, which gathers such changes; new airlines and fixes keep shipping in the weekly patch releases meanwhile. The exception is a takedown request from a trademark owner, which ships in the next patch release. Either kind can start with a [removal request](https://github.com/soaring-symbols/soaring-symbols/issues/new?template=remove-airline.yml).

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
        "guidelines": "https://web.archive.org/web/20210515192059/https://www.vietnamairlines.com/~/media/FilesDownload/AboutUs/Corporate-Identity/GSM-2017-Web1.pdf",
        "dark_color": ["icon"]
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
            "dark": true,
            "colors": ["#d99e09"]
        },
        "logo": {
            "color": true,
            "mono": true,
            "dark": true,
            "colors": ["#d99e09", "#005e80"]
        },
        "logo-stacked": {
            "color": true,
            "mono": true,
            "dark": true,
            "colors": ["#d99e09", "#005e80"]
        }
    }
}
```
