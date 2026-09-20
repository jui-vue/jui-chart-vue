/**
 * Internal math helpers, mostly thin call-throughs to `jui-graph-ts`'s real, from-scratch-ported
 * `mathUtil` namespace (`jui-graph-ts/src/util/math.ts`) as of Phase G's Batch 1 migration. Not
 * part of the public API (not re-exported from `src/index.ts`) - shared by useScale (tick
 * spacing) and useAxis (the "nice domain" algorithm from grid/range.js), and by the pie/donut
 * angle math.
 *
 * `getFixed`/`fixed`/`div`/`radian`/`rotate`/`scaleValue` below delegate to jui-graph-ts's real
 * `mathUtil` (confirmed byte-identical logic by direct comparison against this file's prior
 * hand-port, which the two projects had already cross-checked bidirectionally per PORT_STATUS.md's
 * Phase G writeup). `nice()` is the one deliberate exception - kept as this project's own,
 * independent implementation. See its own doc comment below for why: jui-graph-ts's
 * `mathUtil.nice()` faithfully preserves a real upstream bug (its `isNice: true` branch throws
 * `ReferenceError: niceFraction is not defined` - confirmed by actually calling it), which this
 * file's own `nice()` does not reproduce - importing the throwing version would be a real
 * regression for `useScale.ts`'s `createLinearScale.ticks(count, true)`, not a safe swap.
 */

import { mathUtil as jgMathUtil } from 'jui-graph-ts'

/** Number of decimal places needed to represent `a` or `b` exactly, whichever needs more. */
export function getFixed(a: number, b: number): number {
  return jgMathUtil.getFixed(a, b)
}

export interface FixedMath {
  (value: number): number
  plus(a: number, b: number): number
  minus(a: number, b: number): number
}

/**
 * Ported from math.js's `fixed()`: rounds arithmetic to the decimal precision of `fixedValue`,
 * avoiding floating point drift (e.g. 0.1 + 0.2) when stepping a domain by a fractional unit.
 * Delegates to jui-graph-ts's real `mathUtil.fixed()` - its return value has extra `multi`/`div`/
 * `remain` methods this project never needed (and whose `.div` preserves an unrelated upstream
 * `TypeError`, see jui-graph-ts's `util/math.ts` header comment), harmlessly structurally
 * compatible with this file's narrower `FixedMath` type.
 */
export function fixed(fixedValue: number): FixedMath {
  return jgMathUtil.fixed(fixedValue)
}

export interface NiceResult {
  min: number
  max: number
  range: number
  spacing: number
}

/**
 * Ported from math.js's `nice()`. When `isNice` is true, rounds the tick spacing to a "nice"
 * 1/2/5/10 * 10^n number (the classic Talbot/Heckbert-style algorithm) instead of dividing the
 * range evenly by `ticks`.
 *
 * **Deliberately NOT delegated to jui-graph-ts's `mathUtil.nice()`** (unlike every other function
 * in this file) - jui-graph-ts's version faithfully preserves an upstream bug where the
 * `isNice: true` branch's inner `niceNum()` always throws `ReferenceError: niceFraction is not
 * defined` (an undeclared-identifier typo in the original engine; see jui-graph-ts's
 * `util/math.ts` header comment, quirk 1). Confirmed directly: `jgMathUtil.nice(0, 97, 5, true)`
 * throws, while this file's own `nice(0, 97, 5, true)` correctly returns
 * `{min: 0, max: 100, spacing: 20, range: 100}` - `useScale.ts`'s `createLinearScale.ticks(count,
 * true)` depends on that working result (see its own spec: "rounds to nice 1/2/5/10 spacing when
 * isNice is true"). Swapping in the throwing version would be a real behavior regression, not a
 * wash - this implementation is kept as this project's own maintained fix, exactly as the Phase G
 * plan called for.
 */
export function nice(min: number, max: number, ticks: number, isNice = false): NiceResult {
  const _min = min > max ? max : min
  const _max = min > max ? min : max

  function niceNum(range: number, round: boolean): number {
    const exponent = Math.floor(Math.log(range) / Math.LN10)
    const fraction = range / Math.pow(10, exponent)
    let niceFraction: number

    if (round) {
      if (fraction < 1.5) niceFraction = 1
      else if (fraction < 3) niceFraction = 2
      else if (fraction < 7) niceFraction = 5
      else niceFraction = 10
    } else {
      if (fraction <= 1) niceFraction = 1
      else if (fraction <= 2) niceFraction = 2
      else if (fraction <= 5) niceFraction = 5
      else niceFraction = 10
    }

    return niceFraction * Math.pow(10, exponent)
  }

  const range = isNice ? niceNum(_max - _min, false) : _max - _min
  const spacing = isNice ? niceNum(range / ticks, true) : range / ticks
  const niceMin = isNice ? Math.floor(_min / spacing) * spacing : _min
  const niceMax = isNice ? Math.floor(_max / spacing) * spacing : _max

  return { min: niceMin, max: niceMax, range, spacing }
}

/** a / b using decimal-safe arithmetic, mirroring math.js's `div()` (used by range.js's unit calc). */
export function div(a: number, b: number): number {
  return jgMathUtil.div(a, b)
}

export function radian(degree: number): number {
  return jgMathUtil.radian(degree)
}

/** Rotates point (x,y) by `radians` around the origin. */
export function rotate(x: number, y: number, radians: number): { x: number; y: number } {
  return jgMathUtil.rotate(x, y, radians)
}

/**
 * Ported from math.js's `scaleValue()` - linear interpolation of `value` from `[minValue,
 * maxValue]` into `[minScale, maxScale]` (no clamping, matching the original: values outside
 * `[minValue, maxValue]` extrapolate). `minValue === maxValue` is special-cased to `0` (matching
 * the original's `minValue = (minValue == maxValue) ? 0 : minValue` guard, avoiding a `0/0`
 * divide - not obviously "correct" in general, just preserved). Used by `usePolygon3d.ts`'s
 * perspective-depth scaling.
 */
export function scaleValue(value: number, minValue: number, maxValue: number, minScale: number, maxScale: number): number {
  return jgMathUtil.scaleValue(value, minValue, maxValue, minScale, maxScale)
}
