import { computed, type ComputedRef, type Ref } from 'vue'
import { radian, rotate } from './mathUtil'
import type { DataRow, PieSlice } from '../types'

/**
 * Pie/donut angle math, ported from `chart.brush.pie`'s `drawUnit()`. Deliberately NOT
 * axis-based (no scale/grid involvement) - slice angles come straight from each target's share
 * of the total, via trig. Shared by PieChart and DonutChart.
 *
 * A zero-value target is skipped entirely (no slice, and the angle doesn't advance for it),
 * matching the original's `if (data[target[i]] == 0) continue`.
 */
export function usePieSlices(data: Ref<DataRow>, target: Ref<string[]>, color: Ref<(index: number) => string>): ComputedRef<PieSlice[]> {
  return computed(() => {
    const row = data.value
    const targets = target.value

    let total = 0
    for (const key of targets) total += row[key] || 0

    const slices: PieSlice[] = []
    let startAngle = 0

    targets.forEach((key, i) => {
      const value = row[key]
      if (!value) return

      const ratio = total === 0 ? 0 : value / total
      const sweepAngle = 360 * ratio
      const centerAngle = startAngle + sweepAngle / 2 - 90

      slices.push({
        key,
        value,
        ratio,
        startAngle,
        sweepAngle,
        centerAngle,
        color: color.value(i),
      })

      startAngle += sweepAngle
    })

    return slices
  })
}

/**
 * Ported from `chart.brush.pie`'s `drawPie()` arc path building: returns an SVG path `d`
 * string for one slice's wedge, or `null` when the slice is a full circle (drawn as a
 * `<circle>` instead, per the original's `endAngle == 360` special case).
 */
export function pieSlicePath(centerX: number, centerY: number, radius: number, startAngle: number, sweepAngle: number): string | null {
  if (sweepAngle >= 360) return null

  const start = rotate(0, -radius, radian(startAngle))
  const end = rotate(start.x, start.y, radian(sweepAngle))
  const largeArc = sweepAngle > 180 ? 1 : 0

  const startX = centerX + start.x
  const startY = centerY + start.y
  const endX = centerX + end.x
  const endY = centerY + end.y

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} L ${centerX} ${centerY} Z`
}

/**
 * Ported from `chart.brush.donut`'s `drawDonut()`: a stroked arc (no fill) at `radius` with
 * `stroke-width` = the ring thickness, so the visual outer/inner edges land at
 * `radius +/- thickness/2`.
 */
export function donutSlicePath(centerX: number, centerY: number, radius: number, startAngle: number, sweepAngle: number): string {
  // A >=360deg sweep can't be drawn as a single arc (start===end) - clamp fractionally short,
  // matching the original's `endAngle >= 360 -> endAngle = 359.9999` bugfix.
  const sweep = sweepAngle >= 360 ? 359.9999 : sweepAngle

  const start = rotate(0, -radius, radian(startAngle))
  const end = rotate(start.x, start.y, radian(sweep))
  const largeArc = sweep > 180 ? 1 : 0

  const startX = centerX + start.x
  const startY = centerY + start.y
  const endX = centerX + end.x
  const endY = centerY + end.y

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`
}

/** Position for a pie/donut slice's label, per `drawText()`'s "inside" branch. */
export function pieInsideLabelPosition(centerX: number, centerY: number, centerAngle: number, radius: number): { x: number; y: number } {
  return {
    x: centerX + Math.cos(radian(centerAngle)) * (radius / 2),
    y: centerY + Math.sin(radian(centerAngle)) * (radius / 2),
  }
}

/** Position for a pie/donut slice's outside label anchor point (before the leader-line offset), per `drawText()`'s "outside" branch. */
export function pieOutsideLabelAnchor(centerX: number, centerY: number, centerAngle: number, radius: number, rate: number): { x: number; y: number } {
  return {
    x: centerX + Math.cos(radian(centerAngle)) * (radius * rate),
    y: centerY + Math.sin(radian(centerAngle)) * (radius * rate),
  }
}

