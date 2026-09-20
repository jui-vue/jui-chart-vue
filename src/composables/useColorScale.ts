/**
 * Generic hex-color linear interpolation - **NOT ported from jui-chart, confirmed absent from the
 * engine before writing a single line of this file**. Read `heatmap.js` (84 lines) and
 * `heatmapscatter.js` (152 lines) in full, plus `brush/core.js`'s `color(key1, key2)` and
 * `base/builder.js`'s `chart.color(key, colors)` (the two functions everything in the engine
 * ultimately routes color through): the engine's *only* color-resolution mechanisms are (1) a flat
 * per-index palette lookup (cycling `theme('colors')`, this port's existing `useTheme().color()`)
 * and (2) an arbitrary caller-supplied function returning a literal color string per row/index -
 * there is no gradient/interpolation primitive anywhere in `juijs-graph` (grepped the whole engine
 * source for "interpolate"/"gradient"/"lerp"/"rgb(" - none exist). `heatmap.js`'s own cell color is
 * just `this.color(i, null)` (the same per-index/per-function mechanism every other brush uses -
 * see `HeatmapChart.vue`'s header comment for the full derivation); `heatmapscatter.js`'s is
 * `this.color(dataIndex, targetIndex)`, same mechanism, keyed by target like every other
 * multi-target brush. Neither `classic.js` nor `dark.js` defines a min/max-color pair or a
 * heatmap-specific palette array - only solid background/border/font tokens (see `useTheme.ts`'s
 * `heatmap*` tokens, ported 1:1 from those files).
 *
 * This module exists because a *realistic* demo of `heatmap.js`'s grid ("day of week x hour of day
 * activity") reads far better with a continuous value->color gradient than with the engine's own
 * flat per-row palette cycling - and this port's established `colors?: string[]` convention (every
 * axis-based component takes a plain color array, never a function - see e.g. `ScatterChart.vue`'s
 * `pickColor()`) gives a natural seam for it: `HeatmapPage.vue`'s demo precomputes a `colors[]`
 * array from each row's raw value via `createColorScale`, and `HeatmapChart.vue` itself stays
 * completely gradient-agnostic (just consumes `colors?: string[]` like every other component).
 * Built as a proper reusable composable (not demo-page-local inline logic) since color
 * interpolation is generically useful - matches this port's established pattern of investing in
 * shared infrastructure (`useStackedSeries`, `useRangeSeries`, `OrdinalScale.invert()`) whenever a
 * later item is likely to reuse it, not just the item that first needed it.
 */

/** Parses a `#rgb` or `#rrggbb` hex color string (leading `#` optional) into 0-255 channel values. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean
        .split('')
        .map((c) => c + c)
        .join('')
    : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/** Inverse of `hexToRgb` - each channel is rounded and clamped to `[0, 255]` before formatting. */
export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/**
 * Linearly interpolates each RGB channel between two hex colors. `t` is clamped to `[0, 1]` -
 * an out-of-range `t` returns the nearest endpoint color rather than extrapolating outside the
 * 0-255 channel range (a genuine, deliberate difference from this port's `LinearScale`, which
 * extrapolates by default - clamping is the only sensible behavior for a color channel).
 */
export function interpolateColor(from: string, to: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t))
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  return rgbToHex(r1 + (r2 - r1) * clampedT, g1 + (g2 - g1) * clampedT, b1 + (b2 - b1) * clampedT)
}

/**
 * Builds a `(value) => hexColor` function over a numeric `domain` and 2+ `colors` stops, evenly
 * spaced across `[0, 1]` of the domain (e.g. 3 stops = 2 equal segments, value at the domain
 * midpoint lands exactly on the middle stop with no interpolation). A value outside `domain` clamps
 * to the nearest endpoint color. A zero-width domain (`min === max`) always returns the first
 * color rather than dividing by zero.
 */
export function createColorScale(domain: [number, number], colors: string[]): (value: number) => string {
  if (colors.length === 0) return () => '#000000'
  if (colors.length === 1) return () => colors[0]

  const [min, max] = domain
  const span = max - min

  return (value: number) => {
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / span))
    const segments = colors.length - 1
    const scaledT = t * segments
    const segmentIndex = Math.min(Math.floor(scaledT), segments - 1)
    const localT = scaledT - segmentIndex
    return interpolateColor(colors[segmentIndex], colors[segmentIndex + 1], localT)
  }
}
