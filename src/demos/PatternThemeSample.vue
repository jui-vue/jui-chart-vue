<script setup lang="ts">
// `theme: 'pattern'`'s own `colors` are named SVG-pattern-fill identifiers
// (`"pattern-jennifer-01"` etc, not real colors) that `Builder.createPattern()` resolves via the
// SAME registry `registerTheme()` uses, under the key `"pattern.jennifer"` (NOT `"pattern.classic"`
// - the pattern file's own declared module name is irrelevant to this specific runtime lookup; see
// `register/pattern/classic.ts`'s own header comment for the full derivation). Now registered, so
// these shapes render the real striped/dotted pattern fills (each a small embedded PNG tile) -
// previously (before that registration existed) this demo rendered solid black instead, since an
// unregistered pattern id falls through to an invalid literal `fill` attribute.
import Chart from '../Chart.vue'

// A pie's real data shape (confirmed via `PieSample.vue`'s own demo, Phase 1) is ONE row with
// MULTIPLE fields - each field is a slice. The previous version of this demo used 4 separate rows
// each with a single 'value' field instead, which isn't a valid multi-slice pie shape at all - it
// produced 4 full, fully-overlapping 360° circles (the FIRST slice's pattern repeated 4x - a real
// demo-authoring bug, unrelated to the pattern-registration fix above, that made this demo's
// circle look black-ish/wrong even after the registration fix, since Chromium apparently couldn't
// resolve the pattern `<image>` reliably when 4 identical, fully-overlapping `<circle>`s referenced
// the same pattern def - fixed by using the correct single-row/multi-field shape instead).
const axis = [{ data: [{ a: 40, b: 25, c: 20, d: 15 }] }]

const brush = [{ type: 'pie', target: ['a', 'b', 'c', 'd'] }]

const widget = [{ type: 'title', text: 'Pattern Theme Sample' }]
</script>

<template>
  <div class="demo">
    <h2>theme: pattern</h2>
    <Chart :width="500" :height="350" theme="pattern" :axis="axis" :brush="brush" :widget="widget" />
  </div>
</template>
