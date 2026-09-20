import { describe, expect, it } from 'vitest'
import { BubbleCloud, computeBubbleRadius, computeCenterGravityStep, type BubbleCloudDatum } from './useBubbleCloud'

function datum(overrides: Partial<BubbleCloudDatum> = {}): BubbleCloudDatum {
  return {
    name: 'a',
    count: 10,
    color: '#497eff',
    shadowColor: 'rgba(73,126,255,0.2)',
    textColor: '#fff',
    textStyle: 'bold 11px sans-serif',
    origin: { title: 'a', capacity: 10 },
    ...overrides,
  }
}

describe('computeBubbleRadius', () => {
  it('matches the hand-traced source formula: (count/totalCount) * (min(w,h)/6) + 50', () => {
    // s = min(400, 300) = 300; 300/6 = 50; count/totalCount = 0.5 -> 0.5*50 + 50 = 75
    expect(computeBubbleRadius(5, 10, 400, 300)).toBe(75)
  })

  it('uses width when it is the smaller dimension', () => {
    // s = min(200, 500) = 200; 200/6 ~= 33.333; 0.25 * 33.333 + 50 = ~58.333
    expect(computeBubbleRadius(1, 4, 200, 500)).toBeCloseTo(58.333, 3)
  })

  it('is NOT guarded against a zero total count - preserved source behavior, not fixed', () => {
    expect(computeBubbleRadius(0, 0, 400, 300)).toBeNaN()
  })
})

describe('computeCenterGravityStep', () => {
  it('lerps position toward center by alpha', () => {
    expect(computeCenterGravityStep([0, 0], [100, 200], 0.1)).toEqual([10, 20])
  })

  it('is a no-op at alpha=0', () => {
    expect(computeCenterGravityStep([37, 42], [100, 200], 0)).toEqual([37, 42])
  })

  it('lands exactly on center at alpha=1', () => {
    expect(computeCenterGravityStep([0, 0], [100, 200], 1)).toEqual([100, 200])
  })
})

describe('BubbleCloud.processData / start - mark-and-sweep diff + isChanged/animationAlpha', () => {
  it('creates a Bubble per row on first start(), sized by computeBubbleRadius, and resets animationAlpha', () => {
    const cloud = new BubbleCloud(300, 300)
    cloud.animationAlpha = 0 // simulate an already-settled cloud
    const isChanged = cloud.processData([datum({ name: 'a', count: 10 }), datum({ name: 'b', count: 10 })])

    expect(isChanged).toBe(true)
    expect(Object.keys(cloud.bubbles).sort()).toEqual(['a', 'b'])
    expect(cloud.bubbles.a.radius).toBe(computeBubbleRadius(10, 20, 300, 300))
    expect(cloud.animationAlpha).toBe(0.1)
  })

  it('start() always begins from an EMPTY bubbles map, so a bubble present before start() never survives into it', () => {
    const cloud = new BubbleCloud(300, 300)
    cloud.processData([datum({ name: 'a', count: 10 })])
    const originalA = cloud.bubbles.a

    cloud.start([datum({ name: 'a', count: 10 })])
    // Same name, same count -> would NOT have triggered a radius-update branch on a reused
    // instance, but start() discards the whole map first, so this is a brand-new Bubble anyway.
    expect(cloud.bubbles.a).not.toBe(originalA)
  })

  it('processData() called TWICE on the SAME instance (never happens via the real brush, per useBubbleCloud.ts header) reuses a same-named bubble and only bumps radius past the >20 deadband', () => {
    // Two rows, so a count-only change on 'a' also shifts totalCount (radius is a PROPORTION of
    // the whole data set, per computeBubbleRadius - with only one row it's always 1/1 and never
    // changes at all, which is why this trace needs a second, otherwise-untouched row 'b').
    const cloud = new BubbleCloud(600, 600)
    cloud.processData([datum({ name: 'a', count: 10 }), datum({ name: 'b', count: 90 })])
    const bubbleA = cloud.bubbles.a
    bubbleA.pos = [123, 456]
    expect(bubbleA.radius).toBe(60) // (10/100)*(600/6) + 50
    cloud.animationAlpha = 0

    // Small count change (10 -> 11, total 100 -> 101): radius shifts to ~60.89, a <20 delta from
    // the STORED 60 -> position/radius both untouched, isChanged stays false, animationAlpha NOT
    // reset.
    const small = cloud.processData([datum({ name: 'a', count: 11 }), datum({ name: 'b', count: 90 })])
    expect(small).toBe(false)
    expect(cloud.bubbles.a).toBe(bubbleA)
    expect(cloud.bubbles.a.pos).toEqual([123, 456])
    expect(cloud.bubbles.a.radius).toBe(60)
    expect(cloud.animationAlpha).toBe(0)

    // Large count change (10 -> 5000, total 100 -> 5090): radius shifts to ~148.23, a delta of
    // ~88.23 from the STILL-STORED 60 -> past the >20 deadband -> radius updates in place,
    // position untouched (the "already-settled bubble keeps its place, just resizes" behavior).
    const big = cloud.processData([datum({ name: 'a', count: 5000 }), datum({ name: 'b', count: 90 })])
    expect(big).toBe(true)
    expect(cloud.bubbles.a).toBe(bubbleA)
    expect(cloud.bubbles.a.pos).toEqual([123, 456])
    expect(cloud.bubbles.a.radius).toBe(computeBubbleRadius(5000, 5090, 600, 600))
    expect(cloud.animationAlpha).toBe(0.1)
  })

  it('a name absent from the next data set is swept (deleted) and marks isChanged', () => {
    const cloud = new BubbleCloud(300, 300)
    cloud.processData([datum({ name: 'a', count: 10 }), datum({ name: 'b', count: 10 })])
    cloud.animationAlpha = 0

    const isChanged = cloud.processData([datum({ name: 'a', count: 10 })])
    expect(isChanged).toBe(true)
    expect(Object.keys(cloud.bubbles)).toEqual(['a'])
    expect(cloud.animationAlpha).toBe(0.1)
  })

  it('processData(null) is a no-op that returns false', () => {
    const cloud = new BubbleCloud(300, 300)
    expect(cloud.processData(null)).toBe(false)
    expect(cloud.bubbles).toEqual({})
  })
})

