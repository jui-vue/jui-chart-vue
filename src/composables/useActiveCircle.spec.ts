import { describe, expect, it } from 'vitest'
import { ActiveCircleField, Circle, checkWallCollision } from './useActiveCircle'

describe('Circle', () => {
  it('has the exact default field values from source', () => {
    const c = new Circle(
      (v) => v,
      (v) => v,
      '#fff',
      0,
      0,
    )
    expect(c.radius).toBe(1)
    expect(c.position).toEqual([0, 0])
    expect(c.velocity).toEqual([0, 0])
    expect(c.acceleration).toEqual([0, 0])
    expect(c.gravity).toBe(-9.8)
    expect(c.mass).toBe(1)
    expect(c.weight).toBe(1)
    expect(c.friction).toBe(0.1)
    expect(c.runtime).toBe(0)
  })

  describe('checkForMotion (dead code in the real brush, ported/tested directly)', () => {
    it('hand-traced: mass=1, gravity=-9.8, angle=30, fricCoeff=1 -> true', () => {
      // weight = 1*-9.8 = -9.8; normal = -9.8*cos(30deg) = -8.4870489570875
      // perpForce = -9.8*sin(30deg) = -4.9; staticFriction = 1*normal = -8.4870489570875
      // perpForce(-4.9) > staticFriction(-8.487...) -> true
      const c = new Circle(
        (v) => v,
        (v) => v,
        '#fff',
        0,
        0,
      )
      expect(c.checkForMotion(30, 1)).toBe(true)
    })

    it('hand-traced: a large friction coefficient flips the result to false', () => {
      // staticFriction = 5 * -8.4870489570875 = -42.4352447854375; perpForce(-4.9) > that -> true still
      // (friction acting on a negative normal force only makes staticFriction more negative, so it
      // can never exceed perpForce here - confirmed by trying an extreme angle instead: angle=89
      // makes perpForce very negative while normal ~0, flipping the comparison)
      const c = new Circle(
        (v) => v,
        (v) => v,
        '#fff',
        0,
        0,
      )
      expect(c.checkForMotion(89, 1)).toBe(false)
    })
  })

  describe('calcAcceleration (dead code; preserves the massToWeight 2nd-arg-discarded quirk)', () => {
    it('hand-traced: mass=1, gravity=-9.8, angle=30, fricCoeff=1 -> 3.587048957087501', () => {
      const c = new Circle(
        (v) => v,
        (v) => v,
        '#fff',
        0,
        0,
      )
      expect(c.calcAcceleration(30, 1)).toBeCloseTo(3.587048957087501, 10)
    })

    it('ignores a custom this.acceleration[1] the way the original silently discards massToWeight\'s 2nd arg', () => {
      const c = new Circle(
        (v) => v,
        (v) => v,
        '#fff',
        0,
        0,
      )
      c.acceleration = [0, 999]
      // Still uses this.gravity (-9.8), NOT this.acceleration[1] (999), for the weight calc.
      expect(c.calcAcceleration(30, 1)).toBeCloseTo(3.587048957087501, 10)
    })
  })

  it('poundToWeight/weightToPound/massToWeight/weightToMass hand-traced', () => {
    const c = new Circle(
      (v) => v,
      (v) => v,
      '#fff',
      0,
      0,
    )
    expect(c.poundToWeight(10)).toBeCloseTo(44.48398576512456, 10)
    expect(c.weightToPound(10)).toBeCloseTo(2.248, 10)
    expect(c.massToWeight(2)).toBe(-19.6)
    expect(c.weightToMass(-19.6)).toBe(2)
  })

  describe('updateAcceleration / move (hand-traced position math)', () => {
    const scaleX = (v: number) => v * 10
    const scaleY = (v: number) => 200 - v * 10

    it('at runtime=0, position is the raw scaled (xValue, yValue), no missing 0.5 factor applied yet', () => {
      const c = new Circle(scaleX, scaleY, '#fff', 5, 3)
      c.velocity = [1, -2]
      c.acceleration = [0.5, 0.1]
      c.updateAcceleration()
      expect(c.position).toEqual([50, 170])
    })

    it('move() with tpf=0.5 accumulates runtime and re-derives position (no 0.5 factor on a*t^2, preserved)', () => {
      const c = new Circle(scaleX, scaleY, '#fff', 5, 3)
      c.velocity = [1, -2]
      c.acceleration = [0.5, 0.1]
      c.move(999, 0.5)
      expect(c.runtime).toBe(0.5)
      expect(c.position[0]).toBeCloseTo(56.25, 10)
      expect(c.position[1]).toBeCloseTo(179.75, 10)
    })

    it('a second move(_, 0.5) call accumulates runtime to 1.0 and moves further', () => {
      const c = new Circle(scaleX, scaleY, '#fff', 5, 3)
      c.velocity = [1, -2]
      c.acceleration = [0.5, 0.1]
      c.move(999, 0.5)
      c.move(999, 0.5)
      expect(c.runtime).toBe(1)
      expect(c.position[0]).toBeCloseTo(65, 10)
      expect(c.position[1]).toBeCloseTo(189, 10)
    })

    it('tpf === 1 is a no-op (preserved source guard, inert under this port\'s own frame timing)', () => {
      const c = new Circle(scaleX, scaleY, '#fff', 5, 3)
      c.velocity = [1, -2]
      c.move(999, 1)
      expect(c.runtime).toBe(0)
      expect(c.position).toEqual([0, 0])
    })
  })

  it('stop() resets velocity and acceleration to [0, 0], leaves position/runtime untouched', () => {
    const c = new Circle(
      (v) => v,
      (v) => v,
      '#fff',
      0,
      0,
    )
    c.velocity = [3, 4]
    c.acceleration = [1, 2]
    c.position = [10, 20]
    c.runtime = 5
    c.stop()
    expect(c.velocity).toEqual([0, 0])
    expect(c.acceleration).toEqual([0, 0])
    expect(c.position).toEqual([10, 20])
    expect(c.runtime).toBe(5)
  })

  describe('draw', () => {
    it('sets the fixed shadow recipe then delegates to drawFilledCircle', () => {
      const calls: string[] = []
      const ctx = {
        set shadowColor(v: string) {
          calls.push(`shadowColor=${v}`)
        },
        set shadowBlur(v: number) {
          calls.push(`shadowBlur=${v}`)
        },
        set shadowOffsetX(v: number) {
          calls.push(`shadowOffsetX=${v}`)
        },
        set shadowOffsetY(v: number) {
          calls.push(`shadowOffsetY=${v}`)
        },
        set globalAlpha(v: number) {
          calls.push(`globalAlpha=${v}`)
        },
        set fillStyle(v: string) {
          calls.push(`fillStyle=${v}`)
        },
        beginPath: () => calls.push('beginPath'),
        arc: (x: number, y: number, r: number) => calls.push(`arc(${x},${y},${r})`),
        fill: () => calls.push('fill'),
      } as unknown as CanvasRenderingContext2D

      const c = new Circle(
        (v) => v,
        (v) => v,
        '#7BBAE7',
        0,
        0,
      )
      c.position = [12, 34]
      c.radius = 5
      c.draw(ctx)

      expect(calls).toEqual([
        'shadowColor=rgba(123,186,231,0.3)',
        'shadowBlur=10',
        'shadowOffsetX=0',
        'shadowOffsetY=10',
        'globalAlpha=1',
        'beginPath',
        'arc(12,34,5)',
        'fillStyle=#7BBAE7',
        'fill',
      ])
    })
  })
})

