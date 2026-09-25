<script setup lang="ts">
// No legacy demo exists for `dragselect`/`guideline`/`zoomselect` (checked examples/ - none
// reference these widgets). A line chart is a natural real-world pairing for all three
// (drag-to-select a data range, scrub a guide line along the x-axis, drag-to-zoom a range) -
// dragselect's own rubber-band rect is invisible until dragged, same as `cross`'s hidden-by-default
// crosshair.
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'block', domain: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { day: 'Mon', value: 40 },
      { day: 'Tue', value: 55 },
      { day: 'Wed', value: 30 },
      { day: 'Thu', value: 70 },
      { day: 'Fri', value: 60 },
      { day: 'Sat', value: 25 },
      { day: 'Sun', value: 15 },
    ],
  },
]

const brush = [{ type: 'line', target: ['value'] }]

const widget = [
  { type: 'title', text: 'DragSelect Sample' },
  { type: 'dragselect', brush: [0] },
]
</script>

<template>
  <div class="demo">
    <h2>dragselect</h2>
    <Chart :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
