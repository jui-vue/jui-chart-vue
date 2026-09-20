/**
 * Pure logic for `TopologyChart.vue`'s optional `pannable`/`zoomable` props, ported from
 * `widget/topologyctrl.js` (191 lines), `chart.widget.topologyctrl` - this port's FIRST widget
 * (`extend: "chart.widget.core"`, confirmed from source - a WIDGET, not a brush: it attaches
 * alongside an existing brush/axis and mutates the brush's own grid state rather than drawing any
 * marks of its own; `draw()` even returns an empty `this.chart.svg.group()`). Read in full before
 * writing anything here.
 *
 * **Three genuinely separate interactions, confirmed from `draw()`/`TopologyControlWidget.setup()`,
 * not assumed from the "drag/zoom/pan" grouping in this file's own task brief**:
 * 1. `initDragEvent()` - drags an INDIVIDUAL NODE (mousedown on a node sets `targetKey` via
 *    `setBrushEvent()`, then `axis.mousemove` calls `xy.setX()`/`setY()`) - **always wired,
 *    unconditional**, not gated by any `widget.setup()` flag. **A real, hand-traced quirk, confirmed
 *    algebraically**: `xy.setX(startX + (dragX - startX))` - the `startX` captured at grab time
 *    cancels out of its own formula exactly, so this is really just `xy.setX(dragX)`: the node does
 *    NOT preserve the cursor's offset from its center at grab time, it snaps its reference
 *    coordinate to the raw (scale-corrected) pointer position on every single move, regardless of
 *    where inside the node you first clicked. **Not ported this iteration** - repositioning
 *    individual nodes is a genuinely separate feature from panning/zooming the whole viewport, with
 *    its own non-offset-preserving drag semantics that deserve a dedicated design pass of their own
 *    (plus the drag-to-front z-order `axis.cache.nodeKey`/`node.order` it alone triggers, already
 *    flagged as out of scope in `topologynode.js`'s own PORT_STATUS.md entry) - left for a future
 *    Phase D item.
 * 2. `initMoveEvent()`, opt-in via `widget.move` - drags the WHOLE VIEWPORT (mousedown on the
 *    background, not a node; a running `boxX`/`boxY` "total distance dragged" pair, then
 *    `xy.setView(-boxX, -boxY)`) - ported here as the `pannable` prop / `computeTopologyPan()`.
 * 3. `initZoomEvent()`, opt-in via `widget.zoom` - `axis.mousewheel` nudges a shared `scale` by
 *    `±0.1` (clamped `[0.6, 2]`, starting at `1`) via `xy.setScale()` - ported here as the
 *    `zoomable` prop / `clampTopologyZoomScale()`.
 *
 * **The shared coordinate math, confirmed from `grid/topologytable.js`'s `scale()` getter** (the
 * ONLY thing `axis.c(key)` ever resolves to in the real engine, per `topologynode.js`'s own
 * PORT_STATUS.md entry): a node's FINAL rendered position is
 * `(base.x + viewX) * scale, (base.y + viewY) * scale`, and `topologynode.js` separately multiplies
 * radius/font-size/stroke-width by that SAME `scale` at each of their own call sites
 * (`getNodeRadius()`/`createNodes()`/`createEdgeLine()`) - this engine has no SVG group-transform
 * concept, so source bakes pan/zoom into every individual coordinate/size by hand.
 *
 * **Confirmed mathematically equivalent, not just visually close**: wrapping this port's already-
 * rendered edges+nodes+tooltip `<g>` in one `transform="scale(s) translate(viewX, viewY)"` produces
 * the exact same coordinate for every x/y as the formula above - see `topologyViewportTransform()`'s
 * own doc comment for the derivation - AND gets radius/stroke-width/font-size scaling for free from
 * native SVG rendering, which is why `TopologyChart.vue` uses one group transform instead of
 * replicating source's own per-property multiplication at every node/edge/text call site.
 *
 * **One deliberate fix, not a preserved quirk**: source's raw `scale += 0.1` / `scale -= 0.1` on a
 * plain JS float accumulates drift over repeated wheel events (e.g. `1.1 + 0.1 ===
 * 1.2000000000000002`), purely an artifact of never rounding, with no behavioral/visual feature to
 * preserve (unlike e.g. `topologynode.js`'s reciprocal-edge paint-order quirk) - `clampTopologyZoomScale`
 * rounds to 1 decimal place after every step, which also keeps this item's own exact-value Playwright
 * verification non-flaky.
 */

export interface TopologyViewportPoint {
  x: number
  y: number
}

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2

/**
 * Ported from `initZoomEvent()`'s wheel handler: `direction > 0` zooms in (matches source's
 * `delta > 0` branch), clamped to `[0.6, 2]` in `0.1` steps starting from `1`. Rounds to 1 decimal
 * place to avoid float drift (see file header) - source does not.
 */
export function clampTopologyZoomScale(current: number, direction: 1 | -1): number {
  const next = direction > 0 ? Math.min(ZOOM_MAX, current + ZOOM_STEP) : Math.max(ZOOM_MIN, current - ZOOM_STEP)
  return Math.round(next * 10) / 10
}

/**
 * `WheelEvent.deltaY`'s sign -> zoom direction. `deltaY < 0` (scroll-up / pinch-out) zooms in,
 * matching source's `(e.wheelDelta || -e.detail) > 0` convention for the legacy `mousewheel` event -
 * the standard `wheel` event this port uses instead has the opposite sign convention for `deltaY`
 * vs. the old `wheelDelta`, so the sign is flipped here to preserve the same scroll-up-zooms-in feel.
 */
export function topologyZoomDirection(deltaY: number): 1 | -1 {
  return deltaY < 0 ? 1 : -1
}

/**
 * Ported from `initMoveEvent()`'s `boxX`/`boxY` running-total chain, algebraically simplified to a
 * closed form (hand-derived, see `useTopologyZoom.spec.ts` for the re-derivation trace):
 * `viewAtDragStart` is the viewport offset in effect when THIS drag gesture began (not a mutable
 * running `box` variable - source's own `boxX`/`boxY` are exactly `-viewAtDragStart`, carried across
 * gestures so a second drag continues from where the first left off), `pointerAtDragStart`/
 * `pointerNow` are raw pointer coordinates in the same (unscaled) space as source's own `e.x`/`e.y`.
 */
export function computeTopologyPan(viewAtDragStart: TopologyViewportPoint, pointerAtDragStart: TopologyViewportPoint, pointerNow: TopologyViewportPoint): TopologyViewportPoint {
  return {
    x: viewAtDragStart.x + (pointerNow.x - pointerAtDragStart.x),
    y: viewAtDragStart.y + (pointerNow.y - pointerAtDragStart.y),
  }
}

/**
 * `(base.x + viewX) * scale, (base.y + viewY) * scale` for every point in the wrapped group, via
 * `transform="scale(s) translate(viewX, viewY)"`. **Derivation**: SVG applies the rightmost
 * transform in the list to a child point first, so a point `p` inside the group ends up at
 * `scale(translate(p))` = `s * (p + view)` = `s*p + s*view` - exactly `(p + view) * s`, matching
 * `grid/topologytable.js`'s own getter formula.
 */
export function topologyViewportTransform(scale: number, viewX: number, viewY: number): string {
  return `scale(${scale}) translate(${viewX}, ${viewY})`
}
