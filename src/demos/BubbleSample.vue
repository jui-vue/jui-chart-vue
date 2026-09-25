<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/bubble.js` (real legacy demo data/config) -
// exercises `scaleKey` (radius driven by `profit`, a different field than the plotted `sales`
// value), `showText`, a `format` callback, and a per-row `colors` callback.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: 'quarter', line: true },
    y: { type: 'range', domain: [0, 50], step: 10, line: true },
    data: [
      { quarter: '1Q', sales: 40, profit: 35 },
      { quarter: '2Q', sales: 10, profit: 5 },
      { quarter: '3Q', sales: 15, profit: 10 },
      { quarter: '4Q', sales: 30, profit: 25 },
    ],
  },
]

const brush = {
  type: 'bubble',
  min: 30,
  max: 50,
  target: 'sales',
  scaleKey: 'profit',
  showText: true,
  format: (d: Record<string, number>) => d.profit,
  colors: (d: Record<string, number>) => {
    if (d.profit > 30) return 2
    else if (d.profit > 20) return 1
    return 0
  },
}
</script>

<template>
  <div class="demo">
    <h2>bubble</h2>
    <Chart :width="600" :height="400" :axis="axis" :brush="brush" />
  </div>
</template>
