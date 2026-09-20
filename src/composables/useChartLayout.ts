import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import { useAxis, type AxisResult } from './useAxis'
import type { AxisConfig, ChartPadding, DataRow } from '../types'

// Constant refs identifying which axis a `useAxis()` call is for - see `resolveAxisOrient`.
// Shared module-level singletons are safe: both are read-only and never mutated.
const X_KIND = shallowRef<'x'>('x')
const Y_KIND = shallowRef<'y'>('y')

export interface PlotArea {
  x: number
  y: number
  x2: number
  y2: number
  width: number
  height: number
}

export interface ChartLayout {
  padding: ComputedRef<ChartPadding>
  area: ComputedRef<PlotArea>
  axisX: ComputedRef<AxisResult>
  axisY: ComputedRef<AxisResult>
}

/**
 * Shared padding/plot-area/axis computation used by every axis-based chart component
 * (ChartBase itself, plus LineChart/AreaChart/BarChart, which call this directly rather than
 * reading it back out of ChartBase's slot, so their series math and ChartBase's axis rendering
 * are two independent computations over the same reactive inputs - not a parent/child data
 * dependency). Not axis-grid-specific beyond that: PieChart/DonutChart don't use this.
 */
export function useChartLayout(
  data: Ref<DataRow[]>,
  axisXConfig: Ref<AxisConfig>,
  axisYConfig: Ref<AxisConfig>,
  width: Ref<number>,
  height: Ref<number>,
  paddingOverride: Ref<Partial<ChartPadding> | undefined>,
): ChartLayout {
  const padding = computed<ChartPadding>(() => ({
    top: paddingOverride.value?.top ?? 20,
    right: paddingOverride.value?.right ?? 24,
    bottom: paddingOverride.value?.bottom ?? 32,
    left: paddingOverride.value?.left ?? 48,
  }))

  const area = computed<PlotArea>(() => {
    const p = padding.value
    return {
      x: p.left,
      y: p.top,
      x2: width.value - p.right,
      y2: height.value - p.bottom,
      width: width.value - p.left - p.right,
      height: height.value - p.top - p.bottom,
    }
  })

  // Pixel interval each axis's scale maps its domain onto, ported from range.js's
  // `drawBefore()`/block.js's `drawBefore()`: a "range" (linear/value) axis reverses the interval
  // when it's the y-axis (`orient == "left" || "right"`, which is always true for y here - x is
  // always top/bottom) so values increase upward instead of downward; a "block" (ordinal/
  // category) axis is *never* reversed, on x or y - domain order always runs start-to-end
  // left-to-right or top-to-bottom, regardless of which axis it's bound to. Note this depends on
  // the axis's `type` (block vs range), not its `orient` (top/bottom/left/right) - orient only
  // moves where the axis chrome (baseline/labels) is drawn, handled in ChartBase.
  const xInterval = computed<[number, number]>(() => [area.value.x, area.value.x2])
  const yInterval = computed<[number, number]>(() => {
    const [start, end] = [area.value.y, area.value.y2]
    return axisYConfig.value.type === 'range' ? [end, start] : [start, end]
  })

  const axisX = useAxis(data, axisXConfig, xInterval, X_KIND)
  const axisY = useAxis(data, axisYConfig, yInterval, Y_KIND)

  return { padding, area, axisX, axisY }
}
