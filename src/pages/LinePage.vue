<script setup lang="ts">
// No line.js example ships in jui-chart/examples/ - this uses a representative monthly-series
// dataset to exercise symbol="normal"/"curve"/"step" and the point markers + hover tooltip.
import { ref } from 'vue'
import LineChart from '../components/LineChart.vue'
import type { AxisConfig, ChartElementEventPayload, DataRow } from '../types'

const data: DataRow[] = [
  { month: 'Jan', visits: 120, signups: 30 },
  { month: 'Feb', visits: 132, signups: 45 },
  { month: 'Mar', visits: 101, signups: 28 },
  { month: 'Apr', visits: 154, signups: 52 },
  { month: 'May', visits: 190, signups: 61 },
  { month: 'Jun', visits: 176, signups: 58 },
]

const axisX: AxisConfig = { type: 'block', domain: 'month' }
const axisY: AxisConfig = { type: 'range', domain: ['visits', 'signups'], step: 4 }

// `stacked` needs a y-domain wide enough for the CUMULATIVE sum (visits+signups), not each
// target's own independent max - a plain `domain: ['visits', 'signups']` (like the charts above)
// would clip the stacked line since it only covers each target's own range.
const axisYStacked: AxisConfig = { type: 'range', domain: (d) => d.visits + d.signups, step: 4 }

// Extra top padding so the "display" balloon on the topmost point (May's visits=190, close to the
// axis max) isn't clipped by the root <svg>'s own viewBox - same fix pattern as BarPage's
// `displayPadding`/the axis-orient demo's explicit padding overrides.
const displayPadding = { top: 44, right: 24, bottom: 32, left: 48 }

// Per-element event forwarding demo - ported from `brush/core.js`'s `addEvent()`. See
// `LineChart.vue`'s header comment: `dataIndex`/`data` are always `null` here since line.js wires
// its per-series `<path>`, not per-point.
const lastEvent = ref<{ type: string; payload: ChartElementEventPayload } | null>(null)
function onLineClick(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'click', payload }
}
function onLineMouseover(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseover', payload }
}
function onLineMouseout(payload: ChartElementEventPayload) {
  lastEvent.value = { type: 'mouseout', payload }
}

// `zoomable` demo - ported from widget/zoom.js. Mirrors the exact geometry already established by
// the guideline/crosshair demos above (width=600, default padding => area.x=48, area.x2=576,
// area.width=528; 6 rows => band=88) so a drag from x=136 to x=400 lands exactly on [1,4) -
// Feb/Mar/Apr - a hand-traceable, Playwright-checkable interaction (see PORT_STATUS.md's
// `zoom.js` entry).
const lastZoom = ref<{ start: number; end: number } | null>(null)
function onZoom(window: { start: number; end: number } | null) {
  lastZoom.value = window
}

// `dragSelect` demos - ported from widget/dragselect.js. Same dataset/axes/geometry as the demos
// above, so a drag rectangle's hit points are hand-traceable off the SAME already-verified tick
// positions (Jan=92, Feb=180, Mar=268, ... x pixels) - see PORT_STATUS.md's `dragselect.js` entry.
interface DragSelectItem {
  dataIndex: number
  dataKey: string
  data: DataRow
}
interface DragSelectRange {
  x1: string | number
  y1: string | number
  x2: string | number
  y2: string | number
}

const lastDragSelectList = ref<DragSelectItem[] | null>(null)
function onDragSelectList(selection: DragSelectItem[] | DragSelectRange) {
  lastDragSelectList.value = selection as DragSelectItem[]
}

const lastDragSelectArea = ref<DragSelectRange | null>(null)
function onDragSelectArea(selection: DragSelectItem[] | DragSelectRange) {
  lastDragSelectArea.value = selection as DragSelectRange
}

