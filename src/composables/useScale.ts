import { linearScaleUtil, ordinalScaleUtil } from 'jui-graph-ts'
import { div, fixed, nice } from './mathUtil'

/**
 * Linear + ordinal scale factories, ported from juijs-graph's `util/scale.js`. Plain functions
 * (not Vue reactivity primitives) - `useAxis` wraps them in `computed()`.
 *
 * Phase G migration: `createLinearScale`/`createOrdinalScale` now delegate their core computation
 * to jui-graph-ts's real `linearScaleUtil.linear()`/`ordinalScaleUtil.ordinal()` (`util/scale/
 * linear.ts`/`util/scale/ordinal.ts`) - **not** the collision-prone `scaleUtil` (`util/scale.ts`)
 * namespace, which has its own separately-duplicated, subtly different `linear()`/`ordinal()` (see
 * jui-graph-ts's `util/scale.ts` header comment - its embedded `ordinal().invert()` is a simpler,
 * non-`rangePoints`-aware variant that does NOT match this file's `createOrdinalScale.invert()`).
 * Both this file's own exported factory signatures (constructor-arg style: `createLinearScale
 * (domain, range, clamp)`) stay unchanged for every existing call site - only the internals adapt
 * to the jui-graph-ts builder-style API (`.domain(values)`/`.range(values)`/`.clamp(isClamp)`).
 *
 * One deliberate exception: `createLinearScale.ticks()` does NOT delegate to jui-graph-ts's own
 * `linear().ticks()`, even though the rest of the scale does. jui-graph-ts's `ticks()` internally
 * calls ITS OWN `mathUtil.nice()`, which (confirmed by direct testing) throws `ReferenceError:
 * niceFraction is not defined` whenever `isNice: true` - a faithfully-preserved upstream bug (see
 * `mathUtil.ts`'s own `nice()` doc comment for the full writeup). This project's local `nice()`
 * does not have that bug, so `ticks()` stays a local implementation built on the (safe, jui-graph-ts
 * -delegated) `fixed()` and the (deliberately local, non-delegated) `nice()` from `mathUtil.ts` -
 * unchanged in logic from before this migration, just reading the domain through the new delegated
 * core. `useScale.spec.ts`'s "rounds to nice 1/2/5/10 spacing when isNice is true" test is exactly
 * what would break if `ticks()` were delegated wholesale - this is a real discrepancy the Phase G
 * plan's `mathUtil.ts` bullet flagged in principle but didn't explicitly connect to this file.
 */

export interface LinearScale {
  (value: number): number
  domain: [number, number]
  range: [number, number]
  clamp: boolean
  min(): number
  max(): number
  invert(y: number): number
  /** Ported from linear.ticks(count, isNice) - always the non-reversed code path (reverse=false in the original was only used by unported 3d/z-axis code). */
  ticks(count?: number, isNice?: boolean): number[]
  rangeBand(): number
}

/**
 * Ported from `util.scale.linear()`. `domain`/`range` may be given in either order (jui-chart
 * reverses `range` for a "left"/"right" oriented axis) - values outside the domain extrapolate
 * unless `clampToRange` is set, matching the original's slightly asymmetric extrapolation.
 */
