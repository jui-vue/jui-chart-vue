<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/stack_area.js` (real legacy demo data/config) - a
// combo demo: `stackarea` (brush 0) + `stackscatter` (brush 1) sharing one axis, with a filterable,
// `brushSync`'d legend spanning both. `target` left unset on both brushes, matching the legacy
// demo (auto-inferred from `axis.data[0]`'s keys).
import Chart from '../Chart.vue'

const data = [
  { sales: 2, profit: 6, dept: 7 },
  { sales: 5, profit: 6, dept: 2 },
  { sales: 8, profit: 4, dept: 5 },
  { sales: 10, profit: 5, dept: 12 },
]

const axis = [
  {
    x: { type: 'fullblock', domain: ['Q1', 'Q2', 'Q3', 'Q4'], line: true },
    y: {
      type: 'range',
      domain: (row: Record<string, number>) => row.sales + row.profit + row.dept,
      step: 10,
    },
    data,
  },
]

const brush = [
  { type: 'stackarea' },
  { type: 'stackscatter', size: 10, symbol: 'circle' },
]

const widget = [
  { type: 'title', text: 'Area Sample' },
  { type: 'legend', filter: true, brush: [0, 1], brushSync: true },
]
</script>

<template>
  <div class="demo">
    <h2>stackarea + stackscatter</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
