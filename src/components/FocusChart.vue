<script setup lang="ts">
// Ported from `chart.brush.focus` (98 lines). **Source-confirmed, don't assume from the name**:
// `extend: "chart.brush.core"` directly. Read all 98 lines before writing this file.
//
// **What it actually is, confirmed from `drawBefore()`/`draw()`/`drawFocus()`**: a translucent
// rect with a solid border line on each of its two edges, spanning the full plot area in the
// perpendicular dimension, positioned between two config indices (`start`/`end`, both `-1` by
// default - nothing renders until both are set). It draws NOTHING else and never calls
// `this.addEvent(...)` - the overlay itself isn't a clickable/hoverable element upstream, unlike
// most brush types already ported. See `useFocus.ts`'s header comment for the full derivation of
// `focusPixelRange`/`focusGridAxis`, which this component renders unmodified.
//
// **Dependency check (per this port's Phase C process)**: does `focus.js` need any unported Phase D
// widget (`widget/zoom.js`/`widget/zoomscroll.js`/`widget/zoomselect.js`) to function? No - grepped
// the whole file: it reads only `this.axis`/`this.chart`/`this.svg`/`this.brush`, all supplied by
// `chart.brush.core` itself. It's a pure renderer, fully functional given nothing but `start`/`end`
// - it just has no drag/click logic of ITS OWN (no `this.on(...)` anywhere in the file); upstream,
// something external (hand-rolled app code, not a documented widget pairing - `zoomselect.js`/
// `dragselect.js` were also read in full and neither ever looks up a brush by type `"focus"` or
// writes to a brush's `start`/`end`) is expected to drive it. Confirmed via grep across
// `jui-chart/examples/*.html`: **no example anywhere uses a `focus` brush type at all** - it's
// wired to nothing in the reference app either. So this port adds a minimal, clearly-separate
// click-to-select capability (`selectEvent` prop, `resolveFocusSelection` in `useFocus.ts`) so the
// component is genuinely interactive standalone, without inventing a free-drag/pixel-inversion
// gesture that has no precedent anywhere else in this port (every other interactive element here is
// a discrete SVG shape with a node-level DOM listener - see `SelectBoxChart.vue` for the closest
// precedent, which this component's hit-target cells are modeled on).
//
// **Structural shape**: like `SelectBoxChart.vue`, this is a `ChartBase`-wrapped overlay-only brush
// (no data series of its own) - not a standalone-`<svg>` component like `TimelineChart`/
// `PyramidChart`/`ArcEqualizerChart` (those draw their own complete axis/chrome; this one draws
// nothing without `ChartBase`'s grid/axis underneath it, exactly like `focus.js` upstream, which is
// always layered over another brush's axis in real usage).
import { computed, ref, toRef } from 'vue'
import { useChartLayout } from '../composables/useChartLayout'
import { focusGridAxis, focusPixelRange, resolveFocusSelection, type FocusSelectionState } from '../composables/useFocus'
import { useTheme } from '../composables/useTheme'
import ChartBase from './ChartBase.vue'
import ChartTitle from './ChartTitle.vue'
import type { AxisConfig, ChartPadding, DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow[]
    axisX: AxisConfig
    axisY: AxisConfig
    width?: number
    height?: number
    theme?: ThemeName
    padding?: Partial<ChartPadding>
    showGrid?: boolean
    title?: string
    /** Focus start index. `-1` (default, matches `focus.js`'s own `@cfg` default) renders nothing. */
    start?: number
    /** Focus end index. `-1` (default) renders nothing. */
    end?: number
    /**
     * **Added, not ported** (see this file's header comment) - a DOM event name (e.g. `"click"`)
     * that, when the grid axis (see `useFocus.ts`'s `focusGridAxis`) is `"block"`-typed, arms a
     * 2-click range picker over per-category hit-target cells: the first click picks one end of
     * the range, the second picks the other (order-independent), replacing `start`/`end` for
     * display purposes and firing `change`. `null` (default) disables this, matching `focus.js`
     * having no interaction of its own - the component then only ever shows the static `start`/
     * `end` props, exactly like upstream.
     */
    selectEvent?: string | null
  }>(),
  {
    width: 600,
    height: 400,
    theme: 'classic',
    padding: undefined,
    showGrid: true,
    title: undefined,
    start: -1,
    end: -1,
    selectEvent: null,
  },
)

const emit = defineEmits<{
  /** Fires when a `selectEvent`-driven 2-click selection completes. `data` is the inclusive slice
   * of `props.data` across `[start, end]` (matches how a "focus" overlay is normally consumed: to
   * read off the selected rows, not just the indices). */
  change: [payload: { start: number; end: number; data: DataRow[] }]
}>()

const dataRef = toRef(props, 'data')
const { axisX, axisY, area } = useChartLayout(dataRef, toRef(props, 'axisX'), toRef(props, 'axisY'), toRef(props, 'width'), toRef(props, 'height'), toRef(props, 'padding'))

