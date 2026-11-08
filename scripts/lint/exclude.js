// SVGs that `lint-svg.js` skips, by repo path; the browser validator's tests
// skip them too. Gradient SVGs the fill rules would break (#53), and broken
// files to redraw.
export const EXCLUDE_FILES = [
    'assets/british-airways/icon.svg',
    // Five paths have fill="url" with no gradient behind them; redraw (#52)
    'assets/china-airlines/icon.svg',
    'assets/iberia/icon.svg',
    'assets/iberia/logo.svg',
    'assets/southwest-airlines/icon.svg',
    // 0.034 short of 24, past the geometry warning tolerance; refit it
    'assets/vietravel-airlines/icon.svg',
]
