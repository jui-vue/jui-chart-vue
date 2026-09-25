<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/rangebar.js` (real legacy demo data/config) -
// exercises both `rangebar` (x=range/value, y=block/category) and its column-orientation sibling
// `rangecolumn` (x=block, y=range) side by side.
import Chart from '../Chart.vue'

const data = [
  { quarter: '1Q', sales: [10, 50], profit: [10, 35] },
  { quarter: '2Q', sales: [-20, 5], profit: [-30, 7] },
  { quarter: '3Q', sales: [10, 30], profit: [0, 30] },
  { quarter: '4Q', sales: [35, 70], profit: [30, 60] },
]

const barAxis = [
  {
    x: { type: 'range', domain: [-40, 80], step: 10, line: true },
    y: { type: 'block', domain: 'quarter', line: true },
    data,
  },
]

const columnAxis = [
  {
    x: { type: 'block', domain: 'quarter', line: true },
    y: { type: 'range', domain: [-40, 80], step: 10, line: true },
    data,
  },
]

const brush = [{ type: 'rangebar', target: ['sales', 'profit'], outerPadding: 20 }]
const columnBrush = [{ type: 'rangecolumn', target: ['sales', 'profit'], outerPadding: 20 }]

const widget = [
  { type: 'title', text: 'Bar Sample' },
  { type: 'tooltip', orient: 'right' },
  { type: 'legend' },
]
</script>

<template>
  <div class="demo">
    <h2>rangebar</h2>
    <Chart :width="600" :height="400" :axis="barAxis" :brush="brush" :widget="widget" />
  </div>
  <div class="demo">
    <h2>rangecolumn</h2>
    <Chart :width="600" :height="400" :axis="columnAxis" :brush="columnBrush" :widget="widget" />
  </div>
</template>
