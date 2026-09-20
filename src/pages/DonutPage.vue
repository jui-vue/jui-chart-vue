<script setup lang="ts">
// No donut.js example ships in jui-chart/examples/ either - same caveat as PiePage (config
// shape inferred from src/brush/donut.js, not validated against a real example).
import { ref } from 'vue'
import DonutChart from '../components/DonutChart.vue'
import DonutGrid from '../components/DonutGrid.vue'
import type { ChartElementEventPayload, DataRow } from '../types'

const data: DataRow = { chrome: 64, safari: 19, edge: 5, firefox: 3, other: 9 }
const target = ['chrome', 'safari', 'edge', 'firefox', 'other']

// Same clustered-slices declutter demo as PiePage.vue - donut.js reuses pie.js's `drawText()`
// unmodified, so the same `pieOutsideLabelDeclutter` logic applies identically.
const clusteredData: DataRow = { big: 900, t1: 1, t2: 1, t3: 1, t4: 1, t5: 1, t6: 1, t7: 1, t8: 1, t9: 1, t10: 1 }
const clusteredTarget = ['big', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']

// One row per region - drives the `axis.c` small-multiples grid demo below.
const regionData: DataRow[] = [
  { region: 'North America', chrome: 52, safari: 32, edge: 9, firefox: 4, other: 3 },
  { region: 'Europe', chrome: 61, safari: 15, edge: 11, firefox: 9, other: 4 },
  { region: 'Asia Pacific', chrome: 71, safari: 12, edge: 6, firefox: 3, other: 8 },
  { region: 'Latin America', chrome: 68, safari: 10, edge: 7, firefox: 5, other: 10 },
  { region: 'Middle East & Africa', chrome: 65, safari: 14, edge: 8, firefox: 4, other: 9 },
  { region: 'Oceania', chrome: 58, safari: 24, edge: 8, firefox: 6, other: 4 },
]

// Per-element event forwarding demo - same shape as PiePage's (donut.js's addEvent call site is
// identical to pie.js's - see DonutChart.vue's header comment).
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onDonutClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onDonutMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onDonutMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>Donut chart</h2>
    <p class="desc">Ported from <code>src/brush/donut.js</code> (extends pie.js). Same angle math, drawn as a stroked ring of width <code>size</code>.</p>

    <h3>showValue: total in the center</h3>
    <DonutChart :data="data" :target="target" :size="60" show-value title="Browser share" />

    <h3>showText="outside"</h3>
    <DonutChart :data="data" :target="target" :size="40" show-text="outside" />

    <h3>activeEvent="mouseover" (hover to pull out - no dim, matches donut.js's setActiveEvent(cache, false))</h3>
    <p class="desc">Donut wedges only pull out on active (never dim), since donut.js calls pie.js's shared <code>setActiveEvent()</code> with <code>useOpacity=false</code>.</p>
    <DonutChart :data="data" :target="target" :size="40" show-text="outside" active-event="mouseover" />

    <h3>showText="outside" with tightly-clustered small wedges (label declutter)</h3>
    <p class="desc">
      Same declutter demo as PiePage - <code>donut.js</code> reuses pie.js's <code>drawText()</code> unmodified, so
      <code>pieOutsideLabelDeclutter</code> applies identically here.
    </p>
    <DonutChart :data="clusteredData" :target="clusteredTarget" :size="40" show-text="outside" :width="500" :height="500" />

    <h3>axis.c small-multiples grid (DonutGrid)</h3>
    <p class="desc">
      Ported from <code>axis.c</code>'s "small-multiples" mode, same as PieGrid - <code>&lt;DonutGrid&gt;</code> composes
      independent <code>&lt;DonutChart&gt;</code> instances into a grid. See <code>PieGrid.vue</code>'s header comment and
      <code>PORT_STATUS.md</code> for the design rationale. <code>show-text="inside"</code> here exercises
      <code>pieInsideLabelDeclutter</code> (usePie.ts) - a from-scratch fix for small cells' inside labels overlapping
      illegibly (there's no original pie.js algorithm for this - it never declutters inside labels at all).
    </p>
    <DonutGrid :data="regionData" :target="target" :columns="3" title-field="region" show-text="inside" :size="16" :width="720" :height="440" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - same per-wedge shape as PieChart. Hover
      or click a ring segment below.
    </p>
    <DonutChart :data="data" :target="target" :size="40" show-text="outside" @click="onDonutClick" @mouseover="onDonutMouseover" @mouseout="onDonutMouseout" />
    <p class="desc" data-testid="last-donut-event">
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
