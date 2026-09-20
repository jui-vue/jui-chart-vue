import { scaleValue } from './mathUtil'
import { maxZ, rotatePolygonVertices, vertex, type Center3, type Degree3, type Vector3 } from './usePolygon3d'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/canvas/dot3d.js` (166 lines, `chart.brush.canvas.
 * dot3d`). Confirmed genuine chart-rendering-domain code per PORT_STATUS.md's Phase E policy
 * test - listed by name in the policy section's own "confirmed genuine chart-engine" list
 * alongside `activecircle.js`/`activebubble.js` - hand-ported like every brush/widget in this
 * phase, not vendored+`.d.ts`'d.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.canvas.core"` - same chain as
 * every other Phase E canvas brush (`activebubble.js`/`activecircle.js`/`bubblecloud.js`). This
 * is the FIRST canvas brush in this phase that actually uses what `chart.brush.canvas.core`
 * (`useDot3d.ts`'s sibling files never needed) provides beyond the base `draw()` hook:
 * `addPolygon(polygon, callback)` (computes `polygon.rotate(...)` immediately, then queues
 * `{polygon, order: axis.depth - polygon.max().z, handler}`) and a `drawAfter()` that sorts the
 * queue ascending by `order` and replays each `handler` - i.e. a real back-to-front painter's-
 * algorithm depth sort across every dot/line/area this brush draws in one frame. Ported as
 * `buildDot3dDraws()`'s own `order` field + the caller (`Dot3DChart.vue`) sorting before drawing.
 *
 * **dot3d.js's relationship to `jui-chart/src/widget/polygon/*` (the task's flagged check) -
 * CONFIRMED, not unrelated**: `dot3d.js` does NOT import anything from `widget/polygon/` (that
 * directory only holds `rotate3d.js`, the interactive mouse-drag-to-rotate WIDGET - separate,
 * unported, out of scope here). But it DOES depend, transitively and essentially, on
 * `juijs-graph/src/polygon/{core,point,line}.js` (`chart.polygon.core/point/line`, via
 * `jui.include`) and inline-defines a 4th, `chart.polygon.face`, extending `chart.polygon.core`
 * itself. These live in the SEPARATE `juijs-graph` npm package (`jui-chart/node_modules/
 * juijs-graph/src/polygon/`), not in `jui-chart/src` at all - `dot3d.js` is a thin canvas-drawing
 * adapter over `juijs-graph`'s real 3D engine (vertex/matrix/rotation math), not a self-contained
 * file. See `usePolygon3d.ts`'s header comment for the full engine port and its own external-
 * library-match check (none found - hand-ported).
 *
 * **This is REAL 3D projection math, not a 2D shading/gradient effect** - confirmed from source,
 * see `usePolygon3d.ts`'s header comment: genuine homogeneous 4x4 rotation matrices around all
 * three axes plus a depth-based perspective scale, driven by `axis.degree`/`axis.depth`/`axis.
 * perspective`. `dot3d.js` ALSO applies a second, separate, simpler linear depth-cue directly to
 * a dot's RADIUS (`createDot`: `tr = r * MathUtil.scaleValue(z, 0, axis.depth, 1, p.perspective)`,
 * using the dot's RAW pre-rotation z, unrelated to the rotated-vertex perspective scale computed
 * inside `rotate()`) - ported here as `radiusDepthScale()`, kept distinct from the position
 * projection per source (a dot's on-screen SIZE and its on-screen POSITION are depth-scaled by
 * two independently-computed factors, not one).
 *
 * **Genuinely AXIS-BASED, confirmed from source**: `createDot`/`createLine`/`createArea` all call
 * `this.axis.x(data[0])`/`this.axis.y(data[1])`/`this.axis.z(data[2])` - real data-to-pixel scale
 * mapping, the same shape `activecircle.js` established as this phase's axis-based pattern (reuse
 * `useChartLayout`/`useAxis`/`toSeriesScale()` for x/y exactly as SVG components do). **Deviation,
 * explicitly scoped and documented, not an oversight**: `axis.z` in the original is a REAL third
 * grid axis (`chart.axis`'s `drawGridType(this, "z")`, its own block/range grid with ticks,
 * "center"-orient rendering, `isFull3D()` chrome positioning) with a `depth`/`degree`/
 * `perspective` config trio and a `calculate3d()` helper (`juijs-graph/src/base/draw.js`) that
 * feeds `Math.max(plotAreaWidth, plotAreaHeight, axis.depth)` and `(areaCenterX, areaCenterY,
 * axis.depth/2)` into `PolygonCore.rotate()` (see `usePolygon3d.ts`'s `rotatePolygonVertices` doc
 * comment for the exact derivation). Porting that FULL z-axis grid/chrome/interactive-rotation
 * system is out of this iteration's scope (same boundary as leaving `widget/polygon/rotate3d.js`,
 * `column3d.js`/`line3d.js` for a future iteration - they'd all need this same shared engine).
 * This port therefore builds the z SCALE with the existing `createLinearScale()` (data z-domain
 * -> `[0, depth]` pixel range, the same scale-construction primitive every other axis-based
 * component already uses) and reproduces `calculate3d()`'s exact depth/center formula by hand in
 * `Dot3DChart.vue`, but does NOT render z-axis tick/grid chrome (matching `activecircle.js`'s own
 * "no grid/tick chrome drawn here" precedent) and does not port the mouse-drag rotate widget.
 *
 * **A real, preserved bug found via careful source reading, NOT fixed here**: `draw()`'s loop
 * computes `isLast` as `i == data.length-1`, where `data` is `datas[i]` - THE CURRENT ROW ITSELF
 * (reassigned inside the loop, shadowing the `datas` array), not `datas.length-1` as the "is this
 * the last row" intent clearly means. Since every row ends up length 3 (`[x,y,z]`, 2-element rows
 * get a `z=0` pushed first), `isLast` is actually `i === 2` REGARDLESS of how many total rows
 * exist - true exactly once, at the 3rd row (index 2), never at the chart's real last row unless
 * there happen to be exactly 3 rows. This gates the "poly" symbol's closing-fill logic (see
 * `drawLine`'s `firstCacheData`/`isFill` below) - so a "poly" chart's fill-back-to-start visual
 * only ever fires at row index 2, not at the series' actual end. Ported faithfully as
 * `isLast = i === row.length - 1` (using the row's own length, exactly like source) below - not
 * "fixed" to `i === rows.length - 1`.
 *
 * **`firstCacheData`'s cross-frame persistence, ported faithfully**: it's a `var` closed over by
 * the WHOLE brush instance (declared once, outside `draw()`), set only once ever (`if(isFill &&
 * firstCacheData == null)`) and NEVER reset - so once a "poly" chart's first-ever `draw()` call
 * caches row 0's projected start point, EVERY later `draw()` call (even with completely different
 * data) keeps closing its row-2 fill triangle back to that stale, original point. This port
 * threads the equivalent state via a caller-supplied, mutable `PolyFillCache` object (see below)
 * that `Dot3DChart.vue` creates ONCE for the component's lifetime (same "created once, never
 * reset by a prop watch" pattern `ActiveCircleChart.vue`'s own `field` establishes), not a
 * per-call-reset default - the staleness-across-redraws behavior is preserved, not fixed.
 *
 * **The "poly" fill itself is a real, preserved visual bug, not a full polygon fill**: `drawLine`
 * strokes the CURRENT segment (`x1,y1 -> x2,y2`) first; only on `isLast` does it extend the SAME
 * canvas path with one more `lineTo(firstCacheData.x, firstCacheData.y)` then `fill()` - i.e. it
 * fills just the triangle `(x1,y1)-(x2,y2)-(firstPoint)`, NOT the interior of the whole polygonal
 * line strip (`beginPath()` is called once per segment, so earlier segments' paths are long since
 * discarded). Ported as-is via `polyFillTo` on the `isLast` line draw command.
 */

