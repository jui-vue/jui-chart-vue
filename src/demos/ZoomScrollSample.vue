<script setup lang="ts">
// No legacy demo exists for `zoomscroll` (checked examples/ - none reference this widget). A
// column chart with enough columns to make the minimap snapshot + end-cap window meaningful.
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
  { type: 'title', text: 'ZoomScroll Sample (windowed to 5 of 12 columns)' },
  { type: 'zoomscroll', axis: 0, key: 'value', symbol: 'area' },
]
</script>

<template>
  <div class="demo">
    <h2>zoomscroll</h2>
    <Chart :width="500" :height="380" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
