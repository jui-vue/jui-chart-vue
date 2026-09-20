<script setup lang="ts">
// Ported from `chart.brush.pie`: NOT axis-based - center/radius/angles come straight from
// trig (see usePie.ts), not a grid/scale. `data` is always a single row - jui-chart draws one
// pie per `axis.data` row via its own `axis.c` coord-grid for small-multiples, ported as
// `PieGrid.vue` (composes N of *this* component instead of replicating the original's
// shared-brush `axis.c` lookup - see PieGrid.vue's header comment and PORT_STATUS.md). This
// component intentionally stays single-row-only so PieGrid can reuse it unmodified.
// Skips: 3d.
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`), ported
// from `brush/core.js`'s `addEvent()`/`chart.emit()` - see `ChartElementEventPayload` in types.ts.
// **Source read**: `drawUnit(index, data, g)` is invoked via `eachData(fn)` as `fn.call(this,
// list[index], index)` - i.e. `index` is the ROW index into `axis.data` (which small-multiples
// pie in the grid; always `0` for a lone, non-grid pie, since `listData()` here has exactly one
// row), NOT a wedge index. The per-wedge loop inside `drawUnit` is `for (i = 0; i < target.length;
// i++) { ...; self.addEvent(pie, index, i); ... }` - so `addEvent(pie, index /*row, always 0
// here*/, i /*wedge/target*/)` is **per wedge**, `dataKey = target[i]`, and `data =
// this.getData(index)` resolves to the exact same single-row object already passed in as `data`
// (i.e. every wedge's forwarded `data` is the *whole* row, all targets included, matching
// `data[target[i]]` being just one field read off it - same shape as `BarChart.vue`'s per-bar
// `data`, which is also the full row, not just that bar's own value). **Deviation**: upstream's
// literal `dataIndex` is always `0` for this component (there is no small-multiples grid at this
// layer - `PieGrid.vue` composes N independent `PieChart` instances instead of one shared brush
// walking an array, see this component's own header comment above), and a constant `0` on every
// event would carry no real information for a Vue consumer - unlike `BarChart`'s `data: DataRow[]`
// prop, `PieChart`'s `data` prop is already a single `DataRow`, not an array, so there's no
// meaningful index *into* anything at this layer. `dataIndex` is `null` here instead (matching
// `ChartElementEventPayload`'s own documented meaning: "not tied to one row" in an array sense),
// with `data: props.data` (the whole row) still forwarded, same as upstream's `getData(0)`. Wedges
// with a `0` value never appear in `slices`/`wedges` at all (`usePieSlices` already filters them,
// pre-existing behavior unrelated to this item - see its own doc comment), so no extra zero-value
// guard is needed (matching that `pie.js`'s own *first*, 3d-only loop skips zero values but its
// *second* loop, the one with `addEvent`, has no such skip of its own - moot here since this port
// never produces a zero-value wedge to begin with).
import { computed, ref, toRef, watch } from 'vue'
import { pieActiveOpacity, pieActivePullOffset, toActiveKeySet } from '../composables/useActive'
import { usePieSlices, pieInsideLabelPosition, pieInsideLabelDeclutter, pieOutsideLabelAnchor, pieOutsideLabelDeclutter, pieSlicePath } from '../composables/usePie'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import ChartTooltip from './ChartTooltip.vue'
import type { ChartElementEventPayload, ChartElementEventType, DataRow, PieShowText, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    data: DataRow
    target: string[]
    width?: number
    height?: number
    theme?: ThemeName
    colors?: string[]
    showText?: PieShowText
    /** `(key, value, total) => label`. Defaults to `"key: value"`. */
    format?: (key: string, value: number, total: number) => string
    showTooltip?: boolean
    title?: string
    /** Activates (pulls out + dims the rest) the wedge(s) matching this target key or keys. Ported from pie.js's `active`. */
    active?: string | string[] | null
    /** DOM event name (e.g. `"click"`, `"mouseover"`) that toggles a wedge's active state. `null` (default) disables the interaction, per pie.js's `activeEvent`. */
    activeEvent?: string | null
  }>(),
  {
    width: 400,
    height: 400,
    theme: 'classic',
    colors: undefined,
    showText: null,
    format: undefined,
    showTooltip: true,
    title: undefined,
    active: null,
    activeEvent: null,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

/** Forwards a per-element DOM event for wedge `w` - see this file's header comment. */
function forwardEvent(type: ChartElementEventType, w: Wedge, e: MouseEvent) {
  // See LineChart.vue's `forwardEvent` for why this cast is needed and sound.
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, { dataIndex: null, dataKey: w.key, data: props.data, event: e })
}

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i] ?? themeColor(i)
}

