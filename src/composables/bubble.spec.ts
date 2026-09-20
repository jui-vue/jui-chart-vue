import { describe, expect, it } from 'vitest'
import { Bubble } from './bubble'

/**
 * `Bubble` is a genuine hand-port (see `bubble.ts`'s header comment for the confirmed-not-external
 * classification), so - unlike `kinetic.spec.ts`'s vendored-code sanity check - this is a real
 * correctness suite: constructor defaults, the `KineticObject` composition (`pos`/`force`/
 * `update` inherited via `extends`), and `draw()`'s exact canvas call sequence including the
 * `dim` alpha toggle.
 */

/** A minimal recording `CanvasRenderingContext2D` stand-in: every property SET and every drawing-
 *  method CALL is appended, in order, to `log` - lets a test assert both the exact values written
 *  (e.g. `fillStyle`) and their relative ordering (e.g. "shadow set before the circle is filled"),
 *  which a plain jsdom canvas context can't provide (jsdom's 2D context is a no-op stub). */
function createRecordingContext() {
  const log: string[] = []
  const methods = ['beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'fillText'] as const
  const ctx = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined
        if ((methods as readonly string[]).includes(prop)) {
          return (...args: unknown[]) => log.push(`${prop}(${args.join(', ')})`)
        }
        return undefined
      },
      set(_target, prop: string | symbol, value: unknown) {
        if (typeof prop === 'string') log.push(`${prop} = ${value}`)
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}

describe('Bubble constructor', () => {
  it('applies the documented default color/shadow/text styling', () => {
    const b = new Bubble(20, 'hi')
    expect(b.radius).toBe(20)
    expect(b.text).toBe('hi')
    expect(b.color).toBe('#497eff')
    expect(b.shadowColor).toBe('rgba(16,116,252,0.2)')
    expect(b.textColor).toBe('#fff')
  })

  it('accepts every override', () => {
    const b = new Bubble(5, 'x', '#111', '#222', '#333', '16px serif')
    expect(b.color).toBe('#111')
    expect(b.shadowColor).toBe('#222')
    expect(b.textColor).toBe('#333')
  })

  it('starts undimmed and unmarked', () => {
    const b = new Bubble(5, 'x')
    expect(b.dim).toBe(false)
    expect(b.mark).toBe(false)
  })
})

describe('Bubble extends KineticObject', () => {
  it('inherits the kinetic default fields', () => {
    const b = new Bubble(5, 'x')
    expect(b.pos).toEqual([0, 0])
    expect(b.veloc).toEqual([0, 0])
    expect(b.mass).toBe(10)
  })

  it('force() + update() moves it, same as a plain KineticObject', () => {
    const b = new Bubble(5, 'x')
    b.force([30, 0])
    b.update()
    expect(b.pos).toEqual([3, 0]) // accel = 30/mass(10) = 3; |veloc|=3 > 2 gate -> pos += veloc
  })
})

describe('Bubble.draw', () => {
  it('draws the shadowed circle then centered text, ignoring the now parameter', () => {
    const b = new Bubble(12, 'N', '#abc', '#shadow', '#textclr')
    b.pos = [50, 60]
    const { ctx, log } = createRecordingContext()

    b.draw(ctx, 999999) // now is unused by Bubble.draw - any value should behave identically

    expect(log).toEqual([
      'shadowColor = #shadow',
      'shadowBlur = 10',
      'shadowOffsetX = 0',
      'shadowOffsetY = 10',
      'beginPath()',
      'arc(50, 60, 12, 0, 6.283185307179586)',
      'fillStyle = #abc',
      'fill()',
      'fillStyle = #textclr',
      'textAlign = center',
      'font = bold 11px Noto Sans KR',
      'fillText(N, 50, 65)', // pos[1] + 5, the original's fixed vertical-centering offset
      'globalAlpha = 1',
    ])
  })

  it('sets globalAlpha to 0.5 before drawing when dim, then resets to 1.0 at the end', () => {
    const b = new Bubble(12, 'N')
    b.pos = [0, 0]
    b.dim = true
    const { ctx, log } = createRecordingContext()

    b.draw(ctx, 0)

    expect(log[0]).toBe('globalAlpha = 0.5')
    expect(log.at(-1)).toBe('globalAlpha = 1')
  })
})
