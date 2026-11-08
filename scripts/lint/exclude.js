// SVGs that `lint-svg.js` skips, by repo path; the browser validator's tests
// skip them too: broken files to redraw or refit.
export const EXCLUDE_FILES = [
    // Five paths have fill="url" with no gradient behind them; redraw (#52)
    'assets/china-airlines/icon.svg',
    // 0.034 short of 24, past the geometry warning tolerance; refit it
    'assets/vietravel-airlines/icon.svg',
]