describe('checkWallCollision (dead code in the real brush, ported/tested directly)', () => {
  // Realistic inverted y-pixel bounds: minY (axis.y(axis.y.min())) is the BOTTOM edge (larger
  // pixel value), maxY (axis.y(axis.y.max())) is the TOP edge (smaller pixel value) - see this
  // function's doc comment in useActiveCircle.ts for why.
  const minX = 0
  const maxX = 400
  const minY = 300
  const maxY = 0

  it('well inside the bounds -> no collision', () => {
    expect(checkWallCollision([200, 150], 10, minX, maxX, minY, maxY)).toBe(false)
  })

  it('near the top edge (small pixel y) -> collision', () => {
    expect(checkWallCollision([200, 5], 10, minX, maxX, minY, maxY)).toBe(true)
  })

  it('near the bottom edge (large pixel y) -> collision', () => {
    expect(checkWallCollision([200, 295], 10, minX, maxX, minY, maxY)).toBe(true)
  })

  it('near the left edge -> collision', () => {
    expect(checkWallCollision([2, 150], 10, minX, maxX, minY, maxY)).toBe(true)
  })

  it('near the right edge -> collision', () => {
    expect(checkWallCollision([398, 150], 10, minX, maxX, minY, maxY)).toBe(true)
  })
})