export interface Dot3dRow extends DataRow {
  x: number
  y: number
  z?: number
}

export type Dot3dSymbol = 'dot' | 'line' | 'poly' | 'area'

export interface PolyFillCache {
  point: { x: number; y: number } | null
}

export function createPolyFillCache(): PolyFillCache {
  return { point: null }
}

export interface Dot3dDotDraw {
  kind: 'dot'
  order: number
  x: number
  y: number
  radius: number
  color: string
}

export interface Dot3dLineDraw {
  kind: 'line'
  order: number
  x1: number
  y1: number
  x2: number
  y2: number
  lineWidth: number
  color: string
  /** Set only on the (buggy) `isLast` segment of a "poly" chart - see this file's header comment. */
  polyFillTo?: { x: number; y: number }
}

export interface Dot3dAreaDraw {
  kind: 'area'
  order: number
  /** Always 4 points: `[prev-top, cur-top, cur-base, prev-base]`, matching `FacePolygon`'s vertex order. */
  points: [number, number][]
  color: string
}

export type Dot3dDraw = Dot3dDotDraw | Dot3dLineDraw | Dot3dAreaDraw

export interface Dot3dProjection {
  /** `Math.max(plotAreaWidth, plotAreaHeight, axisDepth)` - see `usePolygon3d.ts`'s `rotatePolygonVertices` doc comment. */
  effectiveDepth: number
  /** `(areaX + areaWidth/2, areaY + areaHeight/2, axisDepth/2)` - `calculate3d()`'s rotation center. */
  center: Center3
  degree: Degree3
  perspective: number
  /** Raw `axis.depth` (config value, e.g. default `0`) - used for the `order` z-sort field and the radius depth-cue, NOT the same as `effectiveDepth`. */
  axisDepth: number
}

