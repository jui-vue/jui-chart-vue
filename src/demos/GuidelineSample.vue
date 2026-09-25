<script setup lang="ts">
// No legacy demo exists for `guideline` (checked examples/ - none reference this widget). Unlike
// `cross`'s mouse-driven crosshair, `guideline` is driven entirely through a custom
// `guideline.show`/`guideline.hide` event pair (see `guideline.ts`'s own header comment) - nothing
// shows it automatically on mount, so this demo reaches through `<Chart>`'s own `getBuilder()`
// escape hatch (documented in `Chart.vue` as "for tests/advanced use") to simulate a real caller
// (e.g. another widget, or an app's own UI) scrubbing to a specific x value, so the screenshot
// shows the guide line + tooltips actually drawn rather than just their hidden initial state.
import { onMounted, ref, nextTick } from 'vue'
import Chart from '../Chart.vue'

const axis = [
  {
    x: { type: 'range', domain: [0, 6], step: 1, line: true },
    y: { type: 'range', domain: [0, 100], line: true },
    data: [
      { value1: 40, value2: 20 },
      { value1: 55, value2: 35 },
      { value1: 30, value2: 45 },
      { value1: 70, value2: 50 },
      { value1: 60, value2: 30 },
      { value1: 25, value2: 40 },
      { value1: 15, value2: 25 },
    ],
  },
]

const brush = [{ type: 'line', target: ['value1', 'value2'] }]

const widget = [
  { type: 'title', text: 'Guideline Sample (scrubbed to x=3)' },
  {
    type: 'guideline',
    brush: 0,
    xFormat: (v: unknown) => `x: ${Math.round(v as number)}`,
    tooltipFormat: (data: Record<string, unknown>, key: string) => ({ key, value: data[key] }),
  },
]

const chartRef = ref<InstanceType<typeof Chart> | null>(null)

onMounted(async () => {
  await nextTick()
  const builder = chartRef.value?.getBuilder()
  builder?.emit('guideline.show', [3])
})
</script>

<template>
  <div class="demo">
    <h2>guideline</h2>
    <Chart ref="chartRef" :width="500" :height="350" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
