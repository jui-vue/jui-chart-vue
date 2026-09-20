import { Bubble } from './bubble'
import type { Vec2 } from './kinetic'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/canvas/bubblecloud.js` (196 lines,
 * `chart.brush.canvas.bubblecloud`, `import BubbleMod from './base/bubble.js'` - the PLAIN,
 * non-mortal `Bubble`, confirmed by the import path; `MortalBubble` is never referenced anywhere
 * in this file). Confirmed genuine chart-rendering-domain code per PORT_STATUS.md's Phase E
 * policy test, same classification as `activebubble.js`/`base/bubble.js`/`base/mortalbubble.js` -
 * hand-ported, not vendored.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"`, the exact same
 * chain as `activebubble.js` (see `useActiveBubble.ts`'s header comment for the full derivation -
 * `chart.brush.canvas.core` only adds `addPolygon()`/a depth-sorting `drawAfter()`, both purely
 * for the hand-rolled-3D brushes, neither referenced anywhere in this file's 196 lines either).
 *
 * **Genuinely non-axis-based, confirmed from source**: never touches `axis.x`/`axis.y` - only
 * `this.axis.area('width'/'height')` for the plot rectangle (the `BubbleCloud` inner class's
 * `contextWidth`/`contextHeight`) and `this.axis.data` used two different ways: (1) as the raw
 * row source, iterated ONCE via `this.eachData(...)` to build a `{name, count, color, ...}` spec
 * per row (`name`/`count` hardcoded to the `"title"`/`"capacity"` fields via `this.getValue(data,
 * "title", "Unknown")`/`this.getValue(data, "capacity", 1)` - NOT configurable via brush config,
 * unlike an axis-based brush's `domain`/`target`), and (2) as a cache key compared by REFERENCE
 * (`bubbleData == this.axis.data`, plain `==` on the array itself, never a deep/value compare -
 * see "the caching mechanism" below).
 *
 * **The caching mechanism, confirmed from `component.draw()`**: two nested layers, both preserved
 * here.
 * 1. **Outer (brush-level, `chart.getCache`/`setCache`)**: `draw()` compares the `bubble_data`
 *    cache slot against the CURRENT `this.axis.data` by reference. Same reference -> skip
 *    rebuilding entirely, just call the cached `BubbleCloud.draw()` again (this port's
 *    `step()`+`render()`) - i.e. advance one physics/render frame of an already-built cloud.
 *    Different reference (including a brand-new array holding IDENTICAL row values - `==` is
 *    reference equality, not deep equality) -> construct a BRAND NEW `BubbleCloud` instance from
 *    scratch (`new BubbleCloud(...)`, `bubbleCloud.start(...)`), discarding the old one entirely.
 *    This is the "avoid rebuilding the whole cloud on every render when data hasn't changed"
 *    behavior the task description anticipated - confirmed exactly that, and confirmed
 *    reference-based (not value-based). `BubbleCloudChart.vue` ports this literally: comparing
 *    `props.data` by `===` across frames, which - since Vue passes a prop array by reference and
 *    only a parent reassigning `data.value = newArray` (not an in-place `.push()`) changes that
 *    reference - reproduces the exact same "new array reference, even same values, forces a full
 *    rebuild" quirk without any extra bookkeeping.
 * 2. **Inner (`BubbleCloud.processData()`, called from `start()`)**: a mark-and-sweep diff by
 *    `name` - existing bubbles are marked `false`, each `nextData` row either creates a new
 *    `Bubble` (random spawn position) or, if a bubble with that `name` already exists, updates
 *    its `radius` ONLY IF `|oldRadius - newRadius| > 20` (leaving its current `pos` - and hence
 *    its place in an already-settled layout - untouched otherwise), then any bubble left unmarked
 *    is deleted. Setting `isChanged = true` on ANY create/radius-update/delete resets
 *    `animationAlpha` back to `0.1`, re-arming the center-gravity settle animation (see below).
 *    **Confirmed dead in THIS brush's actual call pattern, not a bug**: because layer 1 always
 *    constructs a fresh, EMPTY `BubbleCloud` before calling `start()` on any reference change
 *    (never reuses an existing instance's populated `bubbles` map across a data change), every
 *    `nextData` row hits the "no existing bubble with this name" branch on every real rebuild -
 *    the update-radius-in-place / bubble-survives-with-new-position-untouched branch of this
 *    diff can only ever fire if a CALLER of `BubbleCloud` directly calls `processData()` a second
 *    time on the SAME instance (not the actual `bubblecloud.js` brush's own usage) - ported
 *    faithfully anyway (`processData()` unit-tested directly, calling it twice on one instance),
 *    since it's real, intentional reusable-class behavior, not incidental brush-glue.
 *
 * **Exact layout algorithm, confirmed from `BubbleCloud.draw()` (split here into `step()` +
 * `render()`, matching this port's established `ActiveBubble` precedent)** - NOT a kinetic force
 * simulation, despite `Bubble` extending `KineticObject`:
 * 1. **Center gravity**: every bubble's `pos` is lerped a fraction `animationAlpha` of the way
 *    toward the canvas center, EVERY frame (`pos += (center - pos) * animationAlpha`) - direct
 *    position interpolation, not a `force()`+`update()` call. `animationAlpha` starts at `0.1` and
 *    decays by `*= 0.99` every frame (clamped at `0`, though - unlike `activebubble.js`'s
 *    `preCheck()` bug - that clamp is genuinely reachable here only in the limit; `*0.99` alone
 *    asymptotes toward but never crosses `0`), so this pull weakens toward imperceptible over
 *    time and effectively "freezes" the gravity component after a few hundred frames, UNTIL a
 *    data change resets it back to `0.1` (see the caching note above).
 * 2. **Pairwise collision separation**: an O(n^2) DOUBLE nested loop over EVERY ordered `(i, j)`
 *    pair with `i !== j` (confirmed: no `j > i`/dedupe guard at all, unlike `activebubble.js`'s
 *    `ActiveBubble.step()`, which explicitly collects pairs then dedupes symmetric duplicates
 *    before applying - a real, confirmed algorithmic difference between the two brushes, not an
 *    oversight in this port). Each overlapping pair is push-separated by a `jitter = 0.5` fraction
 *    of the overlap, applied via direct `pos[0]`/`pos[1]` mutation (not `force()`), and later
 *    pairs in the SAME pass see already-mutated positions from earlier pairs in that pass (no
 *    snapshot-then-batch-apply). Hand-traced in `useBubbleCloud.spec.ts`: two bubbles (radius 10
 *    each, `collisionPadding = 4`) starting exactly 10px apart resolve to EXACTLY `minDist` (24px)
 *    apart after processing ordered pair `(0,1)` alone - `jitter = 0.5` fully closes a single
 *    pairwise overlap in one application, which is also why the very next ordered pair `(1,0)` in
 *    the same pass is a no-op (`dist === minDist`, not `< minDist`). This runs UNCONDITIONALLY,
 *    every frame, regardless of `animationAlpha` - collision separation never decays/freezes the
 *    way gravity does, so a cloud always converges to (and then holds) a fully non-overlapping
 *    layout even after `animationAlpha` has decayed to ~0, which is what makes this a genuine
 *    "settle into a stable packed layout and stay there" brush, not a continuous jitter loop.
 * 3. **`bubble.update()`, confirmed a no-op here**: `BubbleCloud.draw()` calls it every frame
 *    (ported faithfully in `render()` below) but NEVER calls `bubble.force(...)` anywhere in this
 *    file - `veloc`/`accel` stay at `KineticObject`'s `[0, 0]` default forever, so `update()`'s
 *    own `|veloc| > 2` gate for actually moving `pos` never opens. **This is the core difference
 *    from `activebubble.js`'s physics loop**: that brush is a genuine kinetic force simulation
 *    (`force()` + `update()` every frame, mass/velocity/acceleration all live), continuously
 *    drifting/never settling until death; `bubblecloud.js` only borrows `KineticObject` for
 *    `pos`/`radius`/`distance()`/`distancePos()`/`draw()` and does ALL of its actual movement via
 *    direct position arithmetic (steps 1-2 above) - `update()`'s call is vestigial, preserved
 *    faithfully (not dropped) since the original calls it too.
 * 4. **Hover dim + draw**: `hoverBubble` (set by `pick(x, y)`, a simple `distancePos(...) <
 *    radius` hit-test over every bubble, first match wins) makes every OTHER bubble render at
 *    `dim = true` (50% alpha, per `Bubble.draw()`); the hovered one (or every bubble, if none
 *    hovered) renders normally.
 */

/**
 * Ported from `BubbleCloud.processData()`'s inline `radiusSize` closure. `count`/`totalCount` are
 * the row's own `capacity` value and the sum of every row's `capacity` in the current data set
 * (`nextData.reduce((a, b) => a + b.count, 0)`) - NOT clamped or guarded against `totalCount ===
 * 0` (an all-zero-capacity data set divides by zero, producing `NaN`/`Infinity` radii), matching
 * source exactly; not "fixed" here.
 */
export function computeBubbleRadius(count: number, totalCount: number, contextWidth: number, contextHeight: number): number {
  const s = contextWidth > contextHeight ? contextHeight : contextWidth
  return (count / totalCount) * (s / 6) + 50
}

/** Ported from `BubbleCloud.draw()`'s per-bubble gravity step (see this file's header comment,
 *  point 1) - direct position lerp toward `center`, not a `force()` call. Pure, so hand-traceable
 *  without a real `Bubble`/canvas. */
export function computeCenterGravityStep(pos: Vec2, center: Vec2, alpha: number): Vec2 {
  return [pos[0] + (center[0] - pos[0]) * alpha, pos[1] + (center[1] - pos[1]) * alpha]
}

/** One row's resolved bubble spec - ported from the brush component's `this.eachData(...)`
 *  callback body (the object literal assigned into `bubbleCloud.bubbles[name]` before
 *  `start()`/`processData()` converts it into a real `Bubble`). */
export interface BubbleCloudDatum {
  name: string
  count: number
  color: string
  shadowColor: string
  textColor: string
  textStyle: string
  origin: DataRow
}

/** The `|oldRadius - newRadius| > 20` threshold from `processData()` - a bubble surviving a data
 *  change only gets a new `radius` (and thus a visibly different size) past this deadband;
 *  smaller fluctuations leave its rendered size untouched even though its underlying `count`
 *  changed. Named here for clarity; inlined as a magic number in the original. */
const RADIUS_CHANGE_THRESHOLD = 20

/**
 * Ported from `BubbleCloud` (`bubblecloud.js`'s inner, non-jui-module class). Owns the live
 * `Bubble` population (keyed by `name`, exactly like source's `this.bubbles: {[name]: Bubble}`)
 * and runs the per-frame settle/collision physics. See this file's header comment for the full
 * algorithm writeup and the two-layer caching design.
 */
export class BubbleCloud {
  bubbles: Record<string, Bubble> = {}
  /** Parallel to `bubbles`, keyed the same way - ports the original's dynamic `bubble.data = e`
   *  assignment (an ad-hoc property the source attaches directly to each `Bubble` instance) as a
   *  separate map instead, since this port's `Bubble` class (`./bubble.ts`) deliberately has no
   *  generic payload field of its own. Read back by `pick()`, exactly like source's
   *  `this.hoverBubble.data.origin`. */
  private origins: Record<string, DataRow> = {}
  animationAlpha = 0.1
  hoverBubble: Bubble | null = null

  private readonly contextWidth: number
  private readonly contextHeight: number

  constructor(contextWidth: number, contextHeight: number) {
    this.contextWidth = contextWidth
    this.contextHeight = contextHeight
  }

  /**
   * Ported 1:1 from `processData()`'s mark-and-sweep diff (see this file's header comment for why
   * this is exercised directly only via a second `processData()` call on the same instance, never
   * by the actual brush's own usage). Returns `isChanged`, matching source's own local variable
   * (the brush component itself never reads this return value; `start()` does, indirectly, via
   * its effect on `animationAlpha`).
   */
  processData(nextData: readonly BubbleCloudDatum[] | null | undefined): boolean {
    if (nextData == null) return false

    const totalCount = nextData.reduce((a, b) => a + b.count, 0)
    let isChanged = false

    for (const key in this.bubbles) this.bubbles[key].mark = false

    for (const e of nextData) {
      const newRadius = computeBubbleRadius(e.count, totalCount, this.contextWidth, this.contextHeight)
      const bubble = this.bubbles[e.name]

      if (bubble == null) {
        const created = new Bubble(newRadius, e.name, e.color, e.shadowColor, e.textColor, e.textStyle)
        created.mark = true
        created.pos = [Math.random() * this.contextWidth, Math.random() * this.contextHeight]
        this.bubbles[e.name] = created
        this.origins[e.name] = e.origin
        isChanged = true
      } else {
        bubble.mark = true
        this.origins[e.name] = e.origin
        if (Math.abs(bubble.radius - newRadius) > RADIUS_CHANGE_THRESHOLD) {
          bubble.radius = newRadius
          isChanged = true
        }
      }
    }

    for (const key in this.bubbles) {
      if (!this.bubbles[key].mark) {
        delete this.bubbles[key]
        delete this.origins[key]
        isChanged = true
      }
    }

    if (isChanged) this.animationAlpha = 0.1
    return isChanged
  }

  /** Ported from `start(data)` - always rebuilds from an EMPTY `bubbles` map (see this file's
   *  header comment on why this is what makes `processData()`'s reuse-by-name branches dead code
   *  in the real brush call pattern). */
  start(data: readonly BubbleCloudDatum[]): void {
    this.bubbles = {}
    this.origins = {}
    this.processData(data)
  }

  /**
   * Physics half of the original single `draw()` - split from `render()` below, matching this
   * port's established `ActiveBubble.step()`/`render()` precedent (`useActiveBubble.ts`). See
   * this file's header comment (points 1-2) for the exact gravity + collision algorithm; ported
   * with the same ordered-pair-double-loop, no-dedupe, mutate-in-place-during-the-pass shape as
   * source, not simplified to unordered pairs.
   */
  step(): void {
    this.animationAlpha *= 0.99
    if (this.animationAlpha < 0) this.animationAlpha = 0

    const bubbles = Object.values(this.bubbles)
    const center: Vec2 = [this.contextWidth / 2, this.contextHeight / 2]
    for (const bubble of bubbles) {
      bubble.pos = computeCenterGravityStep(bubble.pos, center, this.animationAlpha)
    }

    const jitter = 0.5
    const collisionPadding = 4

    for (let i = 0; i < bubbles.length; i++) {
      for (let j = 0; j < bubbles.length; j++) {
        if (i === j) continue
        const me = bubbles[i]
        const other = bubbles[j]
        const dist = me.distance(other)
        const minDist = me.radius + other.radius + collisionPadding
        if (dist < minDist) {
          const d = ((dist - minDist) / dist) * jitter
          const dx = (me.pos[0] - other.pos[0]) * d
          const dy = (me.pos[1] - other.pos[1]) * d

          me.pos[0] -= dx
          me.pos[1] -= dy
          other.pos[0] += dx
          other.pos[1] += dy
        }
      }
    }
  }

  /** Render half of the original `draw()` - `bubble.update()` is called for fidelity even though
   *  it's a confirmed no-op here (see this file's header comment, point 3). Must be called with
   *  the SAME `now` used elsewhere this frame, matching `Bubble.draw(context, now)`'s signature
   *  (unused by `Bubble` itself - see `bubble.ts` - but kept for signature parity with source). */
  render(ctx: CanvasRenderingContext2D, now: number): void {
    const bubbles = Object.values(this.bubbles)
    for (const bubble of bubbles) {
      bubble.update()
      bubble.dim = this.hoverBubble != null && this.hoverBubble !== bubble
      bubble.draw(ctx, now)
    }
  }

  /** Ported from `pick(x, y)`. First-match hit-test (insertion order, matching source's
   *  `Object.values(this.bubbles)` iteration), not "closest bubble" - a point inside two
   *  overlapping bubbles' radii always resolves to whichever was inserted first. Returns the
   *  matched row's `origin` (source: `this.hoverBubble.data.origin`), or `null` if nothing hit -
   *  also clearing `hoverBubble` on a miss, exactly like source's `if (!isHover) this.hoverBubble
   *  = null`. */
  pick(x: number, y: number): DataRow | null {
    let hitName: string | null = null
    for (const name in this.bubbles) {
      if (this.bubbles[name].distancePos([x, y]) < this.bubbles[name].radius) {
        hitName = name
        break
      }
    }

    this.hoverBubble = hitName != null ? this.bubbles[hitName] : null
    return hitName != null ? (this.origins[hitName] ?? null) : null
  }
}