/** Result of {@link pieOutsideLabelDeclutter} for a single outside label. */
export interface OutsideLabelDeclutter {
  /** Replacement for the flat `theme('pieOuterLineRate')` passed into {@link pieOutsideLabelAnchor} - shrinks on repeated collisions. */
  rate: number
  /** Fade multiplier (`fill-opacity`/`stroke-opacity`) - fades on repeated collisions, independent of any `active` dim. */
  opacity: number
  /** Once `rate` drops to/below the original's hardcoded `1.2` floor, the original stops drawing the label at all. */
  hidden: boolean
}

// Ported verbatim from pie.js's `drawText()` "outside" branch constants: a hardcoded 2deg
// collision-gap threshold, a hardcoded 1.2 hide-floor (NOT relative to `baseRate` - a theme with
// `pieOuterLineRate <= 1.2` would hide every outside label, matching the original's actual,
// possibly-unintended behavior), a 5%-of-baseRate shrink step, and a flat 0.25 opacity step.
const OUTSIDE_LABEL_ANGLE_GAP = 2
const OUTSIDE_LABEL_HIDE_FLOOR = 1.2
const OUTSIDE_LABEL_RATE_STEP_FACTOR = 0.05
const OUTSIDE_LABEL_OPACITY_STEP = 0.25

/**
 * Outside-label collision avoidance, ported from `pie.js`'s `drawText()` stateful
 * `preAngle`/`preRate`/`preOpacity` walk. Sequential, not pairwise: each label is only compared
 * against the *previous label actually drawn* (an angle-close label that itself got hidden does
 * NOT reset the comparison point), so a long run of closely-spaced wedges keeps shrinking/fading
 * until labels start dropping out, then resumes at full size/opacity once a gap of >=2deg is
 * found.
 *
 * `centerAngles` must be in the same order `drawText()` would be called (draw/target order, same
 * as `usePieSlices()`'s returned slice order) - order is what the algorithm's state walk depends
 * on. Ported literally, including the original's odd initial condition: `preAngle` starts at
 * literal `0`, not "no previous label", so a first wedge whose `centerAngle` happens to land
 * within 2deg of 0 *does* count as a collision against nothing.
 */
export function pieOutsideLabelDeclutter(centerAngles: number[], baseRate: number): OutsideLabelDeclutter[] {
  let preAngle = 0
  let preRate = 0
  let preOpacity = 1

  return centerAngles.map((centerAngle) => {
    const diffAngle = Math.abs(centerAngle - preAngle)

    if (diffAngle < OUTSIDE_LABEL_ANGLE_GAP) {
      if (preRate === 0) preRate = baseRate
      preRate -= baseRate * OUTSIDE_LABEL_RATE_STEP_FACTOR
      preOpacity -= OUTSIDE_LABEL_OPACITY_STEP
    } else {
      preRate = baseRate
      preOpacity = 1
    }

    const hidden = preRate <= OUTSIDE_LABEL_HIDE_FLOOR
    if (!hidden) preAngle = centerAngle

    return { rate: preRate, opacity: preOpacity, hidden }
  })
}

/** Result of {@link pieInsideLabelDeclutter} for a single inside label. */
export interface InsideLabelDeclutter {
  /** `true` once this label sits close enough to the previously-drawn one to be illegible - the label is skipped entirely, matching how the outside case handles a full collision. */
  hidden: boolean
}

// An inside label's on-screen "footprint" has no real DOM measurement available to a pure
// composable (unlike ChartTooltip's getComputedTextLength() - see PORT_STATUS.md, item 4's
// "real tooltip text measurement" entry), so this approximates each label's width from its
// character count. The 0.57-per-char-per-fontSize factor isn't a guess: it's derived from that
// same item's own Chromium measurement of `getComputedTextLength()` on `"chrome: 64"` at
// fontSize 12 (68.3px measured / (10 chars * 12) = 0.569) - close enough to a typical sans-serif
// average glyph width to reuse here. A first attempt at this function used only `fontSize` as a
// line-height-only threshold (no text width at all) and looked plausible in isolation, but
// Playwright screenshots of the *existing, un-crowded-looking* full-size single-pie "inside" demo
// showed it was ALREADY silently overlapping ("edge: 5" under "firefox: 3", both short labels
// packed into a combined ~9% of the circle) - a real, previously-unnoticed bug this function
// should also catch, which a height-only threshold structurally cannot (two label *centers* can
// be many pixels apart vertically while their *text* - anchored `text-anchor="middle"`, i.e.
// centered on that point - still overlaps horizontally). Hence width, not just height.
const INSIDE_LABEL_CHAR_WIDTH_FACTOR = 0.57
// Floor so a very short label (e.g. a single digit) still claims a minimum sensible footprint.
const INSIDE_LABEL_MIN_WIDTH_FACTOR = 1.4

