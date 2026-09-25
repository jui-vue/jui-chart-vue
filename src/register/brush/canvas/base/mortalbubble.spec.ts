import { describe, expect, it } from 'vitest'
import { createStubCanvasContext } from '../testCanvasStub'
import { MortalBubble } from './mortalbubble'

describe('MortalBubble', () => {
  it('starts active with the legacy color/shadowColor defaults, and gives itself an initial rightward force', () => {
    const m = new MortalBubble(0, 1000)
    expect(m.active).toBe(true)
    expect(m.color).toBe('#497eff')
    expect(m.shadowColor).toBe('rgba(16,116,252,0.2)')
    // constructor's own `this.force([30, 0])`, applied against the default mass (10)
    expect(m.accel).toEqual([3, 0])
  })

  it('draw() deactivates once its age has fully elapsed (now - birthtime >= age), without drawing anything', () => {
    const stub = createStubCanvasContext()
    const m = new MortalBubble(0, 100)

    m.draw(stub as unknown as CanvasRenderingContext2D, 500)

    expect(m.active).toBe(false)
    expect(stub.calls.length).toBe(0)
  })

  it('draw() while still alive draws a shape (circle or the cross/pulse lines) onto the context', () => {
    const stub = createStubCanvasContext()
    const m = new MortalBubble(0, 100000, 20)
    m.pos = [50, 50]

    m.draw(stub as unknown as CanvasRenderingContext2D, 1)

    expect(m.active).toBe(true)
    expect(stub.calls.length).toBeGreaterThan(0)
  })
})
