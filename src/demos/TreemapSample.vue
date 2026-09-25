<script setup lang="ts">
// No legacy demo exists for `treemap` (checked examples/ - none reference this brush, same finding
// `main` branch's own TreemapPage.vue header comment independently reached) - a representative
// 2-level folder/file tree is used here instead.
import Chart from '../Chart.vue'

const axis = [
  {
    data: [
      { index: '0', text: 'Documents', value: 0 },
      { index: '0.0', text: 'report.pdf', value: 55 },
      { index: '0.1', text: 'notes.txt', value: 25 },
      { index: '1', text: 'Media', value: 0 },
      { index: '1.0', text: 'video.mp4', value: 120 },
      { index: '1.1', text: 'photo.png', value: 25 },
      { index: '1.2', text: 'audio.mp3', value: 15 },
      { index: '2', text: 'archive.zip', value: 60 },
    ],
  },
]

const brush = [
  {
    type: 'treemap',
    titleDepth: 1,
    showText: true,
    format: (node: { text: string; value: number }) => `${node.text} (${node.value})`,
  },
]

const widget = [{ type: 'title', text: 'Disk Usage Treemap' }]
</script>

<template>
  <div class="demo">
    <h2>treemap</h2>
    <Chart :width="500" :height="400" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
