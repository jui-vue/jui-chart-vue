import { describe, expect, it } from 'vitest'
import { buildColumn3dDraws, resolveColumnSize, sortColumn3dDraws, type Column3dDraw } from './useColumn3d'
import type { Polygon3dProjection } from './usePolygon3d'

describe('resolveColumnSize (ported from drawBefore())', () => {
  it('auto-fits to rangeBand minus padding*2 when width/height overrides are 0', () => {
    expect(resolveColumnSize(100, 60, 20, 0, 0)).toEqual({ width: 60, height: 20 })
  })

  it('an override > 0 takes precedence over the auto-fit size', () => {
    expect(resolveColumnSize(100, 60, 20, 15, 0)).toEqual({ width: 15, height: 20 })
    expect(resolveColumnSize(100, 60, 20, 0, 8)).toEqual({ width: 60, height: 8 })
  })
})

// perspective=1 forces scaleValue(far,0,effectiveDepth,1,1)=1 for any `far`/`effectiveDepth`, and
// degree={0,0,0} makes every rotation matrix the identity - together this makes
// rotatePolygonVertices() a pure passthrough (x,y,z unchanged), isolating this file's own
// cube-assembly/order/color logic from the (separately, exhaustively tested)
// rotatePolygonVertices() math itself - same isolation technique usePolygon3d.spec.ts's own
// "rotating around a non-origin center" test uses.
const IDENTITY_PROJECTION: Polygon3dProjection = {
  effectiveDepth: 1000,
  center: { x: 0, y: 0, z: 0 },
  degree: { x: 0, y: 0, z: 0 },
  perspective: 1,
  axisDepth: 100,
}

describe('buildColumn3dDraws (ported from PolygonColumn3DBrush.createColumn/draw)', () => {
  it('hand-traced single-column cube: vertices, front face, order, color', () => {
    // dataIndex=0 -> x=100 (scaleX), value=5 -> y=40, zero-baseline -> y=80 (scaleY), targetIndex=0 -> z-center=30 (scaleZ)
    const draws = buildColumn3dDraws(
      [{ a: 5 }],
      ['a'],
      () => 100,
      (v) => (v === 5 ? 40 : 80),
      () => 30,
      20, // colWidth
      10, // colHeight
      (j) => `color-${j}`,
      0.6,
      0.5,
      IDENTITY_PROJECTION,
    )

    expect(draws).toHaveLength(1)
    const d = draws[0]

    // Cube corner: x = 100 - 20/2 = 90, yy(baseline) = 80, y(value) = 40 (h = y-yy = -40), z = 30 - 10/2 = 25 (d=10)
    // -> vertices span x:[90,110], y:[40,80], z:[25,35]. At identity projection, face [0,1,5,4]
    // (the z=25-constant front face, source order [0]=(90,80),[1]=(110,80),[5]=(110,40),[4]=(90,40)) is the
    // only face that ISN'T degenerate under a 0-rotation orthographic projection (the others vary
    // only in z, which contributes nothing to x/y with no rotation applied - expected, not a bug,
    // same "flat until rotated" behavior dot3d.js's own port already documents).
    expect(d.faces[4].points).toEqual([
      [90, 80],
      [110, 80],
      [110, 40],
      [90, 40],
    ])

    // order = axisDepth(100) - maxZ(35, the z=35 corners) = 65
    expect(d.order).toBe(65)
    expect(d.dataIndex).toBe(0)
    expect(d.targetIndex).toBe(0)
    expect(d.targetKey).toBe('a')
    expect(d.value).toBe(5)
    expect(d.fill).toBe('color-0')
    expect(d.fillOpacity).toBe(0.6)
    expect(d.strokeOpacity).toBe(0.5)
  })

  it('one draw per (row, target) pair, in row-major order', () => {
    const draws = buildColumn3dDraws(
      [{ a: 1, b: 2 }, { a: 3, b: 4 }],
      ['a', 'b'],
      (i) => i,
      (v) => v,
      (j) => j,
      2,
      2,
      (j) => `c${j}`,
      0.6,
      0.5,
      IDENTITY_PROJECTION,
    )
    expect(draws.map((d) => [d.dataIndex, d.targetIndex, d.value])).toEqual([
      [0, 0, 1],
      [0, 1, 2],
      [1, 0, 3],
      [1, 1, 4],
    ])
  })
})

describe('sortColumn3dDraws (ported from util/svg.js appendAll() sibling sort)', () => {
  it('stable ascending sort by order', () => {
    const draws = [{ order: 3 }, { order: 1 }, { order: 2 }] as unknown as Column3dDraw[]
    expect(sortColumn3dDraws(draws).map((d) => d.order)).toEqual([1, 2, 3])
  })
})
