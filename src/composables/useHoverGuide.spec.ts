import { describe, expect, it } from 'vitest'
import { createLinearScale, createOrdinalScale } from './useScale'
import { clamp, invertAxisValue, nearestIndexByPosition, toSvgPoint } from './useHoverGuide'
import type { BlockAxisResult, RangeAxisResult } from './useAxis'

describe('toSvgPoint', () => {
  it('maps client coords 1:1 when the rendered rect matches the target size', () => {
    const rect = { left: 10, top: 20, width: 600, height: 400 }
    expect(toSvgPoint(110, 120, rect, 600, 400)).toEqual({ x: 100, y: 100 })
  })

  it('scales up when the rendered rect is smaller than the target (max-width: 100% shrink)', () => {
    // rect is half-size (300x200) of the target (600x400) - a client-space move of (150, 100)
    // relative to rect origin should map to (300, 200) in SVG user-unit space.
    const rect = { left: 100, top: 50, width: 300, height: 200 }
    expect(toSvgPoint(250, 150, rect, 600, 400)).toEqual({ x: 300, y: 200 })
  })

  it('falls back to scale 1 when the rect has zero width/height (not yet laid out)', () => {
    const rect = { left: 0, top: 0, width: 0, height: 0 }
    expect(toSvgPoint(40, 30, rect, 600, 400)).toEqual({ x: 40, y: 30 })
  })
})

describe('clamp', () => {
  it('passes through a value already in range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('nearestIndexByPosition', () => {
  const positions = [20, 60, 100]

  it('picks the closest row for a pointer between two rows', () => {
    // distances from 45: |20-45|=25, |60-45|=15, |100-45|=55 - row 1 (60) wins.
    expect(nearestIndexByPosition(positions, 45)).toBe(1)
  })

  it('picks the closest row past the last one', () => {
    // distances from 90: |20-90|=70, |60-90|=30, |100-90|=10 - row 2 (100) wins.
    expect(nearestIndexByPosition(positions, 90)).toBe(2)
  })

  it('picks the first row for a pointer left of everything', () => {
    expect(nearestIndexByPosition(positions, -100)).toBe(0)
  })

  it('returns -1 for an empty position list', () => {
    expect(nearestIndexByPosition([], 50)).toBe(-1)
  })
})

describe('invertAxisValue', () => {
  // createOrdinalScale(['a','b','c'], [0,120]): unit=(120-0)/3=40, range=[20,60,100].
  const blockScale = createOrdinalScale(['a', 'b', 'c'], [0, 120])
  const blockAxis: BlockAxisResult = { type: 'block', scale: blockScale, ticks: ['a', 'b', 'c'], values: blockScale.range, band: blockScale.rangeBand(), orient: 'bottom', line: false, hide: false }

  it('maps a pixel exactly on a tick back to its label', () => {
    expect(invertAxisValue(blockAxis, 20)).toBe('a')
    expect(invertAxisValue(blockAxis, 60)).toBe('b')
  })

  it('maps a pixel between two ticks to the floor tick (matches OrdinalScale.invert)', () => {
    // invert(59) = floor(|59-0|/40) = 1 -> 'b'.
    expect(invertAxisValue(blockAxis, 59)).toBe('b')
  })

  it('clamps a pixel past the last tick to the last label (OrdinalScale.invert has no upper clamp of its own)', () => {
    // invert(150) = floor(150/40) = 3, out of range for a 3-item domain - clamped to index 2.
    expect(invertAxisValue(blockAxis, 150)).toBe('c')
  })

  it('clamps a pixel before the first tick to the first label', () => {
    expect(invertAxisValue(blockAxis, -40)).toBe('a')
  })

  // createLinearScale([0,100], [0,200]): scale.invert(50) inverts [0,200]->[0,100] at x=50:
  // pos = (50-0)/(200-0) = 0.25, value = 0 + (100-0)*0.25 = 25.
  const rangeScale = createLinearScale([0, 100], [0, 200])
  const rangeAxis: RangeAxisResult = { type: 'range', scale: rangeScale, ticks: rangeScale.ticks(10), values: [], band: 0, orient: 'bottom', line: false, hide: false }

  it('inverts a range axis pixel to its continuous numeric value', () => {
    expect(invertAxisValue(rangeAxis, 50)).toBe(25)
  })

  it('inverts a range axis pixel at the origin', () => {
    expect(invertAxisValue(rangeAxis, 0)).toBe(0)
  })
})
