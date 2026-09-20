<script setup lang="ts">
// No rangebar.js/rangecolumn.js example ships in jui-chart/examples/ - hand-built. Weekly stock
// price range (low/high per week), the canonical range-bar use case. `price` is a 2-element
// `[low, high]` tuple per row, same data model as RangeAreaChart.
import { ref } from 'vue'
import RangeBarChart from '../components/RangeBarChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { week: 'W1', price: [98, 112] },
  { week: 'W2', price: [105, 118] },
  { week: 'W3', price: [95, 108] },
  { week: 'W4', price: [110, 125] },
  { week: 'W5', price: [102, 121] },
]

const axisXColumn: AxisConfig = { type: 'block', domain: 'week' }
const axisYColumn: AxisConfig = { type: 'range', domain: 'price', step: 5 }

// Same series as horizontal bars: axis roles swap (x becomes value/range, y becomes category/block).
const axisXBar: AxisConfig = { type: 'range', domain: 'price', step: 5 }
const axisYBar: AxisConfig = { type: 'block', domain: 'week' }

// Two-target demo (two stocks' weekly ranges side by side per week), proving the grouped
// outerPadding/innerPadding geometry (`rangeGroupGeometry`).
const dataTwoStocks: DataRow[] = [
  { week: 'W1', aapl: [98, 112], msft: [150, 160] },
  { week: 'W2', aapl: [105, 118], msft: [148, 162] },
  { week: 'W3', aapl: [95, 108], msft: [152, 165] },
  { week: 'W4', aapl: [110, 125], msft: [155, 170] },
]
const axisXTwoStocks: AxisConfig = { type: 'block', domain: 'week' }
const axisYTwoStocks: AxisConfig = { type: 'range', domain: (d) => [...d.aapl, ...d.msft], step: 5 }

// Per-element event forwarding demo - ported from `rangebar.js`/`rangecolumn.js`'s own
// `this.addEvent(r, i, j)` call (see RangeBarChart.vue's header comment).
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
    <h2>rangebar.js / rangecolumn.js</h2>
    <p class="desc">
      No original example ships for either brush - hand-built. Source-confirmed both `extend:
      "chart.brush.core"` directly (not bar.js/column.js) but share the identical
      outerPadding/innerPadding group-size formula and per-target rect shape modulo an axis swap -
      merged into one component via <code>orient</code>, matching this port's own <code>BarChart</code> precedent. Weekly stock price
      range (low/high) shown below.
    </p>
    <RangeBarChart :data="data" :axis-x="axisXColumn" :axis-y="axisYColumn" :target="['price']" orient="column" title="Weekly price range" />

    <h3>Same data, as horizontal bars</h3>
    <p class="desc"><code>orient="bar"</code> - axis roles swap (x becomes the value/range axis, y the category/block axis).</p>
    <RangeBarChart :data="data" :axis-x="axisXBar" :axis-y="axisYBar" :target="['price']" orient="bar" />

    <h3>Two targets (grouped)</h3>
    <p class="desc">Two stocks' weekly ranges side by side per week, proving the outerPadding/innerPadding grouped-item geometry.</p>
    <RangeBarChart :data="dataTwoStocks" :axis-x="axisXTwoStocks" :axis-y="axisYTwoStocks" :target="['aapl', 'msft']" orient="column" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>rangebar.js</code>/<code>rangecolumn.js</code>'s own unconditional <code>addEvent(r, i, j)</code> per rect (no
      value===0 guard, unlike bar.js). Hover/click a bar below.
    </p>
    <RangeBarChart
      :data="data"
      :axis-x="axisXColumn"
      :axis-y="axisYColumn"
      :target="['price']"
      orient="column"
      @click="onClick"
      @mouseover="onMouseover"
      @mouseout="onMouseout"
    />
    <p class="desc" data-testid="last-rangebar-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey="{{ lastEvent.payload.dataKey }}" data={{ JSON.stringify(lastEvent.payload.data) }}</code>
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
