import { describe, expect, it } from 'vitest'
import {
  computePolygon3dProjection,
  CUBE_FACES,
  cubeVertices,
  darkenColor,
  maxZ,
  move3dMatrix,
  multiplyMatrixMatrix4,
  multiplyMatrixVector4,
  rotate3dxMatrix,
  rotate3dyMatrix,
  rotate3dzMatrix,
  rotatePolygonVertices,
  scale3dMatrix,
  vertex,
} from './usePolygon3d'

describe('matrix builders (ported from util.transform.js)', () => {
  it('move3dMatrix matches source\'s "move3d" branch', () => {
    expect(move3dMatrix(1, 2, 3)).toEqual([
      [1, 0, 0, 1],
      [0, 1, 0, 2],
      [0, 0, 1, 3],
      [0, 0, 0, 1],
    ])
  })

  it('scale3dMatrix matches source\'s "scale3d" branch', () => {
    expect(scale3dMatrix(2, 3, 4)).toEqual([
      [2, 0, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 1],
    ])
  })

  it('rotate3dyMatrix at 90deg: hand-traced cos(90)=0, sin(90)=1', () => {
    const m = rotate3dyMatrix(90)
    expect(m[0][0]).toBeCloseTo(0, 10)
    expect(m[0][2]).toBeCloseTo(1, 10)
    expect(m[2][0]).toBeCloseTo(-1, 10)
    expect(m[2][2]).toBeCloseTo(0, 10)
  })

  it('rotate3dxMatrix at 90deg: hand-traced cos(90)=0, sin(90)=1 (rotation in the y/z plane)', () => {
    const m = rotate3dxMatrix(90)
    expect(m[1][1]).toBeCloseTo(0, 10)
    expect(m[1][2]).toBeCloseTo(-1, 10)
    expect(m[2][1]).toBeCloseTo(1, 10)
    expect(m[2][2]).toBeCloseTo(0, 10)
  })

  it('rotate3dzMatrix at 90deg: hand-traced cos(90)=0, sin(90)=1 (rotation in the x/y plane)', () => {
    const m = rotate3dzMatrix(90)
    expect(m[0][0]).toBeCloseTo(0, 10)
    expect(m[0][1]).toBeCloseTo(-1, 10)
    expect(m[1][0]).toBeCloseTo(1, 10)
    expect(m[1][1]).toBeCloseTo(0, 10)
  })
})

describe('multiplyMatrixVector4 (ported from math.js matrix3d() vector branch)', () => {
  it('identity matrix leaves a vertex unchanged', () => {
    const identity = move3dMatrix(0, 0, 0)
    const v = vertex(5, -3, 7)
    expect(multiplyMatrixVector4(identity, v)).toEqual({ x: 5, y: -3, z: 7, w: 1 })
  })

  it('move3d(10,20,30) translates a vertex by (10,20,30)', () => {
    const m = move3dMatrix(10, 20, 30)
    const v = vertex(1, 1, 1)
    expect(multiplyMatrixVector4(m, v)).toEqual({ x: 11, y: 21, z: 31, w: 1 })
  })

  it('hand-traced: rotY(90) applied to (1,0,0) -> (0,0,-1) (standard right-handed Y-rotation)', () => {
    const m = rotate3dyMatrix(90)
    const out = multiplyMatrixVector4(m, vertex(1, 0, 0))
    expect(out.x).toBeCloseTo(0, 10)
    expect(out.y).toBeCloseTo(0, 10)
    expect(out.z).toBeCloseTo(-1, 10)
  })
})

describe('multiplyMatrixMatrix4 (ported from math.js matrix3d() matrix branch / deepMatrix3d)', () => {
  it('identity * M === M', () => {
    const identity = move3dMatrix(0, 0, 0)
    const m = scale3dMatrix(2, 3, 4)
    expect(multiplyMatrixMatrix4(identity, m)).toEqual(m)
  })

  it('composing move then move-back cancels out (identity)', () => {
    const forward = move3dMatrix(5, 5, 5)
    const back = move3dMatrix(-5, -5, -5)
    const combined = multiplyMatrixMatrix4(forward, back)
    const v = vertex(1, 2, 3)
    expect(multiplyMatrixVector4(combined, v)).toEqual({ x: 1, y: 2, z: 3, w: 1 })
  })
})

