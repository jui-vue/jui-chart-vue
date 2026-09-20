import { hexToRgba } from './useActiveBubble'
import { drawFilledCircle } from './canvasPrimitives'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/canvas/activecircle.js` (174 lines, `chart.brush.canvas.
 * activecircle`). Confirmed genuine chart-rendering-domain code per PORT_STATUS.md's Phase E
 * policy test - named explicitly in the policy section's own "confirmed genuine chart-engine"
 * list - so hand-ported like every other brush/widget in this phase, not vendored+`.d.ts`'d.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`, the SAME chain
 * as `activebubble.js`/`bubblecloud.js` (see `useActiveBubble.ts`'s header comment for the full
 * derivation - `chart.brush.canvas.core` only adds `addPolygon()`/a depth-sorting `drawAfter()`
 * for the 3D brushes, neither referenced anywhere in this file's 174 lines). Unlike those two
 * siblings, this file imports `util.canvas.base`/`util.color` directly (`jui.include(...)`) rather
 * than `./base/bubble.js`/`./base/mortalbubble.js` - no `KineticObject` involved anywhere; `Circle`
 * below is a wholly separate, bespoke inline physics object with its own gravity/mass/friction
 * fields, never a `KineticObject` subclass.
 *
 * **Genuinely AXIS-BASED, confirmed from source (the first canvas brush in this phase that is)**:
 * `CanvasActiveCircleBrush.checkWallCollision()` calls `this.axis.x.min()`/`.max()`/`this.axis.y.
 * min()`/`.max()`, and `draw()`'s spawn loop positions every circle at `[this.axis.x(data.x),
 * this.axis.y(data.y)]` - a real data-value-to-pixel mapping through the chart's actual x/y scales,
 * not the "plot rect + data queue" shape `activebubble.js`/`bubblecloud.js` turned out to have
 * (neither of which ever touches `axis.x`/`axis.y` at all). **Confirmed from `useAxis.ts`/
 * `useChartLayout.ts`: the axis/scale MATH already ported for Phases A-D's SVG components is
 * rendering-backend-agnostic** - `AxisResult.scale` (a plain `(value) => pixelPosition` function,
 * via `toSeriesScale()` from `useSeries.ts` for polymorphic block/range calling) is exactly
 * `this.axis.x`/`this.axis.y` from the original, whether the caller then does
 * `ctx.arc(scale(x), scale(y), ...)` (canvas) or `<circle cx="{{scale(x)}}" .../>` (SVG) - only the
 * final draw call differs. `ActiveCircleChart.vue` therefore reuses `useChartLayout()` AS-IS (same
 * composable every axis-based SVG component in this port already calls), just feeding its computed
 * positions to `CanvasRenderingContext2D` calls instead of Vue-templated SVG elements - no new
 * axis/scale composable needed for this brush, confirming the task's own hypothesis. `LinearScale`
 * (`useScale.ts`) already exposes `.min()`/`.max()` matching `this.axis.x.min()`/`.max()` exactly
 * (ordinal/"block" scales have no such methods in either the original or this port - `.min()`/
 * `.max()` are only ever meaningful for a "range" axis, confirmed by grepping
 * `juijs-graph/src/grid/block.js` for a `min`/`max` method: none exist).
 *
 * **Exact spawn algorithm, confirmed from `CanvasActiveCircleBrush.draw()`** - a REAL, source-
 * confirmed quirk, unlike either sibling brush's lifecycle: `if (circles.length == 0) { this.
 * eachData(...) }` - circles are seeded from `axis.data` **only on the very first `draw()` call
 * that ever finds an empty population**, via a `chart.getCache("active_circle", [])`/`setCache`
 * pair with NO `drawBefore()` hook at all (unlike `activebubble.js`, which has a real
 * `drawBefore()` that resets on a data-count change). There is also **no removal/death logic
 * anywhere in this file** (no `.active` flag, no `preCheck()`-equivalent) - once `circles.length`
 * becomes non-zero it can only grow via... nothing, since the spawn branch itself is gated behind
 * `circles.length == 0`. Net effect: **the chart's very first frame's `axis.data` permanently
 * decides the circle population for the chart's entire remaining lifetime** - a LATER change to
 * the data source (a new `axis.data` reference, more/fewer rows) has zero effect once circles
 * exist. Ported literally as `ActiveCircleField.step()`'s own `if (this.circles.length === 0)`
 * gate below - not "fixed" to re-sync with later data changes.
 *
 * **Per-row spawn fields, confirmed from `draw()`'s `eachData` callback**: `circle.radius = data.
 * radius || this.brush.radius` (falls back to the brush's configured `radius`, default `20` per
 * `CanvasActiveCircleBrush.setup()`); `circle.position` is set explicitly right after construction
 * (redundant with the constructor's own initial `[0,0]`, since `Circle`'s constructor never itself
 * calls `updateAcceleration()` - ported as-is, not simplified away); `circle.velocity = [data.vx ||
 * 0, data.vy || 0]`; `circle.acceleration = [data.ax || 0, data.ay || 0]`. `this.color(i)` uses the
 * loop's own row index directly (not a batch-local restarting counter like `activebubble.js`'s
 * `index` - see that file's header comment for the contrast - since this loop only ever runs once,
 * total, for the whole chart, the distinction is moot in practice but the underlying mechanism
 * differs).
 *
 * **`Circle`'s physics, confirmed from source - NOT `KineticObject`-based, a bespoke incline-plane
 * (mass/friction/gravity/normal-force) model**: only `move()`/`stop()`/`draw()` are ever actually
 * CALLED by `CanvasActiveCircleBrush.draw()` - `checkForMotion()`/`calcAcceleration()` exist on
 * every `Circle` instance but are dead code in the brush's own render loop (their call site inside
 * `draw()` is commented out: `// if(circle.checkForMotion(30, 1)) { circle.acceleration[1] =
 * circle.calcAcceleration(90, 1); circle.move(fps, tpf); // }` - note even the indentation implies
 * `move()` was meant to be conditional but the comment boundaries leave it unconditional either
 * way). Ported faithfully anyway (same rationale as `BubbleCloud.processData()`'s confirmed-dead
 * mark-and-sweep diff in the prior Phase E entry): real, intentional `Circle`-class behavior,
 * unit-tested by calling these methods directly, never how the actual brush exercises them.
 *
 * **A real, preserved bug in `calcAcceleration()`, confirmed from source, NOT fixed here**:
 * `massToWeight(mass)` takes exactly ONE parameter and always multiplies by `this.gravity`
 * internally - `calcAcceleration()`'s own call site, `this.massToWeight(this.mass, this.
 * acceleration[1])`, passes a SECOND argument (clearly intending to substitute a custom
 * "gravity" for this one calculation) that JavaScript silently discards; the result always uses
 * `this.gravity`, never `this.acceleration[1]`, regardless of what's passed. `checkForMotion()`'s
 * own `massToWeight(this.mass, this.gravity)` call happens to pass `this.gravity` as that same
 * ignored 2nd argument, so its result is coincidentally correct either way. This port's
 * `massToWeight(mass)` below takes a single parameter (matching the REAL signature, not the
 * call sites' apparent 2-argument intent) - `calcAcceleration()`'s behavior is unchanged, since the
 * 2nd argument was always discarded in the original too.
 *
 * **`move(fps, tpf)`, confirmed from source**: `fps` is accepted but never referenced anywhere in
 * the function body (confirmed by a full read) - a dead parameter, kept here as `_fps` for
 * signature fidelity (matches this port's established `_now`/`_fps`-style convention for a
 * preserved-but-unused original parameter, e.g. `Bubble.draw(context, _now)`). `if (tpf === 1)
 * return` skips ALL movement for that call - sourced from a separate, NOT-yet-ported
 * `juijs-graph/src/base/animation.js` (`chart.animation`) polling wrapper: its own `run()` computes
 * `tpf = (currentTime - prevTime) / 1000`, clamped to a max of `1`, with `prevTime` starting at
 * `0` - so the very FIRST `chart.animation` tick always computes `tpf === 1` exactly (a huge
 * `Date.now()`-sized value clamped down to the ceiling), meaning `activecircle.js`'s very first
 * animated frame is silently a no-op by design (avoiding a first-frame position jump), while every
 * later tick reflects real elapsed seconds. **Documented deviation**: `chart.animation` itself
 * isn't ported in this iteration (no PORT_STATUS.md item requests it, and it's a chart-wide
 * real-time wrapper, not part of `activecircle.js` itself) - `ActiveCircleChart.vue` instead
 * drives `tpf` from `ChartCanvasBase.vue`'s own already-built `@frame` `FrameInfo.delta` (ms,
 * clamped to 250ms max, `0` on the very first RAF tick - see `useCanvasChart.ts`'s
 * `computeFrameDelta`), converted to seconds. This never naturally produces `tpf === 1` under this
 * port's own timing (max 0.25, first frame exactly `0`), so the literal `tpf === 1` guard is kept
 * for source fidelity but is effectively inert here; the FIRST-frame-is-a-no-op INTENT is instead
 * satisfied for free by `tpf === 0` on that same first frame (`runtime += 1 * 0` and
 * `updateAcceleration()` place the circle at its untouched spawn position, not a jump) - same
 * outcome, different mechanism, not a functional gap.
 */

/** One data row's spawn-relevant fields, matching `draw()`'s `data.x`/`data.y`/`data.radius`/
 *  `data.vx`/`data.vy`/`data.ax`/`data.ay` reads (all plain properties, not `getValue()`/keymap
 *  lookups - `DataRow` is a plain `Record<string, any>`, so no narrower type is enforced here,
 *  matching every other row-shaped input in this port). */
export interface ActiveCircleRow extends DataRow {
  x: number
  y: number
  radius?: number
  vx?: number
  vy?: number
  ax?: number
  ay?: number
}

/**
 * Ported from the `Circle` constructor + its methods (`jui-chart/src/brush/canvas/
 * activecircle.js`, lines 10-117). **Deviation, same rationale as `ActiveBubble`/`MortalBubble`'s
 * own (see `useActiveBubble.ts`'s header comment)**: the original constructor took and cached a
 * `context` argument for `draw()` to close over; this port's canvas context can be recreated by
 * `useCanvasChart.ts` (e.g. on a `width`/`height` change), so `draw()` here takes `ctx` as an
 * explicit parameter instead. Likewise, `scaleX`/`scaleY` are plain `(value) => number` functions
 * (not a cached `axis` object) - **passed as small wrapper closures by the caller that read the
 * CURRENT `axisX.value`/`axisY.value` on every call** (see `ActiveCircleChart.vue`), so a circle's
 * position still reflects a live axis/scale change exactly like the original's `scale.x(...)`/
 * `scale.y(...)` calls against the chart's one persistent `this.axis` reference - not a one-time
 * snapshot.
 */
export class Circle {
  radius = 1
  position: [number, number] = [0, 0]
  velocity: [number, number] = [0, 0]
  acceleration: [number, number] = [0, 0]
  gravity = -9.8
  mass = 1
  weight = 1
  friction = 0.1
  runtime = 0

  private readonly scaleX: (value: number) => number
  private readonly scaleY: (value: number) => number
  private readonly color: string
  private readonly xValue: number
  private readonly yValue: number

  constructor(scaleX: (value: number) => number, scaleY: (value: number) => number, color: string, xValue: number, yValue: number) {
    this.scaleX = scaleX
    this.scaleY = scaleY
    this.color = color
    this.xValue = xValue
    this.yValue = yValue
  }

  /** Dead code in the actual brush render loop (see this file's header comment) - ported
   *  faithfully, unit-tested directly. */
  checkForMotion(angle: number, fricCoeff: number): boolean {
    const weight = this.massToWeight(this.mass)
    const normal = weight * Math.cos((angle * Math.PI) / 180)
    const perpForce = weight * Math.sin((angle * Math.PI) / 180)
    const staticFriction = fricCoeff * normal
    return perpForce > staticFriction
  }

  /** Dead code in the actual brush render loop; also carries the preserved `massToWeight` 2nd-
   *  argument-discarded quirk documented in this file's header comment. */
  calcAcceleration(angle: number, fricCoeff: number): number {
    const weight = this.massToWeight(this.mass)
    const normal = weight * Math.cos((angle * Math.PI) / 180)
    const perpForce = weight * Math.sin((angle * Math.PI) / 180)
    const kinFriction = fricCoeff * normal
    const totalForce = perpForce - kinFriction
    return totalForce / this.mass
  }

  poundToWeight(pound: number): number {
    return pound * (1 / 0.2248)
  }

  weightToPound(weight: number): number {
    return weight * (0.2248 / 1)
  }

  massToWeight(mass: number): number {
    return mass * this.gravity
  }

  weightToMass(weight: number): number {
    return weight / this.gravity
  }

  /** Ported 1:1, including the missing `0.5` factor on the acceleration term (physically this
   *  should be `0.5 * a * t^2` - the original just uses `a * t^2` directly) - preserved, not
   *  "fixed". */
  updateAcceleration(): void {
    const vx = this.velocity[0] * this.runtime
    const vy = this.velocity[1] * this.runtime
    const ax = this.acceleration[0] * Math.pow(this.runtime, 2)
    const ay = this.acceleration[1] * Math.pow(this.runtime, 2)
    this.position = [this.scaleX(this.xValue + vx + ax), this.scaleY(this.yValue + vy + ay)]
  }

  move(_fps: number, tpf: number): void {
    if (tpf === 1) return
    this.runtime += 1 * tpf
    this.updateAcceleration()
  }

  stop(): void {
    this.velocity = [0, 0]
    this.acceleration = [0, 0]
  }

  /** Ported from `Circle.draw()` - same fixed drop-shadow recipe (10px blur, 0 horizontal / 10px
   *  vertical offset) as `Bubble.draw()`/`MortalBubble.draw()`, via the existing `hexToRgba`
   *  (reused from `useActiveBubble.ts`, matching `bubblecloud.js`'s own established reuse rather
   *  than re-declaring a duplicate export) and `drawFilledCircle` (`canvasPrimitives.ts`, matching
   *  `util.canvas.base.drawCircle`). */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = hexToRgba(this.color, 0.3)
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 10
    ctx.globalAlpha = 1.0
    drawFilledCircle(ctx, this.position[0], this.position[1], this.radius, this.color)
  }
}

/**
 * Ported from `CanvasActiveCircleBrush.checkWallCollision()` - confirmed DEAD CODE in the actual
 * brush (its only call site, inside `draw()`, is commented out alongside `checkForMotion`/
 * `calcAcceleration` - see this file's header comment). Ported anyway as real, intentional
 * behavior, unit-tested directly. **A real, preserved quirk**: the 3rd/4th conditions compare
 * `position[1]` against `maxY`/`minY` SWAPPED relative to the 1st/2nd (x) conditions - not a typo:
 * `minY`/`maxY` here are PIXEL positions (`axis.y(axis.y.min())`/`axis.y(axis.y.max())`), and a
 * "range" y-axis's pixel interval is reversed (see `useChartLayout.ts`'s `yInterval` - the axis's
 * data-MIN maps to the LARGER pixel Y, since y increases upward on screen but downward in raw
 * pixel coordinates), so `minY` (pixel) is actually the bottom edge and `maxY` (pixel) is the top
 * edge - the swap is correct given that inversion, not backwards.
 */
export function checkWallCollision(position: readonly [number, number], radius: number, minX: number, maxX: number, minY: number, maxY: number): boolean {
  return position[0] - radius < minX || position[0] + radius > maxX || position[1] - radius < maxY || position[1] + radius > minY
}

/**
 * Ported from `CanvasActiveCircleBrush` (the plain, non-jui-module inner object `activecircle.js`
 * defines and caches per-chart via `chart.getCache("active_circle", [])`/`setCache`). Owns the
 * circle population and runs the spawn-once/step/render logic `draw()` combines in the original -
 * split into `step()`/`render()` for the same reason (and with the same "no functional change,
 * just a recreatable-context deviation") as `ActiveBubble.step()`/`render()` in `useActiveBubble.ts`.
 */
export class ActiveCircleField {
  circles: Circle[] = []

  /** Ported from `draw()`'s `if (circles.length == 0) { this.eachData(...) }` spawn gate plus its
   *  per-circle `move()` call - see this file's header comment for why this seeds ONLY on the
   *  first call that finds an empty population and never again, no matter how `rows` changes on
   *  later calls. `colorFor` receives the same per-row index `eachData` itself provides
   *  (`this.color(i)`). */
  step(rows: readonly ActiveCircleRow[], scaleX: (value: number) => number, scaleY: (value: number) => number, colorFor: (index: number) => string, defaultRadius: number, tpf: number): void {
    if (this.circles.length === 0) {
      rows.forEach((row, i) => {
        const circle = new Circle(scaleX, scaleY, colorFor(i), row.x, row.y)
        circle.radius = row.radius || defaultRadius
        circle.position = [scaleX(row.x), scaleY(row.y)]
        circle.velocity = [row.vx || 0, row.vy || 0]
        circle.acceleration = [row.ax || 0, row.ay || 0]
        this.circles.push(circle)
      })
    }

    const fps = tpf > 0 ? 1 / tpf : Infinity
    for (const circle of this.circles) {
      circle.move(fps, tpf)
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const circle of this.circles) circle.draw(ctx)
  }
}
