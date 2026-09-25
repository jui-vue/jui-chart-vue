// Port of legacy `src/brush/stackarea.js` ("chart.brush.stackarea", extend: "chart.brush.area") -
// extends `AreaBrush` (confirmed from the legacy file's own `extend:` field). Same single-override
// shape as `StackLineBrush`: `draw()` calls `this.drawArea(this.getStackXY())` instead of
// `this.drawArea(this.getXY())` - everything else reused unchanged from `AreaBrush`.
import { registerBrush } from 'jui-graph-ts'
import { AreaBrush } from './area'

export class StackAreaBrush extends AreaBrush {
  draw = (): any => {
    return this.drawArea(this.getStackXY())
  }
}

registerBrush('stackarea', StackAreaBrush)
