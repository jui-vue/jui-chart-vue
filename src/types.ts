export type ThemeName = 'classic' | 'dark'

/** A single data row backing a chart. Keys referenced by `target`/`domain` index into this. */
export type DataRow = Record<string, any>

/**
 * Ported from `chart.axis`'s `drawGridType()`: which edge of the plot area an axis is drawn
 * against. Only `"top"`/`"bottom"` are meaningful for an x-axis config (anything else, e.g.
 * omitted, resolves to `"bottom"`) and only `"left"`/`"right"` for a y-axis config (resolves to
 * `"left"`) - same as the original, which silently coerces an invalid/omitted orient the same
 * way per axis key (`axis[k].orient = axis[k].orient == "top" ? "top" : "bottom"` for x, etc).
 */
export type AxisOrient = 'top' | 'bottom' | 'left' | 'right'

/**
 * "block" grid: an ordinal/categorical axis (jui-chart's `chart.grid.block`). Positions are
 * evenly spaced by index, e.g. one slot per quarter.
 */
export interface BlockAxisConfig {
  type: 'block'
  /** Field name resolved per-row, or an explicit array of category labels. */
  domain: string | string[]
  reverse?: boolean
  /** Which edge of the plot area this axis is drawn against. See `AxisOrient`. */
  orient?: AxisOrient
  /**
   * Draws a full-length grid line (spanning the whole opposite dimension of the plot area) at
   * every tick of this axis, independent of the other axis and independent of `ChartBase`'s
   * chart-wide `showGrid` prop. Ported from `grid/core.js`'s `line` option (default `false`).
   * Unlike `showGrid`, this works for a block (categorical) axis too - see `PORT_STATUS.md`.
   */
  line?: boolean
  /**
   * Suppresses this axis's own baseline + tick labels entirely (grid lines, gated separately by
   * `line`/`showGrid`, are unaffected - same independence as upstream). Ported from `chart.axis`'s
   * `hide` option (default `false`), added specifically for `LineChart.vue`'s `zoomScrollable`
   * embedded thumbnail chart (`widget/zoomscroll.js`'s own `axis.y: {hide: true}`) - see
   * `PORT_STATUS.md`'s `zoomscroll.js` entry. No existing demo needed this before, so it was never
   * plumbed through `ChartBase.vue` until now.
   */
  hide?: boolean
}

/**
 * "range" grid: a linear numeric axis (jui-chart's `chart.grid.range`) with the "nice domain"
 * algorithm from range.js: expands [min,max] outward to unit-aligned bounds anchored at 0.
 */
export interface RangeAxisConfig {
  type: 'range'
  /**
   * Field name(s) read per-row (an array reads each field and folds min/max across all of
   * them - mirrors passing `target` fields as the domain), or a function returning a number or
   * [min,max] per row.
   */
  domain: string | string[] | ((row: DataRow) => number | number[])
  /** Divides the domain range into this many unit steps. Default 10. */
  step?: number
  /** Explicit lower bound. Only ever widens the computed domain, never narrows it (matches the original). */
  min?: number
  /** Explicit upper bound. Only ever widens the computed domain, never narrows it (matches the original). */
  max?: number
  /** Overrides the auto-computed unit spacing. */
  unit?: number
  /** Runs the domain bounds through math.nice()'s 1/2/5/10 rounding instead of even step division. */
  nice?: boolean
  reverse?: boolean
  /** Clamp values outside the domain to the domain edges instead of extrapolating. Default true. */
  clamp?: boolean
  /** Which edge of the plot area this axis is drawn against. See `AxisOrient`. */
  orient?: AxisOrient
  /**
   * Draws a full-length grid line (spanning the whole opposite dimension of the plot area) at
   * every tick of this axis, independent of the other axis and independent of `ChartBase`'s
   * chart-wide `showGrid` prop. Ported from `grid/core.js`'s `line` option (default `false`).
   */
  line?: boolean
  /** Suppresses this axis's own baseline + tick labels entirely. See `BlockAxisConfig.hide`'s doc comment. */
  hide?: boolean
}

export type AxisConfig = BlockAxisConfig | RangeAxisConfig

