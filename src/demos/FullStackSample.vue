<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/fullstackbar.js` (real legacy demo data/config) -
// exercises `fullstackbar` and `fullstackcolumn` (100%-normalized stacking with percent labels)
// side by side.
import Chart from '../Chart.vue'

const data = [
  { quarter: '1Q', samsung: 50, lg: 35, sony: 10 },
  { quarter: '2Q', samsung: 20, lg: 30, sony: 5 },
  { quarter: '3Q', samsung: 20, lg: 5, sony: 10 },
  { quarter: '4Q', samsung: 30, lg: 25, sony: 15 },
]

const barAxis = [
  {
    x: { type: 'range', domain: [0, 100], line: true },
    y: { type: 'block', domain: 'quarter', line: true, orient: 'right' },
    data,
  },
]

const columnAxis = [
  {
    x: { type: 'block', domain: 'quarter', line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data,
  },
]

const barBrush = [{ type: 'fullstackbar', target: ['samsung', 'lg', 'sony'], showText: true }]
const columnBrush = [{ type: 'fullstackcolumn', target: ['samsung', 'lg', 'sony'], showText: true }]

const widget = [
  { type: 'title', text: 'Bar Sample' },
  { type: 'legend', filter: true },
]
</script>

<template>
  <div class="demo">
    <h2>fullstackbar</h2>
    <Chart :width="600" :height="400" :axis="barAxis" :brush="barBrush" :widget="widget" />
  </div>
  <div class="demo">
    <h2>fullstackcolumn</h2>
    <Chart :width="600" :height="400" :axis="columnAxis" :brush="columnBrush" :widget="widget" />
  </div>
</template>
