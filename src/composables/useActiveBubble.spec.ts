import { describe, expect, it } from 'vitest'
import { ActiveBubble, buildSpawnQueue, computeGravityForce, hexToRgba } from './useActiveBubble'
import { MortalBubble } from './mortalBubble'

describe('hexToRgba', () => {
  it('parses a 6-digit hex color and formats rgba', () => {
    expect(hexToRgba('#7BBAE7', 1)).toBe('rgba(123,186,231,1)')
  })

  it('parses without a leading #', () => {
    expect(hexToRgba('7BBAE7', 0.5)).toBe('rgba(123,186,231,0.5)')
  })

  it('parses a 3-digit hex shorthand', () => {
    expect(hexToRgba('#0f0', 0.2)).toBe('rgba(0,255,0,0.2)')
  })

  it('passes opacity through unclamped (matches util.color.format, which never clamps either)', () => {
    expect(hexToRgba('#000000', 0)).toBe('rgba(0,0,0,0)')
  })
})

describe('computeGravityForce', () => {
  it('is purely horizontal ([1,0] gDirection) - mass*gravity on x, always 0 on y', () => {
    expect(computeGravityForce(10, 0.2)).toEqual([2, 0])
  })

  it('scales linearly with both mass and gravity', () => {
    expect(computeGravityForce(20, 0.2)).toEqual([4, 0])
    expect(computeGravityForce(10, 0.5)).toEqual([5, 0])
  })

  it('is zero force at zero gravity', () => {
    expect(computeGravityForce(10, 0)).toEqual([0, 0])
  })
})

describe('buildSpawnQueue', () => {
  it('resolves color via the batch-local index (restarts at 0 every call, not a running count)', () => {
    const items = [{}, {}, {}]
    const spawns = buildSpawnQueue(items, (_item, i) => `color-${i}`, 1000)
    expect(spawns.map((s) => s.color)).toEqual(['color-0', 'color-1', 'color-2'])
  })

  it('falls back startTime to `now` and duration to 1000 when the row omits them', () => {
    const [spawn] = buildSpawnQueue([{}], () => '#fff', 5000)
    expect(spawn.startTime).toBe(5000)
    expect(spawn.duration).toBe(1000)
  })

  it('reads startTime/duration off the row when present, ignoring `now` for them', () => {
    const [spawn] = buildSpawnQueue([{ startTime: 42, duration: 777 }], () => '#fff', 5000)
    expect(spawn.startTime).toBe(42)
    expect(spawn.duration).toBe(777)
  })

  it('non-number startTime/duration fields fall back exactly like a missing field', () => {
    const [spawn] = buildSpawnQueue([{ startTime: 'soon', duration: null }], () => '#fff', 9)
    expect(spawn.startTime).toBe(9)
    expect(spawn.duration).toBe(1000)
  })
})

describe('ActiveBubble.preCheck', () => {
  it('removes a single dead bubble', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    const b1 = new MortalBubble(0, 1000, 20)
    sim.data.push(b1)
    b1.active = false
    expect(sim.preCheck()).toBe(false)
    expect(sim.data).toHaveLength(0)
  })

  it('returns true and keeps live bubbles untouched', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    sim.data.push(new MortalBubble(0, 1000, 20), new MortalBubble(0, 1000, 20))
    expect(sim.preCheck()).toBe(true)
    expect(sim.data).toHaveLength(2)
  })

  it('preserves the source splice-without-decrement bug: a run of consecutive dead bubbles needs MULTIPLE preCheck() calls to fully clear', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    const [a, b, c, d] = [new MortalBubble(0, 1000, 20), new MortalBubble(0, 1000, 20), new MortalBubble(0, 1000, 20), new MortalBubble(0, 1000, 20)]
    ;[a, b, c, d].forEach((bubble) => (bubble.active = false))
    sim.data.push(a, b, c, d)

    // Pass 1: i=0 checks A (dead) -> splice, data=[B,C,D], i becomes 1.
    //         i=1 checks data[1]=C (dead, C's own turn came up early because B shifted into slot
    //         0 and was never re-checked this pass) -> splice, data=[B,D], i becomes 2.
    //         i=2 >= length(2), loop ends. B survived this pass WITHOUT being checked at all.
    sim.preCheck()
    expect(sim.data).toEqual([b, d])

    // Pass 2: i=0 checks data[0]=B (dead) -> splice, data=[D], i becomes 1. Loop ends (1 >= 1) -
    // D survives this pass too, again without being checked.
    sim.preCheck()
    expect(sim.data).toEqual([d])

    // Pass 3: i=0 checks data[0]=D (dead) -> splice, data=[]. Finally empty.
    sim.preCheck()
    expect(sim.data).toEqual([])
  })
})

