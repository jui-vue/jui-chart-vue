<script setup lang="ts">
// No legacy demo exists for `zoom` (checked examples/ - none reference this widget). Same visual
// shape as `zoomselect` (a drag overlay, invisible until dragged), but a real zoom - dragging
// actually rewrites the x-axis's own domain via `axis.zoom()`.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { day: 'Mon', value: 40 },
      { day: 'Tue', value: 55 },
      { day: 'Wed', value: 30 },
      { day: 'Thu', value: 70 },
      { day: 'Fri', value: 60 },
    ],
  },
]

const brush = [{ type: 'column', target: ['value'] }]

const widget = [
  { type: 'title', text: 'Zoom Sample' },
  { type: 'zoom', axis: 0 },
]
</script>

<template>
  <div class="demo">
    <h2>zoom</h2>
    <Chart :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
