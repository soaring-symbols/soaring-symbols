// SVGs that `lint-svg.js` skips, by repo path; the browser validator's tests
// skip them too: broken files to redraw or refit.
export const EXCLUDE_FILES = [
    // Five paths have fill="url" with no gradient behind them; redraw (#52)
    'airlines/china-airlines/icon.svg',
    // Redrawn but not yet right: every mark waits for its next redraw (#107)
    'airlines/vietravel-airlines/icon-mono.svg',
    'airlines/vietravel-airlines/icon.svg',
    'airlines/vietravel-airlines/logo-mono.svg',
    'airlines/vietravel-airlines/logo.svg',
]
