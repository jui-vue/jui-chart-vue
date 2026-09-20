<script setup lang="ts">
// `pointer-events: none` on the root `<g>`: a value-readout balloon should never itself become a
// mouse target - found the hard way while building `LineChart.vue`'s `guideline`/`crosshair`
// props (widget/guideline.js, widget/cross.js), whose own tooltip can render directly under the
// still-hovering pointer (unlike this component's other, point-anchored callers): without this,
// the balloon's own `<text>`/`<rect>` becomes the topmost hit-test target at that pixel, firing a
// native `mouseleave` on the hover-tracking element underneath even though the pointer never
// physically moved - a self-covering flicker loop (tooltip appears -> covers cursor -> "leave"
// fires -> tooltip disappears -> repeat). Confirmed via Playwright's `document.elementFromPoint()`
// and a `relatedTarget` dump on the spurious `mouseleave` (it resolved to this component's own
// `<text>`). Harmless for every existing caller (a value readout has no interactive content of
// its own to lose).
//
// A hover-triggered floating balloon, ported (simplified) from `chart.widget.tooltip`: the
// original measures each line's real text width via `chart.svg.getTextSize()` (an offscreen SVG
// `<text>` appended to `document.body`, measured, then removed) and supports flipping
// orientation when the balloon would run off the axis; this port measures the same way (see
// `measureTextWidth` below, using `SVGTextElement.getComputedTextLength()` in place of the
// original's `getBoundingClientRect()` - simpler and exactly the "advance width" of the text) but
// still always anchors above the point, which covers the MVP's demo usage.
import { computed } from 'vue'
import { computeBoxWidth, lineText, measureTextWidth } from '../composables/tooltipMeasure'

const props = withDefaults(
  defineProps<{
    visible: boolean
    x: number
    y: number
    items: { key?: string; value: string | number }[]
    backgroundColor?: string
    backgroundOpacity?: number
    borderColor?: string
    fontColor?: string
    fontSize?: number
  }>(),
  {
    backgroundColor: '#fff',
    backgroundOpacity: 0.95,
    borderColor: '#a9a9a9',
    fontColor: '#333',
    fontSize: 12,
  },
)

const PADDING = 7
const ANCHOR = 6

const lineHeight = computed(() => props.fontSize * 1.2)

// `measureTextWidth` (the offscreen `<text>` + `getComputedTextLength()` measurement) now lives in
// `tooltipMeasure.ts`, shared with `RateBarChart.vue`'s own text-fit check - see that module's doc
// comment for the lazy/module-level-singleton reasoning (unchanged from when it was private here).

const boxWidth = computed(() => {
  const widths = props.items.map((it) => measureTextWidth(lineText(it), props.fontSize))
  return computeBoxWidth(widths, PADDING)
})

const boxHeight = computed(() => props.items.length * lineHeight.value + PADDING)

const originX = computed(() => props.x - boxWidth.value / 2)
const originY = computed(() => props.y - boxHeight.value - ANCHOR - PADDING)
</script>

<template>
  <g v-if="visible" class="jui-chart-vue-tooltip" style="pointer-events: none">
    <path :d="`M ${x - ANCHOR} ${originY + boxHeight} L ${x} ${originY + boxHeight + ANCHOR} L ${x + ANCHOR} ${originY + boxHeight} Z`" :fill="backgroundColor" :fill-opacity="backgroundOpacity" :stroke="borderColor" />
    <rect :x="originX" :y="originY" :width="boxWidth" :height="boxHeight" rx="2" :fill="backgroundColor" :fill-opacity="backgroundOpacity" :stroke="borderColor" />
    <text v-for="(item, i) in items" :key="i" :x="originX + PADDING" :y="originY + PADDING + lineHeight * (i + 0.75)" :font-size="fontSize" :fill="fontColor">
      {{ lineText(item) }}
    </text>
  </g>
</template>
