import { describe, expect, it } from 'vitest'
import { createStubCanvasContext } from '../testCanvasStub'
import { Bubble } from './bubble'

describe('Bubble', () => {
  it('defaults mark/dim to false and applies the legacy color/shadowColor/textColor defaults', () => {
    const b = new Bubble(20, 'hi')
    expect(b.mark).toBe(false)
    expect(b.dim).toBe(false)
    expect(b.color).toBe('#497eff')
    expect(b.shadowColor).toBe('rgba(16,116,252,0.2)')
    expect(b.textColor).toBe('#fff')
  })

  it('extends KineticObject (inherits pos/force/update/distance)', () => {
    const b = new Bubble(10, 'x')
    b.pos = [3, 4]
    expect(b.distancePos([0, 0])).toBe(5)
    b.force([10, 0])
    expect(b.accel).toEqual([1, 0])
  })

  it('draw() renders a circle (arc/fill) plus the label text (fillText) onto the given context', () => {
    const stub = createStubCanvasContext()
    const b = new Bubble(15, 'label')
    b.pos = [10, 10]

    b.draw(stub as unknown as CanvasRenderingContext2D, Date.now())

    expect(stub.calls).toContain('arc')
    expect(stub.calls).toContain('fill')
    expect(stub.calls).toContain('fillText')
  })

  it('dim: true sets a reduced globalAlpha before drawing, restored to 1 after', () => {
    const stub = createStubCanvasContext()
    const b = new Bubble(15, 'label')
    b.pos = [0, 0]
    b.dim = true

    b.draw(stub as unknown as CanvasRenderingContext2D, Date.now())

    expect((stub as unknown as { globalAlpha: number }).globalAlpha).toBe(1.0)
  })
})
