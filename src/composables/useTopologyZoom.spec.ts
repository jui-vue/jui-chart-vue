import { describe, expect, it } from 'vitest'
import { clampTopologyZoomScale, computeTopologyPan, topologyViewportTransform, topologyZoomDirection } from './useTopologyZoom'

describe('clampTopologyZoomScale', () => {
  it('zooms in by 0.1 from the default scale', () => {
    expect(clampTopologyZoomScale(1, 1)).toBe(1.1)
  })

  it('zooms out by 0.1 from the default scale', () => {
    expect(clampTopologyZoomScale(1, -1)).toBe(0.9)
  })

  it('clamps zoom-in at the max (2), matching source\'s upper bound', () => {
    expect(clampTopologyZoomScale(1.9, 1)).toBe(2)
    expect(clampTopologyZoomScale(2, 1)).toBe(2)
  })

  it('clamps zoom-out at the min (0.6), matching source\'s lower bound', () => {
    expect(clampTopologyZoomScale(0.7, -1)).toBe(0.6)
    expect(clampTopologyZoomScale(0.6, -1)).toBe(0.6)
  })

  it('does not accumulate float drift across repeated steps (deviation from source)', () => {
    // 1 -> 1.1 -> 1.2 -> 1.3 - a raw `1.1 + 0.1` in JS is 1.2000000000000002, which this port's
    // rounding avoids (source does not round, see file header for why this is a deliberate fix).
    let scale = 1
    scale = clampTopologyZoomScale(scale, 1)
    scale = clampTopologyZoomScale(scale, 1)
    scale = clampTopologyZoomScale(scale, 1)
    expect(scale).toBe(1.3)
  })
})

describe('topologyZoomDirection', () => {
  it('scroll-up (negative deltaY) zooms in', () => {
    expect(topologyZoomDirection(-100)).toBe(1)
  })

  it('scroll-down (positive deltaY) zooms out', () => {
    expect(topologyZoomDirection(100)).toBe(-1)
  })

  it('deltaY of 0 falls to the zoom-out branch (matches source\'s `delta > 0` check)', () => {
    expect(topologyZoomDirection(0)).toBe(-1)
  })
})

describe('computeTopologyPan', () => {
  it('hand-traced single drag: view starts at (5,5), pointer moves from (100,200) to (130,180)', () => {
    const result = computeTopologyPan({ x: 5, y: 5 }, { x: 100, y: 200 }, { x: 130, y: 180 })
    expect(result).toEqual({ x: 35, y: -15 })
  })

  it('a zero-distance move (pointer back at its start) restores the starting view exactly', () => {
    const result = computeTopologyPan({ x: 5, y: 5 }, { x: 100, y: 200 }, { x: 100, y: 200 })
    expect(result).toEqual({ x: 5, y: 5 })
  })

  it('hand-traced two-gesture chain: a second drag continues from the first drag\'s end view, matching source\'s boxX/boxY carry-over across gestures', () => {
    // First drag: view (0,0) -> pointer (100,200) to (130,180) -> view (30,-20).
    const afterFirst = computeTopologyPan({ x: 0, y: 0 }, { x: 100, y: 200 }, { x: 130, y: 180 })
    expect(afterFirst).toEqual({ x: 30, y: -20 })

    // Second drag starts fresh (new pointerAtDragStart), continuing from afterFirst as its own
    // viewAtDragStart: pointer moves from (50,50) to (40,70).
    const afterSecond = computeTopologyPan(afterFirst, { x: 50, y: 50 }, { x: 40, y: 70 })
    expect(afterSecond).toEqual({ x: 20, y: 0 })
  })
})

describe('topologyViewportTransform', () => {
  it('renders the exact scale()/translate() string', () => {
    expect(topologyViewportTransform(1.5, 10, -4)).toBe('scale(1.5) translate(10, -4)')
  })

  it('identity at defaults (scale 1, view 0,0)', () => {
    expect(topologyViewportTransform(1, 0, 0)).toBe('scale(1) translate(0, 0)')
  })

  // Hand-traced "zoom-then-pan produces exact expected coordinates" check: simulate what an SVG
  // renderer does with `scale(s) translate(viewX, viewY)` applied to a child point (translate
  // first, since it's the rightmost transform, then scale the result) and confirm it matches the
  // `(base + view) * scale` formula from `grid/topologytable.js`'s own getter directly.
  function applySvgTransform(scale: number, viewX: number, viewY: number, point: { x: number; y: number }) {
    const translated = { x: point.x + viewX, y: point.y + viewY }
    return { x: translated.x * scale, y: translated.y * scale }
  }

  it('a zoomed (1.5x) and panned (viewX=10, viewY=-4) node at base (20,30) lands at exactly (45,39)', () => {
    const rendered = applySvgTransform(1.5, 10, -4, { x: 20, y: 30 })
    expect(rendered).toEqual({ x: 45, y: 39 })
    // Cross-check against the source formula directly.
    expect(rendered.x).toBe((20 + 10) * 1.5)
    expect(rendered.y).toBe((30 + -4) * 1.5)
  })
})