describe('BubbleCloud.step - collision resolution (ordered-pair, no dedupe, in-place mutation)', () => {
  it('two overlapping bubbles resolve to exactly minDist apart after the (0,1) pass, making the (1,0) pass a no-op', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 }), datum({ name: 'b', count: 1 })])
    cloud.animationAlpha = 0 // isolate the collision pass from the gravity pass for this trace
    cloud.bubbles.a.radius = 10
    cloud.bubbles.b.radius = 10
    cloud.bubbles.a.pos = [0, 0]
    cloud.bubbles.b.pos = [10, 0]

    cloud.step()

    // minDist = 10 + 10 + collisionPadding(4) = 24. Hand-traced: d = (10-24)/10*0.5 = -0.7,
    // dx = (0-10)*-0.7 = 7 -> a.x -= 7 => -7, b.x += 7 => 17. New dist = 24 = minDist exactly, so
    // the very next ordered pair (1,0) in the same step() finds dist === minDist (not <), a no-op.
    expect(cloud.bubbles.a.pos).toEqual([-7, 0])
    expect(cloud.bubbles.b.pos).toEqual([17, 0])
  })

  it('non-overlapping bubbles are left untouched by the collision pass', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 }), datum({ name: 'b', count: 1 })])
    cloud.animationAlpha = 0
    cloud.bubbles.a.radius = 10
    cloud.bubbles.b.radius = 10
    cloud.bubbles.a.pos = [0, 0]
    cloud.bubbles.b.pos = [1000, 1000] // far apart, well past minDist=24

    cloud.step()

    expect(cloud.bubbles.a.pos).toEqual([0, 0])
    expect(cloud.bubbles.b.pos).toEqual([1000, 1000])
  })

  it('animationAlpha decays by *0.99 per step() and clamps at 0, independent of collision resolution', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 })])
    expect(cloud.animationAlpha).toBe(0.1)
    cloud.step()
    expect(cloud.animationAlpha).toBeCloseTo(0.099, 5)
  })

  it('gravity pulls a lone bubble toward the canvas center even with zero collisions, using the ALREADY-decayed alpha (the *=0.99 decay runs before the gravity loop, matching source order)', () => {
    const cloud = new BubbleCloud(200, 200)
    cloud.processData([datum({ name: 'a', count: 1 })])
    cloud.bubbles.a.pos = [0, 0]
    cloud.animationAlpha = 0.5

    cloud.step()

    // decay first: 0.5 * 0.99 = 0.495; center = [100, 100]; pos += (center - pos) * 0.495 -> [49.5, 49.5]
    expect(cloud.animationAlpha).toBeCloseTo(0.495, 5)
    expect(cloud.bubbles.a.pos[0]).toBeCloseTo(49.5, 5)
    expect(cloud.bubbles.a.pos[1]).toBeCloseTo(49.5, 5)
  })

  it('update() is a confirmed no-op in render() - force() is never called anywhere in this file, so veloc/accel stay [0,0] and pos is untouched by update()', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 })])
    cloud.bubbles.a.pos = [42, 84]

    const ctx = { fillStyle: '', font: '', textAlign: '', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1, beginPath() {}, arc() {}, fill() {}, fillText() {} } as unknown as CanvasRenderingContext2D
    cloud.render(ctx, Date.now())

    expect(cloud.bubbles.a.pos).toEqual([42, 84])
    expect(cloud.bubbles.a.veloc).toEqual([0, 0])
  })
})

describe('BubbleCloud.pick - hover hit-test', () => {
  it('returns the origin row of whichever bubble the point falls inside, first match wins', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1, origin: { title: 'a', capacity: 1 } }), datum({ name: 'b', count: 1, origin: { title: 'b', capacity: 1 } })])
    cloud.bubbles.a.pos = [0, 0]
    cloud.bubbles.a.radius = 10
    cloud.bubbles.b.pos = [500, 500]
    cloud.bubbles.b.radius = 10

    const hit = cloud.pick(1, 1)
    expect(hit).toEqual({ title: 'a', capacity: 1 })
    expect(cloud.hoverBubble).toBe(cloud.bubbles.a)
  })

  it('returns null and clears hoverBubble on a miss', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 })])
    cloud.bubbles.a.pos = [0, 0]
    cloud.bubbles.a.radius = 10
    cloud.pick(1, 1)
    expect(cloud.hoverBubble).not.toBeNull()

    const miss = cloud.pick(900, 900)
    expect(miss).toBeNull()
    expect(cloud.hoverBubble).toBeNull()
  })

  it('render() dims every bubble except hoverBubble', () => {
    const cloud = new BubbleCloud(1000, 1000)
    cloud.processData([datum({ name: 'a', count: 1 }), datum({ name: 'b', count: 1 })])
    cloud.bubbles.a.pos = [0, 0]
    cloud.bubbles.a.radius = 10
    cloud.pick(1, 1)

    const ctx = { fillStyle: '', font: '', textAlign: '', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1, beginPath() {}, arc() {}, fill() {}, fillText() {} } as unknown as CanvasRenderingContext2D
    cloud.render(ctx, Date.now())

    expect(cloud.bubbles.a.dim).toBe(false)
    expect(cloud.bubbles.b.dim).toBe(true)
  })
})