describe('ActiveBubble.step - gravity + bounds', () => {
  it('applies rightward gravity force then update(), moving a single bubble right (not down)', () => {
    const sim = new ActiveBubble(1000, 1000, 0.2)
    const b = new MortalBubble(0, 1000, 20)
    b.pos = [100, 100]
    b.veloc = [0, 0]
    // MortalBubble's own constructor already applied a one-time force([30, 0]) kick (see
    // mortalBubble.ts) - reset it so this test isolates the gravity math in step() cleanly,
    // matching the hand-traced numbers below exactly.
    b.accel = [0, 0]
    sim.data.push(b)

    sim.step()

    // force([mass*gravity, 0]) = force([2, 0]) since mass=10 -> accel += [2,0]/10 = [0.2, 0].
    // update(): veloc = [0.2, 0]; |veloc[0]| = 0.2 is NOT > 2, so x does not move THIS tick
    // (kinetic.js's own update() gate) - position is unchanged on the very first tick.
    expect(b.pos).toEqual([100, 100])
    expect(b.veloc[0]).toBeCloseTo(0.2)
    expect(b.veloc[1]).toBe(0)
  })

  it('after enough ticks, veloc[0] crosses the >2 gate and the bubble actually moves right, never down', () => {
    const sim = new ActiveBubble(1000, 1000, 5)
    const b = new MortalBubble(0, 100000, 20)
    b.pos = [50, 50]
    b.veloc = [0, 0]
    b.accel = [0, 0]
    sim.data.push(b)

    for (let i = 0; i < 5; i++) sim.step()

    expect(b.pos[0]).toBeGreaterThan(50)
    expect(b.pos[1]).toBe(50)
  })

  it('clamps pos[0] only at the max edge (no min-edge clamp) and pos[1] at both edges', () => {
    const sim = new ActiveBubble(200, 150, 0)
    const over = new MortalBubble(0, 1000, 10)
    over.pos = [500, 500]
    over.veloc = [0, 0]
    over.accel = [0, 0]
    const under = new MortalBubble(0, 1000, 10)
    under.pos = [-999, -50]
    under.veloc = [0, 0]
    under.accel = [0, 0]
    sim.data.push(over, under)

    sim.step()

    expect(over.pos[0]).toBe(200)
    expect(over.pos[1]).toBe(150)
    // No lower clamp on x at all - stays far negative.
    expect(under.pos[0]).toBe(-999)
    expect(under.pos[1]).toBe(0)
  })

  it('flips isArrange to true once a step finds zero overlapping pairs', () => {
    const sim = new ActiveBubble(1000, 1000, 0)
    const b1 = new MortalBubble(0, 1000, 10)
    b1.pos = [10, 10]
    const b2 = new MortalBubble(0, 1000, 10)
    b2.pos = [500, 500]
    sim.data.push(b1, b2)

    expect(sim.isArrange).toBe(false)
    sim.step()
    expect(sim.isArrange).toBe(true)
  })

  it('does not flip isArrange when bubbles still overlap', () => {
    const sim = new ActiveBubble(1000, 1000, 0)
    const b1 = new MortalBubble(0, 1000, 20)
    b1.pos = [100, 100]
    const b2 = new MortalBubble(0, 1000, 20)
    b2.pos = [110, 100]
    sim.data.push(b1, b2)

    sim.step()
    expect(sim.isArrange).toBe(false)
  })

  it('overlapping bubbles are pushed apart along the normal between their centers', () => {
    const sim = new ActiveBubble(1000, 1000, 0)
    const b1 = new MortalBubble(0, 1000, 20)
    b1.pos = [100, 100]
    b1.veloc = [0, 0]
    b1.accel = [0, 0]
    const b2 = new MortalBubble(0, 1000, 20)
    b2.pos = [110, 100]
    b2.veloc = [0, 0]
    b2.accel = [0, 0]
    sim.data.push(b1, b2)

    sim.step()

    // gravity=0 and accel was reset above, so the gravity+update() phase leaves both positions
    // untouched going into collision resolution: radiusSum=40, dist=10 -> size=30, normal=[1,0]
    // (pointing from b1 toward b2).
    // b1.pos = -15*[1,0] + [100,100] = [85,100]; b2.pos = 15*[1,0] + [110,100] = [125,100].
    expect(b1.pos[0]).toBeCloseTo(85)
    expect(b2.pos[0]).toBeCloseTo(125)
  })

  it('does nothing (no throw, no-op) with an empty population', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    expect(() => sim.step()).not.toThrow()
    expect(sim.data).toHaveLength(0)
  })
})

describe('ActiveBubble.render', () => {
  it('calls draw(ctx, now) on every remaining bubble, in order', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    const calls: number[] = []
    const b1 = new MortalBubble(0, 1000, 10)
    b1.draw = (_ctx, now) => calls.push(now)
    const b2 = new MortalBubble(0, 1000, 10)
    b2.draw = (_ctx, now) => calls.push(now + 1)
    sim.data.push(b1, b2)

    sim.render({} as CanvasRenderingContext2D, 500)

    expect(calls).toEqual([500, 501])
  })

  it('skips bubbles preCheck already removed', () => {
    const sim = new ActiveBubble(400, 300, 0.2)
    let drawn = 0
    const dead = new MortalBubble(0, 1000, 10)
    dead.draw = () => drawn++
    dead.active = false
    sim.data.push(dead)

    sim.preCheck()
    sim.render({} as CanvasRenderingContext2D, 0)

    expect(drawn).toBe(0)
  })
})