// `scrollable`/`verticalScrollable` demos - ported from widget/scroll.js/vscroll.js. Same 6-row dataset/
// default geometry as the zoomable demo above (width=600, default padding => area.x=48, area.x2=576,
// trackSize=528) with visibleCount=3, so the thumb's size/travel is hand-traceable off
// useScrollWindow.spec.ts's own worked example (thumbSize=266, max gap=262, dragging fully right
// reaches start=3 i.e. Apr/May/Jun via the +1 edge correction).
const extraBottomPadding = { top: 20, right: 24, bottom: 48, left: 48 }
const extraLeftPadding = { top: 20, right: 24, bottom: 32, left: 64 }

// `zoomScrollable` demo - ported from widget/zoomscroll.js. Same 6-row dataset/default geometry as
// the zoomable/scrollable demos above (width=600, default padding => area.x=48, area.x2=576,
// trackWidth=528, count=6 rows => tick=88 - matching useZoomScroll.spec.ts's own worked example)
// - needs more bottom padding than `scrollable` (the widget's own track is 45px tall, plus its
// embedded thumbnail chart's tick labels underneath it).
const zoomScrollPadding = { top: 20, right: 24, bottom: 90, left: 48 }
const lastZoomScroll = ref<{ start: number; end: number } | null>(null)
function onZoomScroll(window: { start: number; end: number }) {
  lastZoomScroll.value = window
}
</script>

