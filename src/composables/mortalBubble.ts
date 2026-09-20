/**
 * Hand-ported from `jui-chart/src/brush/canvas/base/mortalbubble.js` (`util.canvas.base.
 * mortalbubble`, 76 lines, `extend: "util.canvas.base.kinetic"`). Same classification as
 * `./bubble.ts` (read that file's header first): confirmed genuine chart-rendering-domain code
 * per PORT_STATUS.md's Phase E policy test - no license header, no recognizable match to a
 * published library found via web search ("MortalBubble"/"birthtime"/"animSpeed" all came back
 * with nothing resembling this file) - so hand-ported, not vendored. Same `class ... extends
 * KineticObject` composition as `Bubble` - see `./bubble.ts`'s header comment for why that's the
 * direct TS equivalent of the original's `extend: "util.canvas.base.kinetic"` inheritance.
 */
import { KineticObject } from './kinetic'
import { drawFilledCircle, drawStrokedLine } from './canvasPrimitives'

/**
 * Result of one `computeMortalBubbleFrame()` evaluation: `active: false` once the bubble's
 * lifetime has expired, otherwise either a plain circle (most of its life) or the `cross`
 * arm-length parameters for its final `80 * animSpeed`ms death animation (see
 * `computeMortalBubbleFrame`'s own doc comment for the exact windows).
 */
export type MortalBubbleFrame =
  | { active: false }
  | { active: true; mode: 'circle'; radius: number }
  | { active: true; mode: 'cross'; sd: number; ed: number; stroke: number }

/**
 * Pure age/radius/cross-fade animation math, extracted from the original `MortalBubble.draw
 * (context, now)`'s body (everything before its first `util.draw*` call) for hand-traceable unit
 * testing without a real `CanvasRenderingContext2D` - the same "extract the pure math, keep
 * canvas/DOM calls in the class/component" split this port already uses for
 * `useCanvasChart.ts`'s `computeCanvasBackingSize`/`computeFrameDelta`. Ported 1:1, including the
 * original's exact control-flow order - each check below observes the PREVIOUS check's mutation
 * of `radius`/its own threshold on `d`, and that dependency is preserved exactly, not
 * restructured:
 *
 * 1. `d` = remaining lifetime in ms at `now` (`age - (now - birthtime)`). `d <= 0` means dead.
 * 2. Once `d <= 100 * animSpeed` (the last 300ms of life, at the default `animSpeed = 3`),
 *    `radius` inflates linearly from 1x (at `d === 100 * animSpeed`) toward 2x (as `d -> 0`).
 * 3. Once `d <= 80 * animSpeed` (a SUBSET of window 2's, so `radius` here already reflects that
 *    inflation), the bubble switches from a filled circle to a 4-armed cross/plus shape: `x`
 *    sweeps `0 -> 1` over this window; `sd` (each arm's start distance from center) grows
 *    LINEARLY with `x`, `ed` (each arm's end distance) grows via a sine ease, both sharing the
 *    same `radius / 3 - 2` amplitude plus a `+2` floor (so at `x = 0`, `sd === ed === 2`); the
 *    stroke width grows linearly from 2 to 5.
 *
 * The original also sets `context.shadowColor`/`shadowBlur`/`shadowOffsetX`/`shadowOffsetY`
 * UNCONDITIONALLY, before even computing `d` - including on the frame where `d <= 0` and it
 * returns immediately afterward, leaving those shadow properties applied to the context with
 * nothing actually drawn using them. That's a `draw()`-level (not pure-math) detail, preserved as-
 * is in `MortalBubble.draw()` below rather than "fixed" here.
 */
export function computeMortalBubbleFrame(birthtime: number, age: number, baseRadius: number, now: number, animSpeed = 3): MortalBubbleFrame {
  const d = age - (now - birthtime)
  if (d <= 0) return { active: false }

  let radius = baseRadius
  if (d <= 100 * animSpeed) {
    radius *= (100 * animSpeed - d) / (100 * animSpeed) + 1
  }

  if (d <= 80 * animSpeed) {
    const x = (80 * animSpeed - d) / (80 * animSpeed)
    const sd = (radius / 3 - 2) * x + 2
    const ed = (radius / 3 - 2) * Math.sin((Math.PI / 2) * x) + 2
    const stroke = 3 * x + 2
    return { active: true, mode: 'cross', sd, ed, stroke }
  }

  return { active: true, mode: 'circle', radius }
}

/**
 * Ported from `MortalBubble`'s constructor + `draw(context, now)`. Unlike `Bubble` (`./bubble.ts`),
 * this one has a real lifecycle: born at `birthtime`, dies once `age` ms have elapsed, and its
 * constructor immediately applies a constant `[30, 0]` rightward `force()` (confirmed from source
 * - baked into every `MortalBubble` at creation, a one-time push consumed by the next `update()`
 * tick, same as `kinetic.ts`'s `force()` always accumulates into pending `accel`; NOT reapplied
 * every frame) - callers (a future `activebubble.js` port) are expected to call `update()`
 * themselves each animation frame, same as `KineticObject` always has.
 *
 * `draw` is assigned as an INSTANCE property in the constructor (after `super()`), NOT as an
 * ES2015 class-body method - see `bubble.ts`'s header comment for the full "why" (the vendored
 * `KineticObject` constructor already sets `this.draw` to a no-op stub as an own property, which
 * would permanently shadow a same-named prototype method; reassigning it after `super()` is both
 * the fix and the faithful port, matching the original `MortalBubble` constructor's own last
 * statement).
 */
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

    this.draw = (context: CanvasRenderingContext2D, now: number): void => {
      context.shadowColor = this.shadowColor
      context.shadowBlur = 10
      context.shadowOffsetX = 0
      context.shadowOffsetY = 10

      const frame = computeMortalBubbleFrame(this.birthtime, this.age, this.radius, now)

      if (!frame.active) {
        this.active = false
        return
      }

      if (frame.mode === 'circle') {
        drawFilledCircle(context, this.pos[0], this.pos[1], frame.radius, this.color)
        return
      }

      const { sd, ed, stroke } = frame
      context.lineCap = 'round'
      drawStrokedLine(context, this.pos[0] + sd, this.pos[1], this.pos[0] + ed, this.pos[1], this.color, stroke)
      drawStrokedLine(context, this.pos[0] - sd, this.pos[1], this.pos[0] - ed, this.pos[1], this.color, stroke)
      drawStrokedLine(context, this.pos[0], this.pos[1] + sd, this.pos[0], this.pos[1] + ed, this.color, stroke)
      drawStrokedLine(context, this.pos[0], this.pos[1] - sd, this.pos[0], this.pos[1] - ed, this.color, stroke)
      context.lineCap = 'butt'
    }
  }
}