export function createLinearScale(domain: [number, number], range: [number, number], clampToRange = false): LinearScale {
  // Core interpolation/min/max/invert/clamp delegate to jui-graph-ts's real `linearScaleUtil.linear()`
  // (builder-style API: `.domain(values)`/`.range(values)`/`.clamp(isClamp)`, called in the same
  // order the original `util.scale.linear()` chain uses - domain before range, since `.range()`
  // computes its own `rate` from the domain span already set by `.domain()`).
  const core = linearScaleUtil.linear()
  core.domain([domain[0], domain[1]])
  core.range([range[0], range[1]])

  // jui-graph-ts's `.clamp(isClamp)` is a write-only setter (calling it with no args resets to
  // `false`) - track the current value locally so `scale.clamp` stays a readable/writable property,
  // matching this file's own `LinearScale.clamp: boolean` shape.
  let _clamp = clampToRange
  core.clamp(_clamp)

  let _rangeBand: number | null = null

  const scale = ((x: number): number => core(x)) as LinearScale

  Object.defineProperty(scale, 'domain', {
    get: () => core.domain() as [number, number],
    set: (v: [number, number]) => {
      core.domain([v[0], v[1]])
    },
  })
  Object.defineProperty(scale, 'range', {
    get: () => core.range() as [number, number],
    set: (v: [number, number]) => {
      core.range([v[0], v[1]])
    },
  })
  Object.defineProperty(scale, 'clamp', {
    get: () => _clamp,
    set: (v: boolean) => {
      _clamp = v
      core.clamp(v)
    },
  })

  scale.min = () => core.min()
  scale.max = () => core.max()

  scale.invert = (y: number) => core.invert(y)

  // NOT delegated to `core.ticks()` - see this file's header comment for why (jui-graph-ts's own
  // `ticks()` inherits a throwing `nice(isNice: true)` bug this project's local `nice()` avoids).
  // Otherwise unchanged from before this migration - reads the domain through the delegated core,
  // steps with the (now jui-graph-ts-delegated) `fixed()`, and reuses `scale(x)` (which now calls
  // through to `core`) for the rangeBand pixel-distance measurement.
  scale.ticks = (count = 10, isNice = false): number[] => {
    const [d0, d1] = core.domain() as [number, number]
    if (d0 === 0 && d1 === 0) return []

    const obj = nice(d0, d1, count || 10, isNice)
    const arr: number[] = []

    let start = obj.min
    const end = obj.max
    const unit = obj.spacing
    const fixedMath = fixed(unit)

    while (start <= end) {
      arr.push(start)
      start = fixedMath.plus(start, unit)
    }

    if (arr[arr.length - 1] !== end && start > end) {
      arr.push(end)
    }

    if (d0 > d1) {
      arr.reverse()
    }

    if (arr.length > 1) {
      const first = scale(arr[0])
      const second = scale(arr[1])
      _rangeBand = Math.abs(second - first)
    } else {
      _rangeBand = 0
    }

    return arr
  }

  scale.rangeBand = () => _rangeBand ?? 0

  return scale
}

export interface OrdinalScale {
  (value: string | number): number | null
  domain: (string | number)[]
  range: number[]
  rangeBand(): number
  /** Ported from `util.scale.ordinal()`'s `invert()`, `rangePoints`-mode branch only (the only
   * mode `createOrdinalScale` produces - `rangeBands` is intentionally not ported, see this
   * file's own doc comment). Recovers the (floored) domain INDEX for a pixel position, not a
   * domain value/label - used by `pin.js`'s `axis.x.invert(d)` call (see `usePin.ts`). Faithfully
   * ports the original's own `Math.min(_range[0], _range[1])` (only the first two range entries,
   * not a full-array min) - harmless for a real (monotonically increasing) range, but produces
   * `NaN` for a 1-item domain (`range[1]` is `undefined`) exactly like the original does. */
  invert(x: number): number
}

/**
 * Ported from `util.scale.ordinal().rangePoints()`. Evenly places `domain.length` points
 * within `interval`, each `unit` apart, centered with half a unit of padding on each end -
 * `rangeBands()` (used by unported brush types) is intentionally not ported.
 */
export function createOrdinalScale(domain: (string | number)[], interval: [number, number], padding = 0): OrdinalScale {
  // Delegates to jui-graph-ts's real `ordinalScaleUtil.ordinal()`, specifically its
  // `.rangePoints()` mode - see this file's header comment for why `ordinalScaleUtil` (not the
  // colliding `scaleUtil.ordinal()`) is the correct counterpart: its `invert()` has the same
  // `_isRangePoints`-aware branch this file's own `invert()` below was ported from (a fuller
  // implementation than `scaleUtil`'s embedded, simpler `ordinal().invert()`).
  const core = ordinalScaleUtil.ordinal()
  core.domain(domain)
  core.rangePoints(interval, padding)

  const scale = ((value: string | number): number | null => core(value)) as OrdinalScale

  scale.domain = core.domain() as (string | number)[]
  scale.range = core.range()
  scale.rangeBand = () => core.rangeBand()

  scale.invert = (x: number): number => core.invert(x)

  return scale
}

/** Re-exported for useAxis's range-domain algorithm, which needs the same decimal-safe division. */
export { div }
