<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/heatmap1.js` (real legacy demo data/config) -
// exercises `brush.colors` as a callback (the real, intended usage - see `heatmap.ts`'s own header
// comment for why the DEFAULT `colors: null` case is actually a uniform-background degenerate case).
import Chart from '../Chart.vue'

const data = [
  { x: 0, y: 0, value: 100 },
  { x: 0, y: 1, value: 93 },
  { x: 0, y: 2, value: 96 },
  { x: 0, y: 3, value: 100 },
  { x: 0, y: 4, value: 100 },
  { x: 0, y: 5, value: 100 },
  { x: 1, y: 0, value: 85 },
  { x: 1, y: 1, value: 86 },
  { x: 1, y: 2, value: 84 },
  { x: 1, y: 3, value: 86 },
  { x: 1, y: 4, value: 100 },
  { x: 1, y: 5, value: 100 },
  { x: 2, y: 0, value: 77 },
  { x: 2, y: 1, value: 77 },
  { x: 2, y: 2, value: 72 },
  { x: 2, y: 3, value: 82 },
  { x: 2, y: 4, value: 100 },
  { x: 2, y: 5, value: 100 },
  { x: 3, y: 0, value: 74 },
  { x: 3, y: 1, value: 68 },
  { x: 3, y: 2, value: 64 },
  { x: 3, y: 3, value: 72 },
  { x: 3, y: 4, value: 100 },
  { x: 4, y: 0, value: 68 },
  { x: 4, y: 1, value: 62 },
  { x: 4, y: 2, value: 56 },
  { x: 4, y: 3, value: 65 },
  { x: 4, y: 4, value: 100 },
  { x: 5, y: 0, value: 54 },
  { x: 5, y: 1, value: 57 },
  { x: 5, y: 2, value: 52 },
  { x: 5, y: 3, value: 62 },
  { x: 5, y: 4, value: 100 },
  { x: 6, y: 0, value: 48 },
  { x: 6, y: 1, value: 55 },
  { x: 6, y: 2, value: 52 },
  { x: 6, y: 3, value: 55 },
  { x: 6, y: 4, value: 100 },
]

const axis = [
  {
    x: { type: 'block', domain: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], line: 'solid', key: 'x' },
    y: { type: 'block', domain: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'], line: 'solid', key: 'y' },
    data,
  },
]

const brush = {
  type: 'heatmap',
  target: 'value',
  colors: (d: Record<string, number>) => {
    if (d.value > 95) return '#588526'
    else if (d.value > 60) return '#8cba00'
    return '#fab913'
  },
  format: (d: Record<string, number>) => `${d.value}%`,
}

const widget = { type: 'tooltip' }
</script>

<template>
  <div class="demo">
    <h2>heatmap</h2>
    <Chart :width="500" :height="450" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
