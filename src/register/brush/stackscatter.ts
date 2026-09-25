// Port of legacy `src/brush/stackscatter.js` ("chart.brush.stackscatter", extend:
// "chart.brush.scatter") - extends `ScatterBrush` (confirmed from the legacy file's own `extend:`
// field). Same single-override shape as `StackLineBrush`/`StackAreaBrush`: `draw()` calls
// `this.drawScatter(this.getStackXY())` instead of `this.drawScatter(this.getXY())`.
import { registerBrush } from 'jui-graph-ts'
import { ScatterBrush } from './scatter'

export class StackScatterBrush extends ScatterBrush {
  draw = (): any => {
    return this.drawScatter(this.getStackXY())
  }
}

registerBrush('stackscatter', StackScatterBrush)
