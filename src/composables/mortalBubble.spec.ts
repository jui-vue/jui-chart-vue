import { describe, expect, it } from 'vitest'
import { computeMortalBubbleFrame, MortalBubble } from './mortalBubble'

/**
 * `MortalBubble` is a genuine hand-port (see `mortalBubble.ts`'s header comment for the confirmed-
 * not-external classification). `computeMortalBubbleFrame`'s age/radius/cross-fade math is the
 * "genuinely nontrivial animation math" PORT_STATUS.md flags for this item - every case below was
 * hand-traced by re-deriving the original's arithmetic by hand and cross-checked by evaluating the
 * exact same formula in an isolated Node script, not just re-running the ported code against
 * itself.
 */

describe('computeMortalBubbleFrame (birthtime=0, age=1000, baseRadius=30, default animSpeed=3)', () => {
  it('at birth (now=0, d=1000): no inflation (d > 300), plain circle at base radius', () => {
    expect(computeMortalBubbleFrame(0, 1000, 30, 0)).toEqual({ active: true, mode: 'circle', radius: 30 })
  })

  it('at the inflation threshold (now=700, d=300 exactly): factor is 1 (no-op), still base radius', () => {
    expect(computeMortalBubbleFrame(0, 1000, 30, 700)).toEqual({ active: true, mode: 'circle', radius: 30 })
  })

  it('mid-inflation (now=750, d=250): radius grows to 35 (30 * (50/300 + 1))', () => {
    expect(computeMortalBubbleFrame(0, 1000, 30, 750)).toEqual({ active: true, mode: 'circle', radius: 35 })
  })

  it('at the cross-fade threshold (now=760, d=240 exactly): x=0, so sd=ed=2 and stroke=2 regardless of the inflated radius', () => {
    expect(computeMortalBubbleFrame(0, 1000, 30, 760)).toEqual({ active: true, mode: 'cross', sd: 2, ed: 2, stroke: 2 })
  })

  it('mid cross-fade (now=880, d=120, x=0.5): radius inflates to 48 first, then sd=9 (linear), ed uses the sine ease, stroke=3.5', () => {
    // radius at d=120: 30 * (180/300 + 1) = 48 (not itself exposed by the frame, but drives sd/ed below)
    // sd = (48/3 - 2)*0.5 + 2 = 9 ; ed = (48/3 - 2)*sin(pi/4) + 2 ~= 11.899... ; stroke = 3*0.5 + 2 = 3.5
    const frame = computeMortalBubbleFrame(0, 1000, 30, 880)
    expect(frame).toEqual({ active: true, mode: 'cross', sd: 9, ed: expect.closeTo(11.899494936611664, 10), stroke: 3.5 })
  })

  it('sine ease (ed) is ahead of the linear ramp (sd) partway through the window, converging as x -> 1', () => {
    const frame = computeMortalBubbleFrame(0, 1000, 30, 880) as { mode: 'cross'; sd: number; ed: number }
    expect(frame.ed).toBeGreaterThan(frame.sd)
  })

  it('dies exactly at d=0 (now=1000) and stays dead past it (now=1200)', () => {
    expect(computeMortalBubbleFrame(0, 1000, 30, 1000)).toEqual({ active: false })
    expect(computeMortalBubbleFrame(0, 1000, 30, 1200)).toEqual({ active: false })
  })

  it('is birthtime-relative, not now-absolute: shifting both birthtime and now by +100 reproduces the mid-inflation case', () => {
    expect(computeMortalBubbleFrame(100, 1000, 30, 850)).toEqual({ active: true, mode: 'circle', radius: 35 })
  })
})

