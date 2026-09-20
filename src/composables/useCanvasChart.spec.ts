import { describe, expect, it } from 'vitest'
import { computeCanvasBackingSize, computeFrameDelta, resolveDevicePixelRatio } from './useCanvasChart'

describe('resolveDevicePixelRatio', () => {
  it('passes through a valid positive ratio', () => {
    expect(resolveDevicePixelRatio(2)).toBe(2)
    expect(resolveDevicePixelRatio(1.5)).toBe(1.5)
  })

  it('falls back to 1 for missing/invalid values', () => {
    expect(resolveDevicePixelRatio(undefined)).toBe(1)
    expect(resolveDevicePixelRatio(null)).toBe(1)
    expect(resolveDevicePixelRatio(0)).toBe(1)
    expect(resolveDevicePixelRatio(-2)).toBe(1)
  })
})

describe('computeCanvasBackingSize', () => {
  it('scales CSS pixels to device pixels at dpr=1 (identity)', () => {
    expect(computeCanvasBackingSize(600, 400, 1)).toEqual({ width: 600, height: 400 })
  })

  it('scales CSS pixels to device pixels at dpr=2 (retina)', () => {
    expect(computeCanvasBackingSize(600, 400, 2)).toEqual({ width: 1200, height: 800 })
  })

  it('rounds a fractional result (dpr=1.5 on odd CSS sizes)', () => {
    // 601 * 1.5 = 901.5 -> round -> 902 ; 399 * 1.5 = 598.5 -> round -> 599 (round-half-up)
    expect(computeCanvasBackingSize(601, 399, 1.5)).toEqual({ width: 902, height: 599 })
  })

  it('floors at 1x1 for a not-yet-laid-out (0-sized) container', () => {
    expect(computeCanvasBackingSize(0, 0, 2)).toEqual({ width: 1, height: 1 })
  })

  it('treats an invalid dpr (0/negative/missing) as 1, via resolveDevicePixelRatio', () => {
    expect(computeCanvasBackingSize(300, 200, 0)).toEqual({ width: 300, height: 200 })
    expect(computeCanvasBackingSize(300, 200, -3)).toEqual({ width: 300, height: 200 })
  })
})

describe('computeFrameDelta', () => {
  it('is 0 for the first frame (previousTimestamp === null), regardless of timestamp', () => {
    expect(computeFrameDelta(null, 1000)).toBe(0)
    expect(computeFrameDelta(null, 0)).toBe(0)
  })

  it('is the plain difference for a normal ~60fps frame gap', () => {
    // 1000 -> 1016.67 is a typical 60fps frame gap
    expect(computeFrameDelta(1000, 1016.67)).toBeCloseTo(16.67, 5)
  })

  it('clamps to maxDelta (default 250) after a large gap, e.g. a backgrounded tab resuming', () => {
    expect(computeFrameDelta(1000, 6000)).toBe(250)
  })

  it('respects a custom maxDelta', () => {
    expect(computeFrameDelta(1000, 6000, 500)).toBe(500)
    expect(computeFrameDelta(1000, 1100, 500)).toBe(100)
  })

  it('clamps a negative delta (an out-of-order/backwards timestamp) up to 0', () => {
    expect(computeFrameDelta(1000, 900)).toBe(0)
  })
})
