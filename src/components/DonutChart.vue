<script setup lang="ts">
// Ported from `chart.brush.donut` (extends pie.js): same angle math as PieChart, drawn as a
// stroked ring instead of filled wedges. `size` is the ring's stroke width (jui-chart's
// DonutBrush.setup `size`, default 50) - the centerline radius is `min(w,h)/2 - size/2` so the
// ring's outer edge lands exactly on the chart's bounding circle (see usePie.ts's donutSlicePath
// doc comment). Skips: 3d. `axis.c` small-multiples ported as `DonutGrid.vue` (composes N of
// *this* component - see PieGrid.vue's header comment and PORT_STATUS.md), same as PieChart.
//
// `active`/`activeEvent`: donut.js calls pie.js's `setActiveEvent(cache, false)` - the `false`
// (useOpacity) means donut wedges pull out on active but never dim (unlike pie, which dims).
//
// Per-element event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout`): donut.js
// calls `this.addEvent(donut, index, i)` in `drawUnit()`, the exact same `(row index, wedge
// index)` shape as pie.js's `self.addEvent(pie, index, i)` - see `PieChart.vue`'s header comment
// for the full source read (donut.js's `drawUnit` is its own, not inherited, but this call site is
// identical in shape). Same deviation applied here for the same reason: `dataIndex: null` (no
// small-multiples array at this layer - `DonutGrid.vue` composes independent `DonutChart`
// instances instead), `data: props.data` (the whole single row, matching `getData(0)`).
import { computed, ref, toRef, watch } from 'vue'
import { pieActivePullOffset, toActiveKeySet } from '../composables/useActive'
import { donutSlicePath, pieInsideLabelPosition, pieInsideLabelDeclutter, pieOutsideLabelAnchor, pieOutsideLabelDeclutter, usePieSlices } from '../composables/usePie'
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
    /** Ring thickness in px. */
    size?: number
    /** Show the summed total in the center. */
    showValue?: boolean
    format?: (key: string, value: number, total: number) => string
    showTooltip?: boolean
    title?: string
    /** Activates (pulls out) the wedge(s) matching this target key or keys. Ported from pie.js's `active`. */
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
    size: 50,
    showValue: false,
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

// Outside labels (and the title) extend past the ring itself, so the ring must be shrunk to
// leave room for them inside the fixed width/height viewBox - otherwise labels near the
// top/left/right edges get clipped by the SVG boundary (same reasoning as PieChart.vue).
const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const centerX = computed(() => props.width / 2)
const centerY = computed(() => titleReserve.value + (props.height - titleReserve.value) / 2)

const availableRadius = computed(() => {
  const base = Math.min(props.width, props.height - titleReserve.value) / 2
  if (props.showText === 'outside') {
    const labelAllowance = theme('pieOuterFontSize') * 5
    return Math.max(10, (base - labelAllowance) / theme('pieOuterLineRate'))
  }
  return base
})

// Ported from DonutBrush's getProperty(): clamp the ring width so it never exceeds the
// available radius, then center the ring's stroke on `radius` so it spans [radius - size/2,
// radius + size/2] === [outerBound - size, outerBound].
const ringSize = computed(() => {
  const minSide = availableRadius.value * 2
  return props.size >= minSide / 2 ? minSide / 4 : props.size
})
const radius = computed(() => availableRadius.value - ringSize.value / 2)

function label(key: string, value: number): string {
  if (props.format) return props.format(key, value, total.value)
  return `${key}: ${value}`
}

// `active`/`activeEvent` state, shared shape with PieChart - see useActive.ts. Skipped for a
// single-wedge (full circle) donut, matching the original's `isOnlyOne` guard.
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
  path: string
  labelPos: { x: number; y: number }
  labelText: string
  labelOpacity: number
  labelHidden: boolean
  anchorLeft: boolean
  active: boolean
  offsetX: number
  offsetY: number
}

// Outside-label collision avoidance, same as PieChart.vue - see its comment. donut.js reuses
// pie.js's `drawText()` unmodified (only `setActiveEvent()`'s `useOpacity` differs between the
// two), so this is the exact same algorithm/state walk.
const outsideDeclutter = computed(() =>
  props.showText === 'outside'
    ? pieOutsideLabelDeclutter(
        slices.value.map((s) => s.centerAngle),
        theme('pieOuterLineRate'),
      )
    : [],
)

