// Port of legacy `src/brush/stackline.js` ("chart.brush.stackline", extend: "chart.brush.line") -
// extends `LineBrush` (confirmed from the legacy file's own `extend:` field). The ENTIRE legacy
// file is just one override: `draw()` calls `this.drawLine(this.getStackXY())` instead of
// `this.drawLine(this.getXY())` - everything else (`drawBefore`, `createLine`, tooltips, active
// effects, `static setup()`) is reused unchanged from `LineBrush`.
import { registerBrush } from 'jui-graph-ts'
import { LineBrush } from './line'

export class StackLineBrush extends LineBrush {
  draw = (): any => {
    return this.drawLine(this.getStackXY())
  }
}

registerBrush('stackline', StackLineBrush)
