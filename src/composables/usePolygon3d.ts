import { radian, scaleValue } from './mathUtil'

/**
 * Hand-ported 3D vertex transform/projection math, sourced from THREE files with no license
 * header and no confirmed exact-match external library (checked via web search for the
 * distinctive names below - see PORT_STATUS.md's dot3d.js entry for the full writeup):
 * `juijs-graph/src/util/transform.js` (`util.transform`, the `move3d`/`scale3d`/`rotate3dx`/
 * `rotate3dy`/`rotate3dz` 4x4 homogeneous-matrix builders + a generic matrix/vector multiply),
 * `juijs-graph/src/util/math.js`'s `matrix3d()`/`deepMatrix3d()` (4x4 matrix<->vector and
 * matrix<->matrix multiply), and `juijs-graph/src/polygon/core.js` (`chart.polygon.core`,
 * `PolygonCore.rotate()` - the actual per-vertex rotate+perspective-scale pipeline every 3D
 * polygon/brush in `juijs-graph` funnels through). A web search for "rotate3dx" "rotate3dy"
 * "matrix3d" and for "PointPolygon" "LinePolygon" "FacePolygon" "CubePolygon" found no matching
 * published library - the rotation matrices themselves are the standard textbook Euler-angle
 * rotation formulas (same math CSS's own `rotate3d()`/`matrix3d()` describe, but this is a
 * bespoke same-named reimplementation, not a port of any specific library's code) and the
 * per-vertex perspective-scale step (shrink toward a `perspective` factor as a vertex's rotated
 * z approaches the far/depth plane, centered on the polygon's own axis-space rotation center) is
 * `juijs-graph`-specific chart-engine logic. Per PORT_STATUS.md's Phase E policy ("is the code
 * recognizably lifted from an existing published library" - not "does it look generic"), this
 * is hand-ported like every other confirmed chart-engine file, NOT vendored+`.d.ts`'d.
 *
 * This is REAL 3D projection math, not a 2D shading effect - confirmed from source: `dot3d.js`
 * builds genuine homogeneous 4x4 rotation matrices around all three axes (`rotate3dx`/`y`/`z`,
 * degrees supplied by the chart's `axis.degree`), composes them with `move3d`s that first
 * translate a vertex to the rotation center and back, and additionally applies a depth-based
 * perspective SCALE (not just a fixed highlight/gradient) so a rotated vertex nearer the `depth`
 * far-plane visually shrinks. There is no 2D-only shading/gradient path anywhere in this file.
 */

/** A vertex in the 4-component homogeneous form the original's `Float32Array([x, y, z, 1])`
 *  vertices use - `w` is always `1` for a point (never actually varied, kept for fidelity with
 *  the original's matrix shape so `multiplyMatrixVector4` stays a literal 4x4 * 4x1 multiply). */
export interface Vertex4 {
  x: number
  y: number
  z: number
  w: number
}

export function vertex(x: number, y: number, z: number): Vertex4 {
  return { x, y, z, w: 1 }
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

/** A plain 4x4 matrix, row-major (`m[row][col]`), matching `transform.js`'s `Float32Array[4]` shape. */
export type Matrix4 = [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]]

const IDENTITY4: Matrix4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]

/** Ported from `transform.js`'s `matrix("move3d", dx, dy, dz)`. */
export function move3dMatrix(dx: number, dy: number, dz: number): Matrix4 {
  return [
    [1, 0, 0, dx],
    [0, 1, 0, dy],
    [0, 0, 1, dz],
    [0, 0, 0, 1],
  ]
}

/** Ported from `transform.js`'s `matrix("scale3d", sx, sy, sz)`. */
export function scale3dMatrix(sx: number, sy: number, sz: number): Matrix4 {
  return [
    [sx, 0, 0, 0],
    [0, sy, 0, 0],
    [0, 0, sz, 0],
    [0, 0, 0, 1],
  ]
}

/** Ported from `transform.js`'s `matrix("rotate3dx", degree)` - rotation around the X axis (pitch). */
export function rotate3dxMatrix(degree: number): Matrix4 {
  const r = radian(degree)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ]
}

/** Ported from `transform.js`'s `matrix("rotate3dy", degree)` - rotation around the Y axis (yaw). */
export function rotate3dyMatrix(degree: number): Matrix4 {
  const r = radian(degree)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1],
  ]
}

/** Ported from `transform.js`'s `matrix("rotate3dz", degree)` - rotation around the Z axis (roll). */
export function rotate3dzMatrix(degree: number): Matrix4 {
  const r = radian(degree)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
}

/**
 * Ported from `math.js`'s `matrix3d()` matrix<->matrix branch (`deepMatrix3d`, taken when
 * multiplying two 4x4 matrices together to compose transforms) - split from the vector-multiply
 * case (`multiplyMatrixVector4` below) into two clearly-typed functions rather than replicating
 * the original's single polymorphic `matrix3d(a, b)` that branches on `b`'s shape at runtime.
 * Behaviorally identical output for either input shape, just not dispatched through one function.
 */
