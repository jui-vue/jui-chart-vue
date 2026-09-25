<script setup lang="ts">
// No legacy demo exists for `zoomselect` (checked examples/ - none reference this widget). A
// column chart is used here - the drag-to-zoom overlay itself is invisible until dragged (same
// "hidden until interacted with" shape as `dragselect`/`cross`), so this screenshot shows its
// static (not-yet-dragged) state.
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
  { type: 'title', text: 'ZoomSelect Sample' },
  { type: 'zoomselect', axis: 0 },
]
</script>

<template>
  <div class="demo">
    <h2>zoomselect</h2>
    <Chart :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