/** Ported from `createDot`'s radius depth-cue: `r * scaleValue(rawZ, 0, axisDepth, 1, perspective)`. */
export function radiusDepthScale(radius: number, rawZ: number, axisDepth: number, perspective: number): number {
  return radius * scaleValue(rawZ, 0, axisDepth, 1, perspective)
}

function project(vertices: ReturnType<typeof vertex>[], p: Dot3dProjection): Vector3[] {
  return rotatePolygonVertices(vertices, p.effectiveDepth, p.degree, p.center, p.perspective)
}

/**
 * Ported from `CanvasDot3DBrush.draw()` + `createDot`/`createLine`/`createArea`. `rows` are
 * already `{x,y,z?}` objects (this port's convention - the original's raw `[x,y]`/`[x,y,z]`
 * arrays with the "2-element row gets `z=0` pushed" quirk are equivalent to `z ?? 0` here).
 * `scaleX`/`scaleY`/`scaleZ` are plain pixel-space scale functions (`scaleZ` maps a data z value
 * into `[0, axisDepth]` - see this file's header comment for why a full z-axis grid isn't built).
 * Returns an UNSORTED draw list - sort by `order` ascending before drawing (`chart.brush.canvas.
 * core`'s `drawAfter()` back-to-front painter's sort).
 */
export function buildDot3dDraws(
  rows: readonly Dot3dRow[],
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
  scaleZ: (v: number) => number,
  symbol: Dot3dSymbol,
  color: string,
  size: number,
  projection: Dot3dProjection,
  polyFillCache?: PolyFillCache,
): Dot3dDraw[] {
  const r = size / 2
  const draws: Dot3dDraw[] = []

  const px = (row: Dot3dRow) => scaleX(row.x)
  const py = (row: Dot3dRow) => scaleY(row.y)
  const pz = (row: Dot3dRow) => scaleZ(row.z ?? 0)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const x = px(row)
    const y = py(row)
    const z = pz(row)

    if (symbol === 'line' || symbol === 'poly') {
      const prev = i === 0 ? null : rows[i - 1]
      const pX = prev == null ? x : px(prev)
      const pY = prev == null ? y : py(prev)
      const pZ = prev == null ? z : pz(prev)
      // Preserved `data.length-1` bug (see header comment): every row is effectively length 3
      // after the original's z-push (`[x,y]` -> `[x,y,0]`), so `isLast` is really `i === 2`
      // regardless of the true row count - NOT `i === rows.length - 1`.
      const isLast = i === 2

      const [v1, v2] = project([vertex(pX, pY, pZ), vertex(x, y, z)], projection)
      const isFill = symbol === 'poly'

      if (isFill && polyFillCache && polyFillCache.point == null) {
        polyFillCache.point = { x: v1.x, y: v1.y }
      }

      draws.push({
        kind: 'line',
        order: projection.axisDepth - Math.max(v1.z, v2.z),
        x1: v1.x,
        y1: v1.y,
        x2: v2.x,
        y2: v2.y,
        lineWidth: r,
        color,
        polyFillTo: isLast && isFill && polyFillCache?.point ? polyFillCache.point : undefined,
      })
    } else if (symbol === 'area') {
      const prev = i === 0 ? null : rows[i - 1]
      const pX = prev == null ? x : px(prev)
      const pY = prev == null ? y : py(prev)
      const pZ = prev == null ? z : pz(prev)
      const oy = scaleY(0)

      // FacePolygon(px,py,pz, x,y,z, oy): vertices = [px,py,pz],[x,y,z],[x,oy,z],[px,oy,z]
      // (both baseline corners reuse the CURRENT point's z, not their own - a source quirk, preserved).
      const vecs = project([vertex(pX, pY, pZ), vertex(x, y, z), vertex(x, oy, z), vertex(pX, oy, z)], projection)

      draws.push({
        kind: 'area',
        order: projection.axisDepth - maxZ(vecs),
        points: vecs.map((v) => [v.x, v.y] as [number, number]),
        color,
      })
    } else {
      const [v] = project([vertex(x, y, z)], projection)
      const tr = radiusDepthScale(r, z, projection.axisDepth, projection.perspective)

      draws.push({
        kind: 'dot',
        order: projection.axisDepth - v.z,
        x: v.x,
        y: v.y,
        radius: tr,
        color,
      })
    }
  }

  return draws
}

/** Ported from `chart.brush.canvas.core`'s `drawAfter()`: stable ascending sort by `order` (JS's
 *  `Array.sort` has been spec-guaranteed stable since ES2019, matching the original's `list.
 *  shift()`-in-sorted-order FIFO-within-ties behavior). */
export function sortDot3dDraws(draws: readonly Dot3dDraw[]): Dot3dDraw[] {
  return [...draws].sort((a, b) => a.order - b.order)
}
