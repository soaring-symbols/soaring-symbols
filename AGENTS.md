# AGENTS.md

Instructions for AI coding agents working in this repository. Human-facing docs live in `README.md`, `CONTRIBUTING.md` and `API.md`; read `CONTRIBUTING.md` before adding or changing any airline.

## Project

Soaring Symbols is an npm package (`soaring-symbols`) that ships a curated collection of airline logos, icons and tail designs as SVG, plus a small JS API to look them up.

- `airlines.json` — the airline catalog (source of truth for metadata). Sorted alphabetically by `name`.
- `assets/<slug>/` — SVGs per airline. `<slug>` is `slugify(name, { lower: true, strict: true })` (see `utils/index.js`).
    - `icon.svg`, `logo.svg`, `tail.svg` are the color versions; `*-mono.svg` are optional monochrome variants (only needed for multi-color assets).
- `index.js` — ESM library entry (`listAirlines`, `getAirline`, `getAssetPath`). It only reads `airlines.json` (no Node built-ins), so it stays browser-safe. Types in `index.d.ts` — keep them in sync, and keep `API.md` (including its migration guide) in step with any API change.
- `utils/index.js` — repo tooling only (not published): `toSlug` and `getAirlineAssets` (detects color/mono files and colors from the SVGs on disk).
- `svg-validator.js` — browser-safe validator exported as `soaring-symbols/svg-validator`; it imports `scripts/lint/validators.js`, which the build inlines.
- `scripts/` — tooling: `build.js`, `generate.js`, `lint-svg.js` (+ rules in `scripts/lint/`), `test.js`, `release.js`.
- `AIRLINES.md` — **generated** by `scripts/generate.js`; never edit by hand.
- `dist/` — build output (git-ignored), the only code that is published.

## Commands

Node ≥ 20 is required (`index.js` uses JSON import attributes). Dependencies are tracked in both `package-lock.json` and `bun.lock`; Husky hooks call `bunx`.

| Command                           | What it does                                                                                       |
| :-------------------------------- | :------------------------------------------------------------------------------------------------- |
| `npm run optimize -- <files>`     | Optimize SVGs in place with the project's SVGO config (`svgo.config.mjs`).                         |
| `npm run lint:svg`                | Lint all SVGs (dry run, reports only).                                                             |
| `node scripts/lint-svg.js --fix`  | Lint and rewrite fixable SVG issues in place.                                                      |
| `npm run generate`                | Re-sort `airlines.json`, recompute `slug` and `assets`, regenerate `AIRLINES.md`.                  |
| `npm run build`                   | `lint:svg` + `generate` (via `prebuild`), then build `dist/` (ESM, CJS, validator bundle, assets). |
| `npm test`                        | Build, then run `scripts/test.js` (`node:test`) against the ESM and CJS builds in `dist/`.         |
| `npm run lint` / `npm run format` | ESLint / Prettier.                                                                                 |
| `npm run release`                 | Cut a release (see below).                                                                         |

## Adding or updating an airline

1. Put the SVGs in `assets/<slug>/` following `CONTRIBUTING.md`: optimized with `npm run optimize` (never SVGO's defaults, which drop `role="img"`), `role="img"`, `xmlns`, `<title>Airline Name</title>` as the first child, `viewBox="0 0 64 64"` for logos and `0 0 24 24` for icons and tails, hex colors only, no `transform`, no scripts.
2. Add the base entry to `airlines.json` (`name`, `iata`, `icao`, `country`, `website`, `branding.primary_color`, plus optional fields from `CONTRIBUTING.md`).
3. Run `node scripts/lint-svg.js --fix`, then `npm run generate`, and commit the SVGs together with the regenerated `airlines.json` and `AIRLINES.md`.
4. Run `npm test`.

## Gotchas

- `lint-svg.js` always exits 0, even when it finds issues — read its output instead of trusting the exit code. Some rules (e.g. one `<path>` per single-color SVG) only warn and are never changed by `--fix`. Files that intentionally break the rules are listed in `EXCLUDE_FILES` at the top of the script.
- `generate.js` rewrites `airlines.json` from scratch (4-space JSON) — run it rather than hand-editing `slug` or `assets`. `npm run build` / `npm test` also run it, so a build can leave the working tree dirty.
- The CJS build is produced by two regex replacements in `scripts/build.js` (`transformToCJS`): the `airlines.json` import and the single `export { ... }` list. It throws if either stops matching or another `import`/`export` appears, so adding an import to `index.js` means updating it.
- `svg-validator.js` must stay free of Node-only imports, and every helper it uses from `scripts/lint/validators.js` must be a top-level `export function` so the build can inline it.

## Conventions

- Code style: Prettier (4 spaces, single quotes, no semicolons, trailing commas, width 80) and ESLint (`eslint.config.mjs`, including a blank line before `return`). Lint-staged runs both on commit.
- ESM everywhere (`"type": "module"`).
- Commits follow Conventional Commits and are checked by commitlint, e.g. `feat: add Vietravel Airlines`, `fix(build): ...`, `chore(release): v0.1.0-alpha.12`.

## Releasing

Run `npm run release -- <bump>` from a clean, up-to-date `main` (`<bump>` is `prerelease` by default, or `patch`/`minor`/`major`/`pre*`/an exact version; `--dry-run` previews). The script in `scripts/release.js` tests the package, bumps the version in `package.json`, publishes to npm, and commits the bump as `chore(release): v<version>` without pushing. It creates no git tag or GitHub release. Prereleases are published under their preid dist-tag (e.g. `alpha`), and `latest` also follows them until a stable version exists. Never run it unless the maintainer asks for a release.
