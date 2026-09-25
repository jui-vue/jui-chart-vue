import { describe, expect, it } from 'vitest'
import { KineticObject } from './kinetic'

describe('KineticObject', () => {
  it('starts with the legacy defaults (mass 10, friction 0.1, pos/veloc/accel at origin)', () => {
    const k = new KineticObject()
    expect(k.mass).toBe(10)
    expect(k.friction).toBe(0.1)
    expect(k.pos).toEqual([0, 0])
    expect(k.veloc).toEqual([0, 0])
    expect(k.accel).toEqual([0, 0])
  })

  it('force(f) accumulates f/mass onto accel', () => {
    const k = new KineticObject()
    k.force([20, 0])
    expect(k.accel).toEqual([2, 0])
    k.force([0, 30])
    expect(k.accel).toEqual([2, 3])
  })

  it('update() only moves an axis once |veloc| on that axis exceeds 2, and always resets accel to [0,0]', () => {
    const k = new KineticObject()
    k.veloc = [1, 3]
    k.accel = [5, 5]
    k.update()

    // veloc becomes [1+5, 3+5] = [6, 8] first, THEN position moves by veloc on each axis whose
    // |veloc| > 2 (both here).
    expect(k.veloc).toEqual([6, 8])
    expect(k.pos).toEqual([6, 8])
    expect(k.accel).toEqual([0, 0])
  })

  it('distancePos()/distance() compute Euclidean distance', () => {
    const k = new KineticObject()
    k.pos = [3, 4]
    expect(k.distancePos([0, 0])).toBe(5)
    expect(k.distance({ pos: [0, 0] })).toBe(5)
  })

  it('direction() returns [0,0] at zero distance, otherwise a unit-ish vector toward pos', () => {
    const k = new KineticObject()
    k.pos = [0, 0]
    expect(k.direction([0, 0])).toEqual([0, 0])

    k.pos = [10, 0]
    expect(k.direction([0, 0])).toEqual([1, 0])
  })

  it('draw() is a documented no-op', () => {
    const k = new KineticObject()
    expect(() => k.draw({} as CanvasRenderingContext2D, 0)).not.toThrow()
  })
})
