<script setup lang="ts">
// Ported from `chart.brush.canvas.bubblecloud` (196 lines) - see `useBubbleCloud.ts`'s header
// comment for the full `extend` chain / caching / settle-and-hold-non-overlapping algorithm
// writeup this component relies on. Renders via `ChartCanvasBase.vue` in `animate: true` mode
// (like `ActiveBubbleChart.vue`) - the center-gravity settle needs several frames to decay, and
// the collision-separation pass needs to keep running every frame even after gravity has decayed
// to hold the layout non-overlapping, so this is genuinely a continuous per-frame simulation, not
// a draw-once-per-reactive-change brush.
//
// **Vue integration design decision**: like `activebubble.js`, `bubblecloud.js` never touches
// `axis.x`/`axis.y` - only `axis.area('width'/'height')` for the plot rectangle and `axis.data`
// (confirmed from source, not assumed - see `useBubbleCloud.ts`'s header comment). So this
// component needs none of `useChartLayout.ts`'s axis/scale machinery, same as
// `ActiveBubbleChart.vue`: `props.width`/`props.height` (minus an optional `title` reserve, this
// port's established convention) directly ARE the plot rectangle `BubbleCloud` needs.
//
// **Two-layer caching, ported literally (see `useBubbleCloud.ts`'s header comment for the full
// derivation)**: `cachedDataRef` mirrors the source's `chart.getCache('bubble_data')` slot,
// compared by `!==` (reference, not deep equality) against `props.data` every frame. Since Vue
// hands a prop array through by reference, this reproduces the exact same "a brand-new array with
// IDENTICAL row values still forces a full rebuild" quirk the source has, with no extra
// bookkeeping - a caller must reassign `props.data` (not mutate it in place) to trigger a rebuild,
// exactly like reassigning `axis.data`.
import { computed, ref, toRef, watch } from 'vue'
import ChartCanvasBase from './ChartCanvasBase.vue'
import { useTheme } from '../composables/useTheme'
import { hexToRgba } from '../composables/useActiveBubble'
import { BubbleCloud, type BubbleCloudDatum } from '../composables/useBubbleCloud'
import { runPickerCheck } from '../composables/usePickerWidget'
import type { DataRow, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Rows to cluster into bubbles. Each row's bubble `name`/size are read from its `"title"`/
     *  `"capacity"` fields (falling back to `"Unknown"`/`1`) - hardcoded field names, matching
     *  source's own `this.getValue(data, "title"/"capacity", ...)`, not a configurable `domain`/
     *  `target` like an axis-based brush. Reassign (not mutate in place) to trigger a rebuild -
     *  see this file's header comment on the reference-equality cache. */
    data: DataRow[]
    width?: number
    height?: number
    theme?: ThemeName
    /** Palette override, matching this port's established `colors?: string[]` convention. Falls
     *  back to the active theme's palette, cycled by row index (`this.color(index, null)` in
     *  source). */
    colors?: string[]
    /** Port-only addition, matching `ActiveBubbleChart`/`BarGaugeChart`/etc.'s own `title` prop
     *  convention - canvas has no declarative `<ChartTitle>` to reuse. */
    title?: string
  }>(),
  {
    width: 560,
    height: 360,
    theme: 'classic',
    colors: undefined,
    title: undefined,
  },
)

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

function pickColor(i: number): string {
  return props.colors?.[i % props.colors.length] ?? themeColor(i)
}

function titleReserve(): number {
  return props.title ? theme('titleFontSize') + 14 : 0
}

const canvasBase = ref<InstanceType<typeof ChartCanvasBase> | null>(null)
/** Live hovered row (via `pick()`), exposed for demo readouts/Playwright checks - canvas has no
 *  per-bubble DOM element a test could hover directly. `null` when nothing is under the pointer. */
const hoveredRow = ref<DataRow | null>(null)

let cloud: BubbleCloud | null = null
let cachedDataRef: DataRow[] | null = null

/** Builds this frame's `BubbleCloudDatum[]` from `props.data`, matching the brush component's own
 *  `this.eachData(...)` callback body exactly (field names, color/theme resolution). Only called
 *  on a cache-miss rebuild (see below), same as source only building this once per new
 *  `axis.data` reference. */
function buildData(): BubbleCloudDatum[] {
  const textStyle = `${theme('bubbleCloudFontWeight')} ${theme('bubbleCloudFontSize')}px ${theme('fontFamily')}`
  return props.data.map((row, index) => {
    const color = pickColor(index)
    return {
      name: String(row.title ?? 'Unknown'),
      count: typeof row.capacity === 'number' ? row.capacity : 1,
      color,
      shadowColor: hexToRgba(color, 0.2),
      textColor: theme('bubbleCloudFontColor'),
      textStyle,
      origin: row,
    }
  })
}

/** Rebuilds the whole cloud from scratch - the cache-miss branch of `component.draw()` (see this
 *  file's header comment). Sizing (`props.width`/`height` minus the title reserve) is re-read
 *  every rebuild, matching source re-reading `this.axis.area(...)` on every cache-miss `draw()`
 *  call (unlike `activebubble.js`'s `ActiveBubble`, which fixes its size once at lazy-creation). */
