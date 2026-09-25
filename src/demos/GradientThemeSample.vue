<script setup lang="ts">
// `theme: 'gradient'`'s own `colors` are jui's `"linear(top) #hex1,0.9 #hex2"` gradient-descriptor
// strings (see `register/theme/gradient.ts`'s own header comment) - resolved into real SVG
// `<linearGradient>` defs by `Builder.createColor()`/`colorUtil.parse()` (already a real, ported
// feature, confirmed by reading both directly - not something this task needed to add).
import Chart from '../Chart.vue'

// A pie's real data shape (confirmed via `PieSample.vue`'s own demo, Phase 1) is ONE row with
// MULTIPLE fields - each field is a slice. The previous version of this demo used 4 separate rows
// each with a single 'value' field instead, which isn't a valid multi-slice pie shape at all - it
// produced 4 full, fully-overlapping 360° circles (same gradient repeated, so visually
// indistinguishable from one - a real demo-authoring bug, unrelated to the gradient theme itself,
// only caught once the pattern theme's equivalent bug became visibly obvious as solid black).
const axis = [{ data: [{ a: 40, b: 25, c: 20, d: 15 }] }]

const brush = [{ type: 'pie', target: ['a', 'b', 'c', 'd'] }]

const widget = [{ type: 'title', text: 'Gradient Theme Sample' }]
</script>

<template>
  <div class="demo">
    <h2>theme: gradient</h2>
    <Chart :width="500" :height="350" theme="gradient" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
