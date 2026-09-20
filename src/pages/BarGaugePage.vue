<script setup lang="ts">
// bargauge.js has no shipped example in jui-chart/examples/ - hand-built. See BarGaugeChart.vue's
// header comment: `extend: "chart.brush.core"` directly, reads only `axis.c(0)` (never
// axis.x/axis.y), and renders a LIST of independent value-vs-range bars, one per data row - not a
// single-value speedometer despite the "gauge" name.
import { ref } from 'vue'
import BarGaugeChart from '../components/BarGaugeChart.vue'
import type { ChartElementEventPayload, DataRow } from '../types'

// Primary demo: server resource usage (%) - all default min=0/max=100, chosen so each row's fill
// width is a clean, hand-checkable number at the chart's 300px width: (300/100)*value.
// CPU=42 -> 126px, Memory=78 -> 234px, Disk=15 -> 45px, Network=95 -> 285px.
const resourceData: DataRow[] = [
  { title: 'CPU', value: 42 },
  { title: 'Memory', value: 78 },
  { title: 'Disk', value: 15 },
  { title: 'Network', value: 95 },
]

// Second demo: the ported `min`-is-divisor-only quirk (see `barGaugeFillWidth`'s doc comment in
// useGauge.ts) made explicit - row 1 sets value===min (20===20), which in a conventional
// value-vs-range gauge would render a ZERO-width bar (the value is at the very bottom of the
// range), but here renders (300/(100-20))*20 = 75px, since `min` only ever shrinks the divisor,
// never offsets the value. Row 2 (value=60) renders (300/80)*60 = 225px for comparison.
const minQuirkData: DataRow[] = [
  { title: 'value = min (20 of [20,100])', value: 20, min: 20, max: 100 },
  { title: 'value = 60 of [20,100]', value: 60, min: 20, max: 100 },
]

// Third demo: uncapped overflow - value=150 against max=100 renders (300/100)*150 = 450px, wider
// than the 300px chart itself (clipped by the SVG viewBox) - the source has no Math.min guard.
const overflowData: DataRow[] = [{ title: 'value=150, max=100 (uncapped)', value: 150, max: 100 }]

// Fourth demo: custom `format` - value=0.87 of [0,1], fill = (300/1)*0.87 = 261px, label shown as
// a rounded percentage instead of the raw fraction.
const formatData: DataRow[] = [{ title: 'Quota attainment', value: 0.87, min: 0, max: 1 }]
function percentFormat(value: number): string {
  return `${Math.round(value * 100)}%`
}

const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>bargauge.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly - never touches <code>axis.x</code>/<code>axis.y</code>. Reads
      <code>axis.c(0)</code> (the whole chart plot area, `chart.grid.panel`) once, then stacks ONE horizontal bar per data row underneath it -
      a list of independent value-vs-range bars, not a single gauge for one value. Linear width-fraction geometry, no threshold bands, no
      needle.
    </p>
    <BarGaugeChart :data="resourceData" :width="300" :height="220" />

    <h3>The "min" quirk: divisor only, never a baseline offset</h3>
    <p class="desc">
      Source-confirmed from <code>draw()</code>: <code>value = (width / (max - min)) * v</code> - <code>min</code> is never subtracted from
      <code>v</code>. Row 1's value EQUALS its min (20 of a [20,100] range) - a conventional gauge would render this as an empty/zero-width bar,
      but it renders 75px wide ((300/80)*20), the same fraction as if min were 0 with a range of 80.
    </p>
    <BarGaugeChart :data="minQuirkData" :width="300" :height="90" />

    <h3>Uncapped overflow</h3>
    <p class="desc">value=150 against max=100 renders (300/100)*150 = 450px - wider than the 300px chart, clipped by the SVG viewBox, matching the source's lack of a clamp.</p>
    <BarGaugeChart :data="overflowData" :width="300" :height="50" />

    <h3>Custom <code>format</code></h3>
    <BarGaugeChart :data="formatData" :width="300" :height="50" :format="(v) => percentFormat(v)" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">Ported from <code>this.addEvent(g, i, null)</code> - once per row (<code>dataKey</code> always <code>null</code>, single-value rows). Hover/click a bar below.</p>
    <BarGaugeChart :data="resourceData" :width="300" :height="220" @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-bargauge-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey={{ lastEvent.payload.dataKey }} data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <BarGaugeChart :data="resourceData" :width="300" :height="220" theme="dark" title="Server resources" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
