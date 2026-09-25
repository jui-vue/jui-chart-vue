// Port of legacy `src/brush/cylinder3d.js` ("chart.brush.cylinder3d", extend:
// "chart.brush.column3d") - extends `Column3DBrush` (confirmed from the legacy file's own
// `extend:` field), reusing its `drawBefore()`/`draw()` wholesale and overriding ONLY
// `drawMain()` to build a `chart.svg.cylinder3d(...)` (`jui-graph-ts`'s `SVG3d.cylinder3d()`)
// instead of a `rect3d(...)` box.
import { registerBrush } from 'jui-graph-ts'
import { Column3DBrush } from './column3d'

/** Own `chart.brush.cylinder3d.setup()` fields - see legacy `cylinder3d.js`. `topRate` is NEW
 * over the inherited `Column3DBrush.setup()`'s own `outerPadding`/`innerPadding` (still inherited
 * unchanged, per the real `extend` chain). */
export const CYLINDER3D_BRUSH_OWN_DEFAULTS = {
  topRate: 1,
  outerPadding: 10,
  innerPadding: 5,
}

export class Cylinder3DBrush extends Column3DBrush {
  drawMain(color: string, width: number, height: number, degree: unknown, depth: number): any {
    return this.chart.svg.cylinder3d(color, width, height, degree as number, depth, (this.brush as Record<string, unknown>).topRate as number)
  }

  static setup(): Record<string, unknown> {
    return CYLINDER3D_BRUSH_OWN_DEFAULTS
  }
}

registerBrush('cylinder3d', Cylinder3DBrush)