const dataRef = toRef(props, 'data')
const targetRef = toRef(props, 'target')
const colorFn = computed(() => pickColor)

const slices = usePieSlices(dataRef, targetRef, colorFn)

const total = computed(() => props.target.reduce((sum, key) => sum + (props.data[key] || 0), 0))

// Outside labels (and the title) extend past the wedge circle itself, so the circle must be
// shrunk to leave room for them inside the fixed width/height viewBox - otherwise labels near
// the top/left/right edges get clipped by the SVG boundary.
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const centerX = computed(() => props.width / 2)
const centerY = computed(() => titleReserve.value + (props.height - titleReserve.value) / 2)
const outerRadius = computed(() => {
  const available = Math.min(props.width, props.height - titleReserve.value) / 2 - theme('pieBorderWidth') - 2
  if (props.showText === 'outside') {
    const labelAllowance = theme('pieOuterFontSize') * 5
    return Math.max(10, (available - labelAllowance) / theme('pieOuterLineRate'))
  }
  return available
})

function label(key: string, value: number): string {
  if (props.format) return props.format(key, value, total.value)
  return `${key}: ${value}`
}

// `active`/`activeEvent`, ported from pie.js's `setActiveEvent()`/`setActiveTextEvent()`:
// `active` seeds which wedge(s) start pulled-out+highlighted; `activeEvent` toggles a wedge's
// membership in that set when the named DOM event fires on it. Skipped entirely for a
// single-wedge (full circle) pie, matching the original's `isOnlyOne` guard.
const activeKeys = ref<Set<string>>(toActiveKeySet(props.active))
watch(
  () => props.active,
  (v) => {
    activeKeys.value = toActiveKeySet(v)
  },
)

const hasMultipleSlices = computed(() => slices.value.length > 1)

