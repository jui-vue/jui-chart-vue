<script setup lang="ts">
// No legacy demo exists for `scroll`/`vscroll`/`raycast` (checked examples/ - none reference these
// widgets). A column chart windowed via `axis.buffer` (showing only 5 of 12 columns at a time),
// paired with both a horizontal and a vertical scrollbar plus a raycast click-passthrough, is used
// here to demonstrate all three at once.
import Chart from '../Chart.vue'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon2', 'Tue2', 'Wed2', 'Thu2', 'Fri2']
const values = [40, 55, 30, 70, 60, 25, 15, 45, 65, 35, 50, 20]

const axis = [
  {
    buffer: 5,
    x: { type: 'block', domain: days, line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: days.map((day, i) => ({ day, value: values[i] })),
  },
]

const brush = [{ type: 'column', target: ['value'] }]

const widget = [
  { type: 'title', text: 'Scroll Sample (windowed to 5 of 12 columns)' },
  { type: 'scroll' },
  { type: 'vscroll' },
  { type: 'raycast', brush: [0] },
]
</script>

<template>
  <div class="demo">
    <h2>scroll + vscroll + raycast</h2>
    <Chart :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