export interface SeriesPoint {
  x: number[]
  y: number[]
  value: (number | null | undefined)[]
  /** Per-row: is this the minimum value seen for this target across all rows? */
  min: boolean[]
  /** Per-row: is this the maximum value seen for this target across all rows? */
  max: boolean[]
}

/**
 * Ported from `chart.brush.core`'s `getXY()` as used by `rangearea.js`/`rangebar.js`/
 * `rangecolumn.js`: unlike `SeriesPoint` (one numeric value per row per target), each of these
 * brushes reads a **2-element `[low, high]` tuple** per row per target (`data[j][target[i]]`,
 * `value[0]`/`value[1]` in the source - not two separate `target` field names). Whichever axis is
 * `"block"` is evaluated once per row (shared by low/high, same as `SeriesPoint.x`/`.y`);
 * whichever is `"range"` is evaluated twice per row, once for `low` and once for `high` - hence
 * two full coordinate pairs (`xLow`/`yLow`, `xHigh`/`yHigh`) instead of one. See `useRangeSeries`.
 */
export interface RangeSeriesPoint {
  xLow: number[]
  yLow: number[]
  xHigh: number[]
  yHigh: number[]
  low: (number | null | undefined)[]
  high: (number | null | undefined)[]
}

export type LineSymbol = 'normal' | 'curve' | 'step'

/**
 * `chart.brush.scatter`'s marker shape. The original also accepts `"rect"` as an alias for
 * `"rectangle"` and lets `symbol` resolve to an arbitrary image URI via a callback - this port
 * only ports the 4 vector shapes (image markers are out of scope, see README).
 */
export type ScatterSymbol = 'circle' | 'triangle' | 'rectangle' | 'cross'

export type BarOrient = 'bar' | 'column'

/**
 * `chart.brush.bar`'s `display` option: shows a persistent value label on the bar(s) holding a
 * target's maximum value, minimum value, or on every bar. Default (omitted) shows none.
 */
export type BarDisplayMode = 'max' | 'min' | 'all'

export type PieShowText = 'inside' | 'outside' | null

export interface PieSlice {
  key: string
  value: number
  ratio: number
  /** Absolute angle (degrees, clockwise from straight up) where this slice begins. */
  startAngle: number
  /** This slice's own angular width in degrees (jui-chart's confusingly-named `endAngle` param to `drawPie`, which is actually a sweep delta, not an absolute angle). */
  sweepAngle: number
  /** Midpoint angle minus 90deg, matching pie.js - used to position the outside/inside label. */
  centerAngle: number
  color: string
}

export interface ChartPadding {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Payload for per-element DOM event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/
 * `mouseout`), ported from `brush/core.js`'s `addEvent()`/`chart.emit()` - the original's
 * `{brush, dataIndex, dataKey, data}` object, minus `brush` (an internal engine handle with no
 * Vue-port equivalent - the emitting component instance already identifies "which chart" fired
 * the event, so it would be redundant here). `dataIndex`/`data` are `null` when the interaction
 * target isn't tied to a single data row (e.g. a whole line-series `<path>`, matching
 * `line.js`'s own `addEvent(p, null, k)` call - only bar.js's per-bar wiring passes a real
 * `dataIndex`). The original emits a jQuery-style `"rclick"` for a right-click/contextmenu; this
 * port emits the native DOM event name `contextmenu` instead, matching Vue's own
 * `@contextmenu` convention.
 */
/** The 5 per-element DOM events this port forwards - see `ChartElementEventPayload`. */
export type ChartElementEventType = 'click' | 'dblclick' | 'contextmenu' | 'mouseover' | 'mouseout'

export interface ChartElementEventPayload {
  /** Row index into the chart's `data` array, or `null` when not tied to one row (e.g. a whole line-series path). */
  dataIndex: number | null
  /** The `target` key this element represents, or `null` when not applicable. */
  dataKey: string | null
  /** The full data row at `dataIndex`, or `null` when `dataIndex` is `null`. */
  data: DataRow | null
  /** The native DOM mouse event that triggered this. */
  event: MouseEvent
}
