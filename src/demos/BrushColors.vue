<script setup lang="ts">
// Converted from `www.jui-vue.io/play/chart/json/brush_colors.js` (this is the exact demo
// PLAN.md's step 1 names) into a single `<Chart>` call - a combo column chart with two targets
// (one negative-going) using an explicit per-target `colors` override.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: 'quarter', line: true },
    y: { type: 'range', domain: [-40, 40], step: 10, line: true },
    data: [
      { quarter: '1Q', sales: 50, profit: 35 },
      { quarter: '2Q', sales: -20, profit: -30 },
      { quarter: '3Q', sales: 10, profit: -5 },
      { quarter: '4Q', sales: 30, profit: 25 },
    ],
  },
]

const brush = [
  {
    type: 'column',
    target: ['sales', 'profit'],
    // Color index of theme or RGB color code
    colors: [2, '#9228E4'],
  },
]
</script>

<template>
  <div class="demo">
    <h2>brush_colors</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" />
  </div>
</template>
