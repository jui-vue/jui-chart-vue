import { describe, expect, it } from 'vitest'
import { buildDot3dDraws, createPolyFillCache, radiusDepthScale, sortDot3dDraws, type Dot3dAreaDraw, type Dot3dDotDraw, type Dot3dLineDraw, type Dot3dProjection, type Dot3dRow } from './useDot3d'

describe('radiusDepthScale (ported from createDot\'s tr = r * scaleValue(z, 0, axis.depth, 1, p.perspective))', () => {
  it('hand-traced: z=0 (near plane) -> full size regardless of perspective', () => {
    expect(radiusDepthScale(10, 0, 100, 0.9)).toBeCloseTo(10, 10)
  })

  it('hand-traced: z=depth (far plane) -> shrinks to radius*perspective exactly', () => {
    expect(radiusDepthScale(10, 100, 100, 0.9)).toBeCloseTo(9, 10)
  })

  it('hand-traced: z=depth/2 -> halfway between full size and perspective*radius', () => {
    // scaleValue(50,0,100,1,0.9) = 1 + (0.9-1)*0.5 = 0.95 -> tr = 10*0.95 = 9.5
    expect(radiusDepthScale(10, 50, 100, 0.9)).toBeCloseTo(9.5, 10)
  })

  it('preserved source quirk: axisDepth=0 (chart.axis\'s own default) divides by zero -> NaN, not guarded in the original either', () => {
    expect(radiusDepthScale(10, 0, 0, 0.9)).toBeNaN()
  })
})

const identity = (v: number): number => v

function baseProjection(overrides: Partial<Dot3dProjection> = {}): Dot3dProjection {
  return {
    effectiveDepth: 100,
    center: { x: 0, y: 0, z: 50 },
    degree: { x: 0, y: 0, z: 0 },
    perspective: 1,
    axisDepth: 100,
    ...overrides,
  }
}

describe('buildDot3dDraws - "dot" symbol (ported from createDot + drawDot)', () => {
  it('hand/Node-cross-checked: two points at different z produce distinct positions/radii/order, and sortDot3dDraws paints the farther one first (painter\'s algorithm)', () => {
    const rows: Dot3dRow[] = [
      { x: 10, y: 20, z: 0 },
      { x: 30, y: 40, z: 100 },
    ]
    // perspective=0.9, identity rotation (degree 0), effectiveDepth=axisDepth=100, center=(0,0,50).
    const projection = baseProjection({ perspective: 0.9 })
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'dot', '#f00', 10, projection) as Dot3dDotDraw[]

    // Point A (z=0): far=|0-100|=100 -> s=scaleValue(100,0,100,0.9,1)=1 -> position unchanged, order=100-0=100.
    expect(draws[0]).toMatchObject({ kind: 'dot', x: 10, y: 20, order: 100 })
    expect(draws[0].radius).toBeCloseTo(5, 10) // r=size/2=5, radiusDepthScale(5,0,100,0.9)=5

    // Point B (z=100): far=0 -> s=scaleValue(0,0,100,0.9,1)=0.9. Scale center (0,0,50):
    // x=0+(30-0)*0.9=27, y=0+(40-0)*0.9=36, z=50+(100-50)*0.9=95 -> order=100-95=5.
    expect(draws[1].x).toBeCloseTo(27, 10)
    expect(draws[1].y).toBeCloseTo(36, 10)
    expect(draws[1].order).toBeCloseTo(5, 10)
    expect(draws[1].radius).toBeCloseTo(4.5, 10) // radiusDepthScale(5,100,100,0.9) = 5*0.9

    const sorted = sortDot3dDraws(draws) as Dot3dDotDraw[]
    // Farther-shrunk point B (order 5) painted first (behind), nearer point A (order 100) painted last (in front).
    expect(sorted[0].order).toBeCloseTo(5, 10)
    expect(sorted[1].order).toBe(100)
  })

  it('a row with no z defaults to 0, matching the original\'s 2-element-array z-push', () => {
    const rows: Dot3dRow[] = [{ x: 1, y: 2 }]
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'dot', '#000', 4, baseProjection()) as Dot3dDotDraw[]
    expect(draws[0].x).toBeCloseTo(1, 10)
    expect(draws[0].y).toBeCloseTo(2, 10)
  })
})

