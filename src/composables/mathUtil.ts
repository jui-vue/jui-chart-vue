/**
 * Internal math helpers ported from juijs-graph's `util/math.js`. Not part of the public API
 * (not re-exported from `src/index.ts`) - shared by useScale (tick spacing) and useAxis (the
 * "nice domain" algorithm from grid/range.js), and by the pie/donut angle math.
 */

/** Number of decimal places needed to represent `a` or `b` exactly, whichever needs more. */
export function getFixed(a: number, b: number): number {
  const aLen = (`${a}`.split('.')[1] ?? '').length
  const bLen = (`${b}`.split('.')[1] ?? '').length
  return aLen > bLen ? aLen : bLen
}

export interface FixedMath {
  (value: number): number
  plus(a: number, b: number): number
  minus(a: number, b: number): number
}

/**
 * Ported from math.js's `fixed()`: rounds arithmetic to the decimal precision of `fixedValue`,
 * avoiding floating point drift (e.g. 0.1 + 0.2) when stepping a domain by a fractional unit.
 */
export function fixed(fixedValue: number): FixedMath {
  const fixedNumber = getFixed(fixedValue, 0)
  const pow = Math.pow(10, fixedNumber)

  const f = ((value: number) => Math.round(value * pow) / pow) as FixedMath
  f.plus = (a, b) => Math.round(a * pow + b * pow) / pow
  f.minus = (a, b) => Math.round(a * pow - b * pow) / pow

  return f
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
  const pow = Math.pow(10, getFixed(a, b))
  const result = (a * pow) / (b * pow)
  const pow2 = Math.pow(10, getFixed(result, 0))
  return Math.round(result * pow2) / pow2
}

export function radian(degree: number): number {
  return (degree * Math.PI) / 180
}

/** Rotates point (x,y) by `radians` around the origin. */
export function rotate(x: number, y: number, radians: number): { x: number; y: number } {
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  }
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
  const _minValue = minValue === maxValue ? 0 : minValue
  const per = (value - _minValue) / (maxValue - _minValue)
  return minScale + (maxScale - minScale) * per
}
