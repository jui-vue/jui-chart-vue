import { describe, expect, it } from 'vitest'
import { buildLine3dDraws, sortLine3dDraws, type Line3dDraw } from './useLine3d'
import type { Polygon3dProjection } from './usePolygon3d'

// Same identity-projection isolation technique as useColumn3d.spec.ts - see that file's own doc
// comment for why perspective=1 + degree={0,0,0} makes rotatePolygonVertices() a pure passthrough.
const IDENTITY_PROJECTION: Polygon3dProjection = {
  effectiveDepth: 1000,
  center: { x: 0, y: 0, z: 0 },
  degree: { x: 0, y: 0, z: 0 },
  perspective: 1,
  axisDepth: 50,
}

describe('buildLine3dDraws (ported from PolygonLine3DBrush.createLine/draw)', () => {
  it('hand-traced single-segment ribbon: vertex order, order, color', () => {
    // segment i=0 (row0 -> row1), target 'a': x1=100,y1=40 (value 5); x2=200,y2=20 (value 8); z-center=30, ribbonDepth=10 -> z1=25,z2=35
    const draws = buildLine3dDraws(
      [{ a: 5 }, { a: 8 }],
      ['a'],
      (i) => (i === 0 ? 100 : 200),
      (v) => (v === 5 ? 40 : 20),
      () => 30,
      10,
      (j) => `color-${j}`,
      0.6,
      0.7,
      IDENTITY_PROJECTION,
    )

    expect(draws).toHaveLength(1)
    const d = draws[0]

    // Source vertex order: (x1,y1,z1), (x1,y1,z2), (x2,y2,z2), (x2,y2,z1) - at identity
    // projection z contributes nothing to x/y, so this degenerates to [p1,p1,p2,p2] (expected -
    // see useColumn3d.spec.ts's own note on this).
    expect(d.points).toEqual([
      [100, 40],
      [100, 40],
      [200, 20],
      [200, 20],
    ])

    // order = axisDepth(50) - maxZ(35) = 15
    expect(d.order).toBe(15)
    expect(d.dataIndex).toBe(0)
    expect(d.targetIndex).toBe(0)
    expect(d.targetKey).toBe('a')
    expect(d.fill).toBe('color-0')
    expect(d.fillOpacity).toBe(0.6)
    expect(d.strokeOpacity).toBe(0.7)
  })

  it('N rows produce N-1 segments per target, ported from draw()\'s `i < datas.length - 1` bound', () => {
    const draws = buildLine3dDraws(
      [{ a: 1 }, { a: 2 }, { a: 3 }],
      ['a'],
      (i) => i,
      (v) => v,
      () => 0,
      2,
      () => 'c',
      0.6,
      0.7,
      IDENTITY_PROJECTION,
    )
    expect(draws.map((d) => d.dataIndex)).toEqual([0, 1])
  })

  it('a single-row dataset renders no segments', () => {
    const draws = buildLine3dDraws([{ a: 1 }], ['a'], (i) => i, (v) => v, () => 0, 2, () => 'c', 0.6, 0.7, IDENTITY_PROJECTION)
    expect(draws).toHaveLength(0)
  })

  it('one segment per target, per row-pair', () => {
    const draws = buildLine3dDraws(
      [{ a: 1, b: 10 }, { a: 2, b: 20 }],
      ['a', 'b'],
      (i) => i,
      (v) => v,
      (j) => j,
      2,
      (j) => `c${j}`,
      0.6,
      0.7,
      IDENTITY_PROJECTION,
    )
    expect(draws.map((d) => [d.dataIndex, d.targetIndex])).toEqual([
      [0, 0],
      [0, 1],
    ])
  })
})

describe('sortLine3dDraws (ported from util/svg.js appendAll() sibling sort)', () => {
  it('stable ascending sort by order', () => {
    const draws = [{ order: 5 }, { order: -1 }, { order: 2 }] as unknown as Line3dDraw[]
    expect(sortLine3dDraws(draws).map((d) => d.order)).toEqual([-1, 2, 5])
  })
})
