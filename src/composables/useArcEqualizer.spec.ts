import { describe, expect, it } from 'vitest'
import { arcEqualizerBlockPath, arcEqualizerLayout, arcEqualizerMaxValue, arcEqualizerRows, arcEqualizerStackAngle, arcEqualizerWedgeBlocks } from './useArcEqualizer'

describe('arcEqualizerLayout', () => {
  it('square area: r = half the side, center = (r, r), stackSize = (r - textRadius) / stackCount', () => {
    // r = min(400,400)/2 = 200; dist = 0, so no cx/cy offset; stackSize = (200-50)/25 = 6
    expect(arcEqualizerLayout(400, 400, 50, 25)).toEqual({ r: 200, cx: 200, cy: 200, stackSize: 6 })
  })

  it('wider-than-tall area: r = half the SHORTER side, cx offset by half the excess width, cy unchanged', () => {
    // r = min(400,300)/2 = 150; dist = |400-300| = 100; width>height -> cx = 150 + 100/2 = 200, cy = 150
    // stackSize = (150-50)/25 = 4
    expect(arcEqualizerLayout(400, 300, 50, 25)).toEqual({ r: 150, cx: 200, cy: 150, stackSize: 4 })
  })

  it('taller-than-wide area: cy offset by half the excess height, cx unchanged', () => {
    // r = min(300,400)/2 = 150; dist = 100; height>width -> cy = 150 + 100/2 = 200, cx = 150
    expect(arcEqualizerLayout(300, 400, 50, 25)).toEqual({ r: 150, cx: 150, cy: 200, stackSize: 4 })
  })
})

describe('arcEqualizerStackAngle', () => {
  it('splits 360deg evenly by the real row count', () => {
    expect(arcEqualizerStackAngle(4)).toBe(90)
    expect(arcEqualizerStackAngle(3)).toBeCloseTo(120, 10)
    expect(arcEqualizerStackAngle(6)).toBe(60)
  })

  it('dataCount=0 falls back to a divisor of 1 (a single full-circle wedge), not division-by-zero', () => {
    expect(arcEqualizerStackAngle(0)).toBe(360)
  })
})

describe('arcEqualizerMaxValue', () => {
  it('a plain number is used as-is regardless of rows', () => {
    expect(arcEqualizerMaxValue([{ a: 1 }, { a: 999 }], 100)).toBe(100)
    expect(arcEqualizerMaxValue([], 100)).toBe(100)
  })

  it('a callback is invoked once per row, keeping the running max', () => {
    const rows = [{ a: 5 }, { a: 10 }, { a: 3 }]
    expect(arcEqualizerMaxValue(rows, (row) => row.a * 2)).toBe(20) // max(10, 20, 6) = 20
  })

  it('a callback over an empty row list returns 0 (the source\'s own never-updated initial value)', () => {
    expect(arcEqualizerMaxValue([], (row) => row.a)).toBe(0)
  })
})

describe('arcEqualizerRows', () => {
  it('computes ceil(stackCount * value/maxValue) per target for each real row', () => {
    const rows = [
      { bass: 50, mid: 25, treble: 90 },
      { bass: 0, mid: 100, treble: 12 },
    ]
    const result = arcEqualizerRows(rows, ['bass', 'mid', 'treble'], 100, 25)

    // row 0: ceil(25*0.5)=13(12.5), ceil(25*0.25)=7(6.25), ceil(25*0.9)=23(22.5)
    expect(result[0]).toEqual({ counts: [13, 7, 23], isPlaceholder: false })
    // row 1: ceil(0)=0, ceil(25*1)=25, ceil(25*0.12)=3(3.0 exactly -> 3)
    expect(result[1]).toEqual({ counts: [0, 25, 3], isPlaceholder: false })
  })

  it('a missing target field on a row is treated as 0 (not NaN)', () => {
    const result = arcEqualizerRows([{ bass: 50 }], ['bass', 'mid'], 100, 25)
    expect(result[0].counts).toEqual([13, 0])
  })

  it('empty rows: synthesizes one placeholder row, target 0 fully filled, the rest empty', () => {
    const result = arcEqualizerRows([], ['bass', 'mid', 'treble'], 100, 25)
    expect(result).toEqual([{ counts: [25, 0, 0], isPlaceholder: true }])
  })
})

