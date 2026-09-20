import { div, fixed, nice } from './mathUtil'

/**
 * Linear + ordinal scale factories, ported from juijs-graph's `util/scale.js`. Plain functions
 * (not Vue reactivity primitives) - `useAxis` wraps them in `computed()`.
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
  let _domain = domain
  let _range = range
  let _clamp = clampToRange
  let _rangeBand: number | null = null

  const scale = ((x: number): number => {
    const domainMin = Math.min(_domain[0], _domain[1])
    const domainMax = Math.max(_domain[0], _domain[1])
    const distDomain = _domain[1] - _domain[0]

    if (domainMax < x) {
      if (_clamp) return scale(domainMax)
      const rangeMax = Math.max(_range[0], _range[1])
      const rangeMin = Math.min(_range[0], _range[1])
      const rate = distDomain === 0 ? 0 : Math.abs(rangeMax - rangeMin) / distDomain
      return _range[0] + Math.abs(x - _domain[0]) * rate
    } else if (domainMin > x) {
      if (_clamp) return scale(domainMin)
      const rangeMax = Math.max(_range[0], _range[1])
      const rangeMin = Math.min(_range[0], _range[1])
      const rate = distDomain === 0 ? 0 : Math.abs(rangeMax - rangeMin) / distDomain
      return _range[0] - Math.abs(x - _domain[0]) * rate
    } else {
      const pos = distDomain === 0 ? 0 : (x - _domain[0]) / distDomain
      return _range[0] + (_range[1] - _range[0]) * pos
    }
  }) as LinearScale

  Object.defineProperty(scale, 'domain', {
    get: () => _domain,
    set: (v: [number, number]) => {
      _domain = v
    },
  })
  Object.defineProperty(scale, 'range', {
    get: () => _range,
    set: (v: [number, number]) => {
      _range = v
    },
  })
  Object.defineProperty(scale, 'clamp', {
    get: () => _clamp,
    set: (v: boolean) => {
      _clamp = v
    },
  })

  scale.min = () => Math.min(_domain[0], _domain[1])
  scale.max = () => Math.max(_domain[0], _domain[1])

  scale.invert = (y: number) => {
    const inverse = createLinearScale([_range[0], _range[1]], [_domain[0], _domain[1]])
    return inverse(y)
  }

  scale.ticks = (count = 10, isNice = false): number[] => {
    if (_domain[0] === 0 && _domain[1] === 0) return []

    const obj = nice(_domain[0], _domain[1], count || 10, isNice)
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

    if (_domain[0] > _domain[1]) {
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
  const step = domain.length
  const unit = (interval[1] - interval[0] - padding) / step

  const range: number[] = []
  for (let i = 0; i < domain.length; i++) {
    range[i] = i === 0 ? interval[0] + padding / 2 + unit / 2 : range[i - 1] + unit
  }

  const scale = ((value: string | number): number | null => {
    if (typeof value === 'string') {
      const index = domain.indexOf(value)
      return index > -1 ? range[index] : null
    }

    return range[value] ?? null
  }) as OrdinalScale

  scale.domain = domain
  scale.range = range
  scale.rangeBand = () => unit

  scale.invert = (x: number): number => {
    const min = Math.min(range[0], range[1]) - unit / 2
    const clampedX = x < min ? min : x
    return Math.floor(Math.abs(clampedX - min) / unit)
  }

  return scale
}

/** Re-exported for useAxis's range-domain algorithm, which needs the same decimal-safe division. */
export { div }
