<script setup lang="ts">
// Adapted from `www.jui-vue.io/play/chart/json/pyramid.js` (real legacy demo data/config).
import Chart from '../Chart.vue'

const axis = [
  {
    data: [{ visit: 15654, download: 4064, request: 1987, invoice: 976, final: 846 }],
  },
]

const labels: Record<string, string> = {
  visit: 'Website visits',
  download: 'Downloads',
  request: 'Requested price list',
  invoice: 'Invoice sent',
  final: 'Finalized',
}

const brush = [
  {
    type: 'pyramid',
    target: ['visit', 'download', 'request', 'invoice', 'final'],
    showText: true,
    format: (k: string, v: number) => `${labels[k]} (${v})`,
  },
]

const widget = [
  {
    type: 'tooltip',
    format: (data: Record<string, unknown>, key: string) => data[key],
  },
  { type: 'title', text: 'Sales pyramid' },
]

const style = { pyramidLineWidth: 3 }
</script>

<template>
  <div class="demo">
    <h2>pyramid</h2>
    <Chart :width="500" :height="400" :axis="axis" :brush="brush" :widget="widget" :style="style" />
  </div>
</template>
