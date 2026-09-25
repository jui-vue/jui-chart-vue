// Port of legacy `src/brush/clustercylinder3d.js` ("chart.brush.clustercylinder3d", extend:
// "chart.brush.clustercolumn3d") - extends `ClusterColumn3DBrush` (confirmed from the legacy
// file's own `extend:` field, despite its stale "@extends chart.brush.bar" JSDoc comment),
// reusing its `drawBefore()`/`draw()` wholesale and overriding ONLY `drawMain()` to build a
// `cylinder3d(...)` instead of a `rect3d(...)` box - same shape as `cylinder3d.ts`'s own override
// of `column3d.ts`.
import { registerBrush } from 'jui-graph-ts'
import { ClusterColumn3DBrush } from './clustercolumn3d'

/** Own `chart.brush.clustercylinder3d.setup()` fields - see legacy `clustercylinder3d.js`. */
export const CLUSTERCYLINDER3D_BRUSH_OWN_DEFAULTS = {
  topRate: 1,
  outerPadding: 5,
  innerPadding: 5,
}

export class ClusterCylinder3DBrush extends ClusterColumn3DBrush {
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.cylinder3d(color, width, height, degree as number, depth, (this.brush as Record<string, unknown>).topRate as number)
  }

  static setup(): Record<string, unknown> {
    return CLUSTERCYLINDER3D_BRUSH_OWN_DEFAULTS
  }
}

registerBrush('clustercylinder3d', ClusterCylinder3DBrush)
