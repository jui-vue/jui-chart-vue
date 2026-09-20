import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { pieInsideLabelDeclutter, pieOutsideLabelDeclutter, pieSlicePath, usePieSlices } from './usePie'
import type { DataRow } from '../types'

describe('usePieSlices', () => {
  it('splits 360deg proportionally to each target value, in order', () => {
    const data = ref<DataRow>({ sales: 30, profit: 70 })
    const target = ref(['sales', 'profit'])
    const color = ref((i: number) => `color-${i}`)

    const slices = usePieSlices(data, target, color)

    expect(slices.value).toHaveLength(2)

    expect(slices.value[0]).toMatchObject({ key: 'sales', value: 30, ratio: 0.3, startAngle: 0 })
    expect(slices.value[0].sweepAngle).toBeCloseTo(108, 10)
    expect(slices.value[0].centerAngle).toBeCloseTo(-36, 10)

    expect(slices.value[1]).toMatchObject({ key: 'profit', value: 70, ratio: 0.7, startAngle: 108 })
    expect(slices.value[1].sweepAngle).toBeCloseTo(252, 10)
    expect(slices.value[1].centerAngle).toBeCloseTo(144, 10)

    // Full turn.
    expect(slices.value[0].sweepAngle + slices.value[1].sweepAngle).toBeCloseTo(360, 10)
  })

  it('skips a zero-value target entirely, without advancing the angle for it', () => {
    const data = ref<DataRow>({ a: 0, b: 10 })
    const target = ref(['a', 'b'])
    const color = ref(() => '#000')

    const slices = usePieSlices(data, target, color)

    expect(slices.value).toHaveLength(1)
    expect(slices.value[0]).toMatchObject({ key: 'b', startAngle: 0, sweepAngle: 360 })
  })

  it('assigns colors via the supplied color function by target index', () => {
    const data = ref<DataRow>({ a: 1, b: 1 })
    const target = ref(['a', 'b'])
    const color = ref((i: number) => (i === 0 ? 'red' : 'blue'))

    const slices = usePieSlices(data, target, color)
    expect(slices.value.map((s) => s.color)).toEqual(['red', 'blue'])
  })
})

describe('pieOutsideLabelDeclutter', () => {
  it('keeps every label at full rate/opacity when all angles are >=2deg apart (and far from the initial 0 preAngle)', () => {
    const result = pieOutsideLabelDeclutter([-80, 40, 160], 1.3)

    expect(result).toHaveLength(3)
    for (const r of result) {
      expect(r.rate).toBeCloseTo(1.3, 10)
      expect(r.opacity).toBe(1)
      expect(r.hidden).toBe(false)
    }
  })

  it('shrinks rate and fades opacity for a label within 2deg of the previously-drawn one', () => {
    const result = pieOutsideLabelDeclutter([-80, -79], 1.3)

    expect(result[0]).toMatchObject({ rate: 1.3, opacity: 1, hidden: false })
    // 1.3 - 1.3*0.05 = 1.235, still above the 1.2 hide floor.
    expect(result[1].rate).toBeCloseTo(1.235, 10)
    expect(result[1].opacity).toBeCloseTo(0.75, 10)
    expect(result[1].hidden).toBe(false)
  })

  it('hides a label once its shrunk rate drops to/below the 1.2 floor, and does NOT advance the comparison angle for a hidden label', () => {
    const result = pieOutsideLabelDeclutter([-80, -79, -78, -77.5], 1.3)

    // -78 is 1deg from -79 (the last *drawn* label) -> keeps shrinking: 1.235 - 0.065 = 1.17 <= 1.2 -> hidden.
    expect(result[2].hidden).toBe(true)

    // -77.5 is compared against -79 again (the hidden -78 never became "preAngle") - still <2deg
    // apart, so shrinking continues from the still-hidden 1.17 rather than resetting.
    expect(result[3].hidden).toBe(true)
    expect(result[3].rate).toBeCloseTo(1.105, 10)
  })

  it('resets to full rate/opacity once a gap of >=2deg is found after a run of collisions', () => {
    const result = pieOutsideLabelDeclutter([-80, -79, 40], 1.3)

    expect(result[2]).toMatchObject({ rate: 1.3, opacity: 1, hidden: false })
  })

  it('is order-dependent: only compares against the previous entry, not all pairs', () => {
    // -80 and 40 are far apart from each other AND from the shared reference, but inserting a
    // near-duplicate of -80 in between still only affects its immediate neighbors.
    const isolated = pieOutsideLabelDeclutter([-80, 40], 1.3)
    const withNeighbor = pieOutsideLabelDeclutter([-80, -79.5, 40], 1.3)

    expect(isolated[1].hidden).toBe(false)
    expect(withNeighbor[1].hidden).toBe(false) // -79.5 collides with -80, but survives (1 collision only)
    expect(withNeighbor[2]).toMatchObject({ rate: 1.3, opacity: 1, hidden: false }) // 40 is far from -79.5, resets clean
  })

  it("ports the original's literal initial condition: preAngle starts at 0, so a first label near 0deg counts as a collision", () => {
    const result = pieOutsideLabelDeclutter([1], 1.3)

    expect(result[0].rate).toBeCloseTo(1.235, 10)
    expect(result[0].opacity).toBeCloseTo(0.75, 10)
  })

  it('hides every label when baseRate is already at/below the hardcoded 1.2 floor (matches the original literally, however odd)', () => {
    const result = pieOutsideLabelDeclutter([-80, 40], 1.2)

    expect(result[0].hidden).toBe(true)
    expect(result[1].hidden).toBe(true)
  })
})