function toggleActiveKey(key: string) {
  const next = new Set(activeKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  activeKeys.value = next
}

interface Wedge {
  key: string
  value: number
  color: string
  path: string | null
  labelPos: { x: number; y: number }
  labelText: string
  labelOpacity: number
  labelHidden: boolean
  anchorLeft: boolean
  active: boolean
  offsetX: number
  offsetY: number
  opacity: number
}

// Outside-label collision avoidance (pie.js's `drawText()` `preAngle`/`preRate`/`preOpacity`
// walk, ported as `pieOutsideLabelDeclutter`) - only meaningful in "outside" mode, and only
// computed once per slice set (not per-wedge) since it's a sequential walk over ALL labels in
// draw order, not an independent per-wedge computation.
const outsideDeclutter = computed(() =>
  props.showText === 'outside'
    ? pieOutsideLabelDeclutter(
        slices.value.map((s) => s.centerAngle),
        theme('pieOuterLineRate'),
      )
    : [],
)

// Inside-label collision avoidance (from-scratch - pie.js never declutters inside labels, see
// pieInsideLabelDeclutter's doc comment) - same "computed once over the whole slice set" shape as
// outsideDeclutter, since it's a sequential walk. Needs each label's actual text (the collision
// test is width-aware, not just angle/radius-aware - see the composable's doc comment). Uses the
// non-active outerRadius (not per-wedge activeDistance offsets) as the label position radius -
// active-pulling a wedge only ever moves it further from its neighbors, never closer, so it's not
// worth recomputing per active state.
const insideDeclutter = computed(() =>
  props.showText === 'inside'
    ? pieInsideLabelDeclutter(
        slices.value.map((s) => s.centerAngle),
        slices.value.map((s) => label(s.key, s.value)),
        outerRadius.value / 2,
        theme('pieInnerFontSize'),
      )
    : [],
)

const wedges = computed<Wedge[]>(() => {
  const hasAnyActive = hasMultipleSlices.value && activeKeys.value.size > 0
  const activeDistance = theme('pieActiveDistance')
  const disabledOpacity = theme('pieDisableBackgroundOpacity')
  const outsideInfoAll = outsideDeclutter.value
  const insideInfoAll = insideDeclutter.value

  return slices.value.map((s, i) => {
    const isActive = hasMultipleSlices.value && activeKeys.value.has(s.key)
    const { dx, dy } = isActive ? pieActivePullOffset(s.centerAngle, activeDistance) : { dx: 0, dy: 0 }
    const labelRadius = outerRadius.value + (isActive ? activeDistance : 0)
    const outsideInfo = outsideInfoAll[i]
    const insideInfo = insideInfoAll[i]

    const path = pieSlicePath(centerX.value, centerY.value, outerRadius.value, s.startAngle, s.sweepAngle)
    const pos =
      props.showText === 'inside'
        ? pieInsideLabelPosition(centerX.value, centerY.value, s.centerAngle, labelRadius)
        : pieOutsideLabelAnchor(centerX.value, centerY.value, s.centerAngle, outerRadius.value, outsideInfo?.rate ?? theme('pieOuterLineRate'))

    return {
      key: s.key,
      value: s.value,
      color: s.color,
      path,
      labelPos: pos,
      labelText: label(s.key, s.value),
      labelOpacity: outsideInfo?.opacity ?? 1,
      labelHidden: props.showText === 'inside' ? (insideInfo?.hidden ?? false) : (outsideInfo?.hidden ?? false),
      anchorLeft: s.centerAngle + 90 > 180,
      active: isActive,
      offsetX: dx,
      offsetY: dy,
      opacity: pieActiveOpacity(isActive, hasAnyActive, disabledOpacity),
    }
  })
})

const hover = ref<Wedge | null>(null)

function onWedgeEvent(type: string, w: Wedge) {
  if (type === 'mouseover') hover.value = w
  if (type === 'mouseout') hover.value = null

  if (hasMultipleSlices.value && props.activeEvent === type) {
    toggleActiveKey(w.key)
  }
}
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g v-if="wedges.length === 0">
      <circle :cx="centerX" :cy="centerY" :r="outerRadius" :fill="theme('pieNoDataBackgroundColor')" />
    </g>

    <g v-for="(w, i) in wedges" :key="i" :transform="`translate(${w.offsetX}, ${w.offsetY})`">
      <path
        v-if="w.path"
        :d="w.path"
        :fill="w.color"
        :fill-opacity="w.opacity"
        :stroke="theme('pieBorderColor')"
        :stroke-width="theme('pieBorderWidth')"
        :stroke-opacity="w.opacity"
        style="cursor: pointer"
        @mouseover="(e) => { onWedgeEvent('mouseover', w); forwardEvent('mouseover', w, e) }"
        @mouseout="(e) => { onWedgeEvent('mouseout', w); forwardEvent('mouseout', w, e) }"
        @click="(e) => { onWedgeEvent('click', w); forwardEvent('click', w, e) }"
        @dblclick="(e) => forwardEvent('dblclick', w, e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', w, e) }"
      />
      <circle
        v-else
        :cx="centerX"
        :cy="centerY"
        :r="outerRadius"
        :fill="w.color"
        :fill-opacity="w.opacity"
        :stroke="theme('pieBorderColor')"
        :stroke-width="theme('pieBorderWidth')"
        :stroke-opacity="w.opacity"
        style="cursor: pointer"
        @mouseover="(e) => { onWedgeEvent('mouseover', w); forwardEvent('mouseover', w, e) }"
        @mouseout="(e) => { onWedgeEvent('mouseout', w); forwardEvent('mouseout', w, e) }"
        @click="(e) => { onWedgeEvent('click', w); forwardEvent('click', w, e) }"
        @dblclick="(e) => forwardEvent('dblclick', w, e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', w, e) }"
      />
    </g>

    <!--
      Labels are rendered in a second, separate pass over ALL wedges (not interleaved with each
      wedge's own path) so that no later-drawn wedge can paint over an earlier wedge's label. This
      matters most for inside labels in a small PieGrid cell: a narrow wedge's label text is
      routinely wider than the wedge itself at the radius it's drawn at, so without this the next
      wedge (painted after it in the original interleaved order) would occlude part of it.
    -->
    <g v-for="(w, i) in wedges" :key="`label-${i}`">
      <text
        v-if="props.showText === 'inside' && !w.labelHidden"
        :x="w.labelPos.x"
        :y="w.labelPos.y + 3"
        text-anchor="middle"
        :font-size="theme('pieInnerFontSize')"
        :fill="theme('pieInnerFontColor')"
        :fill-opacity="w.opacity"
      >
        {{ w.labelText }}
      </text>
      <text
        v-else-if="props.showText === 'outside' && !w.labelHidden"
        :x="w.labelPos.x"
        :y="w.labelPos.y + 3"
        :text-anchor="w.anchorLeft ? 'end' : 'start'"
        :font-size="theme('pieOuterFontSize')"
        :fill="theme('pieOuterFontColor')"
        :fill-opacity="w.opacity * w.labelOpacity"
      >
        {{ w.labelText }}
      </text>
    </g>

    <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />

    <ChartTooltip
      v-if="props.showTooltip && hover"
      visible
      :x="hover.labelPos.x"
      :y="hover.labelPos.y"
      :items="[{ key: hover.key, value: hover.value }]"
      :background-color="theme('tooltipBackgroundColor')"
      :background-opacity="theme('tooltipBackgroundOpacity')"
      :border-color="theme('tooltipBorderColor') ?? hover.color"
      :font-color="theme('tooltipFontColor')"
      :font-size="theme('tooltipFontSize')"
    />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
