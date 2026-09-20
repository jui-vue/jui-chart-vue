<script setup lang="ts">
// Ported from `chart.brush.flame` (390 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson): `extend: "chart.brush.core"` directly - it only REUSES
// `treemap.js`'s `chart.brush.treemap.nodemanager` (`jui.use(TreemapBrush)` at the top of the
// file) as a data-structure helper, no `extend` relationship to `chart.brush.treemap` itself. Read
// all 390 lines, plus `treemap.js`'s `chart.brush.treemap.node`/`chart.brush.treemap.nodemanager`
// (the `index`/`depth`/`parent`/`children` model this brush builds its tree on top of) and
// `brush/core.js`'s `addEvent()`/`color()`, before writing this file - this port's FIRST
// genuinely hierarchical brush (nothing else here builds/walks a tree).
//
// **The data model, confirmed from `drawBefore()`'s `nodes.insertNode(k, {...})` loop and
// `examples/resources/flamedata.js`'s real sample data - NOT a nested/children-array input**: a
// FLAT array of rows, each with a dot-separated tree-path `index` string (`"0"` = root, `"0.1"` =
// root's 2nd child, `"0.1.0"` = that child's 1st child, ...), `text`, and `value`. This port
// rebuilds that into a plain object tree with real `children`/`parent` pointers
// (`buildFlameTree()` in `useFlame.ts`) rather than porting `chart.brush.treemap.nodemanager`'s own
// imperative, index-string-parsing `Node`/`NodeManager` classes - see that file's header comment.
//
// **The layout formula, confirmed from `drawNodeAll()`'s recursion, re-derived and hand-traced
// (4-level tree, `useFlame.spec.ts`) rather than assumed from the "flame graph" name**: the ROOT
// always spans the FULL plot width, regardless of its own `value`; each child's width is
// `parentWidth * (child.value / parent.value)` - a share of its OWN PARENT's width, never
// normalized against a children-value-sum (a faithfully-preserved quirk: children whose values
// don't sum to their parent's own value produce a visible gap or overflow, not an error). Depth
// maps to a FIXED row height (`plotHeight / maxDepth`, `maxDepth` from the config or the tallest
// branch, computed ONCE from the full, unfiltered tree and held fixed across zoom) - `nodeOrient:
// "bottom"` (source default) anchors the root at the BOTTOM row, depth increasing upward (the
// conventional flame-graph orientation); `"top"` anchors at the top, though depths start at `1` so
// the very first row (`y` in `[0,rowHeight)`) is always empty, ported literally not "fixed" (see
// `useFlame.ts`'s `FlameLayoutOptions.nodeOrient` doc comment).
//
// **Color, confirmed from `drawNodeAll()`'s `self.color(0)` re-read against `brush/core.js`'s
// `color(key1)`**: with no `colors` option declared in `FlameBrush.setup()` at all (unlike
// `heatmap.js`/`timeline.js`, which DO declare one), every node gets the exact same CONSTANT
// palette color (index 0) unless the caller supplies `nodeColor` - source's own real customization
// point (`self.brush.nodeColor.call(self.chart, node)`, called AFTER the node's own geometry is
// set). Ported as-is (a `nodeColor?: (node) => string` prop over the positioned node) rather than
// inventing a `colors[]`-cycling deviation like `TimelineChart`/`HeatmapChart` did for their own
// literal-constant-color sources - `nodeColor` already IS the intended real-world customization
// hook (a typical flame graph hashes a function/frame NAME to a color; the demo page does exactly
// that), so there's no gap here to deviate around.
//
// **Labels, confirmed from `createTextElement()`**: rendered only when `format` is supplied
// (matching `if (!_.typeCheck("function", self.brush.format)) return null`) - `textAlign` picks the
// anchor edge (`"start"` default). **No width-vs-text-length check exists anywhere in
// `createTextElement()`** - a label is drawn at full size regardless of how narrow its node is, so
// this port does NOT invent narrow-rect text truncation/hiding either (checked explicitly per this
// item's own task brief, not assumed) - a caller wanting that effect supplies a `format` that
// shortens the label itself (demoed in `FlamePage.vue`).
//
// **Zoom (`activeIndex`), confirmed from `draw()`'s `createFilteredNodes()`/`setCacheParents()`/
// `setCacheChildren()`/`sortingCacheNodes()`/`createIndexData()` dance, re-derived as a much
// simpler equivalent** (see `useFlame.ts`'s `filterFlameActive()` doc comment for the full
// algebraic derivation and why source's own version - a fresh re-indexed `NodeManager` rebuilt on
// every draw call, with an `axis.cacheNodes` fallback for indices from an ALREADY-zoomed view - has
// no equivalent problem to solve here, since this port's tree is a stable `computed()` and a
// node's `index` string always means the same thing regardless of current zoom state): the node at
// `activeIndex` becomes full-width, its ancestor chain renders full-width-but-DIMMED above/below
// it (`flameDisableBackgroundOpacity`), and its own subtree keeps its real relative proportions.
// Source has no click-to-zoom logic of ITS OWN (`activeIndex` is a passive config value, exactly
// like `focus.js`'s `start`/`end` - see `FocusChart.vue`'s own precedent) - **this component adds
// an opt-in `zoomEvent` prop** (`'click' | 'dblclick' | false`, default `'click'`), clearly flagged
// as a deliberate addition matching `FocusChart.vue`'s own `selectEvent` precedent exactly, not
// attributed to source: clicking ANY rendered node (including a dimmed ancestor) re-zooms to it -
// clicking the true root zooms all the way back out, since it's always part of every ancestor
// chain. `activeIndex` also stays a real prop (seeds/resets the internal zoom state), demoed with
// an external "reset" button in `FlamePage.vue`.
//
// **Structural shape**: standalone `<svg>` root (no `ChartBase`/axis concept at all - like
// `PyramidChart`/`ArcEqualizerChart`), matching source's own `this.axis.area()`-only positioning
// (never a `.scale()` call) - `titleReserve`/`area` follow those two components' own established
// port-only convention (the original has no title concept here either).
//
// Per-element event forwarding, ported from `brush/core.js`'s `addEvent()`/`chart.emit()` - see
// `ChartElementEventPayload` in types.ts. **Source read**: `this.addEvent(r, node)`/
// `this.addEvent(t, node)` per node (both the rect AND its label text, when rendered) - `node` is
// an `object`, not an index, so `addEvent()`'s own `_.typeCheck("object", dataIndex)` branch fires:
// `obj.data = node` directly, `dataIndex`/`dataKey` are never set (`undefined` upstream). Ported
// here as `dataIndex: null`, `dataKey: node.index` (the node's own hierarchical path string - the
// closest real analog to a "key" this brush has, and genuinely useful for a caller to identify
// which frame fired), `data` = the node's own `{index, text, value, depth}`.
//
// **Not ported**: `clip`/`useEvent` (pre-existing, established gap - matches `PinChart.vue`/
// `RangeBarChart.vue`/`FocusChart.vue`'s own header comments).
import { computed, ref, toRef, watch } from 'vue'
import {
  buildFlameTree,
  filterFlameActive,
  flameNodeOpacity,
  flameTextX,
  flameTextY,
  getFlameMaxDepth,
  layoutFlameNodes,
  type FlamePositionedNode,
  type FlameSourceRow,
} from '../composables/useFlame'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { ChartElementEventPayload, ChartElementEventType, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Flat rows, one per tree node - `index` (dot-separated tree path, e.g. `"0.1.0"`, the very
     * first row is always the root), `text`, `value`. See this file's header comment. */
    data: FlameSourceRow[]
    width?: number
    height?: number
    theme?: ThemeName
    title?: string
    /** `brush.maxDepth` - overrides the auto-computed (tallest-branch) row count used for
     * `rowHeight = plotHeight / maxDepth`. `null`/omitted (default) auto-computes it from `data`. */
    maxDepth?: number | null
    /** `brush.nodeOrient` - `"bottom"` (default, source's own default) anchors the root at the
     * bottom row, depth increasing upward; `"top"` anchors at the top. */
    nodeOrient?: 'top' | 'bottom'
    /** `brush.nodeAlign` - `"end"` (default, source's own default) vs `"start"`: two genuinely
     * different accumulation algorithms that land on the same final positions for well-formed data
     * (see `useFlame.ts`). No visible difference in normal use; kept for source fidelity. */
    nodeAlign?: 'start' | 'end'
    /** `brush.textAlign` - anchor edge for each node's label. Default `"start"`. */
    textAlign?: 'start' | 'middle' | 'end'
    /** `brush.nodeColor` - per-node fill callback, given the node's own positioned geometry.
     * Default (unset, matching source exactly): every node gets the SAME constant palette color
     * (`theme('colors')[0]`) - see this file's header comment on why this isn't deviated from. */
    nodeColor?: (node: FlamePositionedNode) => string
    /** `brush.format` - per-node label text. Labels only render when this is supplied (matches
     * source exactly - see this file's header comment). */
    format?: (node: FlamePositionedNode) => string | number
    /** `brush.activeIndex` - the currently zoomed-to node's index, or `null` for the full
     * unzoomed tree. Seeds/resets the internal zoom state (see `zoomEvent` below and this file's
     * header comment). */
    activeIndex?: string | null
    /** Port-only addition, no source equivalent (source's `activeIndex` is a passive config value
     * only) - which click event re-zooms to the clicked node. `false` disables click-to-zoom
     * entirely (the component then stays purely controlled by the `activeIndex` prop). Default
     * `'click'`. See this file's header comment. */
    zoomEvent?: 'click' | 'dblclick' | false
  }>(),
  {
    width: 640,
    height: 360,
    theme: 'classic',
    title: undefined,
    maxDepth: null,
    nodeOrient: 'bottom',
    nodeAlign: 'end',
    textAlign: 'start',
    nodeColor: undefined,
    format: undefined,
    activeIndex: null,
    zoomEvent: 'click',
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
  /** Fired when `zoomEvent` re-zooms to a (possibly ancestor, i.e. "zoom out") node - port-only,
   * see this file's header comment. */
  zoom: [payload: { index: string; node: FlamePositionedNode }]
}>()

