import { darkenColor, maxZ, rotatePolygonVertices, vertex, type Polygon3dProjection } from './usePolygon3d'
import type { DataRow } from '../types'

/**
 * Hand-ported from `jui-chart/src/brush/polygon/line3d.js` (82 lines, `chart.brush.polygon.
 * line3d`). Same `extend` chain, same `chart.polygon.*` engine dependency, same real-SVG-not-
 * canvas rendering target, and the same axis-based/z-block-axis shape as `column3d.js` - see
 * `useColumn3d.ts`'s header comment for all of that shared writeup (not repeated here).
 *
 * **Closely related to `column3d.js`, but NOT identical structure - confirmed by reading both in
 * full, per this task's own explicit instruction not to assume**: both extend the same
 * `chart.brush.polygon.core` and use the same `createPolygon()`/`calculate3d()` pipeline, but the
 * actual GEOMETRY differs genuinely: `column3d.js` builds one `CubePolygon` (8 vertices, 6 faces)
 * per (row, target) cell via a SINGLE `createPolygon()` call; `line3d.js` builds a flat 4-point
 * ribbon quad per (row-to-row segment, target) cell via FOUR SEPARATE `createPolygon()` calls,
 * each wrapping a single-vertex `PointPolygon` (`chart.polygon.point` - the SAME primitive
 * `dot3d.js` already uses for its own `createDot`, not the new cube). Each of those 4 calls'
 * `callback` doesn't `return` anything (it just appends a projected point to one shared `elem` and
 * tracks the max-z corner in a closure-scoped `maxPoint`), so `createPolygon`'s own `element.order
 * = ...` line **never fires for these calls** (`if(element)` is false every time - `element` is
 * `undefined`) - `line3d.js` computes `elem.order` itself, by hand, AFTER the loop:
 * `elem.order = this.axis.depth - maxPoint.max().z`. Ported here as `buildLine3dDraws()` doing the
 * equivalent: project all 4 corner vertices at once (`rotatePolygonVertices` on a 4-element
 * array, same math either way), take `maxZ()` across all 4 projected vertices for `order` -
 * behaviorally identical to source's incremental per-corner `maxPoint` tracking, just computed in
 * one batch instead of iteratively (both reduce to "the max z among these exact 4 projected
 * points").
 *
 * **No cube needed here** - `line3d.js` never references `chart.polygon.cube`, confirmed by
 * grep - so this file only needs `usePolygon3d.ts`'s pre-existing `vertex()`/
 * `rotatePolygonVertices()`/`maxZ()` (already built for `dot3d.js`/shared with `column3d.js`), no
 * further additions to that composable.
 *
 * **Ribbon geometry, ported from `createLine`**: for segment `i` (row `i` -> row `i+1`) and target
 * `j`: `d = axis.z.rangeBand() - padding*2` (the SAME z ordinal-scale rangeBand `column3d.js`
 * uses, but consumed differently - as a single depth THICKNESS split symmetrically `±d/2` around
 * the target's z center, not a cube dimension), `x1/y1 = axis.x(i)/axis.y(data[i][target])`,
 * `x2/y2 = axis.x(i+1)/axis.y(data[i+1][target])`, `z1 = axis.z(j) - d/2`, `z2 = axis.z(j) + d/2`.
 * The 4 vertices, in the source's own literal order (must be preserved - the SVG `<polygon>` point
 * order determines its rendered shape): `(x1,y1,z1)`, `(x1,y1,z2)`, `(x2,y2,z2)`, `(x2,y2,z1)` - a
 * quad spanning the FULL segment length in x/y, but only `d` thick in z, i.e. a flat "wall" panel
 * approximating a 3D ribbon between consecutive row values, one per target (so `target.length`
 * parallel ribbons, one per z-slot).
 *
 * **`padding` default is 10, confirmed from `PolygonLine3DBrush.setup()` - DIFFERENT from
 * `column3d.js`'s own default of 20**: a real, source-confirmed divergence between these two
 * "paired" brushes' own config defaults, not a copy-paste slip in this port - kept as each
 * component's own independent default.
 *
 * **Color, confirmed from `createLine`**: `this.color(dataIndex, targetIndex)` - a 2-argument
 * call, unlike `column3d.js`'s 1-argument `this.color(targetIndex)`. Confirmed from
 * `brush/core.js`'s own `this.color(key1, key2)`: when `key2` is given, `colorIndex = key2` and
 * `rowIndex = key1` - and for the plain non-function `colors` array/undefined case (this port's
 * only supported mode, `colors?: string[]` - see `BarChart.vue`'s own `pickColor`), `rowIndex` is
 * **read but never used** (`color = this.chart.color(colorIndex, colors)`). So despite the extra
 * argument, `line3d.js`'s color is - like `column3d.js`'s - purely a function of `targetIndex`;
 * `dataIndex` is a genuinely dead argument in the source itself for this port's color mode, not
 * something dropped here. Ported as the same `pickColor(targetIndex)` shape.
 *
 * **Fill/stroke, identical shape to `column3d.js` but its own theme tokens**:
 * `fill-opacity: theme("polygonLineBackgroundOpacity")` (0.6), `stroke:
 * ColorUtil.darken(color, theme("polygonLineBorderOpacity"))` (0.7) with `stroke-opacity` set to
 * that same 0.7 - the identical "theme number reused as both darken-rate and stroke-opacity"
 * quirk `column3d.js` has, with `line3d.js`'s own distinct opacity values (0.6/0.7 vs.
 * column3d's 0.6/0.5).
 *
 * **No per-element event forwarding - confirmed by a full read, unlike `column3d.js`**:
 * `line3d.js` never calls `this.addEvent(...)` anywhere. `Line3DChart.vue` emits nothing, matching
 * this port's established "only wire what source actually wires" convention (e.g.
 * `LineChart.vue`'s own per-series-only, never-per-point, event granularity).
 *
 * **`draw()`'s loop bound, confirmed from source**: `for (i = 0; i < datas.length - 1; i++)` -
 * one fewer segment than rows (N rows -> N-1 ribbon segments per target), unlike `column3d.js`'s
 * one-cube-per-row. A single-row dataset renders nothing (`rows.length - 1 <= 0`), ported as a
 * plain loop bound, not a special-cased guard.
 */