function rebuild(): void {
  cloud = new BubbleCloud(props.width, Math.max(0, props.height - titleReserve()))
  cloud.start(buildData())
  cachedDataRef = props.data
  // A rebuild is a brand-new BubbleCloud instance with an empty `hoverBubble` (see
  // `useBubbleCloud.ts` - `start()` never carries a hover state over), so any hover readout from
  // before this rebuild no longer refers to a live bubble.
  hoveredRow.value = null
}

function onFrame(ctx: CanvasRenderingContext2D): void {
  if (cloud == null || cachedDataRef !== props.data) {
    rebuild()
  }
  const activeCloud = cloud!

  activeCloud.step()
  activeCloud.render(ctx, Date.now())

  if (props.title) {
    ctx.fillStyle = theme('titleFontColor')
    ctx.font = `${theme('titleFontWeight')} ${theme('titleFontSize')}px ${theme('fontFamily')}`
    ctx.textAlign = 'center'
    ctx.fillText(props.title, props.width / 2, 16)
  }
}

/** A `width`/`height`/`title` change has no dedicated cache slot in source (the brush just
 *  re-reads `axis.area(...)` on its next cache-miss `draw()`) - forcing `cachedDataRef = null`
 *  here makes the NEXT frame's reference check miss even though `props.data` itself hasn't
 *  changed, triggering exactly that "next `draw()` call sees a new plot rect" rebuild. */
watch(
  () => [props.width, props.height, props.title] as const,
  () => {
    cachedDataRef = null
  },
)

/** Native pointer events fall through `ChartCanvasBase`'s single-root `<canvas>` (see that
 *  component's template) - `event.offsetX/offsetY` are already in the same CSS-pixel coordinate
 *  space `BubbleCloud`/`Bubble.draw()` use (the canvas's DPR-scaled backing store is transparent
 *  to both), matching source's `pick(x, y)` taking a plain plot-rect coordinate pair. */
// Source wires `pick()` through `chart.setCache('picker', { obj: bubbleCloud, func:
// bubbleCloud.pick })`, consumed by the generic `widget/canvas/picker.js`. That widget is now
// ported too (`usePickerWidget.ts`'s `runPickerCheck`, this iteration) - `BubbleCloud.pick`
// already matches its `PickerCheck<T> = (x, y) => T | null` shape exactly, so hover below now
// routes through it (previously called `cloud.pick()` directly, documented at the time as "a
// deliberate stand-in" for the not-yet-ported widget). Click/dblclick are NEW in this iteration -
// `picker.js`'s real source usage (`examples/bubblecloud.html`: `widget: [{type: "canvas.
// picker"}]` + a `picker.dblclick` handler) wires both alongside hover, which this component
// previously didn't - `pickedRow` gives `picker.js` a genuinely exercised click-path consumer, not
// just the hover-only stand-in from before.
function onPointerMove(event: MouseEvent): void {
  if (!cloud) return
  hoveredRow.value = runPickerCheck(cloud.pick.bind(cloud), event.offsetX, event.offsetY)
}

function onPointerLeave(): void {
  if (!cloud) return
  cloud.hoverBubble = null
  hoveredRow.value = null
}

/** Last `picker.click`/`picker.dblclick`-equivalent hit - like `raycast.js`'s own `EqualizerColumnChart.vue`
 *  wiring, only updated on an actual hit (source only ever EMITS on a hit; a miss leaves any
 *  previous pick untouched, no "unpick" concept). */
const pickedRow = ref<DataRow | null>(null)
const pickedVia = ref<'click' | 'dblclick' | null>(null)

function onClick(event: MouseEvent): void {
  if (!cloud) return
  const hit = runPickerCheck(cloud.pick.bind(cloud), event.offsetX, event.offsetY)
  if (hit) {
    pickedRow.value = hit
    pickedVia.value = 'click'
  }
}

function onDblclick(event: MouseEvent): void {
  if (!cloud) return
  const hit = runPickerCheck(cloud.pick.bind(cloud), event.offsetX, event.offsetY)
  if (hit) {
    pickedRow.value = hit
    pickedVia.value = 'dblclick'
  }
}

const hoveredLabel = computed(() => (hoveredRow.value ? String(hoveredRow.value.title ?? 'Unknown') : null))
const pickedLabel = computed(() => (pickedRow.value ? String(pickedRow.value.title ?? 'Unknown') : null))

defineExpose({ hoveredRow, hoveredLabel, pickedRow, pickedLabel, pickedVia, redraw: () => canvasBase.value?.redraw() })
</script>

<template>
  <ChartCanvasBase
    ref="canvasBase"
    :width="props.width"
    :height="props.height"
    :theme="props.theme"
    :animate="true"
    @frame="onFrame"
    @mousemove="onPointerMove"
    @mouseleave="onPointerLeave"
    @click="onClick"
    @dblclick="onDblclick"
  />
</template>
