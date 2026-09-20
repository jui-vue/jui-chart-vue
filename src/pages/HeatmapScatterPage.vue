<script setup lang="ts">
// heatmapscatter.js: a coarse 2D density grid over ordinary (row, target) scatter points, one
// <rect> per OCCUPIED bucket, colored/keyed by whichever point lands there FIRST - see
// `HeatmapScatterChart.vue`'s header comment for the full source derivation (including the
// deliberate x-axis substitution this port makes for the source's date-type axis).
import { ref } from 'vue'
import HeatmapScatterChart from '../components/HeatmapScatterChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

// 30 one-minute time ticks (09:00-09:29) - a block x-axis substituting for the source's own
// date-type axis (see header comment). xInterval=5 groups 5 consecutive ticks per bucket column
// (6 columns total).
const timeLabels = Array.from({ length: 30 }, (_, i) => `09:${String(i).padStart(2, '0')}`)
const axisX: AxisConfig = { type: 'block', domain: timeLabels }
const axisY: AxisConfig = { type: 'range', domain: ['delayA', 'delayB'], min: 0, max: 1000, unit: 100 }

// Deterministic (not random) transaction-delay-style sample data, two targets - deliberately
// crafted so rows 6 and 7 (both column floor(6/5)=1 / floor(7/5)=1... see note below) land in the
// SAME bucket via different targets, to exercise the "first point wins" quirk in the Playwright
// verification pass.
const scatterData: DataRow[] = timeLabels.map((time, i) => ({
  time,
  delayA: 100 + (i % 6) * 150, // cycles 100,250,400,550,700,850
  delayB: 900 - (i % 5) * 150, // cycles 900,750,600,450,300
}))

const lastEvent = ref('(none yet)')
function onScatterEvent(type: string, payload: ChartElementEventPayload) {
  lastEvent.value = `${type} dataIndex=${payload.dataIndex} dataKey=${payload.dataKey} data=${JSON.stringify(payload.data)}`
}
</script>

<template>
  <div>
    <h2>heatmapscatter.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - no relation to <code>heatmap.js</code>. Every point is computed exactly
      like <code>ScatterChart</code>'s own points, then binned into a coarse <code>xDist x yDist</code> grid - one rect per OCCUPIED bucket, not one
      per point. A bucket's color/forwarded event payload is always its FIRST point (a faithfully-preserved source quirk - later points landing in
      an already-occupied bucket are dropped from what's rendered, confirmed from <code>createScatter()</code>'s own
      <code>tableObj.element == null</code> guard).
    </p>

    <h3>Transaction-delay-style density grid, 2 targets (<code>xInterval=5</code> ticks/column, <code>yInterval=200</code>)</h3>
    <p class="desc">
      x-axis substituted with this port's <code>"block"</code> type for the source's own date-type axis (see header comment) - 30 one-minute
      ticks, grouped 5-per-column. y-axis is a genuine <code>"range"</code> value axis, domain <code>[0,1000]</code>, bucketed every 200 units.
    </p>
    <HeatmapScatterChart
      :data="scatterData"
      :target="['delayA', 'delayB']"
      :axis-x="axisX"
      :axis-y="axisY"
      :x-interval="5"
      :y-interval="200"
      :colors="['#0298d5', '#fa5559']"
      title="Transaction delay density"
      data-testid="heatmapscatter-density"
    />

    <h3>Per-element event forwarding + dark theme</h3>
    <p class="desc">
      <code>addEvent(obj.element, i, j)</code> only on a bucket's first point - <code>dataIndex</code>/<code>dataKey</code>/<code>data</code> are
      that first point's own row/target, not the whole accumulated bucket.
    </p>
    <p data-testid="last-heatmapscatter-event">{{ lastEvent }}</p>
    <HeatmapScatterChart
      :data="scatterData"
      :target="['delayA', 'delayB']"
      :axis-x="axisX"
      :axis-y="axisY"
      :x-interval="5"
      :y-interval="200"
      :colors="['#12f2e8', '#f94590']"
      theme="dark"
      title="Transaction delay density (dark)"
      data-testid="heatmapscatter-dark"
      @click="(p) => onScatterEvent('click', p)"
      @mouseover="(p) => onScatterEvent('mouseover', p)"
      @mouseout="(p) => onScatterEvent('mouseout', p)"
    />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
