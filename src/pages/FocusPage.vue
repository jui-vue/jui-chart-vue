<script setup lang="ts">
// focus.js: a translucent rect with a border line on each edge, spanning the full plot area in the
// perpendicular dimension, between two config indices (`start`/`end`, both -1 by default - nothing
// renders until both are set). Source-confirmed `extend: "chart.brush.core"` directly, no
// `addEvent()` calls anywhere (the overlay itself isn't interactive upstream), and NO dependency on
// any zoom widget (`widget/zoom.js`/`widget/zoomscroll.js`/`widget/zoomselect.js`) - grepped the
// whole file plus every `jui-chart/examples/*.html` (none use a `focus` brush type at all) and both
// `zoomselect.js`/`dragselect.js` (neither ever targets a `"focus"`-typed brush). See
// `FocusChart.vue`'s header comment for the full writeup, and `useFocus.ts` for the pure logic
// (`focusPixelRange`/`focusGridAxis`, faithfully ported; `resolveFocusSelection`, an ADDED
// click-to-select capability since the source has none of its own).
import { computed, ref } from 'vue'
import BarChart from '../components/BarChart.vue'
import FocusChart from '../components/FocusChart.vue'
import type { AxisConfig, DataRow } from '../types'

// 6 categories, round sales numbers - with explicit axis min/max/step so the "nice domain"
// algorithm resolves to EXACTLY [0,100] and the block-axis pixel math hand-traces cleanly (same
// hand-verification-friendly pattern as SelectBoxPage/PinPage).
const monthlyData: DataRow[] = [
  { month: 'Jan', sales: 40 },
  { month: 'Feb', sales: 60 },
  { month: 'Mar', sales: 30 },
  { month: 'Apr', sales: 90 },
  { month: 'May', sales: 50 },
  { month: 'Jun', sales: 70 },
]
const monthAxisX: AxisConfig = { type: 'block', domain: 'month' }
const monthAxisY: AxisConfig = { type: 'range', domain: 'sales', min: 0, max: 100, step: 10 }

// Horizontal-orientation dataset for the "y" grid branch (`axis.y.type` is `"block"`, not
// `"range"`) - 4 teams on y, a range x-axis.
const teamData: DataRow[] = [
  { team: 'Falcons', score: 82 },
  { team: 'Otters', score: 54 },
  { team: 'Wolves', score: 91 },
  { team: 'Herons', score: 67 },
]
const teamAxisX: AxisConfig = { type: 'range', domain: 'score', min: 0, max: 100, step: 10 }
const teamAxisY: AxisConfig = { type: 'block', domain: 'team' }

// Interactive (click-to-select) demo state.
const selection = ref<{ start: number; end: number; data: DataRow[] } | null>(null)
function onChange(payload: { start: number; end: number; data: DataRow[] }) {
  selection.value = payload
}
const selectedTotal = computed(() => (selection.value ? selection.value.data.reduce((sum, row) => sum + row.sales, 0) : 0))
</script>

<template>
  <div>
    <h2>focus.js</h2>
    <p class="desc">
      Source-confirmed: <code>extend: "chart.brush.core"</code> directly. A translucent rect + 2 border lines between <code>start</code>/
      <code>end</code> indices (both <code>-1</code> by default - nothing renders). No <code>addEvent()</code> anywhere upstream (the overlay
      itself isn't clickable/hoverable in the original), and confirmed to have NO dependency on any zoom widget - it's a pure renderer, driven
      entirely by its <code>start</code>/<code>end</code> config. No <code>jui-chart/examples/*.html</code> file uses a <code>focus</code> brush
      type at all.
    </p>

    <h3>Static <code>start</code>/<code>end</code> (block x-axis, the common "x" grid branch)</h3>
    <p class="desc">
      <code>axis.y.type === "range"</code> selects the <code>"x"</code> grid branch. <code>start=1, end=3</code> (Feb..Apr) over a 6-category,
      528px-wide plot area (default padding: left 48, right 24): band = 88px, so the overlay expands from <code>scale(1)-44=136</code> to
      <code>scale(3)+44=400</code> - width 264.
    </p>
    <FocusChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :start="1" :end="3" title="Feb - Apr focus" data-testid="focus-static-x" />

    <h3>Faithfully-preserved source quirk: a REVERSED selection (<code>start=3, end=1</code>)</h3>
    <p class="desc">
      <code>drawFocus()</code> applies <code>-band/2</code> to whichever index is passed as <code>start</code> and <code>+band/2</code> to
      whichever is passed as <code>end</code> - not to whichever pixel position ends up smaller. Reversing the two indices here therefore does
      NOT just mirror the same rect: <code>scale(3)-44=312</code>, <code>scale(1)+44=224</code> - a narrower 88px-wide rect at a different
      position, not the 264px-wide rect from the section above. This port renders it exactly as computed (min/max only decide which edge is
      "left" on screen, not the geometry itself).
    </p>
    <FocusChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :start="3" :end="1" title="Reversed: 3, 1" data-testid="focus-reversed" />

    <h3>Horizontal orientation ("y" grid branch): <code>axis.y.type</code> is <code>"block"</code></h3>
    <p class="desc">
      <code>start=0, end=1</code> (Falcons..Otters) over a 4-category, 348px-tall plot area: band = 87px, so the overlay spans
      <code>scale(0)-43.5=20</code> to <code>scale(1)+43.5=194</code>.
    </p>
    <FocusChart :data="teamData" :axis-x="teamAxisX" :axis-y="teamAxisY" :start="0" :end="1" title="Falcons - Otters focus" data-testid="focus-static-y" />

    <h3>Unset (<code>start</code>/<code>end</code> left at the default <code>-1</code>): renders nothing</h3>
    <FocusChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" data-testid="focus-unset" />

    <h3>Interactive click-to-select (added - see header comment: <code>focus.js</code> has no interaction of its own)</h3>
    <p class="desc">
      <code>selectEvent="click"</code> arms a 2-click range picker over invisible per-category hit cells. Click any two months below to select
      the (inclusive) range between them - this also demonstrates pairing a focus overview with a separate "detail" chart entirely via this
      port's own Vue reactivity (<code>@change</code> + a computed slice), with no dependency on jui-chart's unported zoom widgets.
    </p>
    <FocusChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" select-event="click" title="Click 2 months to select a range" data-testid="focus-interactive" @change="onChange" />
    <p class="desc" data-testid="focus-selection-readout">
      <code v-if="selection">Selected: {{ monthlyData[selection.start]?.month }} - {{ monthlyData[selection.end]?.month }} (indices {{ selection.start }}-{{ selection.end }}), total sales = {{ selectedTotal }}</code>
      <code v-else>(click two months above)</code>
    </p>
    <BarChart v-if="selection" :data="selection.data" :axis-x="{ type: 'block', domain: 'month' }" :axis-y="monthAxisY" :target="['sales']" title="Detail: selected range" data-testid="focus-detail-chart" />

    <h3>Dark theme</h3>
    <FocusChart :data="monthlyData" :axis-x="monthAxisX" :axis-y="monthAxisY" :start="1" :end="4" theme="dark" title="Dark theme" />
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