describe('buildDot3dDraws - "poly" symbol (preserved isLast/firstCacheData bugs, ported from drawLine)', () => {
  it('hand-traced: isLast is TRUE only at row index 2 (source\'s data.length-1 bug), regardless of the true row count, and the poly-fill anchor is cached from row 0 and never updated', () => {
    const rows: Dot3dRow[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 3, y: 3, z: 0 },
    ]
    // perspective=1 -> the perspective-scale step is always exactly 1 (minScale===maxScale), so
    // projected x/y equal the raw input x/y exactly (identity rotation too) - fully hand-computable.
    const projection = baseProjection({ perspective: 1 })
    const cache = createPolyFillCache()
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'poly', '#00f', 2, projection, cache) as Dot3dLineDraw[]

    expect(draws).toHaveLength(4)

    // i=0: prev is null -> segment collapses to (0,0)-(0,0); caches firstCacheData = (0,0); not "last".
    expect(draws[0]).toMatchObject({ x1: 0, y1: 0, x2: 0, y2: 0, polyFillTo: undefined })
    expect(cache.point).toEqual({ x: 0, y: 0 })

    // i=1: segment (0,0)->(1,1); not "last" (i !== 2); cache untouched.
    expect(draws[1]).toMatchObject({ x1: 0, y1: 0, x2: 1, y2: 1, polyFillTo: undefined })

    // i=2: segment (1,1)->(2,2); IS "last" per the preserved bug (i === 2) -> closes back to the
    // cached row-0 point (0,0), NOT the true last row (index 3)'s point.
    expect(draws[2]).toMatchObject({ x1: 1, y1: 1, x2: 2, y2: 2, polyFillTo: { x: 0, y: 0 } })

    // i=3 (the ACTUAL last row): NOT flagged "last" by the bug -> no closing fill here, the real
    // visual bug this test locks in (a naive reader would expect the fill at the true end).
    expect(draws[3]).toMatchObject({ x1: 2, y1: 2, x2: 3, y2: 3, polyFillTo: undefined })
  })

  it('with fewer than 3 rows, isLast (i===2) never fires -> no poly-fill triangle ever drawn', () => {
    const rows: Dot3dRow[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    const cache = createPolyFillCache()
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'poly', '#000', 2, baseProjection({ perspective: 1 }), cache) as Dot3dLineDraw[]
    expect(draws.every((d) => d.polyFillTo === undefined)).toBe(true)
    expect(cache.point).toEqual({ x: 0, y: 0 }) // still cached, just never consumed
  })

  it('"line" symbol (not "poly") never sets a poly-fill, even at row index 2', () => {
    const rows: Dot3dRow[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'line', '#000', 2, baseProjection({ perspective: 1 })) as Dot3dLineDraw[]
    expect(draws.every((d) => d.polyFillTo === undefined)).toBe(true)
  })

  it('firstCacheData persists across separate buildDot3dDraws calls sharing the same cache (matches the brush-instance-lifetime var in source)', () => {
    const cache = createPolyFillCache()
    buildDot3dDraws([{ x: 5, y: 9 }], identity, identity, identity, 'poly', '#000', 2, baseProjection({ perspective: 1 }), cache)
    expect(cache.point).toEqual({ x: 5, y: 9 })

    // A later call with completely different data does NOT overwrite the stale cached anchor.
    const draws = buildDot3dDraws(
      [{ x: 100, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 300 }],
      identity,
      identity,
      identity,
      'poly',
      '#000',
      2,
      baseProjection({ perspective: 1 }),
      cache,
    ) as Dot3dLineDraw[]
    expect(cache.point).toEqual({ x: 5, y: 9 }) // unchanged
    expect(draws[2].polyFillTo).toEqual({ x: 5, y: 9 }) // the stale anchor is what row-2's fill closes back to
  })
})

describe('buildDot3dDraws - "area" symbol (ported from createArea, preserved FacePolygon baseline-z quirk)', () => {
  it('Node-cross-checked: the FacePolygon\'s two baseline corners (and the current-point corner) all use the CURRENT point\'s z, NOT the previous point\'s own z', () => {
    const rows: Dot3dRow[] = [
      { x: 1, y: 1, z: 2 },
      { x: 3, y: 3, z: 8 },
    ]
    const projection = baseProjection({ perspective: 0.9 })
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'area', '#0f0', 2, projection) as Dot3dAreaDraw[]

    // createArea is called for EVERY row (matching source's draw() loop, same as "line"/"poly") -
    // row 0 produces a degenerate self-quad (prev falls back to itself), row 1 the real one below.
    expect(draws).toHaveLength(2)
    const [prevTop, curTop, curBase, prevBase] = draws[1].points

    // Node cross-check (rotatePoly with degree=0, depth=100, center=(0,0,50), perspective=0.9) on
    // vertices [(1,1,2),(3,3,8),(3,0,8),(1,0,8)] (baseline verts and the current-point vert all
    // carry z=8, only the first vertex carries the PREVIOUS point's own z=2):
    expect(prevTop[0]).toBeCloseTo(0.998, 6)
    expect(prevTop[1]).toBeCloseTo(0.998, 6)
    expect(curTop[0]).toBeCloseTo(2.976, 6)
    expect(curTop[1]).toBeCloseTo(2.976, 6)
    expect(curBase[0]).toBeCloseTo(2.976, 6)
    expect(curBase[1]).toBeCloseTo(0, 6)
    expect(prevBase[0]).toBeCloseTo(0.992, 6)
    expect(prevBase[1]).toBeCloseTo(0, 6)
  })

  it('the very first row (no previous point) is skipped - createArea is only ever called for i>=1 worth of segments, but buildDot3dDraws still emits a degenerate quad using the row itself as its own "previous" point', () => {
    const rows: Dot3dRow[] = [{ x: 5, y: 5, z: 0 }]
    const draws = buildDot3dDraws(rows, identity, identity, identity, 'area', '#000', 2, baseProjection({ perspective: 1 })) as Dot3dAreaDraw[]
    expect(draws).toHaveLength(1)
    // prev==null -> pX/pY/pZ fall back to the row's own values, matching createLine's identical fallback.
    expect(draws[0].points[0]).toEqual(draws[0].points[1])
  })
})

describe('sortDot3dDraws (ported from chart.brush.canvas.core drawAfter()\'s ascending order sort)', () => {
  it('sorts ascending by order, stable for ties', () => {
    const a: Dot3dDotDraw = { kind: 'dot', order: 5, x: 0, y: 0, radius: 1, color: '#a' }
    const b: Dot3dDotDraw = { kind: 'dot', order: 1, x: 0, y: 0, radius: 1, color: '#b' }
    const c: Dot3dDotDraw = { kind: 'dot', order: 5, x: 0, y: 0, radius: 1, color: '#c' }
    expect(sortDot3dDraws([a, b, c])).toEqual([b, a, c])
  })
})