export function multiplyMatrixMatrix4(a: Matrix4, b: Matrix4): Matrix4 {
  const result: number[][] = [[], [], [], []]
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[row][k] * b[k][col]
      result[row][col] = sum
    }
  }
  return result as Matrix4
}

/** Ported from `math.js`'s `matrix3d()` matrix<->vector branch (`matrix3d(a, b)` with a plain
 *  4-element `b`). */
export function multiplyMatrixVector4(m: Matrix4, v: Vertex4): Vertex4 {
  const arr = [v.x, v.y, v.z, v.w]
  const out = [0, 0, 0, 0]
  for (let row = 0; row < 4; row++) {
    out[row] = m[row][0] * arr[0] + m[row][1] * arr[1] + m[row][2] * arr[2] + m[row][3] * arr[3]
  }
  return { x: out[0], y: out[1], z: out[2], w: out[3] }
}

export interface Degree3 {
  x: number
  y: number
  z: number
}

export interface Center3 {
  x: number
  y: number
  z: number
}

/**
 * Ported from `chart.polygon.core`'s `PolygonCore.rotate(depth, degree, cx, cy, cz)` - the exact
 * pipeline every `juijs-graph` 3D polygon (point/line/face/cube) funnels through before drawing.
 * Two stages, in order, both applied to EVERY vertex:
 *
 * 1. **Rotate** around `(center.x, center.y, center.z)`: move that point to the origin, rotate
 *    around X then Y then Z (`degree.x/y/z`, degrees), move back - a single combined matrix
 *    (`move3d(+c) * rotateX * rotateY * rotateZ * move3d(-c)`, composition order preserved
 *    exactly from source, not reordered/simplified) applied once per vertex.
 * 2. **Perspective scale**, independently per vertex (varies per-vertex since it depends on that
 *    vertex's OWN rotated z): `far = abs(rotatedZ - depth)`, `s = scaleValue(far, 0, depth,
 *    perspective, 1)` (shrinks toward `perspective` as a vertex's rotated z approaches `depth`,
 *    full size at rotated z = 0), then scale by `s` around `(center.x, center.y, depth/2)` - note
 *    this reuses `center.x`/`center.y` but a DIFFERENT z-center (`depth/2`, not `center.z`) than
 *    stage 1, exactly as the original hardcodes it.
 *
 * **`depth` here is NOT `axis.depth` directly** - confirmed from `juijs-graph/src/base/draw.js`'s
 * `calculate3d()`, the actual caller: it passes `Math.max(plotAreaWidth, plotAreaHeight, axis.
 * depth)` as this `depth` parameter, and `axis.depth / 2` (a DIFFERENT value in general) as
 * `center.z` for stage 1 - callers of this function must compute both exactly that way (see
 * `useDot3d.ts`) to match source. `perspective` defaults to `0.9`, matching both `PolygonCore.
 * prototype.perspective = 0.9`'s hardcoded default AND `chart.axis`'s own `perspective` config
 * default (`calculate3d()` overwrites every polygon's `.perspective` with `axis.perspective`
 * before calling `rotate()`, so in practice it's always axis-level, not the polygon's own field).
 */
export function rotatePolygonVertices(vertices: Vertex4[], depth: number, degree: Degree3, center: Center3, perspective = 0.9): Vector3[] {
  const toCenter = move3dMatrix(center.x, center.y, center.z)
  const rx = rotate3dxMatrix(degree.x)
  const ry = rotate3dyMatrix(degree.y)
  const rz = rotate3dzMatrix(degree.z)
  const fromCenter = move3dMatrix(-center.x, -center.y, -center.z)

  let m = multiplyMatrixMatrix4(IDENTITY4, toCenter)
  m = multiplyMatrixMatrix4(m, rx)
  m = multiplyMatrixMatrix4(m, ry)
  m = multiplyMatrixMatrix4(m, rz)
  m = multiplyMatrixMatrix4(m, fromCenter)

  return vertices.map((v) => {
    const rotated = multiplyMatrixVector4(m, v)

    const far = Math.abs(rotated.z - depth)
    const s = scaleValue(far, 0, depth, perspective, 1)

    const scaleToCenter = move3dMatrix(center.x, center.y, depth / 2)
    const scaleMatrix = scale3dMatrix(s, s, s)
    const scaleFromCenter = move3dMatrix(-center.x, -center.y, -depth / 2)

    let sm = multiplyMatrixMatrix4(IDENTITY4, scaleToCenter)
    sm = multiplyMatrixMatrix4(sm, scaleMatrix)
    sm = multiplyMatrixMatrix4(sm, scaleFromCenter)

    const scaled = multiplyMatrixVector4(sm, rotated)
    return { x: scaled.x, y: scaled.y, z: scaled.z }
  })
}

/** The farthest (max) z among a set of already-rotated vectors - ported from `PolygonCore.max()`
 *  restricted to just the `z` field, which is all `chart.brush.canvas.core`'s `addPolygon()` /
 *  `drawAfter()` z-order sort actually uses (`order = axis.depth - polygon.max().z`). */
