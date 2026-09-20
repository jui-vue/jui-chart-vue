import { describe, expect, it } from 'vitest'
import { computeRotate3dDegree, shouldSkipRotate3dTick, ROTATE3D_DEGREE_LIMIT } from './useRotate3d'

// Plot-area dims shared by every Phase E 3D demo page (`Dot3DPage.vue`/`Column3DPage.vue`/
// `Line3DPage.vue`, all 480x300 with default padding - see any of their header comments for the
// derivation: x:[48,456]/y:[20,268]).
const AREA_WIDTH = 408
const AREA_HEIGHT = 248
const UNIT = 5

describe('ROTATE3D_DEGREE_LIMIT', () => {
  it('matches source\'s hardcoded DEGREE_LIMIT', () => {
    expect(ROTATE3D_DEGREE_LIMIT).toBe(180)
  })
})

describe('computeRotate3dDegree', () => {
  // Every expected value below was independently cross-checked with a standalone Node repro of
  // `mousemove()`'s own arithmetic (`dx = sdx + floor((gapY/h)*180)`, `dy = sdy - floor((gapX/w)*180)`)
  // run via `node -e` against the exact same formula, before this file was written - not derived
  // FROM this implementation.

  it('a pure vertical drag (down) only rotates X, matching a full quarter of the drag limit', () => {
    // gapY = 62 = AREA_HEIGHT/4 -> floor((62/248)*180) = floor(45) = 45
    expect(computeRotate3dDegree({ x: 0, y: 0 }, 0, 62, AREA_WIDTH, AREA_HEIGHT)).toEqual({ x: 45, y: 0 })
  })

  it('a pure horizontal drag (right) only rotates Y, and the sign is SUBTRACTED (not added)', () => {
    // gapX = 102 = AREA_WIDTH/4 -> floor((102/408)*180) = floor(45) = 45, dy = 0 - 45 = -45
    expect(computeRotate3dDegree({ x: 0, y: 0 }, 102, 0, AREA_WIDTH, AREA_HEIGHT)).toEqual({ x: 0, y: -45 })
  })

  it('composes both axes from a diagonal drag, and adds onto a non-zero starting degree', () => {
    // gapX=-50, gapY=30, start={x:20,y:-15}
    // dx = 20 + floor((30/248)*180) = 20 + floor(21.774...) = 20 + 21 = 41
    // dy = -15 - floor((-50/408)*180) = -15 - floor(-22.058...) = -15 - (-23) = 8
    expect(computeRotate3dDegree({ x: 20, y: -15 }, -50, 30, AREA_WIDTH, AREA_HEIGHT)).toEqual({ x: 41, y: 8 })
  })

  it('a drag across the whole plot area (both axes) hits +/-90 exactly (a quarter-turn per axis, matching a half-drag of the 180 limit)', () => {
    // gapX=-204 (=-AREA_WIDTH/2), gapY=124 (=AREA_HEIGHT/2)
    // dx = floor((124/248)*180) = floor(90) = 90
    // dy = 0 - floor((-204/408)*180) = 0 - floor(-90) = 0 - (-90) = 90
    expect(computeRotate3dDegree({ x: 0, y: 0 }, -204, 124, AREA_WIDTH, AREA_HEIGHT)).toEqual({ x: 90, y: 90 })
  })

  it('a zero-delta drag (no movement) is a no-op', () => {
    expect(computeRotate3dDegree({ x: 12, y: -7 }, 0, 0, AREA_WIDTH, AREA_HEIGHT)).toEqual({ x: 12, y: -7 })
  })
})

describe('shouldSkipRotate3dTick', () => {
  it('does not skip when BOTH new angles are unit-multiples', () => {
    expect(shouldSkipRotate3dTick({ x: 0, y: -45 }, UNIT)).toBe(false)
  })

  it('does not skip when only X is a unit-multiple (the guard requires BOTH to be non-multiples to skip)', () => {
    // dx=0 (a multiple of 5), dy=-45 -> both happen to be multiples here; use a case where only one is.
    expect(shouldSkipRotate3dTick({ x: 10, y: -13 }, UNIT)).toBe(false) // 10 % 5 === 0
  })

  it('does not skip when only Y is a unit-multiple', () => {
    expect(shouldSkipRotate3dTick({ x: 12, y: -10 }, UNIT)).toBe(false) // -10 % 5 === -0 (falsy)
  })

  it('skips only when NEITHER angle is a unit-multiple - the real, preserved source quirk', () => {
    // dx=12 (12%5=2, truthy), dy=-4 (-4%5=-4, truthy) -> both non-multiples -> skip
    expect(shouldSkipRotate3dTick({ x: 12, y: -4 }, UNIT)).toBe(true)
  })

  it('cross-checked via computeRotate3dDegree: a small diagonal drag from a non-zero start also skips', () => {
    // From the composed-diagonal-drag test above: {x:41, y:8} - 41%5=1 (truthy), 8%5=3 (truthy) -> skip
    const degree = computeRotate3dDegree({ x: 20, y: -15 }, -50, 30, AREA_WIDTH, AREA_HEIGHT)
    expect(shouldSkipRotate3dTick(degree, UNIT)).toBe(true)
  })
})