export interface Line3dDraw {
  /** `axis.depth - max(z)` across this segment's 4 projected vertices - see this file's header comment. */
  order: number
  /** Always 4 points, in source order: `[x1y1z1, x1y1z2, x2y2z2, x2y2z1]`. */
  points: [number, number][]
  fill: string
  fillOpacity: number
  stroke: string
  strokeOpacity: number
  /** The segment's starting row index (`i`, segment spans rows `i` -> `i+1`). */
  dataIndex: number
  targetIndex: number
  targetKey: string
}

/** Ported from `PolygonLine3DBrush.createLine` + `draw()`'s double loop over segments/targets. */
export function buildLine3dDraws(
  rows: readonly DataRow[],
  targets: readonly string[],
  scaleX: (dataIndex: number) => number,
  scaleY: (value: number) => number,
  scaleZ: (targetIndex: number) => number,
  ribbonDepth: number,
  color: (targetIndex: number) => string,
  backgroundOpacity: number,
  borderOpacity: number,
  projection: Polygon3dProjection,
): Line3dDraw[] {
  const draws: Line3dDraw[] = []
  const d = ribbonDepth

  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < targets.length; j++) {
      const key = targets[j]
      const x1 = scaleX(i)
      const y1 = scaleY(rows[i][key] as number)
      const z1 = scaleZ(j) - d / 2
      const x2 = scaleX(i + 1)
      const y2 = scaleY(rows[i + 1][key] as number)
      const z2 = scaleZ(j) + d / 2

      const verts = [vertex(x1, y1, z1), vertex(x1, y1, z2), vertex(x2, y2, z2), vertex(x2, y2, z1)]
      const projected = rotatePolygonVertices(verts, projection.effectiveDepth, projection.degree, projection.center, projection.perspective)
      const order = projection.axisDepth - maxZ(projected)
      const fillColor = color(j)

      draws.push({
        order,
        points: projected.map((v) => [v.x, v.y] as [number, number]),
        fill: fillColor,
        fillOpacity: backgroundOpacity,
        stroke: darkenColor(fillColor, borderOpacity),
        strokeOpacity: borderOpacity,
        dataIndex: i,
        targetIndex: j,
        targetKey: key,
      })
    }
  }

  return draws
}

/** Ported from `util/svg.js`'s `appendAll()` sibling sort - same convention as `sortColumn3dDraws`/`sortDot3dDraws`. */
export function sortLine3dDraws(draws: readonly Line3dDraw[]): Line3dDraw[] {
  return [...draws].sort((a, b) => a.order - b.order)
}
