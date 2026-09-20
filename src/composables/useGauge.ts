import type { DataRow } from '../types'

/**
 * Pure logic shared by `BarGaugeChart` (`chart.brush.bargauge`, 79 lines) and `FullGaugeChart`
 * (`chart.brush.fullgauge`, 138 lines) - two genuinely different implementations, confirmed from
 * source, NOT variants of each other:
 *
 * - `bargauge.js`: `extend: "chart.brush.core"` directly. Despite the name pairing it visually
 *   with "bar" charts, it does NOT use `axis.x`/`axis.y` block/range scales at all - it reads
 *   `axis.c(0)` exactly once (the `chart.grid.panel` cell, i.e. the whole chart plot area with
 *   zero-padding by default - see `chart.grid.panel`'s `drawBefore()`: `scale(i)` always returns
 *   `{x: axis.area("x"), y: axis.area("y"), width: axis.area("width"), height:
 *   axis.area("height")}` regardless of `i`) and manually stacks one horizontal bar per DATA ROW
 *   underneath it (`y += brush.size + brush.cut` per row in `eachData`). So a single
 *   `BarGaugeChart` renders a *list* of independent value-vs-range bars, one per array entry -
 *   linear geometry (plain width fraction), not radial/trig, and not axis-scale-based either.
 * - `fullgauge.js`: `extend: 'chart.brush.donut'` - literally inherits `DonutBrush.drawDonut()`
 *   (the same stroked-arc path builder `DonutChart.vue`'s `donutSlicePath()` already ports - see
 *   `usePie.ts`). Radial: a partial-circle progress RING (background track arc + a foreground
 *   colored arc whose sweep angle is proportional to `(value-min)/(max-min)`), centered value
 *   text and an optional title label. Genuinely a "gauge" in the speedometer-dial sense, unlike
 *   `bargauge.js`.
 *
 * Neither ships any threshold/color-banding (no red/yellow/green zones - `chart.color(i)`/
 * `this.color(index)` is a plain per-row/per-instance series color, not value-driven), needle/
 * pointer, or min/max tick marks - confirmed absent from both 79+138 lines. `gaugeArrowColor` and
 * `gaugeFontColor` exist in the original theme files but are dead/unreferenced by either brush
 * (see `FullGaugeChart.vue`'s header comment) - not ported, per this file's "tokens actually
 * used" convention (matching `useTheme.ts`'s own header note).
 */

/**
 * Ported from `bargauge.js`'s `draw()`: `(width / (max - min)) * v`. **Source-confirmed quirk,
 * ported literally, not "fixed"**: unlike a conventional value-vs-range gauge, `min` is used ONLY
 * as part of the divisor (the range span) - it is never subtracted from `v` as a baseline offset.
 * So with the default `min=0` this is the expected `(v/max)*width`, but a nonzero `min` (e.g.
 * `min=20, max=100, v=20`) does NOT render a zero-width bar the way "20 is at the bottom of a
 * [20,100] range" would suggest - it renders `(width/80)*20`, a quarter-width bar. Uncapped: a
 * `v` outside `[min, max]` renders a bar shorter/longer than the track without clamping, matching
 * the source (no `Math.min`/`Math.max` guard anywhere in `draw()`).
 */
export function barGaugeFillWidth(value: number, min: number, max: number, totalWidth: number): number {
  return (totalWidth / (max - min)) * value
}

/** Ported from `bargauge.js`'s `draw()`: each row's top-left `y`, stacked by `size + cut` px per index, starting at `startY` (the panel cell's own `y`, i.e. `axis.c(0).y`). */
export function barGaugeRowY(index: number, size: number, cut: number, startY: number): number {
  return startY + index * (size + cut)
}

/**
 * Ported from `fullgauge.js`'s `drawUnit()`: `if (endAngle >= 360) endAngle = 359.99999`. This
 * clamps the brush's CONFIGURED total sweep range (`brush.endAngle`, default `360` - a "full
 * circle" gauge), distinct from `donutSlicePath`'s own internal `>= 360 -> 359.9999` clamp on the
 * rendered arc's sweep (one digit less precision, a separate constant at a separate call site -
 * both preserved exactly as literal, independent source values, not unified into one constant).
 */
export function fullGaugeEndAngleLimit(endAngle: number): number {
  return endAngle >= 360 ? 359.99999 : endAngle
}

/** Ported from `fullgauge.js`'s `drawUnit()`: `(value - min) / (max - min)` - a conventional normalized fraction (unlike `barGaugeFillWidth`, `min` DOES act as a baseline offset here). Not clamped to `[0, 1]` - a `value` outside `[min, max]` yields a rate `< 0` or `> 1` (see `fullGaugeCurrentAngle` for the partial, upper-only clamp applied downstream). */
export function fullGaugeRate(value: number, min: number, max: number): number {
  return (value - min) / (max - min)
}