const themeName = toRef(props, 'theme')
const { theme } = useTheme(themeName)

// `selectEvent`-driven state is INTERNAL and overrides the `start`/`end` props once a selection
// exists (or is in progress) - same "prop is the static default, an internal ref takes over once
// the user interacts" shape as `PieChart.vue`'s `active`/`activeEvent` pair.
const selection = ref<FocusSelectionState>({ pendingStart: null, start: -1, end: -1 })
const hasSelected = computed(() => selection.value.start !== -1 && selection.value.end !== -1)

const effectiveStart = computed(() => (hasSelected.value ? selection.value.start : props.start))
const effectiveEnd = computed(() => (hasSelected.value ? selection.value.end : props.end))

const grid = computed(() => focusGridAxis(axisY.value.type))
const gridAxis = computed(() => (grid.value === 'x' ? axisX.value : axisY.value))

const pixelRange = computed(() => focusPixelRange(gridAxis.value.type, gridAxis.value.scale, gridAxis.value.band, effectiveStart.value, effectiveEnd.value))

// Absolute-coordinate rect/line geometry (this port's established convention - see
// `useChartLayout.ts`'s doc comment and PORT_STATUS.md's coordinate-double-offset writeup - draws
// straight off `area`/the scale's own output, no extra translate wrapper), ported from
// `drawFocus()`'s two translate branches.
const overlayRect = computed(() => {
  const r = pixelRange.value
  if (!r) return null

  const lo = Math.min(r.start, r.end)
  const hi = Math.max(r.start, r.end)

  if (grid.value === 'x') {
    return { x: lo, y: area.value.y, width: hi - lo, height: area.value.height }
  }
  return { x: area.value.x, y: lo, width: area.value.width, height: hi - lo }
})

const borderLines = computed(() => {
  const r = pixelRange.value
  if (!r) return null

  if (grid.value === 'x') {
    return [
      { x1: r.start, x2: r.start, y1: area.value.y, y2: area.value.y2 },
      { x1: r.end, x2: r.end, y1: area.value.y, y2: area.value.y2 },
    ]
  }
  return [
    { x1: area.value.x, x2: area.value.x2, y1: r.start, y2: r.start },
    { x1: area.value.x, x2: area.value.x2, y1: r.end, y2: r.end },
  ]
})

// Click-to-select hit-target cells - one per block-axis tick, spanning the full perpendicular
// plot dimension (same "invisible full-span cell" shape as `SelectBoxChart.vue`'s buckets), only
// meaningful (and only rendered) when `selectEvent` is set AND the grid axis is block-typed (an
// index only identifies one discrete category on a block axis - see `useFocus.ts`'s doc comment
// on why a range-axis grid isn't given click-to-select cells here).
const selectableCells = computed(() => {
  if (!props.selectEvent || gridAxis.value.type !== 'block') return []

  const band = gridAxis.value.band
  return gridAxis.value.values.map((v, i) => {
    if (grid.value === 'x') {
      return { index: i, x: v - band / 2, y: area.value.y, width: band, height: area.value.height }
    }
    return { index: i, x: area.value.x, y: v - band / 2, width: area.value.width, height: band }
  })
})

function onCellSelect(index: number) {
  selection.value = resolveFocusSelection(selection.value, index)
  if (selection.value.pendingStart === null) {
    const lo = Math.min(selection.value.start, selection.value.end)
    const hi = Math.max(selection.value.start, selection.value.end)
    emit('change', { start: selection.value.start, end: selection.value.end, data: props.data.slice(lo, hi + 1) })
  }
}
</script>

<template>
  <ChartBase :data="props.data" :axis-x="props.axisX" :axis-y="props.axisY" :width="props.width" :height="props.height" :theme="props.theme" :padding="props.padding" :show-grid="props.showGrid">
    <g v-if="overlayRect && borderLines" data-testid="focus-overlay">
      <rect :x="overlayRect.x" :y="overlayRect.y" :width="overlayRect.width" :height="overlayRect.height" :fill="theme('focusBackgroundColor')" :fill-opacity="theme('focusBackgroundOpacity')" />
      <line
        v-for="(l, i) in borderLines"
        :key="`focus-border-${i}`"
        :x1="l.x1"
        :x2="l.x2"
        :y1="l.y1"
        :y2="l.y2"
        :stroke="theme('focusBorderColor')"
        :stroke-width="theme('focusBorderWidth')"
      />
    </g>

    <g v-if="selectableCells.length">
      <rect
        v-for="cell in selectableCells"
        :key="`focus-cell-${cell.index}`"
        :x="cell.x"
        :y="cell.y"
        :width="cell.width"
        :height="cell.height"
        fill="transparent"
        cursor="pointer"
        :data-testid="`focus-cell-${cell.index}`"
        @[props.selectEvent]="() => onCellSelect(cell.index)"
      />
    </g>

    <template #overlay>
      <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
    </template>
  </ChartBase>
</template>
