<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/scatter.js` (real legacy demo data/config) -
// exercises the `symbol` callback branch (circle/rectangle/triangle per target key).
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Q1', 'Q2', 'Q3', 'Q4'], line: true },
    y: { type: 'range', domain: 'total', step: 10 },
    data: [
      { sales: 2, profit: 15, total: 20 },
      { sales: 15, profit: 6, total: 20 },
      { sales: 8, profit: 10, total: 20 },
      { sales: 18, profit: 5, total: 20 },
    ],
  },
]

const brush = {
  type: 'scatter',
  symbol: (k: string) => {
    if (k == 'sales') return 'circle'
    else if (k == 'profit') return 'rectangle'
    return 'triangle'
  },
  size: 10,
}

const widget = [
  { type: 'title', text: 'Scatter Sample' },
  { type: 'tooltip' },
]
</script>

<template>
  <div class="demo">
    <h2>scatter</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