/**
 * Ported from `fullgauge.js`'s `drawUnit()`: `currentAngle = endAngle * rate`, then `if
 * (currentAngle > endAngle) currentAngle = endAngle`. **Only upper-clamped** - a negative `rate`
 * (value below `min`) yields a negative `currentAngle`, un-clamped low, matching the source
 * exactly (no `Math.max(0, ...)` anywhere in `drawUnit()`).
 */
export function fullGaugeCurrentAngle(rate: number, endAngle: number): number {
  const currentAngle = endAngle * rate
  return currentAngle > endAngle ? endAngle : currentAngle
}

/**
 * Ported from `fullgauge.js`'s `drawUnit()`: `(brush.symbol == 'butt') ? theme('gaugePaddingAngle') : 0`.
 * The small angular gap left on both sides of the foreground (value) arc, between it and the
 * background (track) arc - only applied for flat (`'butt'`) line caps; a `'round'` cap needs no
 * gap since the rounded end itself reads as a visual stop.
 */
export function fullGaugePaddingAngle(symbol: string, themePaddingAngle: number): number {
  return symbol === 'butt' ? themePaddingAngle : 0
}

/**
 * Ported from `fullgauge.js`'s `drawUnit()`: `outerRadius = w - brush.size; innerRadius =
 * outerRadius - brush.size` (`w = Math.min(width, height) / 2`, the cell's half-size).
 * **Deviation from `DonutBrush.getProperty()`'s own convention, confirmed by re-reading both**:
 * `fullgauge.js` does NOT reuse (or override) `getProperty()` - it computes its own radii inline,
 * with a materially different formula. Donut's `outerRadius = min/2 - size/2` is chosen so the
 * ring's true visual outer edge (`donutSlicePath`'s stroked-arc centerline `+ strokeWidth/2`)
 * lands exactly on the bounding circle (`min/2`), flush with no margin. Fullgauge's `w - size`
 * centerline instead leaves the ring's true outer edge at `w - size/2` - a visible `size/2` px
 * gap between the ring and the bounding circle - and its inner edge (`w - 1.5*size`) is also
 * proportionally further inset. This is a deliberate-looking (if unusual) design choice in the
 * original, not a bug this port should "correct" - ported as-is. **Also unguarded** (unlike
 * Donut's `if (brush.size >= min/2) brush.size = min/4` clamp): an oversized `size` relative to
 * `w` can drive `innerRadius` negative, matching the source's own lack of a clamp here.
 */
export function fullGaugeRadii(w: number, size: number): { outerRadius: number; innerRadius: number } {
  return { outerRadius: w - size, innerRadius: w - 2 * size }
}

export interface BarGaugeRowInput {
  value: number
  title: string
  max: number
  min: number
}

/** `getValue(data, "value", 0)` / `"title", ""` / `"max", 100` / `"min", 0` - `bargauge.js`'s own field names/defaults (all four supplied, unlike `fullgauge.js`'s `"title"` which has no default - see `fullGaugeRowInput`). */
export function barGaugeRowInput(row: DataRow): BarGaugeRowInput {
  return {
    value: typeof row.value === 'number' ? row.value : 0,
    title: typeof row.title === 'string' ? row.title : '',
    max: typeof row.max === 'number' ? row.max : 100,
    min: typeof row.min === 'number' ? row.min : 0,
  }
}

export interface FullGaugeRowInput {
  value: number
  title: string | undefined
  max: number
  min: number
}

/**
 * `getValue(data, 'value', 0)` / `'title'` (no third argument - default is a real JS
 * `undefined`, NOT `''` despite the source's own JSDoc claiming `[defaultValue='']`; confirmed by
 * reading `axis.getValue()`'s actual implementation, which has no default parameter at all) /
 * `'max', 100` / `'min', 0`. **Found source quirk, deliberately NOT reproduced**: since
 * `createTitle()` is gated by `if (title != '')`, an omitted title (`undefined != ''` is `true`
 * in JS) would upstream literally attempt to render the string `"undefined"` as the title text.
 * This port instead skips the title whenever it's `undefined`/empty (i.e. renders it only for a
 * real, non-empty string) - the obviously-intended behavior, not the literal edge-case bug -
 * matching this port's established precedent of not reproducing a nonsensical-looking upstream
 * gap (see e.g. `LineChart.vue`'s/`AreaChart.vue`'s `active`/`activeEvent` dead-wiring note).
 */
export function fullGaugeRowInput(row: DataRow): FullGaugeRowInput {
  return {
    value: typeof row.value === 'number' ? row.value : 0,
    title: typeof row.title === 'string' ? row.title : undefined,
    max: typeof row.max === 'number' ? row.max : 100,
    min: typeof row.min === 'number' ? row.min : 0,
  }
}