function forwardEvent(type: ChartElementEventType, node: FlamePositionedNode, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, {
    dataIndex: null,
    dataKey: node.index,
    data: { index: node.index, text: node.text, value: node.value, depth: node.depth },
    event: e,
  })
}

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const area = computed(() => ({ x: 0, y: titleReserve.value, width: props.width, height: props.height - titleReserve.value }))

const tree = computed(() => buildFlameTree(props.data))
const resolvedMaxDepth = computed(() => props.maxDepth ?? (tree.value ? getFlameMaxDepth(tree.value) : 1))
const rowHeight = computed(() => area.value.height / Math.max(1, resolvedMaxDepth.value))

const internalActiveIndex = ref<string | null>(props.activeIndex ?? null)
watch(
  () => props.activeIndex,
  (v) => {
    internalActiveIndex.value = v ?? null
  },
)

const filtered = computed(() => {
  const root = tree.value
  if (!root) return null
  if (internalActiveIndex.value == null) return { root, activeDepth: null as number | null }
  return filterFlameActive(root, internalActiveIndex.value) ?? { root, activeDepth: null as number | null }
})

const positioned = computed<FlamePositionedNode[]>(() => {
  const f = filtered.value
  if (!f) return []
  return layoutFlameNodes(f.root, {
    areaX: area.value.x,
    areaWidth: area.value.width,
    areaHeight: area.value.height,
    rowHeight: rowHeight.value,
    nodeOrient: props.nodeOrient,
    nodeAlign: props.nodeAlign,
  })
})

