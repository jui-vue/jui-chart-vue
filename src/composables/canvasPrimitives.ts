/**
 * Trivial imperative `CanvasRenderingContext2D` drawing wrappers, hand-written fresh rather than
 * imported from `juijs-graph/src/util/canvas/base.js` (`util.canvas.base`) wholesale. Per
 * PORT_STATUS.md's Phase E policy: that file is a mix - its `getCurvePoints` is a confirmed,
 * near-exact match of the published `cardinal-spline-js` library (Catmull-Rom/cardinal spline with
 * a tension parameter). **Correction (Phase F re-verification): this is NOT the same algorithm as
 * `useSeries.ts`'s `curvePoints()`** (that one solves for Bezier control points via a Thomas-
 * algorithm tridiagonal system, ported from `chart.brush.core` - see PORT_STATUS.md's Phase F
 * section and `useSeries.ts`'s own doc comment). Neither `getCurvePoints` nor its caller `drawCurve`
 * has actually been ported into this codebase - no canvas widget in this port's scope needs curve
 * drawing - so there's nothing to reuse or vendor for it right now; if that changes, vendor
 * `cardinal-spline-js` fresh then, following the `kinetic.js` pattern. But the REST of it
 * (`drawLine`/`drawCircle`/`drawRoundRect`/etc.) is boilerplate few-line wrappers over standard
 * canvas calls with no traceable external source - fine to hand-write fresh, as-needed, rather
 * than importing the whole file just for a one-line `arc()`+`fill()`. `Bubble` and `MortalBubble`
 * (`src/composables/bubble.ts`/`mortalBubble.ts`) are this file's first two consumers (both need
 * `drawFilledCircle`; `MortalBubble` also needs `drawStrokedLine` for its cross-fade animation) -
 * extracted here per this port's established "extract to a composable once 2+ consumers need the
 * same thing" convention, matching `util.canvas.base`'s own `drawCircle`/`drawLine` signatures
 * (positional args, optional trailing style params) so a future brush porting more of
 * `util.canvas.base` can drop more primitives in alongside these with the same shape.
 */

/** Matches `util.canvas.base`'s `drawCircle(x, y, d, color)` exactly - `d` there is actually used
 *  as the arc radius (`context.arc(x, y, d, ...)`), not a diameter, despite the name; renamed
 *  `radius` here for clarity. */
export function drawFilledCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  context.beginPath()
  context.arc(x, y, radius, 0, 2 * Math.PI)
  context.fillStyle = color
  context.fill()
}

/** Matches `util.canvas.base`'s `drawLine(x1, y1, x2, y2, color, lineWidth = 1)` exactly. */
export function drawStrokedLine(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
  context.beginPath()
  context.moveTo(x1, y1)
  context.lineTo(x2, y2)
  context.lineWidth = lineWidth
  context.strokeStyle = color
  context.stroke()
}

/**
 * Added for `dot3d.js`'s `drawLine` (its "poly" symbol's closing-fill quirk, see `useDot3d.ts`'s
 * header comment) and `drawArea`: strokes `x1,y1 -> x2,y2`, then - only when `fillTo` is given -
 * extends the SAME path with one more `lineTo(fillTo.x, fillTo.y)` and fills it, matching the
 * original's single-path stroke-then-extend-and-fill sequence exactly (not two separate shapes).
 */
export function drawStrokedLineWithFill(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number, fillTo?: { x: number; y: number }): void {
  context.beginPath()
  context.moveTo(x1, y1)
  context.lineTo(x2, y2)
  context.lineWidth = lineWidth
  context.strokeStyle = color
  context.stroke()

  if (fillTo) {
    context.lineTo(fillTo.x, fillTo.y)
    context.fillStyle = color
    context.fill()
    context.closePath()
  }
}

/** Matches `util.canvas.base`-style drawing: `dot3d.js`'s `drawArea` - a closed quad, both
 *  stroked and filled with the same color (`this.canvas.strokeStyle = color; ...stroke();
 *  this.canvas.fillStyle = color; ...fill();` - no separate stroke/fill colors in source). */
export function drawFilledPolygon(context: CanvasRenderingContext2D, points: readonly [number, number][], color: string): void {
  if (points.length === 0) return
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) context.lineTo(points[i][0], points[i][1])
  context.lineTo(points[0][0], points[0][1])
  context.strokeStyle = color
  context.stroke()
  context.fillStyle = color
  context.fill()
  context.closePath()
}
