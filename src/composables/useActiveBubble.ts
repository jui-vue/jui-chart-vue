import { hexToRgb } from './useColorScale'
import { MortalBubble } from './mortalBubble'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/canvas/activebubble.js` (206 lines, `chart.brush.canvas.
 * activebubble`). Confirmed genuine chart-rendering-domain code per PORT_STATUS.md's Phase E
 * policy test (references `this.axis.data`/`this.axis.area()`/`this.brush.gravity`/`radius`/
 * `opacity` throughout - not a generic utility), so hand-ported like `base/bubble.js`/
 * `base/mortalbubble.js`, not vendored+`.d.ts`'d.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`
 * (`juijs-graph/src/brush/canvas/core.js`), which itself `extend`s `chart.brush.core`
 * (the same SVG-side brush base Phases A-D's axis-based components all build on -
 * `juijs-graph/src/brush/core.js`). `chart.brush.canvas.core` adds exactly two things over the
 * plain SVG core: `addPolygon()`/a `drawAfter()` that sorts+dispatches 3D polygon draw callbacks
 * by depth - both purely for the hand-rolled-3D brushes (`dot3d.js`/`column3d.js`/`line3d.js`,
 * later Phase E items), NEITHER used by `activebubble.js` at all (confirmed: no `this.addPolygon`/
 * `this.polygons` reference anywhere in its 206 lines). So for THIS brush, the canvas core adds
 * nothing beyond the SVG core it inherits from - `this.color()`/`this.getValue()`/`this.axis`/
 * `this.brush`/`this.chart` all resolve exactly like every SVG brush in Phases A-D; the only real
 * difference is that `activebubble.js` draws to a `CanvasRenderingContext2D` (`this.canvas`)
 * instead of building SVG elements, and that nothing in the engine ever calls its `draw()` on a
 * schedule (see `useCanvasChart.ts`'s header comment - confirmed zero `requestAnimationFrame`/
 * `setInterval` anywhere in the engine) - `ChartCanvasBase.vue`'s `animate: true` RAF loop is what
 * suppries that external, "call `draw()` again" driver in this port.
 *
 * **Exact spawn/lifecycle algorithm, confirmed from source (`drawBefore()` + `draw()`)**:
 * - `drawBefore()`: lazily creates ONE `ActiveBubble` instance (this file's `ActiveBubble` class),
 *   cached on the chart instance (`chart.getCache`/`setCache`) so it survives across every
 *   subsequent `draw()` call - sized to `this.axis.area('width'/'height')` and constructed with
 *   `this.brush.gravity`, both fixed at that one-time creation (never re-read afterward, even if
 *   the brush config or chart size later changes - ported literally, see `ActiveBubble`'s own
 *   comment). It also compares a cached `active_bubble_count` against the CURRENT
 *   `this.axis.data.length` and, if they differ, resets `isArrange = false` - a "new data arrived"
 *   signal (see `isArrange`'s own doc comment for what that flag gates).
 * - `draw()`: `while (this.axis.data.length > 0) { ... }` - DRAINS `axis.data` completely, in the
 *   SAME call, into brand-new `MortalBubble`s (one per row), each with `startTime`/`duration`
 *   resolved per-row via `this.getValue(data, "startTime", Date.now())`/`this.getValue(data,
 *   "duration", 1000)` and a color from `this.color(index)` where **`index` restarts at `0` for
 *   EVERY `draw()` call** (a local `let index = 0` inside `draw()`, not a running/global data
 *   index) - so two rows drained in the SAME batch get different palette colors (0, 1, 2, ...),
 *   but a row drained in a LATER, separate `draw()` call also starts back at color index `0`, same
 *   as the very first row ever spawned. `this.brush.radius`/`this.brush.opacity` (unlike
 *   `gravity`) ARE re-read from the current brush config on every spawn, not cached once.
 *   Once every row is drained into `MortalBubble`s, `activeBubble.draw()` (this file's
 *   `ActiveBubble.step()`+`render()`) runs the physics/render step - called EVERY time the brush's
 *   own `draw()` runs, i.e. every animation frame in this port.
 * - **Spawn timing vs. "staggering"**: draining is NOT staggered by the brush itself - every row
 *   present in `axis.data` at the moment `draw()` runs becomes a `MortalBubble` in that same tick,
 *   and (confirmed via `computeMortalBubbleFrame`, `mortalBubble.ts`) a bubble is drawn from the
 *   very first frame it exists regardless of its own `startTime`/`birthtime` - a future `birthtime`
 *   only delays when its DEATH countdown starts (`d = age - (now - birthtime)` is larger than
 *   `age`, i.e. "more alive than normal", while `now < birthtime`), never its first paint. Real
 *   staggering (a "burst" that visibly spawns over time) can only come from the CALLER adding rows
 *   to the data source at different times (this port: `ActiveBubbleChart.vue` watches `props.data`
 *   for newly-appended rows across frames, mirroring "someone pushes more rows into `axis.data`
 *   between draws") - or from rows sharing one spawn tick but carrying deliberately staggered
 *   `duration`/`startTime` fields so they DIE at different times, which is the "staggered `age -
 *   (now - birthtime)` countdown" `activebubble.js`'s own field names (`startTime`/`duration`) are
 *   clearly designed for.
 * - **Removal/max concurrent/looping**: `ActiveBubble.preCheck()` (called first thing every
 *   `step()`) splices out every bubble whose `MortalBubble.active` has flipped to `false` (i.e.
 *   its lifetime, `age` ms after `birthtime`, has elapsed) - there is NO maximum concurrent bubble
 *   count anywhere in the source, and NO auto-respawn: once a bubble dies it is gone for good,
 *   never recreated, unless the caller supplies MORE rows later. So this runs once per data load
 *   (a burst spawns, animates, and fully dies out), not a continuous/looping emitter - confirmed
 *   by the complete absence of any re-seeding logic in either `drawBefore()` or `draw()`.
 *
 * **Gravity physics, confirmed from `ActiveBubble.draw()` (now `step()` below)**: a CONTINUOUS
 * per-frame force, not a one-time impulse - `bubble.force([...])` + `bubble.update()` run inside
 * the same loop every single `step()` call (every animation frame). **Real, source-confirmed
 * quirk, not a bug this port is fixing**: the original's own `gDirection` is hardcoded `[1, 0]`
 * (`const gDirection = [1, 0];`), NOT `[0, 1]` - so despite the name "gravity", the resulting force
 * (`computeGravityForce` below) is always purely HORIZONTAL (rightward, for a positive `gravity`),
 * never vertical/downward. Combined with `MortalBubble`'s own constructor already applying a
 * one-time `force([30, 0])` kick (also rightward - see `mortalBubble.ts`) and every bubble starting
 * at `pos = [0, 0]` (`KineticObject`'s own default), the whole simulation drifts bubbles rightward
 * from the top-left corner, vertically bounded to `[0, contextHeight]` (see `step()`'s bounds-clamp
 * comment) rather than "falling" downward the way "gravity" would normally suggest.
 */

/** `util.color.rgb()` + `.format(obj, 'rgb')`, collapsed into one step for a hex input - the ONLY
 *  input shape `activebubble.js` ever actually passes it (`this.color(index)`, always a theme hex
 *  string). This port's existing `hexToRgb` (`useColorScale.ts`) already parses `#rgb`/`#rrggbb`
 *  identically to `util.color.rgb()`'s `#`-prefixed branch (confirmed by reading
 *  `juijs-graph/src/util/color.js`'s `rgb()` in full - its other two branches, parsing an already-
 *  formatted `rgb(...)`/`rgba(...)` STRING back into channels, are dead code for this brush's own
 *  usage), so this is a thin formatting wrapper, not a re-port of `util.color` itself. */
export function hexToRgba(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${opacity})`
}

/**
 * `ActiveBubble.draw()`'s per-bubble, per-frame gravity `force()` call, extracted pure (mirrors
 * this port's established "extract the pure math" convention - `computeCanvasBackingSize`/
 * `computeMortalBubbleFrame`). See this file's header comment for the confirmed `[1, 0]`
 * (horizontal-only) direction quirk - preserved exactly, not "corrected" to `[0, 1]`.
 */
export function computeGravityForce(mass: number, gravity: number): [number, number] {
  const gDirection: [number, number] = [1, 0]
  return [gDirection[0] * mass * gravity, gDirection[1] * mass * gravity]
}

/** One data row's resolved spawn parameters - ported from `draw()`'s drain-loop body
 *  (`this.color(index)`/`this.getValue(data, "startTime", Date.now())`/`this.getValue(data,
 *  "duration", 1000)`). */
export interface ActiveBubbleSpawn {
  color: string
  startTime: number
  duration: number
}

/**
 * Ported from the `while (this.axis.data.length > 0) { ... index++ }` drain loop. `items` is
 * whatever rows are being drained in ONE `draw()`/frame call - `colorFor`'s `index` argument is
 * this batch-local `0, 1, 2, ...` counter (see this file's header comment: it is NOT a running
 * count across the bubble's whole lifetime, matching the original's own `let index = 0` being
 * re-declared inside `draw()` on every call). A row's `startTime`/`duration` fall back to `now`/
 * `1000` respectively when absent, exactly like `this.getValue(data, field, default)`.
 */
export function buildSpawnQueue(items: readonly DataRow[], colorFor: (item: DataRow, index: number) => string, now: number): ActiveBubbleSpawn[] {
  return items.map((item, index) => ({
    color: colorFor(item, index),
    startTime: typeof item.startTime === 'number' ? item.startTime : now,
    duration: typeof item.duration === 'number' ? item.duration : 1000,
  }))
}

/**
 * Ported from `ActiveBubble` (the plain, non-jui-module inner class `activebubble.js` defines and
 * caches per-chart). Owns the live `MortalBubble[]` population and runs their per-frame gravity/
 * collision physics; drawing is exposed as a separate `render()` (see below for why that's a
 * deliberate, documented deviation from the original's single `draw()`).
 */
export class ActiveBubble {
  data: MortalBubble[] = []

  /**
   * Ported from the source field of the same name. Starts `false`; flips to `true` once a
   * `step()` call finds ZERO overlapping bubble pairs (a "the population has settled" signal),
   * and is force-reset to `false` by `ActiveBubbleChart.vue` whenever new rows are drained in
   * (mirroring `drawBefore()`'s `activeBubbleCount != dataCount` check - see this file's header
   * comment). While `true`, one extra branch of the collision-resolution step (see `step()`)
   * gives a bubble that's still colliding after being pushed a small deterministic "kick"
   * velocity instead of leaving it as computed - ported 1:1, not restructured.
   */
  isArrange = false

  private readonly contextWidth: number
  private readonly contextHeight: number
  /** Read once at construction, like the original (`this.brush.gravity` is only ever consulted
   *  inside `drawBefore()`'s lazy-create branch, never re-read by `draw()` itself). */
  private readonly gravity: number

  constructor(contextWidth: number, contextHeight: number, gravity: number) {
    this.contextWidth = contextWidth
    this.contextHeight = contextHeight
    this.gravity = gravity
  }

  /**
   * Ported from `ActiveBubble.preCheck()`. **A real, preserved source bug, not fixed here**: the
   * original's splice loop does NOT decrement its own index after removing a dead bubble
   * (`this.data.splice(i, 1)` with no `i--` afterward) - since splicing shifts every later element
   * down by one, the element that slides INTO slot `i` (originally at `i + 1`) is silently skipped
   * this pass (the loop's `i++` then moves past it unchecked). Consequence: a run of 2+
   * consecutive dead bubbles only has every OTHER one removed per `preCheck()` call - the rest
   * linger (still rendered, since `render()` doesn't itself check `.active`) until a LATER
   * `preCheck()` call (any subsequent frame) finally clears them once the shifted survivor lands
   * on an index that gets re-visited. Ported literally: faithfulness to the original's actual
   * runtime behavior matters more here than "obviously correct" cleanup.
   */
  preCheck(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (!this.data[i].active) {
        this.data.splice(i, 1)
      }
    }
    return this.data.length > 0
  }

  /**
   * Ported from `ActiveBubble.draw()`, minus its final per-bubble `this.data[i].draw(...)` call
   * (split out as `render()` below). **Deviation, documented**: the original's constructor took
   * and cached a `renderContext` once, for the chart's whole lifetime; this port's canvas context
   * can be recreated by `useCanvasChart.ts`'s sizing `watchEffect` (e.g. on a `width`/`height`
   * prop change), so this class never stores one - `render()` takes it fresh each call instead.
   * This changes nothing about the PHYSICS (gravity/collision/bounds) or its call signature (no
   * `now` needed - none of the physics reads a timestamp, only `MortalBubble.draw()` does) - every
   * other line below is a 1:1 translation, same order, same quirks (the
   * `preCheck` bug above; the `isArrange`-gated extra "kick" branch; `me`/`other.accel` being read
   * AFTER `update()` already reset it to `[0, 0]` earlier in this same call, so `meForce`/
   * `otherForce` are `[0, 0]` unless an EARLIER collision pair in this same loop already called
   * `.force()` on the same bubble - preserved, not "fixed").
   */
  step(): void {
    if (!this.preCheck()) return

    for (const bubble of this.data) {
      const [fx, fy] = computeGravityForce(bubble.mass, this.gravity)
      bubble.force([fx, fy])
      bubble.update()
    }

    const collisions: Array<[MortalBubble, MortalBubble]> = []
    for (let i = 0; i < this.data.length; i++) {
      for (let j = 0; j < this.data.length; j++) {
        if (i === j) continue
        const me = this.data[i]
        const other = this.data[j]
        const dist = me.distance(other)
        const radiusSum = me.radius + other.radius
        if (radiusSum - dist > 1) {
          collisions.push([me, other])
        }
      }
    }

    if (collisions.length === 0) {
      this.isArrange = true
    }

    const dups: number[] = []
    for (let i = 0; i < collisions.length - 1; i++) {
      const me = collisions[i]
      for (let j = i + 1; j < collisions.length; j++) {
        const other = collisions[j]
        if ((me[0] === other[0] && me[1] === other[1]) || (me[1] === other[0] && me[0] === other[1])) {
          dups.push(j)
        }
      }
    }

    for (let i = 0; i < collisions.length; i++) {
      if (dups.indexOf(i) !== -1) continue

      const [me, other] = collisions[i]
      const radiusSum = me.radius + other.radius
      const dist = me.distance(other)
      let normal: [number, number] = [other.pos[0] - me.pos[0], other.pos[1] - me.pos[1]]
      const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
      normal = [normal[0] / len, normal[1] / len]
      const size = radiusSum - dist
      if (other.pos[0] === me.pos[0] && other.pos[1] === me.pos[1]) {
        normal = [0, -1]
      }

      me.pos = [(-size / 2) * normal[0] + me.pos[0], (-size / 2) * normal[1] + me.pos[1]]
      other.pos = [(size / 2) * normal[0] + other.pos[0], (size / 2) * normal[1] + other.pos[1]]

      const meForce: [number, number] = [normal[0] * me.accel[0], normal[1] * me.accel[1]]
      const otherForce: [number, number] = [normal[0] * other.accel[0], normal[1] * other.accel[1]]

      if (me.pos[0] < other.pos[0]) {
        me.veloc = [me.veloc[0] * 0.7, me.veloc[1] * 0.99]
        me.force([-otherForce[0], -otherForce[1]])
      } else {
        if (this.isArrange) {
          me.veloc = [other.pos[0] > me.pos[0] ? -1 : 1, other.pos[1] > me.pos[1] ? -1 : 1]
          me.force([-meForce[0], -meForce[1]])
        }

        other.veloc = [other.veloc[0] * 0.7, other.veloc[1] * 0.99]
        other.force([-meForce[0], -meForce[1]])
      }
    }

    // Bounds clamp - ported 1:1, including the asymmetry: x only ever clamps at the MAX edge (no
    // `pos[0] < 0` guard at all), while y clamps at BOTH edges. Faithful to source, not "fixed" -
    // matches this file's header note on why bubbles drift right and stay vertically bounded
    // rather than "falling" per se.
    for (const bubble of this.data) {
      if (bubble.pos[0] > this.contextWidth) bubble.pos[0] = this.contextWidth
      if (bubble.pos[1] > this.contextHeight) bubble.pos[1] = this.contextHeight
      else if (bubble.pos[1] < 0) bubble.pos[1] = 0
    }
  }

  /** The render half of the original's single `draw()` - see `step()`'s doc comment for why it's
   *  split out. Must be called with the SAME wall-clock `now` used for this frame's spawn/`step()`
   *  bookkeeping (see this file's header note: every timestamp in this brush is `Date.now()`-based,
   *  never a `requestAnimationFrame` high-res timestamp, since `MortalBubble.birthtime` is always
   *  seeded from `Date.now()`-shaped values). */
  render(ctx: CanvasRenderingContext2D, now: number): void {
    for (const bubble of this.data) {
      bubble.draw(ctx, now)
    }
  }
}