function estimateInsideLabelHalfWidth(text: string, fontSize: number): number {
  return Math.max(text.length * fontSize * INSIDE_LABEL_CHAR_WIDTH_FACTOR, fontSize * INSIDE_LABEL_MIN_WIDTH_FACTOR) / 2
}

/**
 * Inside-label collision avoidance for `showText="inside"` pie/donut labels. From-scratch, NOT a
 * port: `pie.js`'s `drawText()` never declutters inside labels at all (its `preAngle`/`preRate`/
 * `preOpacity` walk lives only in the "outside" branch - see `pieOutsideLabelDeclutter`'s doc
 * comment and PORT_STATUS.md), so there is no original algorithm to replicate here. Confirmed
 * visible bug this fixes: `PieGrid`/`DonutGrid`'s small cells put several inside labels close
 * enough on-screen to overlap illegibly, even though their center angles are tens of degrees
 * apart - `pieInsideLabelPosition`'s static `radius/2` placement was never wrong angle-wise, the
 * problem is purely that a small cell's radius turns a modest angular gap into only a few pixels
 * of separation (and, per the note above, the same math also catches a subtler pre-existing
 * overlap on full-size pies with several short, similarly-sized adjacent wedges).
 *
 * Same sequential-walk shape as `pieOutsideLabelDeclutter` (each label is compared only against
 * the previous label actually drawn, so a hidden label doesn't reset the comparison point and a
 * run of crowded labels keeps hiding until a wide-enough gap reopens), but the collision test
 * itself is pixel-aware rather than a fixed angular threshold: inside labels all sit on the same
 * circle of radius `labelRadius` (already halved by the caller, i.e. the actual value passed to
 * `pieInsideLabelPosition`), so a given angular gap corresponds to a chord (straight-line pixel)
 * distance of `2 * labelRadius * sin(gap/2)` between two labels' anchor points - treated as a
 * collision once that distance is less than the sum of both labels' estimated half-widths (a
 * standard circle-packing approximation: each label is treated as occupying a circle of radius
 * ~half its text width, and two circles overlap once their centers are closer than the sum of
 * their radii). The same angular gap that's harmless on a large single pie (chord distance far
 * exceeds either label's width) can be only a few pixels on a `PieGrid` cell. Unlike the outside
 * case there's no leader-line "rate" to shrink inward - an inside label's position is fixed at
 * `radius/2`, so there's nothing to nudge it into - so a colliding label is hidden outright rather
 * than faded first: a partially-transparent label directly overlapping another one doesn't
 * actually fix legibility (it's still overlapping glyphs), it just makes both harder to read, so
 * hiding is the more honest fix here.
 *
 * `centerAngles`/`labelTexts` must be in draw order (same as `usePieSlices()`'s returned slice
 * order, same index correspondence), same requirement as `pieOutsideLabelDeclutter`. Unlike that
 * function's ported `preAngle = 0` initial condition (a literal quirk of the original worth
 * preserving faithfully), this from-scratch function starts with "no previous label" (never
 * treats the first label as colliding against anything) since there's no original behavior to
 * match.
 */
export function pieInsideLabelDeclutter(centerAngles: number[], labelTexts: string[], labelRadius: number, fontSize: number): InsideLabelDeclutter[] {
  let preAngle: number | null = null
  let preHalfWidth = 0

  return centerAngles.map((centerAngle, i) => {
    const halfWidth = estimateInsideLabelHalfWidth(labelTexts[i], fontSize)
    let hidden = false

    if (preAngle !== null) {
      const gapAngle = Math.abs(centerAngle - preAngle)
      const chordDistance = 2 * labelRadius * Math.sin(radian(gapAngle) / 2)
      hidden = chordDistance < halfWidth + preHalfWidth
    }

    if (!hidden) {
      preAngle = centerAngle
      preHalfWidth = halfWidth
    }
    return { hidden }
  })
}