export function maxZ(vectors: readonly Vector3[]): number {
  let m = vectors[0].z
  for (let i = 1; i < vectors.length; i++) m = Math.max(m, vectors[i].z)
  return m
}

/**
 * Shared `effectiveDepth`/`center` derivation, ported from `juijs-graph/src/base/draw.js`'s
 * `calculate3d()` - see `rotatePolygonVertices`'s doc comment for the full derivation (originally
 * written for `dot3d.js`/`useDot3d.ts`'s own `Dot3dProjection`, which pre-dates this generic
 * version and keeps its own copy rather than being retrofitted onto this one - zero risk to that
 * already-verified component). `column3d.js`/`line3d.js` (`useColumn3d.ts`/`useLine3d.ts`) both
 * go through `chart.brush.polygon.core`'s `createPolygon()` -> `this.calculate3d(polygon)`, the
 * SAME shared `chart.draw` method `dot3d.js` uses - confirmed identical, not brush-specific. */
export interface Polygon3dProjection {
  /** `Math.max(plotAreaWidth, plotAreaHeight, axisDepth)`. */
  effectiveDepth: number
  /** `(areaX + areaWidth/2, areaY + areaHeight/2, axisDepth/2)`. */
  center: Center3
  degree: Degree3
  perspective: number
  /** Raw `axis.depth` (config value) - used for the `order` z-sort field, NOT `effectiveDepth`. */
  axisDepth: number
}

export function computePolygon3dProjection(area: { x: number; y: number; width: number; height: number }, depth: number, degree: Degree3, perspective: number): Polygon3dProjection {
  return {
    effectiveDepth: Math.max(area.width, area.height, depth),
    center: { x: area.x + area.width / 2, y: area.y + area.height / 2, z: depth / 2 },
    degree,
    perspective,
    axisDepth: depth,
  }
}

/**
 * Ported from `juijs-graph/src/polygon/cube.js` (`chart.polygon.cube`, `CubePolygon`) - the 8
 * vertices of an axis-aligned box `(x,y,z)` to `(x+w, y+h, z+d)`, in the EXACT order the original
 * builds them (needed for `CUBE_FACES`'s vertex-index references to line up). Genuinely new
 * geometry `usePolygon3d.ts` didn't need for `dot3d.js` (which only ever built 1-4-vertex point/
 * line/face polygons, never a full box) - `column3d.js`'s `createColumn` is the first, and only,
 * `juijs-graph` 3D brush in this port that needs a cube.
 */
export function cubeVertices(x: number, y: number, z: number, w: number, h: number, d: number): Vertex4[] {
  return [
    vertex(x, y, z),
    vertex(x + w, y, z),
    vertex(x + w, y, z + d),
    vertex(x, y, z + d),
    vertex(x, y + h, z),
    vertex(x + w, y + h, z),
    vertex(x + w, y + h, z + d),
    vertex(x, y + h, z + d),
  ]
}

/** Ported from `chart.polygon.cube`'s `this.faces` - 6 quad faces as index quadruples into
 *  `cubeVertices()`'s 8-vertex array, in the original's own literal order (also the paint order
 *  `column3d.js` appends each face `<polygon>` in - preserved, not resorted). */
export const CUBE_FACES: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3],
  [3, 2, 6, 7],
  [0, 3, 7, 4],
  [1, 2, 6, 5],
  [0, 1, 5, 4],
  [4, 5, 6, 7],
]

/**
 * Ported from `juijs-graph/src/util/color.js`'s `darken(color, rate) { return this.lighten(color,
 * -rate) }` / `lighten(color, rate)`. Used by `column3d.js`/`line3d.js`'s
 * `ColorUtil.darken(color, this.chart.theme("polygon{Column,Line}BorderOpacity"))` - a real,
 * confirmed-preserved source quirk: the SAME `polygon{Column,Line}BorderOpacity` theme number
 * (0.5 / 0.7) is reused BOTH as this darken-rate argument AND, separately, as the stroke's
 * `stroke-opacity` SVG attribute (see `useColumn3d.ts`/`useLine3d.ts`) - not two independent
 * config values, ported literally. No license header in `util/color.js`, and this exact
 * `lighten`/`darken` shape (strip non-hex chars, per-channel `c + c*rate` clamped to [0,255],
 * zero-padded hex rejoin) is common hand-rolled color-math with no single matching published
 * library found via web search for "lighten" "darken" hex color javascript `c + (c * rate)` -
 * same "bespoke, hand-ported" bucket as `rotatePolygonVertices` above, not vendored+`.d.ts`'d.
 */
export function darkenColor(color: string, rate: number): string {
  const hex = color.replace(/[^0-9a-f]/gi, '')
  const channels: string[] = []
  for (let i = 0; i < 6; i += 2) {
    const c = parseInt(hex.substring(i, i + 2), 16)
    const adjusted = Math.round(Math.min(Math.max(0, c + c * -rate), 255)).toString(16)
    channels.push(('00' + adjusted).substring(adjusted.length))
  }
  return '#' + channels.join('')
}