describe('arcEqualizerBlockPath', () => {
  // Parse the `M x y ... A ... L x y ... A ... L x y Z` path back into its 4 key points so the
  // trig can be checked numerically (fp noise on sin(pi/2) etc. rules out an exact string match).
  function parse(d: string) {
    const nums = d.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number)
    // M x0 y0 | A rx ry rot largeArc sweep x1 y1 | L x2 y2 | A rx ry rot largeArc sweep x3 y3 | L x4 y4 | (Z has no numbers)
    // indices: M=[0,1]; A: rx[2] ry[3] rot[4] largeArc[5] sweep[6] x[7] y[8]; L=[9,10];
    // A: rx[11] ry[12] rot[13] largeArc[14] sweep[15] x[16] y[17]; L=[18,19]
    return {
      innerStart: { x: nums[0], y: nums[1] },
      largeArcInner: nums[5],
      innerEnd: { x: nums[7], y: nums[8] },
      outerEnd: { x: nums[9], y: nums[10] },
      largeArcOuter: nums[14],
      outerStart: { x: nums[16], y: nums[17] },
      innerStartRepeat: { x: nums[18], y: nums[19] },
    }
  }

  it('hand-traced quarter-circle block (0deg->90deg, radius 10->16, center at origin)', () => {
    // 0deg = 12 o'clock = (cx, cy-r); 90deg = clockwise a quarter turn = 3 o'clock = (cx+r, cy)
    const d = arcEqualizerBlockPath(0, 0, 10, 16, 0, 90)
    const p = parse(d)

    expect(p.innerStart.x).toBeCloseTo(0, 10)
    expect(p.innerStart.y).toBeCloseTo(-10, 10)
    expect(p.innerEnd.x).toBeCloseTo(10, 10)
    expect(p.innerEnd.y).toBeCloseTo(0, 10)
    expect(p.outerStart.x).toBeCloseTo(0, 10)
    expect(p.outerStart.y).toBeCloseTo(-16, 10)
    expect(p.outerEnd.x).toBeCloseTo(16, 10)
    expect(p.outerEnd.y).toBeCloseTo(0, 10)
    expect(p.innerStartRepeat).toEqual(p.innerStart)
    // 90deg span <= 180 -> largeArc = 0 on both arcs
    expect(p.largeArcInner).toBe(0)
    expect(p.largeArcOuter).toBe(0)
  })

  it('a >180deg span sets the large-arc flag to 1 on both arcs', () => {
    const d = arcEqualizerBlockPath(0, 0, 10, 16, 0, 200)
    const p = parse(d)
    expect(p.largeArcInner).toBe(1)
    expect(p.largeArcOuter).toBe(1)
  })

  it('an exact 360deg span is clamped to 359.9deg (not a coincident-point degenerate arc)', () => {
    // At 359.9deg (i.e. -0.1deg from 0): angle is just short of a full turn back to (cx, cy-r)
    const d = arcEqualizerBlockPath(0, 0, 10, 16, 0, 360)
    const p = parse(d)
    const expectedX = 10 * Math.sin((359.9 * Math.PI) / 180)
    const expectedY = -10 * Math.cos((359.9 * Math.PI) / 180)
    expect(p.innerEnd.x).toBeCloseTo(expectedX, 8)
    expect(p.innerEnd.y).toBeCloseTo(expectedY, 8)
    expect(p.innerEnd).not.toEqual(p.innerStart) // NOT coincident - the whole point of the clamp
    expect(p.largeArcInner).toBe(1) // 359.9 - 0 > 180
  })

  it('a non-origin center offsets every point by (cx, cy)', () => {
    const dOrigin = arcEqualizerBlockPath(0, 0, 10, 16, 0, 90)
    const dOffset = arcEqualizerBlockPath(100, 200, 10, 16, 0, 90)
    const pOrigin = parse(dOrigin)
    const pOffset = parse(dOffset)
    expect(pOffset.innerStart.x).toBeCloseTo(pOrigin.innerStart.x + 100, 8)
    expect(pOffset.innerStart.y).toBeCloseTo(pOrigin.innerStart.y + 200, 8)
    expect(pOffset.outerEnd.x).toBeCloseTo(pOrigin.outerEnd.x + 100, 8)
    expect(pOffset.outerEnd.y).toBeCloseTo(pOrigin.outerEnd.y + 200, 8)
  })
})

describe('arcEqualizerWedgeBlocks', () => {
  it('stacks each target\'s blocks radially, continuing from where the previous target left off', () => {
    const result = arcEqualizerWedgeBlocks([2, 1], 0, 0, 10, 5, 0, 90)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ targetIndex: 0, blockCount: 2 })
    expect(result[1]).toMatchObject({ targetIndex: 1, blockCount: 1 })

    // target 0 has 2 blocks -> 2 'M ' subpath starts in its combined `d`
    expect(result[0].path.match(/M /g)).toHaveLength(2)
    // target 1's single block continues radially from k=2 (textRadius + 2*stackSize = 20 to 25),
    // NOT restarting at k=0 (textRadius=10) - verify via the inner-radius distance from origin
    const innerX = Number(result[1].path.match(/^M (-?\d+(\.\d+)?)/)![1])
    const innerY = Number(result[1].path.split(' ')[2])
    expect(Math.hypot(innerX, innerY)).toBeCloseTo(20, 8) // textRadius(10) + start(2)*stackSize(5)
  })

  it('a target with a 0 count produces an empty path (no rendered element)', () => {
    const result = arcEqualizerWedgeBlocks([0, 3], 0, 0, 10, 5, 0, 90)
    expect(result[0].path).toBe('')
    expect(result[1].blockCount).toBe(3)
    expect(result[1].path.match(/M /g)).toHaveLength(3)
  })

  it('the empty-counts case produces no blocks at all', () => {
    const result = arcEqualizerWedgeBlocks([], 0, 0, 10, 5, 0, 90)
    expect(result).toEqual([])
  })
})
