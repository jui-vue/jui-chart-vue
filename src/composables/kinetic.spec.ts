import { describe, expect, it } from 'vitest'
import { KineticObject } from './kinetic'

/**
 * NOT a hand-traced port-correctness suite - `kinetic.js`'s physics logic is vendored,
 * unmodified, original code (see this file's sibling `kinetic.ts` and `src/vendor/kinetic.d.ts`
 * for the full "why" - PORT_STATUS.md's Phase E policy exception), so there is no reimplementation
 * of that math for this port to have introduced bugs into. This is only an integration-level
 * sanity check: confirm the vendored module actually loads and instantiates through the thin
 * `../vendor/kinetic.js` -> `.component()` -> `new KineticObject()` chain, and that one call to
 * its real `force()`/`update()` moves the object in a directionally-sensible way - treating the
 * implementation itself as a trusted black box, not verifying its internals.
 */
describe('KineticObject (vendored util.canvas.base.kinetic, imported as-is)', () => {
  it('constructs with the documented default field values', () => {
    const k = new KineticObject()
    expect(k.mass).toBe(10)
    expect(k.friction).toBe(0.1)
    expect(k.pos).toEqual([0, 0])
    expect(k.veloc).toEqual([0, 0])
    expect(k.accel).toEqual([0, 0])
  })

  it('a force applied then update()d moves the object in the direction of that force', () => {
    const k = new KineticObject()
    k.force([100, 50]) // pushes right and down
    k.update()
    expect(k.pos[0]).toBeGreaterThan(0)
    expect(k.pos[1]).toBeGreaterThan(0)
    // roughly proportional: twice the x-force should move at least as far in x as y
    expect(k.pos[0]).toBeGreaterThanOrEqual(k.pos[1])
  })

  it('exposes the full documented method surface (distance/direction/speed/draw)', () => {
    const k = new KineticObject()
    const other = new KineticObject()
    other.pos = [3, 4]
    expect(k.distance(other)).toBe(5)
    expect(k.direction([0, 0])).toEqual([0, 0])
    expect(k.speed()).toBe(0)
    expect(() => k.draw({} as CanvasRenderingContext2D, Date.now())).not.toThrow()
  })
})