// Inside-label collision avoidance - same rationale as PieChart.vue's insideDeclutter (from-
// scratch, no original algorithm - see pieInsideLabelDeclutter's doc comment), including passing
// each label's actual text for the width-aware collision test. Uses the non-active ring+radius
// (not per-wedge activeDistance offsets) as the label position radius, same simplification as
// PieChart.vue.
const insideDeclutter = computed(() =>
  props.showText === 'inside'
    ? pieInsideLabelDeclutter(
        slices.value.map((s) => s.centerAngle),
        slices.value.map((s) => label(s.key, s.value)),
        (ringSize.value + radius.value) / 2,
        theme('pieInnerFontSize'),
      )
    : [],
)

const wedges = computed<Wedge[]>(() => {
  const activeDistance = theme('pieActiveDistance')
  const outsideInfoAll = outsideDeclutter.value
  const insideInfoAll = insideDeclutter.value

  return slices.value.map((s, i) => {
    const isActive = hasMultipleSlices.value && activeKeys.value.has(s.key)
    const { dx, dy } = isActive ? pieActivePullOffset(s.centerAngle, activeDistance) : { dx: 0, dy: 0 }
    const outsideInfo = outsideInfoAll[i]
    const insideInfo = insideInfoAll[i]
    // Active offset only bumps the label radius in "inside" mode, matching setActiveTextEvent()
    // (only called when showText === "inside" - outside label position is unaffected by active).
    const pos =
      props.showText === 'inside'
        ? pieInsideLabelPosition(centerX.value, centerY.value, s.centerAngle, ringSize.value + radius.value + (isActive ? activeDistance : 0))
        : pieOutsideLabelAnchor(centerX.value, centerY.value, s.centerAngle, radius.value, outsideInfo?.rate ?? theme('pieOuterLineRate'))

    return {
      key: s.key,
      value: s.value,
      color: s.color,
      path: donutSlicePath(centerX.value, centerY.value, radius.value, s.startAngle, s.sweepAngle),
      labelPos: pos,
      labelText: label(s.key, s.value),
      labelOpacity: outsideInfo?.opacity ?? 1,
      labelHidden: props.showText === 'inside' ? (insideInfo?.hidden ?? false) : (outsideInfo?.hidden ?? false),
      anchorLeft: s.centerAngle + 90 > 180,
      active: isActive,
      offsetX: dx,
      offsetY: dy,
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
      <path
        :d="donutSlicePath(centerX, centerY, radius, 0, 360)"
        fill="none"
        :stroke="theme('pieNoDataBackgroundColor')"
        :stroke-width="ringSize"
      />
    </g>

    <g v-for="(w, i) in wedges" :key="i" :transform="`translate(${w.offsetX}, ${w.offsetY})`">
      <path
        :d="w.path"
        fill="none"
        :stroke="w.color"
        :stroke-width="ringSize"
        style="cursor: pointer"
        @mouseover="(e) => { onWedgeEvent('mouseover', w); forwardEvent('mouseover', w, e) }"
        @mouseout="(e) => { onWedgeEvent('mouseout', w); forwardEvent('mouseout', w, e) }"
        @click="(e) => { onWedgeEvent('click', w); forwardEvent('click', w, e) }"
        @dblclick="(e) => forwardEvent('dblclick', w, e)"
        @contextmenu="(e) => { e.preventDefault(); forwardEvent('contextmenu', w, e) }"
      />
    </g>

    <!-- Labels rendered in a second pass over ALL wedges - see PieChart.vue's identical comment. -->
    <g v-for="(w, i) in wedges" :key="`label-${i}`">
      <text
        v-if="props.showText === 'inside' && !w.labelHidden"
        :x="w.labelPos.x"
        :y="w.labelPos.y + 3"
        text-anchor="middle"
        :font-size="theme('pieInnerFontSize')"
        :fill="theme('pieInnerFontColor')"
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
        :fill-opacity="w.labelOpacity"
      >
        {{ w.labelText }}
      </text>
    </g>

    <text
      v-if="props.showValue"
      :x="centerX"
      :y="centerY + theme('pieTotalValueFontSize') / 3"
      text-anchor="middle"
      :font-size="theme('pieTotalValueFontSize')"
      :font-weight="theme('pieTotalValueFontWeight')"
      :fill="theme('pieTotalValueFontColor')"
    >
      {{ total }}
    </text>

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
