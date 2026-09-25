// Port of legacy `src/brush/canvas/base/mortalbubble.js` ("util.canvas.base.mortalbubble",
// extend: "util.canvas.base.kinetic") - a self-expiring, "pulse then fade" circle used by
// `canvas/activebubble.js` (`chart.brush.canvas.activebubble`)'s `ActiveBubble` collision system.
// `MortalBubble extends KineticObject` (confirmed from the legacy file's own `extend` field),
// reusing its `pos`/`force`/`update`/`distance` wholesale - only `draw()` (plus the constructor's
// own `active`/`birthtime`/`age`/`radius`/`color`/`shadowColor` fields and its own initial
// `this.force([30, 0])` nudge) is new here.
import { canvasBaseUtil } from 'jui-graph-ts'
import { KineticObject } from './kinetic'

export class MortalBubble extends KineticObject {
  active = true
  birthtime: number
  age: number
  radius: number
  color: string
  shadowColor: string

  constructor(birthtime: number, age: number, radius = 20, color = '#497eff', shadowColor = 'rgba(16,116,252,0.2)') {
    super()
    this.birthtime = birthtime
    this.age = age
    this.radius = radius
    this.color = color
    this.shadowColor = shadowColor
    this.force([30, 0])
  }

  draw(context: CanvasRenderingContext2D, now: number): void {
    context.shadowColor = this.shadowColor
    context.shadowBlur = 10
    context.shadowOffsetX = 0
    context.shadowOffsetY = 10

    const util = new canvasBaseUtil.CanvasBase(context)
    const d = this.age - (now - this.birthtime)
    let radius = this.radius
    const animSpeed = 3

    if (d <= 0) {
      this.active = false
      return
    }

    if (d <= 100 * animSpeed) {
      radius *= (100 * animSpeed - d) / (100 * animSpeed) + 1
    }

    if (d <= 80 * animSpeed) {
      const x = (80 * animSpeed - d) / (80 * animSpeed)
      const sd = (radius / 3 - 2) * x + 2
      const ed = (radius / 3 - 2) * Math.sin((Math.PI / 2) * x) + 2
      const stroke = 3 * x + 2
      context.lineCap = 'round'
      util.drawLine(this.pos[0] + sd, this.pos[1], this.pos[0] + ed, this.pos[1], this.color, stroke)
      util.drawLine(this.pos[0] - sd, this.pos[1], this.pos[0] - ed, this.pos[1], this.color, stroke)
      util.drawLine(this.pos[0], this.pos[1] + sd, this.pos[0], this.pos[1] + ed, this.color, stroke)
      util.drawLine(this.pos[0], this.pos[1] - sd, this.pos[0], this.pos[1] - ed, this.color, stroke)
      context.lineCap = 'butt'
    } else {
      util.drawCircle(this.pos[0], this.pos[1], radius, this.color)
    }
  }
}
