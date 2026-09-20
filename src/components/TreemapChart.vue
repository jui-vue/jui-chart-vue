<script setup lang="ts">
// Ported from `chart.brush.treemap` (774 lines). **Source-confirmed, don't assume from the name**
// (this port's recurring lesson): `extend: "chart.brush.core"` directly. This brush DEFINES
// `chart.brush.treemap.nodemanager` (the tree-building helper `flame.js` only BORROWS) - read all
// 774 lines, including `chart.brush.treemap.node`/`nodemanager`/`container`/`calculator`, before
// writing this file.
//
// **The data model, confirmed from `drawBefore()`'s `nodes.insertNode(k, {...})` loop**: the SAME
// flat, dot-separated-index-path row shape as `flame.js` (`{index, text, value}`). **Genuinely
// different from `flame.js` in one load-bearing way, confirmed by reading `nodemanager`'s real
// `root`**: it's a SYNTHETIC, never-rendered wrapper, so `root.children` can hold MANY top-level
// siblings (e.g. several disk folders) - NOT `flame.js`'s "first row is unconditionally the single
// root" assumption (a call stack has one root frame; a treemap usually doesn't). `useTreemap.ts`'s
// `buildTreemapForest()` returns an ARRAY of top-level nodes for exactly this reason.
//
// **The layout algorithm, confirmed from `chart.brush.treemap.calculator`'s `squarify()`/
// `improvesRatio()`/`calculateRatio()` + `chart.brush.treemap.container`'s `getCoordinates()`/
// `cutArea()`**: the SQUARIFIED treemap algorithm (Bruls et al.), not slice-and-dice - values are
// processed in the GIVEN order (no descending sort anywhere in source). **The nested-grouping
// algorithm** (how a multi-level tree's rectangles subdivide) looks, from `treemapMultidimensional()`
// `s own recursive shape, like it should nest arbitrarily deep to match the source tree - it does
// NOT: `convertNodeToArray()` (the function that turns the tree into the array
// `treemapMultidimensional()` consumes) always flattens into an array of GROUPS exactly 2 levels
// deep, regardless of the real tree depth, algebraically reducing the whole algorithm to exactly 2
// squarify passes (group sums, then each group's own raw leaf values) - re-derived and hand-traced
// (a 2-level mixed-sibling case AND a 3-level single-child-chain case) in `useTreemap.spec.ts` before
// being trusted. See `useTreemap.ts`'s header comment for the full derivation, including a real,
// confirmed-not-fixed quirk this preserves: a chain of single-child non-leaf ancestors is
// geometrically harmless, but siblings 3+ levels apart that AREN'T a simple chain lose their
// intermediate grouping boundary (their leaf descendants get squarified as one flat run against
// their nearest leaf-bearing ancestor, not nested per intermediate parent) - this only matters for
// trees deeper than the common 2-level (category -> leaf) shape most real treemap data uses.
//
// **Rendering, confirmed from `mergeArrayToNode()`/`isDrawNode()`**: only LEAF nodes ever get real
// geometry - non-leaf nodes are NEVER drawn as rectangles (`isDrawNode()` skips any node whose
// x/y/width/height are all zero, which is every non-leaf node's untouched default), they exist only
// as invisible grouping containers and, per `titleDepth`, a title label. `titleDepth` (default `1`)
// draws ONE title `<text>` per node at that exact depth (typically the top-level "category" nodes),
// positioned via `getMinimumXY()` - confirmed to be **not a true bounding-box minimum**: it always
// descends via `node.children[0]` (first child) until it hits a leaf and uses THAT leaf's real x/y -
// ported literally as `treemapTitleAnchor()`, not replaced with a true min(). A node that received a
// title label is tracked (`titleKeys`) so its own regular per-leaf label (if it's also a leaf at
// exactly `titleDepth`) doesn't ALSO render, matching source's own `titleKeys[node.index]` guard.
//
// **Color, confirmed from `draw()`'s `this.color(getRootNodeSeq(nodeList[i]))`**: every leaf's
// default fill cycles the theme palette by its TOP-LEVEL ancestor's sibling position (all
// descendants of the same top-level branch share one color) - `getRootNodeSeq()` walks
// `node.parent` on every call; this port precomputes the equivalent (`topAncestorIndex`) once at
// tree-build time instead (same "real object references over source's own bookkeeping" choice
// `useFlame.ts` made). `nodeColor` (per-leaf override, called AFTER geometry is set) overrides this
// exactly like `flame.js`'s own `nodeColor` hook.
//
// **Labels, confirmed from `draw()`'s per-node text block**: `showText` (default `true`, unlike
// `flame.js`'s format-gated labels) shows `format(node)` or `node.text` for every LEAF not already
// title-labeled. `textAlign` (`"start"|"middle"|"end"`, default `"middle"`) and `textOrient`
// (`"top"|"center"|"bottom"`, default `"top"`) are two INDEPENDENT axes (`treemapTextX()`/
// `treemapTextY()` in `useTreemap.ts`) - not a single combined position setting.
//
// **Interaction, checked explicitly against this item's own task brief**: source has NO click-to-
// drill-down (or any other interaction) of its own - `draw()`'s only event wiring is
// `this.addEvent(elem, nodeList[i])` on the drawn RECT alone (title/regular text never get
// `addEvent` - confirmed by re-reading `draw()` in full, unlike `flame.js` which attaches to both
// rect AND text). This port does NOT invent a drill-down/zoom addition (unlike `FlameChart.vue`'s
// deliberate, clearly-flagged `zoomEvent` addition) - per-element event forwarding only, matching
// source's real interaction surface exactly.
//
// Per-element events, ported from `brush/core.js`'s `addEvent()`/`chart.emit()`: `this.addEvent(elem,
// nodeList[i])` passes the NODE OBJECT, not an index, so (per `addEvent()`'s own `_.typeCheck(
// "object", dataIndex)` branch, confirmed identical to `flame.js`'s own finding) `dataIndex` is never
// set upstream. Ported as `dataIndex: null`, `dataKey: node.index`, `data` = `{index, text, value,
// depth}` - matching `FlameChart.vue`'s own precedent exactly.
//
// **Structural shape**: standalone `<svg>` root (no `ChartBase`/axis concept), matching source's own
// `this.axis.area()`-only positioning (never a `.scale()` call) - `titleReserve`/`area` follow
// `FlameChart.vue`'s/`PyramidChart.vue`'s own established port-only convention.
//
// **Not ported**: `clip` (pre-existing, established gap - matches `FlameChart.vue`/`FocusChart.vue`/
// `PinChart.vue`/`RangeBarChart.vue`'s own header comments).
import { computed, toRef } from 'vue'
import {
  buildTreemapForest,
  flattenTreemapForest,
  isDrawableTreemapNode,
  layoutTreemapForest,
  treemapTextX,
  treemapTextY,
  treemapTitleAnchor,
  type TreemapFormatNode,
  type TreemapPositionedNode,
  type TreemapSourceRow,
} from '../composables/useTreemap'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { ChartElementEventPayload, ChartElementEventType, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Flat rows, one per tree node - `index` (dot-separated tree path, e.g. `"0.1"`), `text`,
     * `value`. **Unlike `FlameChart`'s `data`, multiple rows may share the same dot-depth-1 prefix
     * segment** (i.e. several top-level siblings, not one implicit single root) - see this file's
     * header comment. */
    data: TreemapSourceRow[]
    width?: number
    height?: number
    theme?: ThemeName
    title?: string
    /** `brush.titleDepth` - which tree depth (root's own children = depth `1`) gets a title label
     * instead of/in addition to a regular per-leaf label. Default `1`. */
    titleDepth?: number
    /** `brush.showText` - per-leaf label visibility (default `true` - unlike `flame.js`'s
     * format-gated labels, this brush shows `node.text` even with no `format` supplied). */
    showText?: boolean
    /** `brush.textOrient` - vertical anchor for a per-leaf label: `"top"` (default, source's own
     * default) / `"center"` / `"bottom"`. */
    textOrient?: 'top' | 'center' | 'bottom'
    /** `brush.textAlign` - horizontal anchor for a per-leaf label: `"start"` / `"middle"` (default) /
     * `"end"`. */
    textAlign?: 'start' | 'middle' | 'end'
    /** `brush.nodeColor` - per-leaf fill override, given the leaf's own positioned geometry. Default
     * (unset): cycles the theme palette by the leaf's TOP-LEVEL ancestor (see this file's header
     * comment). */
    nodeColor?: (node: TreemapPositionedNode) => string
    /** `brush.format` - label text for BOTH title and regular per-leaf labels (matches source's own
     * `this.format(node)` being called with either kind of node interchangeably). Falls back to
     * `node.text` when omitted. */
    format?: (node: TreemapFormatNode) => string | number
  }>(),
  {
    width: 640,
    height: 400,
    theme: 'classic',
    title: undefined,
    titleDepth: 1,
    showText: true,
    textOrient: 'top',
    textAlign: 'middle',
    nodeColor: undefined,
    format: undefined,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
}>()