describe('ActiveCircleField', () => {
  const scaleX = (v: number) => v * 10
  const scaleY = (v: number) => 100 - v * 10

  it('seeds circles from rows only on the first step() call that finds an empty population', () => {
    const field = new ActiveCircleField()
    const rows = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]
    field.step(rows, scaleX, scaleY, (i) => `color-${i}`, 20, 0)
    expect(field.circles).toHaveLength(2)
    expect(field.circles[0].position).toEqual([10, 80])
    expect(field.circles[1].position).toEqual([30, 60])
  })

  it('a LATER step() call with different rows has no effect once circles already exist (source quirk)', () => {
    const field = new ActiveCircleField()
    field.step([{ x: 1, y: 2 }], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles).toHaveLength(1)

    field.step([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles).toHaveLength(1)
  })

  it('an empty rows array on the first call leaves circles empty, and a later non-empty call still seeds (circles.length===0 gate re-opens)', () => {
    const field = new ActiveCircleField()
    field.step([], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles).toHaveLength(0)

    field.step([{ x: 1, y: 2 }], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles).toHaveLength(1)
  })

  it('radius falls back to defaultRadius when the row omits it (or is 0, matching the `||` quirk)', () => {
    const field = new ActiveCircleField()
    field.step([{ x: 0, y: 0, radius: 0 }, { x: 0, y: 0, radius: 7 }], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles[0].radius).toBe(20)
    expect(field.circles[1].radius).toBe(7)
  })

  it('velocity/acceleration default to [0,0] per-axis when the row omits vx/vy/ax/ay', () => {
    const field = new ActiveCircleField()
    field.step([{ x: 0, y: 0, vx: 2 }], scaleX, scaleY, () => '#fff', 20, 0)
    expect(field.circles[0].velocity).toEqual([2, 0])
    expect(field.circles[0].acceleration).toEqual([0, 0])
  })

  it('step() advances every existing circle via move(), even when the spawn gate is closed', () => {
    const field = new ActiveCircleField()
    field.step([{ x: 0, y: 0, vx: 10, vy: 0 }], scaleX, scaleY, () => '#fff', 20, 0)
    const before = field.circles[0].position
    field.step([], scaleX, scaleY, () => '#fff', 20, 0.5)
    expect(field.circles[0].position).not.toEqual(before)
    expect(field.circles[0].position[0]).toBeCloseTo(50, 10) // scaleX(0 + 10*0.5) = 50
  })

  it('render() draws every circle via ctx calls (delegates to Circle.draw)', () => {
    const field = new ActiveCircleField()
    field.step([{ x: 0, y: 0 }, { x: 1, y: 1 }], scaleX, scaleY, () => '#000000', 5, 0)

    let arcCalls = 0
    const ctx = {
      set shadowColor(_v: string) {},
      set shadowBlur(_v: number) {},
      set shadowOffsetX(_v: number) {},
      set shadowOffsetY(_v: number) {},
      set globalAlpha(_v: number) {},
      set fillStyle(_v: string) {},
      beginPath: () => {},
      arc: () => {
        arcCalls++
      },
      fill: () => {},
    } as unknown as CanvasRenderingContext2D

    field.render(ctx)
    expect(arcCalls).toBe(2)
  })
})
