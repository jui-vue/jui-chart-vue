<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/range_area.js` (real legacy demo data/config) - a
// combo demo: `rangearea` (a `[low, high]` band, v1) + a plain `line` (v2) sharing one axis.
import Chart from '../Chart.vue'

const data = [
  { v1: [4, 8], v2: 6 },
  { v1: [5, 9], v2: 7 },
  { v1: [6, 11], v2: 8 },
  { v1: [5, 10], v2: 6 },
  { v1: [2, 6], v2: 3 },
  { v1: [5, 8], v2: 6 },
  { v1: [2, 6], v2: 4 },
  { v1: [8, 12], v2: 10 },
]

const axis = [
  {
    data,
    x: { type: 'fullblock', domain: ['2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008'], line: true },
    y: { type: 'range', domain: [0, 15], step: 10 },
  },
]

const brush = [
  { type: 'rangearea', target: ['v1'] },
  { type: 'line', target: ['v2'] },
]
</script>

<template>
  <div class="demo">
    <h2>rangearea + line</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" />
  </div>
</template>
