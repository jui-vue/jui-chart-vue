<script setup lang="ts">
// Dedicated demo for the icon-font subsystem (`register/icon/classic.ts` + `<Chart>`'s default
// `icon` prop wiring, both new this round) - `{key}`-style icon-font placeholders (`chart.text()`'s
// `parseIconInText()`) via the `title` widget.
//
// NOTE: in a real Chromium screenshot (Playwright), these currently render as "tofu"/missing-glyph
// boxes, NOT the real icons - OPEN ISSUE, NOT FIXED, root cause unknown (a prior "confirmed fix"
// attributing this to `Builder.setVectorFontIcons()`'s specific CSS-injection technique was later
// disproven by a more rigorous re-test - see `register/icon/classic.ts`'s own header comment for
// the full history). The underlying wiring IS fully correct and unit-tested (codepoint resolution,
// font loading, CSS font-family cascade, exactly one `@font-face` rule present) - only the final
// Chromium glyph PAINT is affected, for reasons not yet identified. This demo is kept as an honest
// visual record of that known, flagged, not-currently-being-investigated-further issue.
import Chart from '../Chart.vue'

const axis = [{ data: [] }]

const widget = [
  { type: 'title', text: '{check} {close} {search} {chart-bar} {home}', size: 32, dy: 20 },
]
</script>

<template>
  <div class="demo">
    <h2>icon font (classic)</h2>
    <Chart :width="500" :height="150" :axis="axis" :widget="widget" />
  </div>
</template>
