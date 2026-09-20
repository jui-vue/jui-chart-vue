<script setup lang="ts">
// No pie.js example ships in jui-chart/examples/ (bar.html is the only concrete example in the
// repo) - this page's config shape is inferred from src/brush/pie.js itself, not validated
// against a real jui-chart example. See README's "What wasn't validated against a real example".
import { ref } from 'vue'
import PieChart from '../components/PieChart.vue'
import PieGrid from '../components/PieGrid.vue'
import type { ChartElementEventPayload, DataRow } from '../types'

const data: DataRow = { chrome: 64, safari: 19, edge: 5, firefox: 3, other: 9 }
const target = ['chrome', 'safari', 'edge', 'firefox', 'other']

// A cluster of ten near-equal tiny slices (each ~0.4deg of sweep) packed next to one huge one -
// crafted so several adjacent labels' `centerAngle`s land under pie.js's hardcoded 2deg collision
// threshold, to demonstrate `pieOutsideLabelDeclutter` (see usePie.ts) actually engaging: the
// first couple of the cluster's labels shrink/fade, then disappear, until the accumulated angle
// gap re-opens past 2deg and a label resumes at full size. Real "many tiny adjacent categories"
// data (e.g. a long tail of small vendors) would trigger the same behavior.
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

// Per-element event forwarding demo - ported from `brush/core.js`'s `addEvent()`. See
// `PieChart.vue`'s header comment: `dataIndex` is always `null` (no small-multiples array at this
// layer), `data` is the whole row (all wedges' values), `dataKey` is the hovered/clicked wedge.
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onPieClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onPieMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onPieMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}
</script>

<template>
  <div>
    <h2>Pie chart</h2>
    <p class="desc">
      Ported from <code>src/brush/pie.js</code>. Not axis-based - angles come from each target's share of the total via
      trig (see <code>usePie.ts</code>), same as the original.
    </p>

    <h3>showText="outside" (default leader-line labels)</h3>
    <PieChart :data="data" :target="target" show-text="outside" title="Browser share" />

    <h3>showText="inside"</h3>
    <PieChart :data="data" :target="target" show-text="inside" />

    <h3>active="chrome" (static wedge-pull + dim)</h3>
    <p class="desc">Ported from pie.js's <code>active</code>: the named wedge pulls out by <code>theme('pieActiveDistance')</code> and the rest dim to <code>theme('pieDisableBackgroundOpacity')</code>.</p>
    <PieChart :data="data" :target="target" show-text="outside" active="chrome" />

    <h3>activeEvent="mouseover" (hover to pull out)</h3>
    <p class="desc">Ported from pie.js's <code>activeEvent</code>: hovering a wedge toggles its active state via the named DOM event.</p>
    <PieChart :data="data" :target="target" show-text="outside" active-event="mouseover" />

    <h3>showText="outside" with tightly-clustered small wedges (label declutter)</h3>
    <p class="desc">
      Ported from pie.js's <code>drawText()</code> stateful <code>preAngle</code>/<code>preRate</code>/<code>preOpacity</code> walk
      (<code>pieOutsideLabelDeclutter</code> in <code>usePie.ts</code>): when adjacent slices' center angles fall within 2deg of
      each other, each successive label shrinks inward and fades, disappearing entirely once fully crowded, then resumes at
      full size once a large-enough gap reopens. The ten <code>t1</code>-<code>t10</code> slices below are packed this tightly on
      purpose.
    </p>
    <PieChart :data="clusteredData" :target="clusteredTarget" show-text="outside" :width="500" :height="500" />

    <h3>axis.c small-multiples grid (PieGrid)</h3>
    <p class="desc">
      Ported from <code>axis.c</code>'s "small-multiples" mode (one pie per <code>axis.data</code> row, laid out via a
      <code>chart.grid.table</code> grid) - <code>&lt;PieGrid&gt;</code> composes independent <code>&lt;PieChart&gt;</code> instances
      into a <code>columns</code> x auto-rows grid instead of replicating the original's shared-brush layout. See
      <code>PieGrid.vue</code> and <code>PORT_STATUS.md</code> for the design rationale. With <code>show-text="inside"</code>,
      each cell's small radius packs several labels close enough on-screen to overlap even though their center angles are
      tens of degrees apart - <code>pieInsideLabelDeclutter</code> (usePie.ts) hides whichever label of a colliding pair
      would render illegibly on top of its neighbor (a from-scratch fix - pie.js never declutters inside labels).
    </p>
    <PieGrid :data="regionData" :target="target" :columns="3" title-field="region" show-text="inside" :width="720" :height="440" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - per-wedge, with <code>dataIndex</code>
      always <code>null</code> (see the component's header comment for why) and <code>data</code> the whole row. Hover or click a wedge below.
    </p>
    <PieChart :data="data" :target="target" show-text="outside" @click="onPieClick" @mouseover="onPieMouseover" @mouseout="onPieMouseout" />
    <p class="desc" data-testid="last-pie-event">
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