describe('computeMortalBubbleFrame with a custom animSpeed', () => {
  it('scales both the 100x and 80x thresholds by animSpeed (animSpeed=1: thresholds at d=100/d=80 instead of 300/240)', () => {
    // age=100, baseRadius=10, now=20 -> d=80 -> exactly the cross-fade threshold at animSpeed=1 (80*1=80): x=0
    expect(computeMortalBubbleFrame(0, 100, 10, 20, 1)).toEqual({ active: true, mode: 'cross', sd: 2, ed: 2, stroke: 2 })
    // now=10 -> d=90 -> inside the inflation window (90<=100) but outside the cross window (90>80): circle, radius 11
    expect(computeMortalBubbleFrame(0, 100, 10, 10, 1)).toEqual({ active: true, mode: 'circle', radius: 11 })
  })
})

describe('MortalBubble construction', () => {
  it('applies the documented defaults and starts active', () => {
    const m = new MortalBubble(0, 1000)
    expect(m.active).toBe(true)
    expect(m.radius).toBe(20)
    expect(m.color).toBe('#497eff')
    expect(m.shadowColor).toBe('rgba(16,116,252,0.2)')
  })

  it('bakes in a constant rightward force at birth, consumed by the next update()', () => {
    const m = new MortalBubble(0, 1000)
    expect(m.pos).toEqual([0, 0]) // force() only accumulates accel, doesn't move it yet
    m.update()
    // accel = 30/mass(10) = 3 on x, 0 on y; |veloc[0]|=3 > 2 gate -> pos.x += veloc.x
    expect(m.pos).toEqual([3, 0])
  })
})

describe('MortalBubble.draw', () => {
  /** Same recording-context approach as `bubble.spec.ts` (see that file for the rationale) -
   *  duplicated locally rather than shared since each file's assertions differ. */
  function createRecordingContext() {
    const log: string[] = []
    const methods = ['beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke'] as const
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

  it('draws a filled circle (not lines) while outside the cross-fade window', () => {
    const m = new MortalBubble(0, 1000, 30)
    m.pos = [10, 20]
    const { ctx, log } = createRecordingContext()

    m.draw(ctx, 0) // d=1000, plain circle at base radius 30

    expect(log).toEqual(['shadowColor = rgba(16,116,252,0.2)', 'shadowBlur = 10', 'shadowOffsetX = 0', 'shadowOffsetY = 10', 'beginPath()', 'arc(10, 20, 30, 0, 6.283185307179586)', 'fillStyle = #497eff', 'fill()'])
    expect(m.active).toBe(true)
  })

  it('draws 4 stroked lines (a cross), not a circle, inside the cross-fade window', () => {
    const m = new MortalBubble(0, 1000, 30)
    m.pos = [0, 0]
    const { ctx, log } = createRecordingContext()

    m.draw(ctx, 760) // d=240 exactly -> cross-fade threshold, x=0, sd=ed=2, stroke=2

    expect(log[4]).toBe('lineCap = round')
    // `stroke(` (the method CALL) deliberately excludes `strokeStyle = ...` (a property SET) -
    // both start with the substring "stroke" but only the former is a draw call being counted.
    const lineCalls = log.filter((entry) => entry.startsWith('moveTo(') || entry.startsWith('lineTo(') || entry.startsWith('stroke('))
    // 4 arms x (moveTo + lineTo + stroke() call) = 12 entries
    expect(lineCalls.length).toBe(12)
    expect(log).toContain('strokeStyle = #497eff')
    expect(log).toContain('lineWidth = 2')
    expect(log.at(-1)).toBe('lineCap = butt')
    expect(log.some((entry) => entry.startsWith('arc'))).toBe(false) // no circle drawn in cross mode
  })

  it('marks itself inactive and draws nothing once d <= 0, even though shadow props were already set', () => {
    const m = new MortalBubble(0, 1000, 30)
    const { ctx, log } = createRecordingContext()

    m.draw(ctx, 1000) // d=0 exactly -> dead

    expect(m.active).toBe(false)
    // the shadow properties ARE set (matches the original's exact, slightly-odd behavior - see
    // computeMortalBubbleFrame's doc comment) but nothing else is drawn afterward
    expect(log).toEqual(['shadowColor = rgba(16,116,252,0.2)', 'shadowBlur = 10', 'shadowOffsetX = 0', 'shadowOffsetY = 10'])
  })
})