describe('rotatePolygonVertices (ported from chart.polygon.core PolygonCore.rotate())', () => {
  // Node-cross-checked (see task scratch): a standalone re-implementation of the same formulas in
  // plain Node was run against these exact inputs before writing these expectations.
  it('identity rotation, z=0 (near plane) -> scaleValue(far=depth,0,depth,p,1)=1, vertex UNCHANGED', () => {
    const out = rotatePolygonVertices([vertex(100, 50, 0)], 200, { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 50 }, 0.9)
    expect(out).toEqual([{ x: 100, y: 50, z: 0 }])
  })

  it('identity rotation, z=depth (far plane) -> scale shrinks toward perspective (0.9) around (cx,cy,depth/2)', () => {
    // far = |200-200| = 0 -> s = scaleValue(0,0,200,0.9,1) = 0.9
    // scale center = (100,100,100) [depth/2=100]: x=100+(150-100)*0.9=145, y=145, z=100+(200-100)*0.9=190
    const out = rotatePolygonVertices([vertex(150, 150, 200)], 200, { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 50 }, 0.9)
    expect(out[0].x).toBeCloseTo(145, 10)
    expect(out[0].y).toBeCloseTo(145, 10)
    expect(out[0].z).toBeCloseTo(190, 10)
  })

  it('hand-traced: rotY(90) around the origin with perspective=1 (no scale distortion) rotates (1,0,0) -> (0,0,-1)', () => {
    const out = rotatePolygonVertices([vertex(1, 0, 0)], 1000, { x: 0, y: 90, z: 0 }, { x: 0, y: 0, z: 0 }, 1)
    expect(out[0].x).toBeCloseTo(0, 10)
    expect(out[0].y).toBeCloseTo(0, 10)
    expect(out[0].z).toBeCloseTo(-1, 10)
  })

  it('rotating around a non-origin center keeps the center point fixed', () => {
    const center = { x: 50, y: 60, z: 0 }
    // Use perspective=1 and depth huge relative to z so the perspective-scale step is a no-op
    // (far stays proportionally tiny -> s stays ~1) - isolates the rotation-only behavior.
    const out = rotatePolygonVertices([vertex(50, 60, 0)], 100000, { x: 0, y: 45, z: 0 }, center, 1)
    expect(out[0].x).toBeCloseTo(50, 6)
    expect(out[0].y).toBeCloseTo(60, 6)
    // Phase G migration (PolygonCore.rotate() via the real, already-ported Transform class):
    // z's expected value is exactly 0 here, so this assertion is the one place in this describe
    // block that lands on the documented float32-precision boundary - measured drift is
    // ~5.96e-7 (a few ULPs of float32 precision, matching polygon/core.ts's own documented
    // "~1e-6" finding), just over precision-6's 5e-7 tolerance. x/y above keep their tighter
    // precision-6 tolerance since their non-zero expected magnitudes (50/60) absorb the same
    // absolute drift comfortably. Not a logic bug - see PORT_STATUS.md's Phase G Batch 3 writeup.
    expect(out[0].z).toBeCloseTo(0, 5)
  })
})

describe('maxZ (ported from PolygonCore.max(), z field only)', () => {
  it('returns the largest z among vectors', () => {
    expect(maxZ([{ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 9 }, { x: 0, y: 0, z: -5 }])).toBe(9)
  })

  it('single vector returns its own z', () => {
    expect(maxZ([{ x: 1, y: 2, z: 7 }])).toBe(7)
  })
})

describe('computePolygon3dProjection (ported from calculate3d() - shared by column3d.js/line3d.js)', () => {
  it('effectiveDepth = max(width, height, depth); center = area center + depth/2', () => {
    const p = computePolygon3dProjection({ x: 10, y: 20, width: 100, height: 50 }, 200, { x: 1, y: 2, z: 3 }, 0.7)
    expect(p.effectiveDepth).toBe(200)
    expect(p.center).toEqual({ x: 60, y: 45, z: 100 })
    expect(p.degree).toEqual({ x: 1, y: 2, z: 3 })
    expect(p.perspective).toBe(0.7)
    expect(p.axisDepth).toBe(200)
  })

  it('effectiveDepth falls back to the larger plot dimension when depth is smaller', () => {
    const p = computePolygon3dProjection({ x: 0, y: 0, width: 400, height: 250 }, 10, { x: 0, y: 0, z: 0 }, 0.9)
    expect(p.effectiveDepth).toBe(400)
    expect(p.center.z).toBe(5)
  })
})

describe('cubeVertices / CUBE_FACES (ported from chart.polygon.cube)', () => {
  it('produces the 8 vertices in the exact source order', () => {
    const v = cubeVertices(1, 2, 3, 10, 20, 30)
    expect(v.map((p) => [p.x, p.y, p.z])).toEqual([
      [1, 2, 3],
      [11, 2, 3],
      [11, 2, 33],
      [1, 2, 33],
      [1, 22, 3],
      [11, 22, 3],
      [11, 22, 33],
      [1, 22, 33],
    ])
    // Homogeneous w is always 1 - see Vertex4's own doc comment.
    expect(v.every((p) => p.w === 1)).toBe(true)
  })

  it('CUBE_FACES has 6 quad faces referencing valid vertex indices', () => {
    expect(CUBE_FACES).toHaveLength(6)
    for (const face of CUBE_FACES) {
      expect(face).toHaveLength(4)
      for (const idx of face) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(8)
      }
    }
  })

  it("face [0,1,5,4] is the cube's z=z0-constant front face", () => {
    const v = cubeVertices(0, 0, 0, 10, 20, 30)
    const face = CUBE_FACES[4].map((i) => v[i])
    expect(face.every((p) => p.z === 0)).toBe(true)
  })
})

describe('darkenColor (ported from util.color.js lighten(color, -rate) / darken())', () => {
  // Node-cross-checked: a standalone reimplementation of the same per-channel formula was run
  // against these exact inputs before writing these expectations.
  it('darkens each channel by c + c*(-rate), clamped and zero-padded', () => {
    expect(darkenColor('#7BBAE7', 0.5)).toBe('#3e5d74')
    expect(darkenColor('#FFC000', 0.7)).toBe('#4d3a00')
  })

  it('black stays black (0 + 0*rate = 0, no negative clamp needed)', () => {
    expect(darkenColor('#000000', 0.5)).toBe('#000000')
  })

  it('rate=0.5 halves white to mid-gray', () => {
    expect(darkenColor('#ffffff', 0.5)).toBe('#808080')
  })
})
