import { CUBE_FACES, cubeVertices, darkenColor, maxZ, rotatePolygonVertices, type Polygon3dProjection } from './usePolygon3d'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/polygon/column3d.js` (89 lines, `chart.brush.polygon.
 * column3d`). Confirmed genuine chart-rendering-domain code - already listed by name in
 * PORT_STATUS.md's Phase E policy section's "confirmed genuine chart-engine" list alongside
 * `dot3d.js`/`activecircle.js` - hand-ported, not vendored+`.d.ts`'d.
 *
 * **`extend` chain, confirmed from source**: `extend: "chart.brush.polygon.core"` ->
 * `"chart.brush.core"` (the SAME brush base every Phase A-D SVG component and every Phase E
 * canvas brush ultimately share `this.color()`/`this.getValue()`/`this.axis`/`this.brush`/
 * `this.chart` from). `chart.brush.polygon.core` (`juijs-graph/src/brush/polygon/core.js`) adds
 * exactly ONE method beyond that: `createPolygon(polygon, callback)`, which calls
 * `this.calculate3d(polygon)` (rotates+perspective-scales the polygon's vertices in place, via
 * `chart.draw`'s shared method - the SAME one `dot3d.js` uses, confirmed NOT brush-specific) then
 * invokes `callback` and stamps `element.order = axis.depth - polygon.max().z` on its return
 * value - a real per-cube back-to-front z-sort (this port's `sortColumn3dDraws` below), the SVG
 * analog of `chart.brush.canvas.core`'s `addPolygon()`/`drawAfter()` z-sort `dot3d.js` uses on the
 * canvas side (confirmed via `juijs-graph/src/util/svg.js`'s `appendAll()`, which sorts a group's
 * children by `.order` before appending to the DOM whenever any child's `order > 0`).
 *
 * **Renders real SVG, NOT canvas - confirmed from source, a genuine surprise vs. this task's own
 * "canvas 3D" framing**: `column3d.js` lives under `jui-chart/src/brush/polygon/`, not
 * `brush/canvas/`, and its `createColumn`/`draw` build `this.svg.group()`/`this.svg.polygon()`
 * elements - literal SVG `<g>`/`<polygon>` output, never touching a `CanvasRenderingContext2D`.
 * The "3D" is entirely in the VERTEX MATH (real rotation + perspective projection, see below),
 * not the rendering target - once vertices are projected to 2D, they're drawn as ordinary SVG
 * polygons, painter's-algorithm-sorted by `order`. Ported here as `Column3DChart.vue` composing
 * `ChartBase.vue` (this port's SVG scaffolding, same as `BarChart.vue`) rather than
 * `ChartCanvasBase.vue` (the canvas wrapper every OTHER Phase E brush before this one used) -
 * the correct match for what this brush actually outputs.
 *
 * **Real 3D via the SAME `chart.polygon.*` engine `dot3d.js` wraps, confirmed from source - NOT a
 * separate implementation**: `createColumn` builds a `new CubePolygon(x, yy, z, w, y-yy, h)`
 * (`chart.polygon.cube`, `juijs-graph/src/polygon/cube.js`) - 8 vertices + 6 quad faces, `extend:
 * "chart.polygon.core"`, the exact same `PolygonCore.rotate()` pipeline (homogeneous 4x4
 * rotation matrices + per-vertex perspective scale) `usePolygon3d.ts`'s `rotatePolygonVertices()`
 * already ports for `dot3d.js`. **`usePolygon3d.ts` needed exactly one addition**: `cubeVertices()`
 * + `CUBE_FACES` (ported from `chart.polygon.cube` itself) - `dot3d.js` only ever built 1-4-vertex
 * point/line/face polygons, never a full 8-vertex/6-face box, so no cube primitive existed before
 * this file. The rotation/perspective math itself is reused as-is via the new
 * `computePolygon3dProjection()` helper (also added to `usePolygon3d.ts` - the exact
 * `calculate3d()` center/effectiveDepth derivation `Dot3DChart.vue` already hand-reproduces
 * inline, now shared since a 2nd+3rd consumer needs the identical formula, per this port's
 * "extract once 2+ consumers need the same thing" convention). **External-library-match check
 * (per Phase E policy)**: no license header in `column3d.js` itself (bespoke jui-chart brush
 * code, already in PORT_STATUS's confirmed-genuine list) or in `chart.polygon.cube` (already
 * checked as part of `dot3d.js`'s own engine audit - the web search for "PointPolygon"
 * "LinePolygon" "FacePolygon" "CubePolygon" explicitly included the cube name and found no
 * matching published library).
 *
 * **Genuinely AXIS-BASED, confirmed from source, including a REAL third (z) axis - unlike
 * `dot3d.js`'s deliberately-scoped-down linear z**: `createColumn` calls `this.axis.x(dataIndex)`/
 * `this.axis.y(data[target])`/`this.axis.z(targetIndex)` - and, confirmed by reading
 * `juijs-graph/src/base/axis.js`'s `drawGridType()`, `axis.z` is a REAL `chart.grid.block`
 * (ordinal) grid, same TYPE as an x-axis category axis, just with `orient: "center"` forcing
 * `chart.grid.core`'s `getGridSize()` into its `isFull3D()` branch (`start=0, size=depth,
 * end=depth` - confirmed from source) instead of a plot-edge pixel span. This means the SAME
 * `createOrdinalScale()` primitive this port's `useAxis.ts` already uses for x/y block axes is
 * directly reusable for z, just with domain = `props.target` (the z-axis's real domain upstream
 * IS the series/target list, one z-slot per target - confirmed from `createColumn`'s own
 * `targetIndex` parameter) and range `[0, depth]` instead of a plot-edge interval - built inline
 * in `Column3DChart.vue` rather than a new `useZAxis.ts`, since it's a 3-line `createOrdinalScale`
 * call, not enough shared logic to warrant its own composable. **Deliberately NOT ported**: real
 * z-axis tick/grid CHROME (ticks/labels/baseline) - `chart.grid.core`'s full render pipeline for
 * `orient: "center"` - matching `dot3d.js`'s own already-documented z-axis-chrome scope boundary
 * (this file's own earlier PORT_STATUS.md entry named `column3d.js`/`line3d.js` as sharing that
 * exact boundary). `Column3DChart.vue` reuses `useChartLayout()`/`ChartBase.vue` for real x/y
 * axis chrome exactly as `BarChart.vue` does; z has a real ordinal SCALE (unlike `dot3d.js`'s
 * lienar-only z) but no rendered grid/tick chrome.
 *
 * **`col_width`/`col_height` sizing, ported from `drawBefore()`**: `width`/`height` props (source
 * `brush.width`/`brush.height`, default `0`) override the auto-fit size when `> 0`; otherwise
 * `col_width = axis.x.rangeBand() - padding*2` / `col_height = axis.z.rangeBand() - padding*2`
 * (source `padding` default `20`, NOT `10` - `line3d.js`'s own default differs, see
 * `useLine3d.ts`). `axis.z.rangeBand()` here = `depth / target.length` (the z ordinal scale's own
 * `rangeBand()`, ported as-is by `createOrdinalScale`).
 *
 * **Color, confirmed from `getBarElement`-adjacent `createColumn`**: `this.color(targetIndex)` -
 * ONE color per TARGET (series), not per row - `pickColor(j)`, same shape as `BarChart.vue`'s own
 * `pickColor`. Fill = `fill-opacity: theme("polygonColumnBackgroundOpacity")` (0.6); stroke =
 * `ColorUtil.darken(color, theme("polygonColumnBorderOpacity"))` (0.5) WITH `stroke-opacity` set
 * to that SAME 0.5 number again - a real, preserved source quirk (see `darkenColor`'s own doc
 * comment in `usePolygon3d.ts`), not a bug fixed here.
 *
 * **Per-element event forwarding, ported from `createColumn`'s own `this.addEvent(g, dataIndex,
 * targetIndex)`**: wired on the column's whole 6-face `<g>` group (matching source calling
 * `addEvent` on `g`, not per-face), **skipped when `data[target] == 0`** (`if(data[target] != 0)
 * this.addEvent(...)`, ported literally - a zero-value column emits nothing, same zero-value
 * guard shape as `bar.js`'s own `getBarElement()`/`BarChart.vue`'s `forwardEvent`).
 *
 * **A real, preserved z-order limitation, NOT fixed here**: `createPolygon`'s `order` is computed
 * ONCE per whole cube (`axis.depth - polygon.max().z`, across all 8 vertices) - the 6 faces of a
 * single column are always painted in their fixed `CUBE_FACES` array order relative to EACH
 * OTHER (no per-face z-sort within one cube), and columns/rows are sorted against each other only
 * by that one whole-cube value. Ported faithfully via `sortColumn3dDraws()` (whole-column sort,
 * `CUBE_FACES` order preserved within each column) - same shape as `dot3d.js`'s own preserved
 * "poly" fill quirk (a documented upstream limitation, not something to improve on).
 */

export interface Column3dFace {
  points: [number, number][]
}

export interface Column3dDraw {
  /** `axis.depth - polygon.max().z` across all 8 cube vertices - see this file's header comment. */
  order: number
  faces: Column3dFace[]
  fill: string
  fillOpacity: number
  stroke: string
  strokeOpacity: number
  dataIndex: number
  targetIndex: number
  targetKey: string
  value: number
}

/** Ported from `drawBefore()`: `col_width`/`col_height` auto-fit sizing. `widthOverride`/
 *  `heightOverride` are `brush.width`/`brush.height` (source default `0` = auto-fit). */
export function resolveColumnSize(rangeBandX: number, rangeBandZ: number, padding: number, widthOverride: number, heightOverride: number): { width: number; height: number } {
  return {
    width: widthOverride > 0 ? widthOverride : rangeBandX - padding * 2,
    height: heightOverride > 0 ? heightOverride : rangeBandZ - padding * 2,
  }
}

/** Ported from `PolygonColumn3DBrush.createColumn` + `draw()`'s double loop over rows/targets. */
export function buildColumn3dDraws(
  rows: readonly DataRow[],
  targets: readonly string[],
  scaleX: (dataIndex: number) => number,
  scaleY: (value: number) => number,
  scaleZ: (targetIndex: number) => number,
  colWidth: number,
  colHeight: number,
  color: (targetIndex: number) => string,
  backgroundOpacity: number,
  borderOpacity: number,
  projection: Polygon3dProjection,
): Column3dDraw[] {
  const draws: Column3dDraw[] = []
  const zeroY = scaleY(0)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    for (let j = 0; j < targets.length; j++) {
      const key = targets[j]
      const value = row[key] as number
      const w = colWidth
      const h = colHeight
      const x = scaleX(i) - w / 2
      const y = scaleY(value)
      const yy = zeroY
      const z = scaleZ(j) - h / 2

      const verts = cubeVertices(x, yy, z, w, y - yy, h)
      const projected = rotatePolygonVertices(verts, projection.effectiveDepth, projection.degree, projection.center, projection.perspective)
      const order = projection.axisDepth - maxZ(projected)
      const fillColor = color(j)

      const faces: Column3dFace[] = CUBE_FACES.map((face) => ({
        points: face.map((idx) => [projected[idx].x, projected[idx].y] as [number, number]),
      }))

      draws.push({
        order,
        faces,
        fill: fillColor,
        fillOpacity: backgroundOpacity,
        stroke: darkenColor(fillColor, borderOpacity),
        strokeOpacity: borderOpacity,
        dataIndex: i,
        targetIndex: j,
        targetKey: key,
        value,
      })
    }
  }

  return draws
}

/** Ported from `util/svg.js`'s `appendAll()` sibling sort (`a.order - b.order`) - see this file's
 *  header comment. Stable ascending sort, same convention as `sortDot3dDraws`. */
export function sortColumn3dDraws(draws: readonly Column3dDraw[]): Column3dDraw[] {
  return [...draws].sort((a, b) => a.order - b.order)
}
