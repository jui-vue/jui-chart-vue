import { describe, expect, it } from 'vitest'
import { pyramidLabelPlacements, pyramidLabelY, pyramidSegments, pyramidTrapezoids } from './usePyramid'

describe('pyramidSegments', () => {
  it('computes rate = value/total and sorts descending by value', () => {
    const row = { visitors: 1000, signups: 400, trials: 150, purchases: 50 }
    const segments = pyramidSegments(row, ['purchases', 'trials', 'signups', 'visitors'])

    // total = 1600; sorted descending by value regardless of target declaration order
    expect(segments.map((s) => s.key)).toEqual(['visitors', 'signups', 'trials', 'purchases'])
    expect(segments.map((s) => s.value)).toEqual([1000, 400, 150, 50])
    expect(segments[0].rate).toBeCloseTo(1000 / 1600, 10)
    expect(segments[1].rate).toBeCloseTo(400 / 1600, 10)
    expect(segments[2].rate).toBeCloseTo(150 / 1600, 10)
    expect(segments[3].rate).toBeCloseTo(50 / 1600, 10)

    // `index` is the ORIGINAL position in the passed `target` array, not the sorted position
    expect(segments.find((s) => s.key === 'visitors')?.index).toBe(3)
    expect(segments.find((s) => s.key === 'purchases')?.index).toBe(0)
  })

  it('skips a target key missing from the row entirely (not a zero-value placeholder)', () => {
    const row = { a: 10, b: 20 }
    const segments = pyramidSegments(row, ['a', 'b', 'c'])
    expect(segments.map((s) => s.key)).toEqual(['b', 'a'])
  })

  it('includes an explicit zero value (falls to the end after sorting)', () => {
    const row = { a: 10, b: 0 }
    const segments = pyramidSegments(row, ['a', 'b'])
    expect(segments.map((s) => s.key)).toEqual(['a', 'b'])
    expect(segments[1].rate).toBe(0)
  })

  it('rate is 0 (not NaN) when total is 0', () => {
    const row = { a: 0, b: 0 }
    const segments = pyramidSegments(row, ['a', 'b'])
    expect(segments.every((s) => s.rate === 0)).toBe(true)
  })
})

