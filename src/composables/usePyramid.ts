import type { DataRow } from '../types'

/**
 * Pure logic for `PyramidChart`, ported from `chart.brush.pyramid` (165 lines).
 * **Source-confirmed, don't assume from the name** (this port's recurring lesson - see e.g.
 * `PinChart.vue`'s/`BarGaugeChart.vue`'s own header comments for the most recent instances):
 * `extend: "chart.brush.core"` **directly** - unrelated to `bar.js`/`fullstackbar.js`/any other
 * brush. Like `PieChart`/`DonutChart`, it draws a single `axis.data[0]` ROW's `target` keys as
 * proportional segments (`obj = (axis.data.length > 0) ? axis.data[0] : {}` - confirmed this
 * brush only ever looks at the first data row); like `BarGaugeChart`, it is NOT axis-scale-based
 * - the only positioning input is `this.axis.area()` (the plot-area rect), consumed with its own
 * from-scratch trig/geometry, not a shared axis `.scale()` call.
 *
 * **The actual visual model, confirmed from `draw()`**: NOT a set of independently-sized rows (the
 * way a typical funnel-chart implementation works, where each row's width is `value / max`) - the
 * whole shape is a single solid triangle (apex at top-center, full-width base at the bottom, by
 * default) inscribed in the plot area, and each target's segment is a trapezoid slice of THAT
 * triangle, sized by `rate = value / total` (total = sum of every target's value in the row) and
 * stacked along the triangle's own straight, constant-slope sides - **not** by an independent
 * per-row width computation. Segments are sorted by value DESCENDING before drawing, so the
 * largest value's segment is the wide base (widest, i.e. literally a "pyramid" shape) and the
 * smallest value's segment is the narrow tip nearest the apex. Because every segment's rate is a
 * share of one fixed total distance (the triangle's apex-to-base-corner hypotenuse length,
 * `distance = sqrt(dx^2+dy^2)`) and the rates sum to 1, the LAST segment's narrow edge always lands
 * exactly on the apex point (`dx`, `0` or `dx`, `height` depending on `reverse` - see
 * `pyramidTrapezoids`' doc comment) - segments are contiguous slices of one continuous triangle,
 * not independently-positioned rows. `reverse` (default `false`) flips which end is the wide base:
 * `false` = a literal upright pyramid (apex top, wide base bottom, largest segment at the bottom);
 * `true` = an inverted funnel (wide top, apex bottom, largest segment at the top) - ported exactly,
 * see `pyramidTrapezoids`' doc comment for the derivation.
 *
 * Fill color is `this.color(i)` where `i` is the SORTED draw-order index (0 = largest/widest
 * segment), NOT the target's original declared position in `target` - a real, easy-to-miss
 * subtlety confirmed by re-reading the loop (`getCalculatedData()` sorts by value first; `this
 * .color(i)` is called inside that same sorted loop).
 */

export interface PyramidSegment {
  key: string
  value: number
  /** `value / total` (sum of every target's value in the row). `0` when `total` is `0` - a
   * deviation from the literal source (which divides unconditionally and would produce `NaN`),
   * matching this port's established `usePie.ts`/`usePieSlices` precedent for the same edge case. */
  rate: number
  /** This target's index in the ORIGINAL `target` array (before the value-descending sort below) -
   * matches `getCalculatedData()`'s own `index` field, used upstream as `addEvent()`'s
   * `targetIndex` argument (see `PyramidChart.vue`'s event-forwarding). */
  index: number
}

/**
 * Ported from `pyramid.js`'s `getCalculatedData()`. The source iterates `for (var key in obj)`
 * (the ROW's own keys) and keeps only those also present in `targets` (`_.inArray(key, targets)`)
 * - reimplemented here as iterating `target` directly and skipping any key missing from `row`,
 * which is behaviorally equivalent (both ways end up with exactly "every target key the row
 * actually has a value for") and deterministic regardless of `row`'s own key enumeration order
 * (the source's final result is sorted anyway, so iteration order never mattered upstream either,
 * only tie-break stability for equal values - JS's `Array.sort` is stable since ES2019, matching
 * V8's/every modern engine's guarantee, so this reimplementation preserves tie order too).
 */
export function pyramidSegments(row: DataRow, target: string[]): PyramidSegment[] {
  let total = 0
  const list: PyramidSegment[] = []

  target.forEach((key, index) => {
    const value = row[key]
    if (value === undefined) return
    total += value
    list.push({ key, value, rate: 0, index })
  })

  for (const seg of list) {
    seg.rate = total === 0 ? 0 : seg.value / total
  }

  list.sort((a, b) => b.value - a.value)

  return list
}

/** One segment's trapezoid vertices, its divider line against the previous segment (if any), and
 * its label anchor point - all in LOCAL, untranslated coordinates (the plot area's own top-left is
 * `(0, 0)`), matching `pyramid.js`'s own points/line coordinates BEFORE `.translate(area.x,
 * area.y)`. `PyramidChart.vue` adds the plot-area offset itself, once, when building final render
 * coordinates - no `<g transform>` wrapper (this port's established, previously-buggy pattern -
 * see PORT_STATUS.md's "double-offset" bug write-up - is deliberately avoided here). */
export interface PyramidTrapezoid {
  /** The 4 polygon vertices in the exact order `pyramid.js`'s `poly.point(...)` calls draw them:
   * wide-edge-start, narrow-edge-left, narrow-edge-right, wide-edge-end. */
  points: [number, number][]
  /** The horizontal divider line against the PREVIOUS segment's narrow edge (`null` for the first/
   * widest segment, `i === 0`, matching the source's `if (i > 0)` guard). */
  divider: { x1: number; x2: number; y: number } | null
  /** Midpoint of this segment's right slanted edge (`(ex+endX)/2`, `(y+dy)/2`) - the label anchor
   * BEFORE the leader-line/dodge offset applied by {@link pyramidLabelPlacements}. */
  labelAnchor: { x: number; y: number }
}

