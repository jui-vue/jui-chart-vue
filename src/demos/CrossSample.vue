<script setup lang="ts">
// No legacy demo exists for `cross` (checked examples/ - none reference this widget). A column
// chart with a crosshair overlay is a standard real-world pairing, used here.
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
  { type: 'title', text: 'Cross Sample' },
  {
    type: 'cross',
    xFormat: (v: unknown) => `x: ${v}`,
    yFormat: (v: unknown) => `y: ${Math.round(v as number)}`,
  },
]
</script>

<template>
  <div class="demo">
    <h2>cross</h2>
    <Chart :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