const activeDepth = computed(() => filtered.value?.activeDepth ?? null)

function pickColor(node: FlamePositionedNode): string {
  return props.nodeColor ? props.nodeColor(node) : themeColor(0)
}

interface RenderNode {
  node: FlamePositionedNode
  color: string
  fillOpacity: number
  label: string | number | null
  textX: number
  textY: number
}

const renderNodes = computed<RenderNode[]>(() =>
  positioned.value.map((node) => ({
    node,
    color: pickColor(node),
    fillOpacity: flameNodeOpacity(node.depth, activeDepth.value, theme('flameDisableBackgroundOpacity')),
    label: props.format ? props.format(node) : null,
    textX: flameTextX(node.x, node.width, props.textAlign),
    textY: flameTextY(node.y, rowHeight.value, theme('flameTextFontSize')),
  })),
)

const hoverIndex = ref<string | null>(null)

function strokeFor(rn: RenderNode): string {
  return hoverIndex.value === rn.node.index ? rn.color : theme('flameNodeBorderColor')
}

function onHover(rn: RenderNode) {
  hoverIndex.value = rn.node.index
}
function onUnhover(rn: RenderNode) {
  if (hoverIndex.value === rn.node.index) hoverIndex.value = null
}

function onNodeEvent(type: ChartElementEventType, rn: RenderNode, e: MouseEvent) {
  forwardEvent(type, rn.node, e)
  if (props.zoomEvent && type === props.zoomEvent) {
    internalActiveIndex.value = rn.node.index
    emit('zoom', { index: rn.node.index, node: rn.node })
  }
}
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g>
      <g v-for="rn in renderNodes" :key="rn.node.index">
        <rect
          :x="rn.node.x"
          :y="rn.node.y"
          :width="rn.node.width"
          :height="rn.node.height"
          :fill="rn.color"
          :fill-opacity="rn.fillOpacity"
          :stroke="strokeFor(rn)"
          :stroke-width="theme('flameNodeBorderWidth')"
          style="cursor: pointer"
          @mouseover="
            (e) => {
              onHover(rn)
              onNodeEvent('mouseover', rn, e)
            }
          "
          @mouseout="
            (e) => {
              onUnhover(rn)
              onNodeEvent('mouseout', rn, e)
            }
          "
          @click="(e) => onNodeEvent('click', rn, e)"
          @dblclick="(e) => onNodeEvent('dblclick', rn, e)"
          @contextmenu="
            (e) => {
              e.preventDefault()
              onNodeEvent('contextmenu', rn, e)
            }
          "
        />
        <text
          v-if="rn.label !== null"
          :x="rn.textX"
          :y="rn.textY"
          font-weight="bold"
          :font-size="theme('flameTextFontSize')"
          :fill="theme('flameTextFontColor')"
          :fill-opacity="rn.fillOpacity"
          :text-anchor="props.textAlign"
          style="cursor: pointer"
          @mouseover="
            (e) => {
              onHover(rn)
              onNodeEvent('mouseover', rn, e)
            }
          "
          @mouseout="
            (e) => {
              onUnhover(rn)
              onNodeEvent('mouseout', rn, e)
            }
          "
          @click="(e) => onNodeEvent('click', rn, e)"
          @dblclick="(e) => onNodeEvent('dblclick', rn, e)"
        >
          {{ rn.label }}
        </text>
      </g>
    </g>

    <ChartTitle v-if="props.title" :text="props.title" :width="props.width" :height="props.height" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
