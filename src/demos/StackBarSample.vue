<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/stack_bar.js` (real legacy demo data) - drops the
// legacy `series` config block (a `chart.series` feature outside `jui-graph-ts`'s `BuilderOptions`
// surface / this project's scope) and uses a plain `target` array instead, like every other demo
// here. Exercises `stackbar` and `stackcolumn` side by side.
import Chart from '../Chart.vue'

const data = [
  { quarter: '1Q', samsung: 50, lg: 35, sony: 10 },
  { quarter: '2Q', samsung: 20, lg: 30, sony: 5 },
  { quarter: '3Q', samsung: 20, lg: 5, sony: 10 },
  { quarter: '4Q', samsung: 30, lg: 25, sony: 15 },
]

const barAxis = [
  {
    x: {
      type: 'range',
      domain: (row: Record<string, number>) => row.samsung + row.lg + row.sony,
      step: 10,
      line: true,
    },
    y: { type: 'block', domain: 'quarter', line: true },
    data,
  },
]

const columnAxis = [
  {
    x: { type: 'block', domain: 'quarter', line: true },
    y: {
      type: 'range',
      domain: (row: Record<string, number>) => row.samsung + row.lg + row.sony,
      step: 10,
      line: true,
    },
    data,
  },
]

const barBrush = [{ type: 'stackbar', target: ['samsung', 'lg', 'sony'] }]
const columnBrush = [{ type: 'stackcolumn', target: ['samsung', 'lg', 'sony'] }]

const widget = [
  { type: 'title', text: 'Bar Sample' },
  { type: 'legend', filter: true },
]
</script>

<template>
  <div class="demo">
    <h2>stackbar</h2>
    <Chart :width="600" :height="400" :axis="barAxis" :brush="barBrush" :widget="widget" />
  </div>
  <div class="demo">
    <h2>stackcolumn</h2>
    <Chart :width="600" :height="400" :axis="columnAxis" :brush="columnBrush" :widget="widget" />
  </div>
</template>
