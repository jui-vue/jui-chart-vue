<script setup lang="ts">
// No rangearea.js example ships in jui-chart/examples/ - hand-built. Daily temperature high/low
// band, the canonical range-area use case. `temp` is a 2-element `[low, high]` tuple per day (see
// RangeAreaChart.vue's header comment on the data model) - `axisY.domain: 'temp'` works directly
// against `useAxis.ts`'s `computeRangeDomain()`, which already folds an array-valued field's own
// max/min per row (no change needed there for this item).
import RangeAreaChart from '../components/RangeAreaChart.vue'
import type { AxisConfig, DataRow } from '../types'

const data: DataRow[] = [
  { day: 'Mon', temp: [12, 22] },
  { day: 'Tue', temp: [11, 19] },
  { day: 'Wed', temp: [14, 24] },
  { day: 'Thu', temp: [16, 26] },
  { day: 'Fri', temp: [15, 21] },
  { day: 'Sat', temp: [10, 18] },
  { day: 'Sun', temp: [9, 17] },
]

const axisX: AxisConfig = { type: 'block', domain: 'day' }
const axisY: AxisConfig = { type: 'range', domain: 'temp', step: 5 }

// Two-target demo (two cities' temperature ranges side by side) - `domain` as an array of field
// names doesn't work here (that branch folds each field's raw value with Math.max/min, which
// assumes a plain number, not a [low,high] tuple - see useAxis.ts) so a `domain` callback that
// flattens both tuples is used instead, still exercising `computeRangeDomain`'s function branch
// (already array-aware per-row).
const dataTwoCities: DataRow[] = [
  { day: 'Mon', tokyo: [14, 23], seoul: [9, 18] },
  { day: 'Tue', tokyo: [13, 20], seoul: [8, 16] },
  { day: 'Wed', tokyo: [16, 25], seoul: [11, 20] },
  { day: 'Thu', tokyo: [17, 27], seoul: [12, 22] },
  { day: 'Fri', tokyo: [15, 22], seoul: [10, 19] },
]
const axisXTwoCities: AxisConfig = { type: 'block', domain: 'day' }
const axisYTwoCities: AxisConfig = { type: 'range', domain: (d) => [...d.tokyo, ...d.seoul], step: 5 }
</script>

<template>
  <div>
    <h2>rangearea.js</h2>
    <p class="desc">
      No original example ships for this brush - hand-built. Each target field is a 2-element
      <code>[low, high]</code> tuple per row (e.g. <code>temp: [12, 22]</code>), not two separate
      <code>target</code> fields - ported from <code>rangearea.js</code>'s <code>value[0]</code>/<code>value[1]</code> read. Daily temperature
      high/low band shown below.
    </p>
    <RangeAreaChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['temp']" title="Daily temperature range" />

    <h3>Two targets (grouped bands)</h3>
    <p class="desc">Two cities' temperature ranges over the same days, as two overlapping/adjacent bands.</p>
    <RangeAreaChart :data="dataTwoCities" :axis-x="axisXTwoCities" :axis-y="axisYTwoCities" :target="['tokyo', 'seoul']" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
