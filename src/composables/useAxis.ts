import { computed, type ComputedRef, type Ref } from 'vue'
import { createLinearScale, createOrdinalScale, type LinearScale, type OrdinalScale } from './useScale'
import { div, fixed } from './mathUtil'
import type { AxisConfig, AxisOrient, DataRow, RangeAxisConfig } from '../types'

/** Which axis a config is bound to - governs which pair of `AxisOrient` values is valid. */
export type AxisRole = 'x' | 'y'

/**
 * Ported from `chart.axis`'s `drawGridType()` orient coercion: an x-axis config only ever
 * resolves to `"top"`/`"bottom"` (default `"bottom"`), a y-axis config only to `"left"`/`"right"`
 * (default `"left"`) - any other/omitted value falls back to the axis's default side.
 */
export function resolveAxisOrient(orient: AxisOrient | undefined, kind: AxisRole): AxisOrient {
  return kind === 'x' ? (orient === 'top' ? 'top' : 'bottom') : orient === 'right' ? 'right' : 'left'
}

/**
 * Turns a "block" (ordinal) or "range" (linear, nice-domained) axis config into a scale + tick
 * list, ported from juijs-graph's `grid/block.js` and `grid/range.js`. `interval` is the pixel
 * span the axis is drawn across, already direction-adjusted by the caller (`useChartLayout`'s
 * `xInterval`/`yInterval` - see its doc comment: reversed for a "range" y-axis, never reversed
 * otherwise). `kind` says which axis (`x`/`y`) this config is bound to, used only to resolve the
 * `orient` the returned `AxisResult` carries (see `resolveAxisOrient`) - it doesn't affect the
 * scale/tick math itself.
 */

export interface BlockAxisResult {
  type: 'block'
  scale: OrdinalScale
  /** Category labels, in domain order. */
  ticks: (string | number)[]
  /** Pixel position of each tick (same order as `ticks`). */
  values: number[]
  band: number
  /** Resolved (defaulted) edge this axis is drawn against - see `AxisOrient`. */
  orient: AxisOrient
  /** Resolved (defaulted `false`) `axis.x.line`/`axis.y.line` - see `BlockAxisConfig`/`RangeAxisConfig`. */
  line: boolean
  /** Resolved (defaulted `false`) `axis.x.hide`/`axis.y.hide` - see `BlockAxisConfig`/`RangeAxisConfig`. */
  hide: boolean
}

export interface RangeAxisResult {
  type: 'range'
  scale: LinearScale
  /** Numeric tick values. */
  ticks: number[]
  /** Pixel position of each tick (same order as `ticks`). */
  values: number[]
  band: number
  /** Resolved (defaulted) edge this axis is drawn against - see `AxisOrient`. */
  orient: AxisOrient
  /** Resolved (defaulted `false`) `axis.x.line`/`axis.y.line` - see `BlockAxisConfig`/`RangeAxisConfig`. */
  line: boolean
  /** Resolved (defaulted `false`) `axis.x.hide`/`axis.y.hide` - see `BlockAxisConfig`/`RangeAxisConfig`. */
  hide: boolean
}

export type AxisResult = BlockAxisResult | RangeAxisResult

function resolveBlockDomain(data: DataRow[], domain: string | string[]): (string | number)[] {
  if (Array.isArray(domain)) return domain
  return data.map((row) => row[domain])
}

/**
 * Ported from `chart.grid.range`'s `initDomain()`: folds min/max out of the data, then expands
 * the domain outward to unit-aligned bounds anchored at 0 (the "nice domain" that guarantees
 * a bar/column chart's zero baseline lands exactly on a grid line).
 */
export function computeRangeDomain(data: DataRow[], config: RangeAxisConfig): { domain: [number, number]; step: number } {
  const step = config.step ?? 10
  const valueList: number[] = []

  if (typeof config.domain === 'function') {
    let pushedZero = false
    for (const row of data) {
      const value = config.domain(row)
      if (Array.isArray(value)) {
        valueList.push(Math.max(...value))
        valueList.push(Math.min(...value))
      } else {
        valueList.push(value)
        if (!pushedZero) {
          valueList.push(0)
          pushedZero = true
        }
      }
    }
  } else if (Array.isArray(config.domain)) {
    for (const row of data) {
      const values = config.domain.map((key) => row[key])
      valueList.push(Math.max(...values))
      valueList.push(Math.min(...values))
    }
  } else {
    const field = config.domain
    for (const row of data) {
      const value = row[field]
      if (Array.isArray(value)) {
        valueList.push(Math.max(...value))
        valueList.push(Math.min(...value))
      } else {
        valueList.push(value)
        valueList.push(0)
      }
    }
  }

  const tempMin = Math.min(...valueList)
  const tempMax = Math.max(...valueList)

  let min = config.min !== undefined && config.min <= tempMin ? config.min : tempMin
  let max = config.max !== undefined && config.max >= tempMax ? config.max : tempMax

  let unit: number
  if (typeof config.unit === 'number') {
    unit = config.unit
  } else {
    if (min > 0) min = Math.floor(min)
    unit = div(max - min, step)

    if (unit > 1) {
      unit = Math.ceil(unit)
    } else if (unit > 0 && unit < 1) {
      unit = div(Math.ceil(unit * 10), 10)
    }
  }

  let domain: [number, number]
  let domainStep: number

  if (unit === 0) {
    domain = [0, 0]
    domainStep = 0
  } else {
    const fixedMath = fixed(unit)
    let start = 0
    let guard = 0
    while (start < max && guard++ < 100000) {
      start = fixedMath.plus(start, unit)
    }

    let end = start
    guard = 0
    while (end > min && guard++ < 100000) {
      end = fixedMath.minus(end, unit)
    }

    domain = [end, start]
    domainStep = Math.abs(end - start) / unit
  }

  if (config.reverse) {
    domain = [domain[1], domain[0]]
  }

  return { domain, step: domainStep }
}

export function useAxis(
  data: Ref<DataRow[]>,
  config: Ref<AxisConfig>,
  interval: Ref<[number, number]>,
  kind: Ref<AxisRole>,
): ComputedRef<AxisResult> {
  return computed<AxisResult>(() => {
    const cfg = config.value
    const [start, end] = interval.value
    const orient = resolveAxisOrient(cfg.orient, kind.value)
    const line = cfg.line ?? false
    const hide = cfg.hide ?? false

    if (cfg.type === 'block') {
      let domain = resolveBlockDomain(data.value, cfg.domain)
      if (cfg.reverse) domain = [...domain].reverse()

      const scale = createOrdinalScale(domain, [start, end])
      return {
        type: 'block',
        scale,
        ticks: domain,
        values: scale.range,
        band: scale.rangeBand(),
        orient,
        line,
        hide,
      }
    }

    const { domain, step } = computeRangeDomain(data.value, cfg)
    const scale = createLinearScale(domain, [start, end], cfg.clamp ?? true)
    const ticks = scale.ticks(step, cfg.nice ?? false)
    const values = ticks.map((t) => scale(t))

    return {
      type: 'range',
      scale,
      ticks,
      values,
      band: 0,
      orient,
      line,
      hide,
    }
  })
}