function forwardEvent(type: ChartElementEventType, node: TreemapPositionedNode, e: MouseEvent) {
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

const forest = computed(() => buildTreemapForest(props.data))
const allNodes = computed(() => flattenTreemapForest(forest.value))
const positioned = computed<TreemapPositionedNode[]>(() => layoutTreemapForest(forest.value, { x: 0, y: 0, width: area.value.width, height: area.value.height }))
const positionedByIndex = computed(() => new Map(positioned.value.map((n) => [n.index, n])))

interface TitleLabel {
  key: string
  x: number
  y: number
  text: string | number
}

const titleLabels = computed<TitleLabel[]>(() => {
  const fontSize = theme('treemapTitleFontSize')
  const out: TitleLabel[] = []
  for (const node of allNodes.value) {
    if (node.depth !== props.titleDepth) continue
    const anchor = treemapTitleAnchor(node, positionedByIndex.value)
    if (!anchor) continue
    out.push({
      key: node.index,
      x: area.value.x + anchor.x + 3,
      y: area.value.y + anchor.y + fontSize,
      text: props.format ? props.format(node) : node.text,
    })
  }
  return out
})
const titleKeys = computed(() => new Set(titleLabels.value.map((t) => t.key)))

interface RenderNode {
  node: TreemapPositionedNode
  x: number
  y: number
  width: number
  height: number
  color: string
  label: string | number | null
  textX: number
  textY: number
}

const renderNodes = computed<RenderNode[]>(() => {
  const fontSize = theme('treemapTextFontSize')
  const keys = titleKeys.value
  const out: RenderNode[] = []
  for (const n of positioned.value) {
    if (!isDrawableTreemapNode(n)) continue
    const x = area.value.x + n.x
    const y = area.value.y + n.y
    const color = props.nodeColor ? props.nodeColor(n) : themeColor(n.topAncestorIndex)

    let label: string | number | null = null
    let textX = 0
    let textY = 0
    if (props.showText && !keys.has(n.index)) {
      label = props.format ? props.format(n) : n.text
      textX = treemapTextX(x, n.width, props.textAlign)
      textY = treemapTextY(y, n.height, fontSize, props.textOrient)
    }

    out.push({ node: n, x, y, width: n.width, height: n.height, color, label, textX, textY })
  }
  return out
})

function onNodeEvent(type: ChartElementEventType, rn: RenderNode, e: MouseEvent) {
  forwardEvent(type, rn.node, e)
}
</script>

<template>
  <svg :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root">
    <rect :x="0" :y="0" :width="props.width" :height="props.height" :fill="theme('backgroundColor')" />

    <g>
      <g v-for="rn in renderNodes" :key="rn.node.index">
        <rect
          :x="rn.x"
          :y="rn.y"
          :width="rn.width"
          :height="rn.height"
          :fill="rn.color"
          :stroke="theme('treemapNodeBorderColor')"
          :stroke-width="theme('treemapNodeBorderWidth')"
          style="cursor: pointer"
          @click="(e) => onNodeEvent('click', rn, e)"
          @dblclick="(e) => onNodeEvent('dblclick', rn, e)"
          @mouseover="(e) => onNodeEvent('mouseover', rn, e)"
          @mouseout="(e) => onNodeEvent('mouseout', rn, e)"
          @contextmenu="
            (e) => {
              e.preventDefault()
              onNodeEvent('contextmenu', rn, e)
            }
          "
        />
        <text v-if="rn.label !== null" :x="rn.textX" :y="rn.textY" :font-size="theme('treemapTextFontSize')" :fill="theme('treemapTextFontColor')" :text-anchor="props.textAlign">
          {{ rn.label }}
        </text>
      </g>

      <text
        v-for="t in titleLabels"
        :key="`title-${t.key}`"
        :x="t.x"
        :y="t.y"
        font-weight="bold"
        :font-size="theme('treemapTitleFontSize')"
        :fill="theme('treemapTitleFontColor')"
        text-anchor="start"
      >
        {{ t.text }}
      </text>
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