describe('pieInsideLabelDeclutter', () => {
  // Short, equal-length placeholder text for cases that aren't about text-width specifically -
  // at fontSize=10 a 1-char label's width estimate (1*10*0.57=5.7) is under the 1.4x-fontSize
  // floor (14), so every such label's half-width is pinned to the same 7px regardless of content,
  // making these cases equivalent to a pure angle/radius collision test.
  const short = (n: number) => Array.from({ length: n }, () => 'x')

  it('keeps every label visible when the chord distance between them clears the width threshold (large radius)', () => {
    // radius=90, 90deg apart -> chord = 2*90*sin(45deg) = ~127px, well clear of the 7+7=14px floor threshold.
    const result = pieInsideLabelDeclutter([0, 90, 180, 270], short(4), 90, 10)
    expect(result.every((r) => r.hidden === false)).toBe(true)
  })

  it('hides a label whose chord distance from the previous one falls under the floor threshold (small radius)', () => {
    // radius=50, 10deg apart -> chord = 2*50*sin(5deg) = ~8.7px, under the 7+7=14px floor threshold.
    const result = pieInsideLabelDeclutter([0, 10], short(2), 50, 10)
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
  })

  it('resets once a wide-enough gap reopens after a hidden label', () => {
    const result = pieInsideLabelDeclutter([0, 10, 100], short(3), 50, 10)
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
    expect(result[2].hidden).toBe(false) // 100deg from 0 (preAngle didn't advance past the hidden 10) -> clear
  })

  it('does not advance the comparison angle for a hidden label, so a cascading run keeps hiding', () => {
    const result = pieInsideLabelDeclutter([0, 10, 10.5, 100], short(4), 50, 10)
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
    // 10.5 is compared against 0 (the last *visible* label, not the hidden 10) - still a collision.
    expect(result[2].hidden).toBe(true)
    expect(result[3].hidden).toBe(false)
  })

  it('never hides the first label (no previous label to collide with) - unlike the outside case, there is no preAngle=0 quirk here', () => {
    const result = pieInsideLabelDeclutter([0], short(1), 50, 10)
    expect(result[0].hidden).toBe(false)
  })

  it('is width-aware, not just angle/radius-aware: a longer label collides at a gap a shorter one would clear', () => {
    // Same angle gap and radius as the "hides..." case above, but this time the second label's
    // text is long enough that even a much bigger gap still collides.
    const result = pieInsideLabelDeclutter([0, 30], ['x', 'a very long label indeed'], 50, 10)
    expect(result[1].hidden).toBe(true)
  })

  it('reproduces the confirmed PieGrid bug: a small-cell radius collides real labels whose text width matters, not just their angular gap', () => {
    // North America cell from PiePage.vue's axis.c grid demo: chrome/safari/edge/firefox/other
    // real label text and center angles at a ~45px inside-label radius (PieGrid's small cells).
    const centerAngles = [3.6, 154.8, 228.6, 252, 264.6]
    const labelTexts = ['chrome: 52', 'safari: 32', 'edge: 9', 'firefox: 4', 'other: 3']
    const result = pieInsideLabelDeclutter(centerAngles, labelTexts, 44.75, 11)

    // chrome/safari/edge are spaced widely enough (relative to their own text width) to survive.
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(false)
    expect(result[2].hidden).toBe(false)
    // firefox and other are packed too tightly against edge's text width to fit - this is the
    // bug: their center angles (23.4deg and 36deg from the last visible label) look far apart,
    // but at this radius and this text length they still collide.
    expect(result[3].hidden).toBe(true)
    expect(result[4].hidden).toBe(true)
  })

  it('a plain fontSize-only (no text width) heuristic would have missed the pre-existing full-size-pie overlap this also catches', () => {
    // Full-size single-pie "inside" demo data (PiePage.vue): "edge: 5" and "firefox: 3" sit only
    // ~24.7px apart (chord) at this radius, but a height-only threshold (fontSize*1.4=15.4) would
    // have called that fine - the text is what actually collides.
    const centerAngles = [25.2, 174.6, 217.8, 232.2, 253.8]
    const labelTexts = ['chrome: 64', 'safari: 19', 'edge: 5', 'firefox: 3', 'other: 9']
    const result = pieInsideLabelDeclutter(centerAngles, labelTexts, 98.5, 11)

    expect(result[3].hidden).toBe(true) // firefox collides with edge's text width
  })
})

describe('pieSlicePath', () => {
  it('returns null for a full-circle slice (rendered as a <circle> instead)', () => {
    expect(pieSlicePath(0, 0, 50, 0, 360)).toBeNull()
  })

  it('starts the arc straight up (0deg) and moves clockwise', () => {
    // rotate(0,-50,0) = (0,-50) -> the arc's start point sits directly above the center.
    const path = pieSlicePath(100, 100, 50, 0, 90)
    expect(path).toMatch(/^M 100 50 A 50 50 0 0 1/)
  })
})