/**
 * Ported from `pyramid.js`'s `draw()` main loop (the polygon/divider-line geometry only - label
 * placement is a separate, independently-testable concern, see {@link pyramidLabelPlacements}).
 *
 * `rates` must already be in DRAW order (i.e. `pyramidSegments()`'s value-descending sort applied)
 * - each entry is one segment's `rate` (`value / total`).
 *
 * **Geometry, hand-verified**: `startRad = atan2(height, width/2)` and `distance =
 * sqrt((width/2)^2 + height^2)` are the constant slope angle and full apex-to-base-corner length of
 * the triangle inscribing the WHOLE shape - computed once, from the ORIGINAL `height` (`area.
 * height`), never the `reverse`-adjusted running `dy` (source computes these before the `if
 * (isReverse) dy = 0` reassignment - ported in the same order here). Each segment then walks
 * `dist = rate * distance` further along that fixed-slope line from the current wide edge toward
 * the apex; since `cos(-startRad) === cos(startRad)` (cosine is even), the source's `ex = endX -
 * dist * Math.cos(-startRad)` is mathematically identical to using the same `cos(startRad)` used
 * for `sx` - ported as one shared `cosR` rather than two separate (but numerically identical)
 * trig calls. Because `sum(rates) === 1` (by construction of `pyramidSegments()`'s `rate`), the
 * LAST segment's `sx`/`ex` converge exactly to `width/2` (the apex x) and its `y` reaches `0`
 * (upright) or `height` (`reverse`) - confirmed via this file's own unit tests with a hand-traced,
 * exact (45-degree slope) case.
 */
export function pyramidTrapezoids(width: number, height: number, reverse: boolean, rates: number[], dividerLineWidth: number): PyramidTrapezoid[] {
  const halfWidth = width / 2
  const startRad = Math.atan2(height, halfWidth)
  const distance = Math.sqrt(halfWidth * halfWidth + height * height)
  const cosR = Math.cos(startRad)
  const sinR = Math.sin(startRad)

  let startX = 0
  let endX = width
  let dy = reverse ? 0 : height

  return rates.map((rate, i) => {
    const dist = rate * distance
    const sx = startX + dist * cosR
    const ex = endX - dist * cosR
    const ty = dist * sinR
    const y = reverse ? dy + ty : dy - ty

    const points: [number, number][] = [
      [startX, dy],
      [sx, y],
      [ex, y],
      [endX, dy],
    ]
    const divider = i > 0 ? { x1: startX - dividerLineWidth / 2, x2: endX + dividerLineWidth / 2, y: dy } : null
    const labelAnchor = { x: (ex + endX) / 2, y: (y + dy) / 2 }

    startX = sx
    endX = ex
    dy = y

    return { points, divider, labelAnchor }
  })
}

export interface PyramidLabelPlacement {
  /** Leader-line start point (== the label's own trapezoid-edge-midpoint anchor). */
  lineX1: number
  lineY1: number
  /** Leader-line end point - also the (pre `dx`/`dy` tspan-nudge) text anchor. */
  lineX2: number
  lineY2: number
}

/**
 * Ported from `pyramid.js`'s `createText()` `y` formula - a literal upstream quirk, preserved
 * exactly, not "fixed" (matching this port's established precedent for odd-looking-but-intentional
 * source formulas, e.g. `useGauge.ts`'s `barGaugeFillWidth` min-divisor note): when the previous
 * label sits less than `lineSize` px below this one (`0 < dist < lineSize`), the label is pushed to
 * `cy + (cy - dist/2)`, i.e. `2*cy - dist/2` - NOT the more obviously-"intended" `cy - (lineSize -
 * dist)`-style nudge a fresh implementation might guess at. Ported literally so a hand-traced test
 * can pin the exact (if unusual) output.
 */
export function pyramidLabelY(cy: number, dist: number, lineSize: number): number {
  return cy + (dist > 0 && dist < lineSize ? cy - dist / 2 : 0)
}

/**
 * Ported from `pyramid.js`'s `createText()` call site: a SEQUENTIAL walk over every label's anchor
 * point in draw order (same shape as `usePie.ts`'s `pieOutsideLabelDeclutter`/
 * `pieInsideLabelDeclutter` - each label is compared only against the previous label actually
 * placed). `dist` (the vertical gap fed into {@link pyramidLabelY}) is `previousCy - currentCy`.
 * Preserves the source's literal initial condition: the running `textY` state starts at literal
 * `0`, not "no previous label" (matching `pieOutsideLabelDeclutter`'s own preserved `preAngle = 0`
 * quirk) - so the FIRST label's `dist` is `0 - firstCy`, almost always negative (since `cy` values
 * are real plot-area pixel coordinates, not near `0`) and thus never triggers the dodge for a
 * realistic chart size, matching upstream's actual (if accidental-looking) behavior.
 *
 * `anchors` must be in draw order (`pyramidTrapezoids()`'s own returned order, i.e.
 * value-descending).
 */
export function pyramidLabelPlacements(anchors: { x: number; y: number }[], lineSize: number): PyramidLabelPlacement[] {
  let prevCy = 0

  return anchors.map(({ x: cx, y: cy }) => {
    const dist = prevCy - cy
    const lineX2 = cx + lineSize
    const lineY2 = pyramidLabelY(cy, dist, lineSize)
    prevCy = cy

    return { lineX1: cx, lineY1: cy, lineX2, lineY2 }
  })
}