describe('pyramidTrapezoids', () => {
  // Hand-traced with a 45-degree case (width=200, height=100 -> halfWidth=100=height, so
  // startRad=atan2(100,100)=45deg, cos=sin=sqrt(2)/2), rates [0.5, 0.3, 0.2] (sum to 1).
  const width = 200
  const height = 100
  const distance = Math.sqrt(100 * 100 + 100 * 100) // 141.42135...
  const c = Math.SQRT1_2 // cos(45deg) === sin(45deg)

  it('upright (non-reverse): segment 0 is the widest, at the bottom (y=height)', () => {
    const [seg0] = pyramidTrapezoids(width, height, false, [0.5, 0.3, 0.2], 1)
    const dist0 = 0.5 * distance
    const sx0 = 0 + dist0 * c
    const ex0 = 200 - dist0 * c
    const ty0 = dist0 * c
    const y0 = 100 - ty0

    expect(seg0.points[0]).toEqual([0, 100])
    expect(seg0.points[1][0]).toBeCloseTo(sx0, 10)
    expect(seg0.points[1][1]).toBeCloseTo(y0, 10)
    expect(seg0.points[2][0]).toBeCloseTo(ex0, 10)
    expect(seg0.points[2][1]).toBeCloseTo(y0, 10)
    expect(seg0.points[3]).toEqual([200, 100])
    expect(sx0).toBeCloseTo(50, 8)
    expect(ex0).toBeCloseTo(150, 8)
    expect(y0).toBeCloseTo(50, 8)
    expect(seg0.divider).toBeNull()
    expect(seg0.labelAnchor.x).toBeCloseTo((150 + 200) / 2, 8) // 175
    expect(seg0.labelAnchor.y).toBeCloseTo((50 + 100) / 2, 8) // 75
  })

  it('all 3 segments are contiguous and the last one converges exactly to the apex', () => {
    const segs = pyramidTrapezoids(width, height, false, [0.5, 0.3, 0.2], 2)

    // segment 1 starts exactly where segment 0's narrow edge ended
    expect(segs[1].points[0][0]).toBeCloseTo(segs[0].points[1][0], 8)
    expect(segs[1].points[0][1]).toBeCloseTo(segs[0].points[1][1], 8)
    expect(segs[1].points[3][0]).toBeCloseTo(segs[0].points[2][0], 8)
    expect(segs[1].points[3][1]).toBeCloseTo(segs[0].points[2][1], 8)
    expect(segs[1].divider?.x1).toBeCloseTo(50 - 1, 8)
    expect(segs[1].divider?.x2).toBeCloseTo(150 + 1, 8)
    expect(segs[1].divider?.y).toBeCloseTo(50, 8)

    // segment 2 (last, smallest, rate=0.2) reaches the apex exactly: sx === ex === halfWidth, y === 0
    const seg2 = segs[2]
    expect(seg2.points[1][0]).toBeCloseTo(100, 8) // sx
    expect(seg2.points[2][0]).toBeCloseTo(100, 8) // ex
    expect(seg2.points[1][1]).toBeCloseTo(0, 8) // y
    expect(seg2.points[2][1]).toBeCloseTo(0, 8)
    expect(seg2.labelAnchor.x).toBeCloseTo((100 + 120) / 2, 8)
    expect(seg2.labelAnchor.y).toBeCloseTo((0 + 20) / 2, 8)
  })

  it('reverse: widest segment starts at the top (y=0) and widens downward to the apex at y=height', () => {
    const [seg0, , seg2] = pyramidTrapezoids(width, height, true, [0.5, 0.3, 0.2], 1)

    expect(seg0.points[0]).toEqual([0, 0])
    expect(seg0.points[3]).toEqual([200, 0])
    expect(seg0.points[1][1]).toBeCloseTo(50, 8) // y moves DOWN (increases) in reverse mode

    // last segment converges to the apex at the BOTTOM (y=height=100) in reverse mode
    expect(seg2.points[1][1]).toBeCloseTo(100, 8)
    expect(seg2.points[1][0]).toBeCloseTo(100, 8)
  })
})

describe('pyramidLabelY', () => {
  it('leaves cy unchanged when the previous label is far enough away (dist >= lineSize)', () => {
    expect(pyramidLabelY(35, 40, 30)).toBe(35)
  })

  it('leaves cy unchanged when dist <= 0 (previous label is not above this one)', () => {
    expect(pyramidLabelY(75, -75, 30)).toBe(75)
    expect(pyramidLabelY(75, 0, 30)).toBe(75)
  })

  it('applies the literal 2*cy - dist/2 nudge when 0 < dist < lineSize', () => {
    // cy=10, dist=25, lineSize=30 -> 10 + (10 - 25/2) = 10 - 2.5 = 7.5
    expect(pyramidLabelY(10, 25, 30)).toBe(7.5)
  })
})

describe('pyramidLabelPlacements', () => {
  it('hand-traced 3-label sequence: first two land untouched, third gets dodged', () => {
    // Anchors from the pyramidTrapezoids 45-degree hand trace above: (175,75), (135,35), (110,10)
    const placements = pyramidLabelPlacements(
      [
        { x: 175, y: 75 },
        { x: 135, y: 35 },
        { x: 110, y: 10 },
      ],
      30,
    )

    // i=0: prevCy=0, dist=0-75=-75 (<=0) -> unchanged
    expect(placements[0]).toEqual({ lineX1: 175, lineY1: 75, lineX2: 205, lineY2: 75 })
    // i=1: prevCy=75, dist=75-35=40 (>=30) -> unchanged
    expect(placements[1]).toEqual({ lineX1: 135, lineY1: 35, lineX2: 165, lineY2: 35 })
    // i=2: prevCy=35, dist=35-10=25 (0<25<30) -> dodged: 10 + (10 - 12.5) = 7.5
    expect(placements[2]).toEqual({ lineX1: 110, lineY1: 10, lineX2: 140, lineY2: 7.5 })
  })
})
