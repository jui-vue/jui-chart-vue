/**
 * Hand-ported from `jui-chart/src/brush/canvas/base/bubble.js` (`util.canvas.base.bubble`, 43
 * lines, `extend: "util.canvas.base.kinetic"`). Confirmed genuine chart-rendering-domain code, NOT
 * an external-library vendoring candidate, per PORT_STATUS.md's Phase E policy test: no license/
 * attribution header in the source, and a web search for its most distinctive terms turned up
 * nothing resembling a published library (unlike `kinetic.js`/`hidpi.js`/`getCurvePoints`, which
 * all matched real external code) - this is original jui-chart bubble-rendering logic, so it's
 * hand-ported like every SVG component in Phases A-D, not vendored+`.d.ts`'d.
 *
 * Composition with the vendored `KineticObject`: the original's module descriptor declares
 * `extend: "util.canvas.base.kinetic"` - the jui module loader's inheritance mechanism copies the
 * kinetic prototype's instance fields/methods (`pos`/`veloc`/`accel`/`force()`/`update()`/etc.)
 * onto a `Bubble` instance before `Bubble`'s own constructor body runs. `KineticObject` (from
 * `./kinetic`) is a plain `function` constructor (vendored as-is, not ES2015 `class` syntax), but
 * ES2015 `extends` works with any constructor function - `class Bubble extends KineticObject`
 * below is the direct, idiomatic TS equivalent: `super()` runs the vendored constructor first
 * (initializing `pos`/`veloc`/`accel` and attaching `force`/`update`/etc. as own properties, since
 * that's how the vendored source defines them - not prototype methods), then this class's own
 * fields are set, mirroring the original's inheritance order exactly.
 *
 * **A real gotcha this composition surfaced, confirmed by a failing test before the fix**: `draw`
 * cannot be a normal ES2015 class-body method here. `KineticObject`'s constructor (run by
 * `super()`) sets `this.draw` to a no-op stub as an OWN property on the instance (again, because
 * the vendored source defines it that way, not as a prototype method) - and a JS property lookup
 * always finds an instance-own property before a same-named prototype method, so a class-body
 * `draw() {}` here would compile fine but never actually run; `instance.draw` would permanently
 * resolve to kinetic.js's stub instead. The fix (and the actually-faithful port, not just a
 * workaround): assign `this.draw = (context, now) => {...}` as the LAST statement in this
 * constructor, after `super()` - exactly mirroring the original `Bubble` constructor's own last
 * statement (`this.draw = function(context, now) {...}`), which only makes sense in the first
 * place because the original jui module loader also runs the kinetic "parent" constructor first,
 * then lets `Bubble`'s own constructor body overwrite the inherited `this.draw`.
 */
import { KineticObject } from './kinetic'
import { drawFilledCircle } from './canvasPrimitives'

/**
 * Ported from `Bubble`'s constructor + `draw(context, now)`. A static, non-aging labeled circle -
 * `draw()` ignores its own `now` parameter entirely (confirmed from source: the original
 * signature is `draw(context, now)` but `now` is never referenced in the body) - unlike
 * `MortalBubble` (`./mortalBubble.ts`), which uses `now` for its birth/age lifecycle animation.
 */
export class Bubble extends KineticObject {
  /** Set by a consumer (a future `activebubble.js`/`bubblecloud.js` port) to flag this bubble as
   *  hit-tested/selected; unused by `Bubble.draw()` itself (confirmed from source - present on
   *  the instance but never read in this file). */
  mark = false
  /** When true, `draw()` renders at 50% opacity - the only field of these two `draw()` itself
   *  actually reads. */
  dim = false
  radius: number
  text: string
  color: string
  shadowColor: string
  textColor: string
  /** Captured as a field here for a real TS class; the original captures `textStyle` as a plain
   *  JS closure variable (a constructor argument never assigned to `this.textStyle`) rather than
   *  an instance field like every other constructor argument here - behaviorally identical since
   *  both are read exactly once per `draw()` call, just noted since it's the one field/closure
   *  asymmetry in the original worth flagging. */
  private readonly textStyle: string

  constructor(
    radius: number,
    text: string,
    color = '#497eff',
    shadowColor = 'rgba(16,116,252,0.2)',
    textColor = '#fff',
    textStyle = 'bold 11px Noto Sans KR',
  ) {
    super()
    this.radius = radius
    this.text = text
    this.color = color
    this.shadowColor = shadowColor
    this.textColor = textColor
    this.textStyle = textStyle

    // Assigned as an INSTANCE property here, deliberately NOT as an ES2015 class-method (which
    // would live on `Bubble.prototype`) - see this file's header comment: the vendored
    // `KineticObject` constructor (run by `super()` just above) already set `this.draw` to its
    // own no-op stub as an OWN property on this instance. An own property always shadows a
    // same-named prototype method in JS property lookup, so a `draw(...)  {}` class-body method
    // here would be permanently unreachable - `this.draw` would always resolve to kinetic.js's
    // stub instead. Reassigning `this.draw` here, AFTER `super()`, is both the fix AND the
    // faithful port: the original `Bubble`'s own constructor does exactly this (sets `this.draw =
    // function(context, now) {...}` as its last statement), relying on the jui module loader
    // having already run the kinetic "parent" constructor first - this is that same shadow-then-
    // overwrite order, just expressed as `super()` + a constructor-body assignment instead of a
    // module-loader-mediated one. Confirmed by test: an earlier version using a class-body `draw()`
    // method silently never ran (see `bubble.spec.ts`'s git history / this comment for the "why").
    this.draw = (context: CanvasRenderingContext2D, _now: number): void => {
      if (this.dim) context.globalAlpha = 0.5

      context.shadowColor = this.shadowColor
      context.shadowBlur = 10
      context.shadowOffsetX = 0
      context.shadowOffsetY = 10

      drawFilledCircle(context, this.pos[0], this.pos[1], this.radius, this.color)

      context.fillStyle = this.textColor
      context.textAlign = 'center'
      context.font = this.textStyle
      context.fillText(this.text, this.pos[0], this.pos[1] + 5)
      context.globalAlpha = 1.0
    }
  }
}
