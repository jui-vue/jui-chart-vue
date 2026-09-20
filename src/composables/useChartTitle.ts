import type { ChartPadding } from '../types'

/**
 * Pure positioning/rotation math for `ChartTitle.vue`, ported from `jui-chart/src/widget/title.js`'s
 * `TitleWidget` (`extend: "chart.widget.core"`, zero `jui.include(...)` calls - confirmed from a
 * full source read, so there is nothing here to trace back into `juijs-graph`/`jui-graph-ts`).
 *
 * **The `if(axis)` branch is NOT ported - only the `else` branch is** (the one source itself marks
 * `// @Deprecated 나중에 제거하기 (모든 샘플 axis 기반으로 변경할 것)` = "remove later, move all samples to
 * axis-based"). Confirmed from `juijs-graph/src/base/builder.js`'s `calculate()`
 * (`this.area`/`this.padding`, ~line 428-440) vs. `juijs-graph/src/base/axis.js` (~line 12-13,
 * 390-438): `chart.area()`/`chart.padding()` is exactly the shape `useChartLayout.ts`'s own `area`/
 * `padding` computed values already reproduce (`{x:padding.left, y:padding.top, x2, y2, width,
 * height}` derived from one shared top-level padding config) - but `axis.area()`/`axis.padding()`
 * is a SEPARATE, per-axis nested region+padding (each axis widget can own its own sub-panel via its
 * own `options.area`/`options.padding`, for upstream's multi-axis-grid layouts). `useChartLayout.ts`
 * deliberately does not model that second concept at all (its own header comment: "Not axis-grid-
 * specific... PieChart/DonutChart don't use this" - there is exactly ONE shared plot `area` for
 * `axisX`/`axisY` together, no per-axis area/padding). `AxisConfig` (`types.ts`) also carries no
 * `padding` field of its own. So `chart.axis(widget.axis)` would have no real per-axis area/padding
 * to resolve against in this port - adding an `axis` prop that always degenerates to the SAME
 * numbers as the chart-level path would be untestable, unfalsifiable dead code, not a faithful
 * port of a real behavioral difference. Every one of this port's 27 `<ChartTitle>` call sites also
 * already renders a whole-chart title with no axis concept at all, one more confirmation that the
 * `else` branch is the one this port actually needs. See `PORT_STATUS.md`'s `title.js` entry for
 * the full writeup.
 */

export type TitleOrient = 'top' | 'bottom' | 'center'
export type TitleAlign = 'start' | 'middle' | 'end'

/** `title.js`'s own `PADDING` constant (`var TOP_PADDING = 25, PADDING = 20`). Only `PADDING` is
 * used by the `else`/deprecated branch this port keeps - `TOP_PADDING` is exclusive to the
 * axis-based branch this port doesn't implement (see this file's header comment). */
const PADDING = 20

export interface TitlePlotArea {
  x: number
  y: number
  x2: number
  y2: number
  width: number
  height: number
}

/**
 * Ported from `juijs-graph/src/base/builder.js`'s `calculate()` - the exact computation
 * `chart.area()`/`chart.padding()` are backed by upstream, and the same shape
 * `useChartLayout.ts`'s own `area` computed already derives. Reproduced here (rather than forcing
 * every `<ChartTitle>` caller - including non-axis chart types like `PieChart`/`DonutChart` that
 * never call `useChartLayout` at all - to pre-build a `TitlePlotArea` object of their own) so a
 * caller only has to pass its own `width`/`height`/(optional) `padding`, exactly like the original
 * `chart.builder` computes `_area` from `_padding` + the SVG's own size.
 */
export function computeChartArea(width: number, height: number, padding: Partial<ChartPadding> = {}): TitlePlotArea {
  const top = padding.top ?? 0
  const right = padding.right ?? 0
  const bottom = padding.bottom ?? 0
  const left = padding.left ?? 0

  const w = Math.max(0, width - left - right)
  const h = Math.max(0, height - top - bottom)

  return { x: left, y: top, x2: left + w, y2: top + h, width: w, height: h }
}

export interface TitlePosition {
  x: number
  y: number
  anchor: TitleAlign
}

/**
 * Ported from `TitleWidget.drawBefore()`'s `else` branch (jui-chart/src/widget/title.js:35-54).
 *
 * `orient`/`align` are matched with an if/else-if/else chain, exactly mirroring source's own
 * implicit-default control flow (NOT an exhaustive switch): `orient === "bottom"` and
 * `orient === "top"` are the only two checked values, anything else (including `"center"`, the
 * typed default-adjacent value, but really *any* other string) falls into the vertical-center
 * `else`. Likewise `align === "middle"` and `align === "start"` are checked, anything else
 * (including `"end"`) falls into the end-aligned `else`. This function's parameter types are
 * narrowed to the 3 known values for caller ergonomics, but the branching shape below is
 * deliberately kept as the same defaulting else-chain as source, not a switch, to document that
 * shape rather than silently relying on TypeScript's exhaustiveness.
 */
export function computeTitlePosition(
  width: number,
  height: number,
  padding: Partial<ChartPadding> | undefined,
  orient: TitleOrient,
  align: TitleAlign,
): TitlePosition {
  const area = computeChartArea(width, height, padding)
  const paddingBottom = padding?.bottom ?? 0

  let y: number
  if (orient === 'bottom') {
    y = area.y2 + paddingBottom - PADDING
  } else if (orient === 'top') {
    // Flat constant, NOT area/padding-derived - a preserved quirk of source's own deprecated
    // branch (`y = PADDING`). See PORT_STATUS.md's `title.js` entry.
    y = PADDING
  } else {
    y = area.y + area.height / 2
  }

  let x: number
  let anchor: TitleAlign
  if (align === 'middle') {
    x = area.x + area.width / 2
    anchor = 'middle'
  } else if (align === 'start') {
    x = area.x
    anchor = 'start'
  } else {
    x = area.x2
    anchor = 'end'
  }

  return { x, y, anchor }
}

export interface TitleRotation {
  angle: number
  cx: number
  cy: number
}

/**
 * Ported from `TitleWidget.draw()`'s rotate block (jui-chart/src/widget/title.js:73-78).
 *
 * Fires ONLY for `orient === "center"` AND (`align === "start"` OR `align === "end"`) -
 * `align === "middle"` is NEVER rotated even when `orient === "center"` (source's inner `if` has
 * no `else` clause covering `middle` - it simply falls through with no `rotate()` call). This is a
 * specific 2-of-9 `orient`x`align` combination gate, not a general "vertical mode" flag.
 *
 * `textX`/`textY` must already include `dx`/`dy` (source computes the rotate center from
 * `x + widget.dx`/`y + widget.dy`, the SAME already-offset coordinates the `<text>` itself is
 * placed at - not the pre-offset `x`/`y` from `computeTitlePosition`).
 */
export function computeTitleRotation(
  orient: TitleOrient,
  align: TitleAlign,
  textX: number,
  textY: number,
  halfTextWidth: number,
  halfTextHeight: number,
): TitleRotation | null {
  if (orient !== 'center') return null

  if (align === 'start') {
    return { angle: -90, cx: textX + halfTextWidth, cy: textY + halfTextHeight }
  }
  if (align === 'end') {
    return { angle: 90, cx: textX - halfTextWidth, cy: textY + halfTextHeight }
  }
  return null
}
