<script setup lang="ts">
// candlestick.js's own example (`examples/candlestick.html`) uses `axis.keymap` to remap
// `high`/`low`/`open`/`close` -> `h`/`l`/`o`/`c` on real `Date` rows - this port has no `keymap`
// composable, so the equivalent (see CandlestickChart.vue's header comment) is the
// `openField`/`highField`/`lowField`/`closeField` props, demoed in the second section below.
//
// Two weeks of a fictitious stock ("ACME"), hand-built with a deliberate mix of bullish
// (close >= open) and bearish (open > close) days for the Playwright color-verification pass.
import { ref } from 'vue'
import CandlestickChart from '../components/CandlestickChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { date: '09/01', open: 100, high: 104, low: 98, close: 103 }, // bullish
  { date: '09/02', open: 103, high: 105, low: 101, close: 101 }, // bearish
  { date: '09/03', open: 101, high: 103, low: 97, close: 99 }, // bearish
  { date: '09/04', open: 99, high: 102, low: 98, close: 102 }, // bullish
  { date: '09/05', open: 102, high: 106, low: 101, close: 105 }, // bullish
  { date: '09/08', open: 105, high: 107, low: 103, close: 104 }, // bearish
  { date: '09/09', open: 104, high: 108, low: 103, close: 107 }, // bullish
  { date: '09/10', open: 107, high: 109, low: 105, close: 106 }, // bearish
  { date: '09/11', open: 106, high: 110, low: 105, close: 109 }, // bullish
  { date: '09/12', open: 109, high: 111, low: 107, close: 108 }, // bearish
]

const axisX: AxisConfig = { type: 'block', domain: 'date', line: true }
const axisY: AxisConfig = { type: 'range', domain: ['low', 'high'], step: 5, line: true }

// Custom field-name demo - the port-only substitute for the original's `axis.keymap` remap
// (`examples/candlestick.html` remaps `high`->`h`, `low`->`l`, `open`->`o`, `close`->`c`).
const dataRemapped: DataRow[] = data.map((row) => ({ date: row.date, h: row.high, l: row.low, o: row.open, c: row.close }))

// Per-element event forwarding demo - ported from candlestick.js's own `this.addEvent(r, i, null)`
// call on the body rect (see CandlestickChart.vue's header comment on the dataKey:null shape).
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
    <h2>candlestick.js</h2>
    <p class="desc">
      Source-confirmed: reads FOUR fixed field names per row (<code>high</code>/<code>low</code>/<code>open</code>/<code>close</code>, via
      <code>getValue()</code>'s <code>axis.keymap</code> fallback) - not a <code>[low, high]</code> tuple like RangeArea/RangeBar, and there is no
      <code>target</code> array at all (one candle per row, unconditionally). Body = open-close rect, wick = high-low line, drawn as two
      separate SVG primitives per row. Bullish (<code>close &gt;= open</code>) uses <code>candlestickBorderColor</code>/<code>candlestickBackgroundColor</code>;
      bearish (<code>open &gt; close</code>) uses the <code>...Invert...</code> pair - both theme-driven, no per-chart color override exists upstream.
      Two weeks of a fictitious stock ("ACME") below.
    </p>
    <CandlestickChart :data="data" :axis-x="axisX" :axis-y="axisY" title="ACME daily OHLC" />

    <h3>Custom field names (<code>openField</code>/<code>highField</code>/<code>lowField</code>/<code>closeField</code>)</h3>
    <p class="desc">
      Port-only substitute for the original's <code>axis.keymap</code> remap (its own example remaps <code>high</code>/<code>low</code>/<code>open</code>/<code>close</code> to
      <code>h</code>/<code>l</code>/<code>o</code>/<code>c</code>) - same data as above, renamed fields.
    </p>
    <CandlestickChart :data="dataRemapped" :axis-x="axisX" :axis-y="{ type: 'range', domain: ['l', 'h'], step: 5 }" open-field="o" high-field="h" low-field="l" close-field="c" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from candlestick.js's own unconditional <code>addEvent(r, i, null)</code> on the body rect (never the wick) - <code>dataKey</code> is
      always <code>null</code> here (the inverse of RangeArea/RangeBar's <code>dataIndex: null</code> shape). Hover/click a candle below.
    </p>
    <CandlestickChart :data="data" :axis-x="axisX" :axis-y="axisY" @click="onClick" @mouseover="onMouseover" @mouseout="onMouseout" />
    <p class="desc" data-testid="last-candlestick-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }} dataKey="{{ lastEvent.payload.dataKey }}" data={{ JSON.stringify(lastEvent.payload.data) }}</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>Dark theme</h3>
    <CandlestickChart :data="data" :axis-x="axisX" :axis-y="axisY" theme="dark" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
