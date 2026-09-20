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
 *
 * **Phase G re-evaluation (post jui-graph-ts)**: this feature is still not a port of anything (see
 * above - the original never had it), but its per-segment interpolation arithmetic now delegates
 * to jui-graph-ts's `colorUtil.scale()` (a real port of `util/color.js`'s own, otherwise-dead,
 * interpolation formula) via the `MultiStopColorScale` class below, rather than this file's own
 * previously-independent `Math.round`-based formula. The class itself stays here, not in
 * jui-graph-ts - see its own doc comment for why. `rgbToHex`/`interpolateColor` were removed as
 * dead code once nothing called them directly anymore; `hexToRgb` remains (still used by
 * `useActiveBubble.ts`'s `hexToRgba`).
 */

import { colorUtil } from 'jui-graph-ts'

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

/**
 * Composes jui-graph-ts's real `colorUtil.scale()` (a faithful port of `juijs-graph`'s
 * `util/color.js` - a "has-a", not "is-a", relationship: this class is NOT part of the ported
 * engine itself, since the original never had a multi-stop/continuous-domain gradient primitive -
 * see `createColorScale`'s own doc comment for the full derivation of why this feature exists at
 * all. Kept in jui-chart-vue (not promoted into jui-graph-ts) because jui-chart-vue is currently
 * its only consumer - jui-graph-ts stays a byte-faithful, 1:1-with-source port with no invented
 * classes; if a second jui-*-vue project needs this, promote it then, not speculatively now.
 *
 * Two real, deliberate behavior changes from this port's prior `interpolateColor`: (1) each
 * segment's interpolation now runs through `colorUtil.scale()`'s real formula, which truncates
 * (`parseInt(String(...))`, matching the original engine's own quirk) rather than rounds
 * (`Math.round`, this port's own prior choice) - verified via Node: ~50% of interpolation positions
 * differ by ±1 per channel between the two; (2) `colorUtil.scale()`'s own `format()` helper emits
 * UPPERCASE hex (`.toUpperCase()`, also the original engine's real behavior) - normalized back to
 * lowercase in `value()` below to match this port's own established lowercase-hex convention used
 * everywhere else (`hexToRgb`, theme color tokens, etc.) - a deliberate formatting choice this
 * class owns, not a pass-through of jui-graph-ts's raw casing. See `useColorScale.spec.ts` for the
 * updated hand-traced expectations.
 */
class MultiStopColorScale {
  private readonly segments: colorUtil.ColorScale[]
  private min = 0
  private max = 1

  constructor(colors: string[]) {
    this.segments = []
    for (let i = 0; i < colors.length - 1; i++) {
      this.segments.push(colorUtil.scale().domain(colors[i], colors[i + 1]))
    }
  }

  domain(min: number, max: number): this {
    this.min = min
    this.max = max
    return this
  }

  value(x: number): string {
    const span = this.max - this.min
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, (x - this.min) / span))
    const scaledT = t * this.segments.length
    const segmentIndex = Math.min(Math.floor(scaledT), this.segments.length - 1)
    const localT = scaledT - segmentIndex
    return (this.segments[segmentIndex](localT, 'hex') as string).toLowerCase()
  }
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

  const scale = new MultiStopColorScale(colors).domain(domain[0], domain[1])
  return (value: number) => scale.value(value)
}
