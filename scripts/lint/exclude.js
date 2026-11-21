// SVGs that `lint-svg.js` skips, by repo path; the browser validator's tests
// skip them too: broken files to redraw or refit.
export const EXCLUDE_FILES = [
    // Five paths have fill="url" with no gradient behind them; redraw (#52)
    'assets/china-airlines/icon.svg',
    // Redrawn but not yet right: every mark waits for its next redraw (#107)
    'assets/vietravel-airlines/icon-mono.svg',
    'assets/vietravel-airlines/icon.svg',
    'assets/vietravel-airlines/logo-mono.svg',
    'assets/vietravel-airlines/logo.svg',
]
