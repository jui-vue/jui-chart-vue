<script setup lang="ts">
// No bubble.js example ships in jui-chart/examples/ - this uses a "monthly city temperature"
// dataset (one categorical x per month, two cities' average temperatures as `target` - same
// categorical-x/range-y dot/strip-plot data model as ScatterChart, see BubbleChart.vue's header
// comment) plus a `rainfall` field per row, unrelated to either target, used to demo `scaleKey`.
import { ref } from 'vue'
import BubbleChart from '../components/BubbleChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { month: 'Jan', tokyo: 6, sydney: 26, rainfall: 52 },
  { month: 'Feb', tokyo: 7, sydney: 26, rainfall: 56 },
  { month: 'Mar', tokyo: 10, sydney: 24, rainfall: 118 },
  { month: 'Apr', tokyo: 15, sydney: 21, rainfall: 125 },
  { month: 'May', tokyo: 20, sydney: 18, rainfall: 138 },
  { month: 'Jun', tokyo: 23, sydney: 15, rainfall: 168 },
]

const axisX: AxisConfig = { type: 'block', domain: 'month' }
const axisY: AxisConfig = { type: 'range', domain: ['tokyo', 'sydney'], step: 6 }
const target = ['tokyo', 'sydney']

function formatCity(row: DataRow): string {
  return `${row.month}: rainfall ${row.rainfall}mm`
}

// Per-element event forwarding demo - ported from `brush/core.js`'s `addEvent()`. Fires for every
// bubble unconditionally (no hide/hideZero-style guard exists in bubble.js).
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onBubbleClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onBubbleMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onBubbleMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>Bubble chart</h2>
    <p class="desc">
      Ported from <code>src/brush/bubble.js</code> (extends <code>chart.brush.core</code> directly, NOT
      <code>chart.brush.scatter</code> - a separate implementation, see the component's header comment). No dedicated example
      ships in jui-chart/examples - this uses a "monthly city temperature" dataset (categorical month x-axis, two cities'
      temperatures as <code>target</code>) plus a per-row <code>rainfall</code> field, unrelated to either target, to demo
      <code>scaleKey</code>.
    </p>

    <h3>default (no scaleKey - each bubble's own value drives its radius)</h3>
    <p class="desc">Radius is scaled from the y-axis's own resolved domain bounds (ported from <code>drawBefore()</code>'s <code>axis.y.min()/max()</code> fallback) - warmer readings render as bigger bubbles.</p>
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" title="Monthly average temperature (°C)" />

    <h3>scaleKey="rainfall" (radius driven by an unrelated 3rd field)</h3>
    <p class="desc">
      Every bubble in a given month now shares the same radius (both tokyo's and sydney's June bubbles are equally large),
      since <code>rainfall</code> is a per-row field, not per-target - ported literally from <code>getBubbleRadius()</code>.
    </p>
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" scale-key="rainfall" />

    <h3>showText + format(row) + custom min/max radius</h3>
    <p class="desc">
      <code>format</code> receives the WHOLE raw data row (not just the value) - matches <code>getFormatText()</code>'s
      <code>this.format(this.axis.data[dataIndex])</code>, a deviation from every other chart's <code>format(value)</code>.
    </p>
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" scale-key="rainfall" show-text :format="formatCity" :min="10" :max="45" :width="700" />

    <h3>active / activeEvent</h3>
    <p class="desc">
      Ported from bubble.js's own index-based <code>active</code>/<code>activeEvent</code> (flat, target-major index into the
      (target, row) pair list - like <code>BarChart</code>'s, not a series name like Line/Area/Pie/Donut).
    </p>
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" :active="2" />
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" active-event="click" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - per-bubble, real
      <code>dataIndex</code>/<code>data</code>, fires unconditionally (no hide/hideZero-style guard in bubble.js). Hover or click a
      bubble below.
    </p>
    <BubbleChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="target" @click="onBubbleClick" @mouseover="onBubbleMouseover" @mouseout="onBubbleMouseout" />
    <p class="desc" data-testid="last-bubble-event">
      Last event:
      <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }}, dataKey="{{ lastEvent.payload.dataKey }}", data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
