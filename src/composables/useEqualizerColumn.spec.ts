import { describe, expect, it } from 'vitest'
import {
  computeErrorFlagGeometry,
  EQUALIZER_BOUNCE_DOWN_SPEED,
  EQUALIZER_BOUNCE_MAX_DISTANCE,
  EQUALIZER_BOUNCE_UP_SPEED,
  getTargetColumnWidth,
  isDisabledIndex,
  isErrorColumn,
  stepEqualizerBounce,
} from './useEqualizerColumn'

describe('isDisabledIndex', () => {
  it('active=null: never disabled', () => {
    expect(isDisabledIndex(null, 0)).toBe(false)
    expect(isDisabledIndex(null, 5)).toBe(false)
  })

  it('active=integer: disabled everywhere except the exact match', () => {
    expect(isDisabledIndex(2, 2)).toBe(false)
    expect(isDisabledIndex(2, 0)).toBe(true)
    expect(isDisabledIndex(2, 3)).toBe(true)
  })

  it('active=array: disabled everywhere except a listed index', () => {
    expect(isDisabledIndex([0, 2], 0)).toBe(false)
    expect(isDisabledIndex([0, 2], 2)).toBe(false)
    expect(isDisabledIndex([0, 2], 1)).toBe(true)
  })
})

describe('isErrorColumn', () => {
  it('error=null: never an error column', () => {
    expect(isErrorColumn(null, 0)).toBe(false)
  })

  it('error=integer: only the exact match is an error column', () => {
    expect(isErrorColumn(0, 0)).toBe(true)
    expect(isErrorColumn(0, 1)).toBe(false)
  })

  it('error=array: only listed indices are error columns', () => {
    expect(isErrorColumn([0, 3], 0)).toBe(true)
    expect(isErrorColumn([0, 3], 3)).toBe(true)
    expect(isErrorColumn([0, 3], 1)).toBe(false)
  })
})

describe('getTargetColumnWidth', () => {
  it('brush.size > 0 wins outright, ignoring band/outerPadding/minSize', () => {
    expect(getTargetColumnWidth(100, 40, 15, 5)).toBe(40)
  })

  it('size=0: band minus outerPadding*2, when above minSize', () => {
    // band=100, outerPadding=15 -> 100 - 30 = 70, above minSize=5
    expect(getTargetColumnWidth(100, 0, 15, 5)).toBe(70)
  })

  it('size=0: floors at minSize when the band is too narrow', () => {
    // band=20, outerPadding=15 -> 20-30 = -10, floored to minSize=5
    expect(getTargetColumnWidth(20, 0, 15, 5)).toBe(5)
  })
})

describe('computeErrorFlagGeometry', () => {
  it('hand-traced: offsetX=100, y=200, xBand=60, plotHeight=240', () => {
    // size = min(60,240)*0.4 = 24; height = 240*0.5 = 120; tick = 24*0.3 = 7.2
    // startX = 100 - 24/2 = 88; fontSize = 120/5 = 24
    // yt = 200 - 7.2 = 192.8; yht = 200 - 120 - 7.2 = 72.8; round = 5
    const g = computeErrorFlagGeometry(100, 200, 60, 240)
    expect(g.size).toBe(24)
    expect(g.height).toBe(120)
    expect(g.tick).toBeCloseTo(7.2)
    expect(g.startX).toBe(88)
    expect(g.fontSize).toBe(24)
    expect(g.yt).toBeCloseTo(192.8)
    expect(g.yht).toBeCloseTo(72.8)
    expect(g.round).toBe(5)
  })

  it('xBand narrower than plotHeight: size derives from xBand (the min)', () => {
    // min(30, 500) = 30 -> size = 12
    const g = computeErrorFlagGeometry(0, 0, 30, 500)
    expect(g.size).toBe(12)
  })
})

describe('stepEqualizerBounce', () => {
  it('hand-traced: starts at {direction:-1, distance:0}, moves up at 20px/s', () => {
    // speed = UP (direction===-1) = 20; distance = 0 + (-1*20*0.1) = -2
    // abs(-2)=2 <8 (no flip); -2>=0 false (direction unchanged, stays -1); clamp: -2 not <-8, not >0
    const s1 = stepEqualizerBounce({ direction: -1, distance: 0 }, 0.1)
    expect(s1).toEqual({ direction: -1, distance: -2 })
  })

  it('hand-traced: crossing -MAX_DISTANCE flips direction to 1 and clamps at exactly -8', () => {
    // From {direction:-1, distance:-6}, tpf=0.1: distance = -6 + (-1*20*0.1) = -8
    // abs(-8)=8 >= MAX_DISTANCE(8) -> direction=1; clamp: -8 not < -8 (strict), not >0 -> stays -8
    const s = stepEqualizerBounce({ direction: -1, distance: -6 }, 0.1)
    expect(s).toEqual({ direction: 1, distance: -8 })
  })

  it('hand-traced: overshoot clamps below -MAX_DISTANCE', () => {
    // {direction:-1, distance:-7.5}, tpf=1 -> distance = -7.5-20 = -27.5, abs>=8 -> direction=1
    // clamp: -27.5 < -8 -> distance = -8
    const s = stepEqualizerBounce({ direction: -1, distance: -7.5 }, 1)
    expect(s).toEqual({ direction: 1, distance: -EQUALIZER_BOUNCE_MAX_DISTANCE })
  })

  it('hand-traced: return leg uses the faster DOWN speed and flips back to -1 at/above 0', () => {
    // {direction:1, distance:-8}, tpf=0.1 -> speed=DOWN(30); distance = -8 + 1*30*0.1 = -5
    // abs(-5)=5<8; -5>=0 false -> direction stays 1; clamp: no-op
    const s1 = stepEqualizerBounce({ direction: 1, distance: -8 }, 0.1)
    expect(s1).toEqual({ direction: 1, distance: -5 })

    // {direction:1, distance:-2}, tpf=0.1 -> distance = -2+3 = 1; abs(1)<8; 1>=0 -> direction=-1
    // clamp: 1 > 0 -> distance = 0
    const s2 = stepEqualizerBounce({ direction: 1, distance: -2 }, 0.1)
    expect(s2).toEqual({ direction: -1, distance: 0 })
  })

  it('a full cycle (tpf=0.05) returns to exactly the starting state after 14 steps - Node-cross-checked', () => {
    let status = { direction: -1, distance: 0 }
    for (let i = 1; i <= 14; i++) {
      status = stepEqualizerBounce(status, 0.05)
    }
    expect(status).toEqual({ direction: -1, distance: 0 })
  })

  it('speed constants match source (UP=20, DOWN=30 - "DOWN" is the faster leg, preserved as named)', () => {
    expect(EQUALIZER_BOUNCE_UP_SPEED).toBe(20)
    expect(EQUALIZER_BOUNCE_DOWN_SPEED).toBe(30)
  })
})
