<script setup lang="ts">
// Ported (adapted) from `chart.widget.legend`. See `ChartLegend.vue`'s own header comment for the
// full architectural reasoning (explicit `items` prop instead of sibling-brush introspection).
//
// Click-to-toggle wiring: `ChartLegend` emits `toggle` (source: the click handler inside
// `getLegendIcon()`) with `{ label, index }`; this page owns `hiddenSeries` (the "which labels are
// off" state source kept as `columns[brush.index][key]`) and does two things with it on toggle -
// (1) passes it back to `ChartLegend` as `hidden` so the swatch/text dim correctly, and (2) filters
// `LineChart`'s own `target` array by it, so a toggled-off series is removed from the chart
// entirely. That second step is deliberately NOT a new `hide`-per-series prop on `LineChart` -
// `ScatterChart`/`LineChart`'s existing `hide` prop (checked before assuming otherwise) is a
// whole-chart boolean, not a per-series toggle, so it doesn't fit here. Filtering `target` instead
// is also a closer semantic match to source's own `changeTargetOption()`, which works by rewriting
// the brush's `target` array to only the still-enabled keys, not by dimming/hiding in place.
import { computed, ref } from 'vue'
import ChartLegend from '../components/ChartLegend.vue'
import LineChart from '../components/LineChart.vue'
import BarChart from '../components/BarChart.vue'
import { useTheme } from '../composables/useTheme'
import type { AxisConfig, DataRow } from '../types'

const data: DataRow[] = [
  { month: 'Jan', visits: 120, signups: 30, refunds: 8 },
  { month: 'Feb', visits: 132, signups: 45, refunds: 12 },
  { month: 'Mar', visits: 101, signups: 28, refunds: 6 },
  { month: 'Apr', visits: 154, signups: 52, refunds: 15 },
  { month: 'May', visits: 190, signups: 61, refunds: 9 },
  { month: 'Jun', visits: 176, signups: 58, refunds: 11 },
]

const allTargets = ['visits', 'signups', 'refunds']
const axisX: AxisConfig = { type: 'block', domain: 'month' }
const axisY: AxisConfig = { type: 'range', domain: allTargets, step: 4 }

const { color: themeColor } = useTheme(ref('classic'))
const legendItems = allTargets.map((label, i) => ({ label, color: themeColor(i) }))

// --- Section 1: basic horizontal legend, non-toggleable (default align="center") ---

// --- Section 2: wrapping legend (narrow width forces multiple rows) ---
const manyItems = [
  { label: 'north-america', color: themeColor(0) },
  { label: 'south-america', color: themeColor(1) },
  { label: 'europe', color: themeColor(2) },
  { label: 'asia-pacific', color: themeColor(3) },
  { label: 'africa', color: themeColor(4) },
  { label: 'middle-east', color: themeColor(5) },
]

// --- Section 3: vertical legend beside a chart ---

// --- Section 4: click-to-toggle, wired to LineChart's own `target` prop ---
const hiddenSeries = ref<string[]>([])
const visibleTargets = computed(() => allTargets.filter((t) => !hiddenSeries.value.includes(t)))

function onToggle({ label }: { label: string; index: number }) {
  hiddenSeries.value = hiddenSeries.value.includes(label) ? hiddenSeries.value.filter((l) => l !== label) : [...hiddenSeries.value, label]
}
</script>

<template>
  <div>
    <h2>Legend</h2>
    <p class="desc">
      Ported (adapted) from <code>src/widget/legend.js</code>. See <code>ChartLegend.vue</code>'s header comment for why this port takes an
      explicit <code>items: {{ '{' }}label, color{{ '}' }}[]</code> prop instead of introspecting a sibling brush the way source does - this
      port's chart types are independent components, not sub-brushes of one shared chart instance.
    </p>

    <h3>Basic legend (orient="horizontal", align="center", default)</h3>
    <BarChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="allTargets" />
    <ChartLegend :items="legendItems" :width="600" data-testid="legend-basic" />

    <h3>Wrapping (narrow width forces multiple rows)</h3>
    <p class="desc">Ported from source's row-wrap in <code>draw()</code> (orient <code>"top"</code>/<code>"bottom"</code>): items flow left-to-right and wrap to a new row once the next item would cross the box's own <code>width</code>.</p>
    <ChartLegend :items="manyItems" :width="220" align="start" data-testid="legend-wrapping" />

    <h3>Vertical (orient="vertical")</h3>
    <p class="desc">Ported from source's single-column stacking (orient <code>"left"</code>/<code>"right"</code>).</p>
    <div style="display: flex; gap: 16px; align-items: flex-start">
      <BarChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="allTargets" :width="420" />
      <ChartLegend :items="legendItems" orient="vertical" :height="400" align="center" :width="140" data-testid="legend-vertical" />
    </div>

    <h3>Click-to-toggle (toggleable, wired to LineChart's own `target` prop)</h3>
    <p class="desc">
      Ported from source's <code>filter: true</code> mode. Click a swatch/label below to toggle that series - the legend dims it (swatch/text
      recolor to <code>legendSwitchDisableColor</code>) and <code>LineChart</code>'s <code>target</code> array is filtered to drop it entirely
      (rather than hiding it in place), matching how source's <code>changeTargetOption()</code> rewrites the brush's own <code>target</code>).
    </p>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="visibleTargets" show-points />
    <ChartLegend :items="legendItems" toggleable :hidden="hiddenSeries" :width="600" data-testid="legend-toggle" @toggle="onToggle" />
    <p class="desc" data-testid="hidden-series">Hidden: <code>{{ hiddenSeries.length ? hiddenSeries.join(', ') : '(none)' }}</code></p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