<template>
  <div>
    <h2>Line chart</h2>
    <p class="desc">Ported from <code>src/brush/line.js</code>. No dedicated example ships in jui-chart/examples - this uses sample monthly data instead.</p>

    <h3>symbol="normal"</h3>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points title="Monthly visits & signups" />

    <h3>symbol="curve"</h3>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" symbol="curve" show-points />

    <h3>symbol="step"</h3>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" symbol="step" show-points />

    <h3>active="signups" (static highlight + dim)</h3>
    <p class="desc">Ported from line.js's <code>active</code> (<code>setActiveEffects()</code>): the named series stays at full opacity, the rest dim to <code>theme('lineDisableBorderOpacity')</code>.</p>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points active="signups" />

    <h3>activeEvent="mouseover" (hover a line to highlight it, dim the rest)</h3>
    <p class="desc">Ported from line.js's <code>activeEvent</code> (<code>setActiveEffect()</code>). Hover either line below.</p>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points active-event="mouseover" />

    <h3>display="max" | "min" | "all"</h3>
    <p class="desc">
      Ported from line.js's <code>display</code> option (<code>createTooltip()</code>): a persistent value label on the point(s) holding each
      target's max value ("max"), min value ("min"), or on every point ("all") - independent of hover.
    </p>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points display="max" :padding="displayPadding" />
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points display="min" :padding="displayPadding" />
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points display="all" :padding="displayPadding" />

    <h3>stacked (same data, non-stacked vs. stacked)</h3>
    <p class="desc">
      Ported from <code>stackline.js</code> (a thin wrapper swapping <code>getXY()</code> for <code>getStackXY()</code> - see
      <code>LineChart.vue</code>'s header comment). <code>signups</code> is stacked on top of <code>visits</code>: its line now traces
      <code>visits + signups</code> at every point, not its own independent value.
    </p>
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points title="non-stacked" />
    <LineChart :data="data" :axis-x="axisX" :axis-y="axisYStacked" :target="['visits', 'signups']" show-points stacked title="stacked" />

    <h3>Per-element event forwarding</h3>
    <p class="desc">
      Ported from <code>brush/core.js</code>'s <code>addEvent()</code>/<code>chart.emit()</code> - <code>click</code>/<code>dblclick</code>/
      <code>contextmenu</code>/<code>mouseover</code>/<code>mouseout</code> now forward a <code>{dataIndex, dataKey, data, event}</code> payload
      per-series (line.js wires the whole line path, not per-point, so <code>dataIndex</code>/<code>data</code> are always <code>null</code> here -
      see <code>BarChart</code>'s demo for a per-row payload instead). Hover or click a line below.
    </p>
    <LineChart
      :data="data"
      :axis-x="axisX"
      :axis-y="axisY"
      :target="['visits', 'signups']"
      show-points
      @click="onLineClick"
      @mouseover="onLineMouseover"
      @mouseout="onLineMouseout"
    />
    <p class="desc" data-testid="last-line-event">
      Last event: <code v-if="lastEvent">{{ lastEvent.type }} dataIndex={{ lastEvent.payload.dataIndex }}, dataKey="{{ lastEvent.payload.dataKey }}"</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>guideline (hover a snapped, per-row value guide)</h3>
    <p class="desc">
      Ported from <code>widget/guideline.js</code>. Hover anywhere over the plot - a vertical line snaps to the NEAREST DATA ROW (not the raw
      pointer position) and a tooltip lists every target's value at that row, with a colored dot on each target's own point. See
      <code>LineChart.vue</code>'s header comment for why this is a separate feature from <code>crosshair</code> below, not a redundant pair.
    </p>
    <div data-testid="line-guideline-demo">
      <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points guideline title="guideline" />
    </div>

    <h3>crosshair (hover a raw-position crosshair with an axis-value readout)</h3>
    <p class="desc">
      Ported from <code>widget/cross.js</code>. Hover anywhere over the plot - both lines track the RAW pointer position (no snapping to a data
      row), each paired with a simple axis-value balloon (<code>crosshairXFormat</code>/<code>crosshairYFormat</code> below round the y-axis
      readout to the nearest integer; the x-axis readout shows the raw block-axis tick label under the pointer).
    </p>
    <div data-testid="line-crosshair-demo">
      <LineChart
        :data="data"
        :axis-x="axisX"
        :axis-y="axisY"
        :target="['visits', 'signups']"
        show-points
        crosshair
        :crosshair-y-format="(v) => Math.round(Number(v))"
        title="crosshair"
      />
    </div>

    <h3>zoomable (drag-select to zoom, click the "×" to reset)</h3>
    <p class="desc">
      Ported from <code>widget/zoom.js</code>. Drag a rectangle across the plot area (only meaningful for a <code>"block"</code> x-axis) to
      re-window the visible rows by index - a REAL zoom: both axes' domains re-derive from just the visible rows, not a visual transform. A reset
      ("×") icon appears at the top-right corner once zoomed; click it to show the full dataset again.
    </p>
    <div data-testid="line-zoomable-demo">
      <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points zoomable title="zoomable" @zoom="onZoom" />
    </div>
    <p class="desc" data-testid="last-zoom-event">
      Last zoom window: <code v-if="lastZoom">[{{ lastZoom.start }}, {{ lastZoom.end }})</code><code v-else>(none - full data)</code>
    </p>

    <h3>dragSelect="list" (default - drag a box to select the points inside it)</h3>
    <p class="desc">
      Ported from <code>widget/dragselect.js</code>. Drag a rectangle over the plot area - every rendered point (across both
      <code>visits</code>/<code>signups</code> series) whose pixel falls inside it is emitted as a <code>{dataIndex, dataKey, data}</code> match.
      Purely a passive notification (unlike <code>zoomable</code> above, it never re-windows the data) - see <code>LineChart.vue</code>'s header
      comment for why this is genuinely distinct from <code>FocusChart</code>'s <code>selectEvent</code>/<code>zoomable</code>/
      <code>SelectBoxChart</code>.
    </p>
    <div data-testid="line-dragselect-list-demo">
      <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points drag-select title="dragSelect (list)" @dragselect="onDragSelectList" />
    </div>
    <p class="desc" data-testid="last-dragselect-list-event">
      Last selection:
      <code v-if="lastDragSelectList && lastDragSelectList.length">{{ lastDragSelectList.map((m) => `${m.dataKey}[${m.dataIndex}]`).join(', ') }}</code>
      <code v-else-if="lastDragSelectList">(empty - no points in the dragged box)</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>dragSelect="area" (drag a box to emit just the dragged range)</h3>
    <p class="desc">
      Ported from <code>dragselect.js</code>'s own <code>dataType: "area"</code> option. Skips per-point matching entirely - just emits the
      dragged rectangle's own two corners as axis values.
    </p>
    <div data-testid="line-dragselect-area-demo">
      <LineChart
        :data="data"
        :axis-x="axisX"
        :axis-y="axisY"
        :target="['visits', 'signups']"
        show-points
        drag-select
        drag-select-mode="area"
        title="dragSelect (area)"
        @dragselect="onDragSelectArea"
      />
    </div>
    <p class="desc" data-testid="last-dragselect-area-event">
      Last range:
      <code v-if="lastDragSelectArea">x: [{{ lastDragSelectArea.x1 }}, {{ lastDragSelectArea.x2 }}], y: [{{ lastDragSelectArea.y1 }}, {{ lastDragSelectArea.y2 }}]</code>
      <code v-else>(none yet)</code>
    </p>

    <h3>scrollable (drag the scrollbar thumb below to pan through a fixed-size window of rows)</h3>
    <p class="desc">
      Ported from <code>widget/scroll.js</code>. <code>visibleCount=3</code> shows only 3 of the 6 months at a time - drag the scrollbar thumb to
      pan the window's start; unlike <code>zoomable</code> above, the window's WIDTH never changes, only which rows are visible. See
      <code>useScrollWindow.ts</code>'s header comment for the full interaction-model writeup and its relationship to the still-unported
      <code>zoomscroll.js</code>.
    </p>
    <div data-testid="line-scrollable-demo">
      <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points scrollable :visible-count="3" :padding="extraBottomPadding" title="scrollable" />
    </div>

    <h3>verticalScrollable (same fixed-size window, a vertical scrollbar to the left)</h3>
    <p class="desc">
      Ported from <code>widget/vscroll.js</code>. Shares the exact same underlying row-index window as <code>scrollable</code> (both drive the
      identical <code>axis.zoom()</code>-equivalent slice, confirmed from source) - only the UI handle differs.
    </p>
    <div data-testid="line-vscrollable-demo">
      <LineChart :data="data" :axis-x="axisX" :axis-y="axisY" :target="['visits', 'signups']" show-points vertical-scrollable :visible-count="3" :padding="extraLeftPadding" title="verticalScrollable" />
    </div>

    <h3>zoomScrollable (drag either edge handle to resize the window, drag the center pane to pan it)</h3>
    <p class="desc">
      Ported from <code>widget/zoomscroll.js</code> - the last Phase D item. A persistent control strip below the chart with an embedded thumbnail
      preview (a real small nested <code>AreaChart</code> here, showing the FULL <code>visits</code> series across all 6 months, never just the
      currently zoomed window). Drag the left or right handle to narrow the visible window from that side (a real axis-domain rescale, exactly like
      <code>zoomable</code> above); drag the center pane to pan the fixed-width window instead (the same underlying math as
      <code>scrollable</code>'s thumb). Shares <code>zoomable</code>'s own zoom state - see <code>useZoomScroll.ts</code>'s header comment for the
      full design writeup.
    </p>
    <div data-testid="line-zoomscroll-demo">
      <LineChart
        :data="data"
        :axis-x="axisX"
        :axis-y="axisY"
        :target="['visits', 'signups']"
        show-points
        zoom-scrollable
        zoom-scroll-key="visits"
        :padding="zoomScrollPadding"
        title="zoomScrollable"
        @zoomscroll="onZoomScroll"
      />
    </div>
    <p class="desc" data-testid="last-zoomscroll-event">
      Last zoomscroll window: <code v-if="lastZoomScroll">[{{ lastZoomScroll.start }}, {{ lastZoomScroll.end }})</code><code v-else>(none yet - full data)</code>
    </p>
  </div>
</template>

<style scoped>
.desc {
  font-size: 12px;
  color: #666;
  max-width: 640px;
}
</style>
