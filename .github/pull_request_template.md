<!--
Adding or updating airlines: fill in the Sources table, one row per airline
(or per file, when its files came from different places).
Anything else (tooling, docs, data fixes): delete the Sources section and describe the change.
-->

## Summary

Adds **Airline Name** (IATA `XX`, ICAO `XXX`, Country).

## Sources

<!-- prettier-ignore -->
| Airline | Files | Source | Changes |
| --- | --- | --- | --- |
| Airline Name | `logo.svg`, `icon.svg` | [airline.com: logo.svg](https://www.airline.com/assets/logo.svg) | None |

<!--
Source: the airline's own SVG, brand guideline or press kit first; Wikimedia Commons
or Wikipedia only when the airline publishes no SVG; never a third-party logo site.
Changes: anything you did beyond optimizing, e.g. recolored to the website's #cc0100,
icon cropped from the logo, tagline dropped, vectorized by hand from a PNG.
Older marks (history/<year>/): list them as `history/1984/logo.svg`, and link a source
for the year the mark was introduced too.
-->

## Checklist

- [ ] Every SVG is optimized with `npm run optimize` (not SVGO's defaults) and has `role="img"`, `xmlns` and a first-child `<title>`.
- [ ] Ran `node scripts/lint-svg.js --fix` and `npm run generate`, and committed what they changed.
- [ ] `npm test` passes.
