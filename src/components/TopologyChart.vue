<script setup lang="ts">
// Ported from `chart.brush.topologynode` (711 lines). **Source-confirmed, don't assume from the
// name**: `extend: "chart.brush.core"` directly. Read all 711 lines, plus the two files this brush
// actually depends on to do anything useful:
//
// - `grid/topologytable.js` (191 lines) - **genuinely required, not optional**: the brush itself
//   never computes node positions, it only ever calls `self.axis.c(index)`; in the real engine
//   the ONLY thing that answers that call is this grid, wired via
//   `axis: [{ c: { type: "topologytable" }, data }]` (confirmed from `examples/topology.html`,
//   the only shipped example for this brush). **Confirmed by reading both of its sort functions
//   in full: this is NOT force-directed physics, and it does NOT read caller-supplied x/y from
//   the data rows either** (the example's `data2` has `x`/`y` fields but `topologytable.js` never
//   looks at them) - it's one of two purely procedural placements ("linear": a deterministic-X/
//   random-Y zigzag column scan; "random": `Math.random()` for both axes) inside the axis area.
//   This port implements those two algorithms directly as pure functions in `useTopology.ts`
//   rather than porting the generic `chart.grid.c`/`chart.grid.core` indirection layer around
//   them - the same "extract the real algorithm, not the engine plumbing" choice `usePie.ts` made
//   for `axis.c` (pie/donut center math). **A genuine, hand-traced quirk of "linear", preserved
//   exactly**: a row's rendered position is generally NOT its own computed point - see
//   `layoutTopologyLinear`'s doc comment in `useTopology.ts` for the full derivation.
// - `widget/topologyctrl.js` (191 lines) - **confirmed genuinely OPTIONAL, not required**: reading
//   it in full shows it only ever calls `axis.c(key).setX/setY/setScale/setView(...)` (mutators
//   the grid itself exposes for drag/zoom/pan) and forces a re-render; the brush renders and is
//   fully interactive (node/edge click, hover, tooltip, active cascading) with zero awareness of
//   whether this widget exists - exactly like `focus.js` turned out not to need `zoom.js`. Not
//   ported this iteration (it's a Phase D widget). Also not ported for the same reason: the
//   drag-to-front z-order this widget alone triggers (`axis.cache.nodeKey`/`node.order`).
//
// `grid/topologytable.js`'s own name suggested a link to `grid/topologytable.js`'s cousin table
// grid, but there is no `chart.brush.topologytable` - the only "table" involved is this one grid
// type, already covered above; nothing else to check there.
//
// **The data model, confirmed from `draw()`'s `this.eachData()` + `setDataEdges()`**: real graph
// nodes+edges - genuinely DIFFERENT from `treemap.js`/`flame.js`'s shared flat
// dot-separated-index-path tree-row shape, not a variant of it. Each row is
// `{ key: string, outgoing: string[], ...arbitrary fields }`; `outgoing` lists OTHER rows' `key`s
// this row has a directed edge to - there is no separate top-level edges/links array for the graph
// topology itself. The optional `edgeData` prop is a SEPARATE, purely-metadata array
// (`{ key: "start:end", ...fields }`, confirmed from `examples/topology.html`) consulted only for
// an existing edge's label/tooltip/opacity - an edge with no matching `edgeData` row still renders
// (line + endpoint dot), just with no label and the theme's default opacity.
//
// **Edge geometry, confirmed from `getDistanceXY()`/`setDataEdges()`, hand-traced in
// `useTopology.spec.ts`**: each edge's line runs from just outside the SOURCE node's own circle to
// just outside the TARGET node's own circle (pulled back by that endpoint's own radius + the
// `topologyEdgePointRadius` marker + 1), NOT center-to-center - and both pull-back distances scale
// by the SOURCE's own node scale, never the target's (a real, preserved asymmetry). A small filled
// circle ("the marker") sits at the TARGET end only - the one bit of real directionality this
// brush draws; there's no literal arrowhead chevron.
//
// **Reciprocal (A->B and B->A both exist) edges, confirmed from `createEdgeLine()`'s
// `edge.connect()` branch, hand-traced in `useTopology.spec.ts`**: only the FIRST-built direction
// of the pair renders the actual `<line>` (`ownsLine`); the second REUSES it rather than drawing
// an exactly-overlapping duplicate. Both directions still get their OWN end-marker circle (at
// their own end) and their OWN edge label. The shared line's opacity is the SECOND
// (reciprocal/"connect") edge's own opacity, not the first's - a real last-write-wins quirk of
// source's imperative paint order, preserved here via a direct lookup instead. **Active-state
// cascading has a real, order-dependent asymmetry, also preserved (not "fixed" to be symmetric)**:
// activating a node/edge only pulls in its reciprocal when THAT SPECIFIC direction's own
// `connect` flag is true - see `topologyActiveEdgeKeysForNode`/`ForEdge`'s doc comments in
// `useTopology.ts`.
//
// **Interaction, confirmed from `draw()`'s event wiring**: `activeEvent` (default `"click"`) is
// ONE config value that gates BOTH node activation (highlights the node's own outgoing edges +
// their connect-gated reciprocals) and edge activation (highlights that edge + its connect-gated
// reciprocal, and - **only when BOTH `tooltipTitle` and `tooltipText` are supplied, a real gate
// confirmed from `showTooltip()`'s own early-return** - shows a tooltip balloon and emits
// `edgeclick`). Hover recoloring (`topologyHoverEdgeColor`/Width) is independent of `activeEvent`,
// always wired to `mouseover`/`mouseout`, and a no-op on an already-active edge (matches source's
// own `_.inArray(edge, activeEdges) != -1` early-return in both hover handlers). Per-NODE generic
// DOM event forwarding (`click`/`dblclick`/`contextmenu`/`mouseover`/`mouseout` ->
// `ChartElementEventPayload`) is ported from `this.addEvent(node, index, null)` - **confirmed
// edges get NO such generic forwarding** (`self.addEvent` is only ever called for nodes, never for
// edges, in this file) so this port doesn't invent any either; edges only ever emit the two named
// custom events below. Background-click reset, ported from the `axis.mousedown` handler on
// `self.axis.root.element`, clears all active/tooltip state.
//
// **Two named custom events**, ported from `self.chart.emit("topology.nodeclick"/"edgeclick", ...)`
// (renamed `nodeclick`/`edgeclick` - Vue event names can't contain a literal `.` the way a
// `v-on:topology.nodeclick` binding would be parsed, since `.foo` after an event name is Vue's own
// modifier syntax). **A deliberate, flagged fix, not a preserved quirk**: source's only call site
// to `showTooltip(edge)` (inside `onEdgeActiveHandler`) omits its own `e` parameter, so upstream's
// `edgeclick` payload's event argument is always `undefined` in practice - clearly an oversight
// with nothing to preserve (unlike e.g. treemap's grouping quirk, this has no real geometric/visual
// consequence to document, only lost information), so this port passes the real `MouseEvent`
// instead.
//
// **What's simplified, beyond the topologyctrl.js/node-z-order gaps above**: (1) node layout is a
// reactive Vue `computed()` (recomputes when `data`/`width`/`height`/`sort`/`space` change) rather
// than source's own `axis.cacheXY`, which is computed ONCE per chart instance and then reused
// forever even across later `data` changes - an artifact of the engine's own imperative
// re-render/cache lifecycle with no real equivalent to preserve in a reactive component, not a
// documented algorithmic feature. (2) the tooltip balloon's box WIDTH is measured for real (see
// `measureTextWidth`, shared with `ChartTooltip.vue`); its HEIGHT is a `fontSize`-based
// approximation rather than a true measured text bbox, matching `ChartTooltip.vue`'s own
// established, already-documented approximation. (3) `activeNode`/`activeEdge` apply immediately/
// reactively from first render; source only applies them starting on a chart's SECOND `render()`
// call (`this.on("render", (init) => { if (!init) ... })` - an artifact of source's own
// initial-vs-subsequent-render lifecycle bookkeeping with no Vue-idiomatic equivalent, and one that
// would make the demo's own `active-node`/`active-edge` examples appear broken on load if
// preserved literally).
//
// **Phase D addition: `pannable`/`zoomable` props, ported from `widget/topologyctrl.js` (191
// lines), this port's FIRST widget** (`extend: "chart.widget.core"`, confirmed from source - a
// widget attaches alongside a brush and mutates its axis/grid state rather than drawing marks of
// its own). See `useTopologyZoom.ts`'s own header comment for the full source read-through
// (`extend` chain, all three of its interactions, and why individual-node dragging is NOT part of
// this prop pair - it's a separate, unconditional-in-source feature with its own drag semantics,
// left for a future item). **Vue integration decision, setting precedent for the rest of Phase D**:
// exposed as two opt-in boolean PROPS on this existing component (`pannable` for `widget.move`,
// `zoomable` for `widget.zoom`), not a separate wrapper/widget component - consistent with this
// port's established "one component, opt-in props" pattern (e.g. `BarChart`'s `stacked`/
// `normalize`/`equalizer`), and a natural fit here specifically because the widget's entire effect
// reduces to ONE derived value (a `scale`/`viewX`/`viewY` triple) applied as a single wrapping
// `<g transform>` around the already-rendered content - there is no separate visual surface a
// standalone component would need to own. A future widget with its own independent visual real
// estate (e.g. `legend.js`, which draws its own key/swatch list, possibly outside this chart's own
// SVG bounds entirely) may well warrant an actual separate component instead - this file's own
// case doesn't generalize to "all widgets are props," only to "a widget whose effect is a pure
// transform/state mutation on an existing brush is a prop."
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { computeBoxWidth, measureTextWidth } from '../composables/tooltipMeasure'
import {
  buildTopologyEdges,
  findTopologyEdgeData,
  findTopologyNode,
  layoutTopologyLinear,
  layoutTopologyRandom,
  topologyActiveEdgeKeysForEdge,
  topologyActiveEdgeKeysForNode,
  topologyBalloonPoints,
  topologyEdgeAlign,
  topologyEdgeTextPosition,
  topologyTooltipPosition,
  topologyTooltipTitleNames,
  type TopologyArea,
  type TopologyBuiltEdge,
  type TopologyEdgeDataRow,
  type TopologyNodeRow,
  type TopologyPositionedNode,
} from '../composables/useTopology'
import { clampTopologyZoomScale, computeTopologyPan, topologyViewportTransform, topologyZoomDirection, type TopologyViewportPoint } from '../composables/useTopologyZoom'
import { useTheme } from '../composables/useTheme'
import ChartTitle from './ChartTitle.vue'
import type { ChartElementEventPayload, ChartElementEventType, ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    /** Graph nodes - `key` (unique id) and `outgoing` (other rows' `key`s this row has a directed
     * edge to) are read by this brush; any other fields are passed through untouched to the
     * callback props below. See this file's header comment for the full data-model write-up. */
    data: TopologyNodeRow[]
    width?: number
    height?: number
    theme?: ThemeName
    title?: string
    /** `grid.sort` - `"linear"` (default, source's own default) or `"random"`. See this file's
     * header comment for the real (non-physics, non-caller-coordinate) algorithms. */
    sort?: 'linear' | 'random'
    /** `grid.space` - the layout grid's cell size (default `50`, source's own default). */
    space?: number
    /** `brush.nodeTitle` - a bold label under each node. */
    nodeTitle?: (data: TopologyNodeRow) => string
    /** `brush.nodeText` - a short label centered on each node. */
    nodeText?: (data: TopologyNodeRow) => string
    /** `brush.nodeImage` - an image URL; when supplied, an `<image>` replaces the default circle. */
    nodeImage?: (data: TopologyNodeRow) => string
    /** `brush.nodeScale` - per-node radius multiplier over `topologyNodeRadius`. Default `1`. */
    nodeScale?: (data: TopologyNodeRow) => number
    /** `brush.edgeData` - per-edge metadata (`{ key: "start:end", ...fields }`), consulted for an
     * existing edge's label/tooltip/opacity. Default `[]`. */
    edgeData?: TopologyEdgeDataRow[]
    /** `brush.edgeText` - `(edgeDataRow, align) => label | null`. No label when `null`/omitted, or
     * when the edge has no matching `edgeData` row. */
    edgeText?: (data: TopologyEdgeDataRow, align: 'start' | 'end') => string | null
    /** `brush.edgeOpacity` - `(edgeDataRow) => opacity`, only called when a matching `edgeData` row
     * exists; falls back to the theme's `topologyEdgeOpacity` otherwise. */
    edgeOpacity?: (data: TopologyEdgeDataRow) => number
    /** `brush.tooltipTitle` - `(names, align) => title`. `names` is the edge's two endpoint
     * display names (`[start, end]`, via `nodeTitle`) - see `topologyTooltipTitleNames`'s doc
     * comment for the raw-key fallback. Tooltip never shows unless BOTH this and `tooltipText` are
     * supplied (matches source's own gate). */
    tooltipTitle?: (names: [string, string] | string, align: 'start' | 'end') => string
    /** `brush.tooltipText` - `(edgeDataRow, align) => text`, the tooltip's second line. */
    tooltipText?: (data: TopologyEdgeDataRow, align: 'start' | 'end') => string
    /** `brush.activeNode` - seeds which node starts activated (highlights its own outgoing edges).
     * Also updated internally when a node is clicked (or whatever `activeEvent` names) - see this
     * file's header comment on the Vue-idiomatic `activeNode`/`activeEdge` merge. */
    activeNode?: string | null
    /** `brush.activeEdge` - seeds which edge starts activated (shows its tooltip too, if both
     * tooltip callbacks are supplied). */
    activeEdge?: string | null
    /** `brush.activeEvent` - the DOM event name that activates a node or edge. Default `"click"`. */
    activeEvent?: string
    /** `widget.move` (`widget/topologyctrl.js`) - drag the BACKGROUND (not a node) to pan the whole
     * topology viewport. See this file's header comment for why this - not individual-node
     * dragging - is what this prop ports. Default `false`, matching source's own default. */
    pannable?: boolean
    /** `widget.zoom` (`widget/topologyctrl.js`) - mouse-wheel to zoom the whole topology viewport
     * in/out, clamped to `[0.6, 2]` in `0.1` steps. Default `false`, matching source's own default. */
    zoomable?: boolean
  }>(),
  {
    width: 640,
    height: 400,
    theme: 'classic',
    title: undefined,
    sort: 'linear',
    space: 50,
    nodeTitle: undefined,
    nodeText: undefined,
    nodeImage: undefined,
    nodeScale: undefined,
    edgeData: () => [],
    edgeText: undefined,
    edgeOpacity: undefined,
    tooltipTitle: undefined,
    tooltipText: undefined,
    activeNode: null,
    activeEdge: null,
    activeEvent: 'click',
    pannable: false,
    zoomable: false,
  },
)

const emit = defineEmits<{
  click: [payload: ChartElementEventPayload]
  dblclick: [payload: ChartElementEventPayload]
  contextmenu: [payload: ChartElementEventPayload]
  mouseover: [payload: ChartElementEventPayload]
  mouseout: [payload: ChartElementEventPayload]
  /** `topology.nodeclick`, ported - fires when a node is activated (see `activeEvent`). */
  nodeclick: [payload: { data: TopologyNodeRow; event: MouseEvent }]
  /** `topology.edgeclick`, ported - fires when an edge is activated, only when BOTH `tooltipTitle`
   * and `tooltipText` are supplied (matches source's own gate - see this file's header comment). */
  edgeclick: [payload: { data: TopologyEdgeDataRow | null; event: MouseEvent }]
}>()

const themeName = toRef(props, 'theme')
const { theme, color: themeColor } = useTheme(themeName)

const titleReserve = computed(() => (props.title ? theme('titleFontSize') + 14 : 0))
const area = computed<TopologyArea>(() => ({ x: 0, y: titleReserve.value, width: props.width, height: props.height - titleReserve.value }))

// Hardcoded upstream (not theme tokens) - `topologynode.js`'s own local `textY`/`padding`/`anchor`
// constants (tooltip layout) - separate from the theme-driven `topologyEdgePointRadius`.
const TEXT_Y = 14
const PADDING = 7
const ANCHOR = 7

interface RenderNode extends TopologyPositionedNode {
  index: number
  color: string
  text: string | null
  titleText: string | null
  imageHref: string | null
}

const positionedNodes = computed<RenderNode[]>(() => {
  const points = props.sort === 'random' ? layoutTopologyRandom(props.data.length, area.value, props.space) : layoutTopologyLinear(props.data.length, area.value, props.space)
  const baseRadius = theme('topologyNodeRadius')

  return props.data.map((d, i) => {
    const scale = props.nodeScale ? props.nodeScale(d) : 1
    const p = points[i] ?? { x: 0, y: 0 }
    return {
      key: String(d.key),
      data: d,
      x: p.x,
      y: p.y,
      // Global pan/zoom scale - always 1 (the topologyctrl.js widget that could change it isn't
      // ported this iteration, see this file's header comment).
      scale: 1,
      radius: baseRadius * scale,
      index: i,
      color: themeColor(i),
      text: props.nodeText ? props.nodeText(d) || null : null,
      titleText: props.nodeTitle ? props.nodeTitle(d) || null : null,
      imageHref: props.nodeImage ? props.nodeImage(d) : null,
    }
  })
})

const edges = computed<TopologyBuiltEdge[]>(() => buildTopologyEdges(positionedNodes.value, theme('topologyEdgePointRadius')))
const edgeByKey = computed(() => new Map(edges.value.map((e) => [e.key, e])))

function edgeDataOf(key: string): TopologyEdgeDataRow | null {
  return findTopologyEdgeData(props.edgeData, key)
}

function edgeOpacityOf(edgeDataRow: TopologyEdgeDataRow | null): number {
  if (props.edgeOpacity && edgeDataRow) return props.edgeOpacity(edgeDataRow)
  return theme('topologyEdgeOpacity')
}

// ---- Active/hover state ----------------------------------------------------------------------

type ActiveState = { type: 'node'; key: string } | { type: 'edge'; key: string } | null

function seedActive(): ActiveState {
  if (props.activeNode != null) return { type: 'node', key: props.activeNode }
  if (props.activeEdge != null) return { type: 'edge', key: props.activeEdge }
  return null
}

const internalActive = ref<ActiveState>(seedActive())
watch(
  () => props.activeNode,
  (v) => {
    if (v != null) internalActive.value = { type: 'node', key: v }
  },
)
watch(
  () => props.activeEdge,
  (v) => {
    if (v != null) internalActive.value = { type: 'edge', key: v }
  },
)

const activeEdgeKeys = computed<Set<string>>(() => {
  const active = internalActive.value
  if (!active) return new Set()
  if (active.type === 'node') {
    const node = findTopologyNode(props.data, active.key)
    return node ? topologyActiveEdgeKeysForNode(node, edges.value) : new Set()
  }
  return topologyActiveEdgeKeysForEdge(active.key, edges.value)
})

const hoverEdgeKey = ref<string | null>(null)

function edgeState(key: string): 'active' | 'hover' | 'default' {
  if (activeEdgeKeys.value.has(key)) return 'active'
  if (hoverEdgeKey.value === key) return 'hover'
  return 'default'
}
function edgeColorFor(state: 'active' | 'hover' | 'default'): string {
  if (state === 'active') return theme('topologyActiveEdgeColor')
  if (state === 'hover') return theme('topologyHoverEdgeColor')
  return theme('topologyEdgeColor')
}
function edgeWidthFor(state: 'active' | 'hover' | 'default'): number {
  if (state === 'active') return theme('topologyActiveEdgeWidth')
  if (state === 'hover') return theme('topologyHoverEdgeWidth')
  return theme('topologyEdgeWidth')
}

function onEdgeMouseOver(key: string) {
  if (activeEdgeKeys.value.has(key)) return
  hoverEdgeKey.value = key
}
function onEdgeMouseOut(key: string) {
  if (activeEdgeKeys.value.has(key)) return
  if (hoverEdgeKey.value === key) hoverEdgeKey.value = null
}

function onEdgeActivate(edge: TopologyBuiltEdge, e: MouseEvent) {
  internalActive.value = { type: 'edge', key: edge.key }
  if (props.tooltipTitle && props.tooltipText) {
    emit('edgeclick', { data: edgeDataOf(edge.key), event: e })
  }
}

function resetActive(e: MouseEvent) {
  if (e.target !== e.currentTarget) return
  internalActive.value = null
  hoverEdgeKey.value = null
}

// ---- Render-ready edges (geometry + color/opacity/label already resolved) -----------------------

interface RenderEdge {
  key: string
  ownsLine: boolean
  x1: number
  y1: number
  x2: number
  y2: number
  lineColor: string
  lineWidth: number
  lineOpacity: number
  cx: number
  cy: number
  circleR: number
  circleColor: string
  circleOpacity: number
  text: { x: number; y: number; rotateDeg: number; cx: number; cy: number; anchor: 'start' | 'end'; content: string } | null
}

const renderEdges = computed<RenderEdge[]>(() => {
  const pointRadius = theme('topologyEdgePointRadius')

  return edges.value.map((e) => {
    const state = edgeState(e.key)
    const ownEdgeData = edgeDataOf(e.key)
    const ownOpacity = edgeOpacityOf(ownEdgeData)

    // The reciprocal (reverse) edge, if any - reused line's opacity is THAT edge's own opacity
    // (last-write-wins in source's paint order, see this file's header comment).
    const partner = e.ownsLine ? edgeByKey.value.get(e.reverseKey) : undefined
    const lineOpacity = partner ? edgeOpacityOf(edgeDataOf(partner.key)) : ownOpacity

    const align = topologyEdgeAlign(e.inXY, e.outXY)
    const edgeLabel = ownEdgeData && props.edgeText ? props.edgeText(ownEdgeData, align) : null
    const textPos = edgeLabel != null ? topologyEdgeTextPosition(align, e.inXY, e.outXY) : null

    return {
      key: e.key,
      ownsLine: e.ownsLine,
      x1: e.inXY.x,
      y1: e.inXY.y,
      x2: e.outXY.x,
      y2: e.outXY.y,
      lineColor: edgeColorFor(state),
      lineWidth: edgeWidthFor(state) * e.scale,
      lineOpacity,
      cx: e.outXY.x,
      cy: e.outXY.y,
      circleR: pointRadius * e.scale,
      circleColor: edgeColorFor(state),
      circleOpacity: ownOpacity,
      text:
        textPos && edgeLabel != null
          ? { x: textPos.x, y: textPos.y, rotateDeg: textPos.rotateDeg, cx: textPos.cx, cy: textPos.cy, anchor: textPos.textAnchor, content: edgeLabel }
          : null,
    }
  })
})

// ---- Node events --------------------------------------------------------------------------------

function forwardNodeEvent(type: ChartElementEventType, node: RenderNode, e: MouseEvent) {
  ;(emit as (type: ChartElementEventType, payload: ChartElementEventPayload) => void)(type, { dataIndex: node.index, dataKey: null, data: node.data, event: e })
}

function onNodeEvent(type: ChartElementEventType, node: RenderNode, e: MouseEvent) {
  forwardNodeEvent(type, node, e)
  if (type === props.activeEvent) {
    internalActive.value = { type: 'node', key: node.key }
    emit('nodeclick', { data: node.data, event: e })
  }
}

// ---- Tooltip -------------------------------------------------------------------------------------

const tooltip = computed(() => {
  const active = internalActive.value
  if (!active || active.type !== 'edge') return null
  if (!props.tooltipTitle || !props.tooltipText) return null

  const edge = edgeByKey.value.get(active.key)
  const edgeDataRow = edgeDataOf(active.key)
  if (!edge || !edgeDataRow) return null

  const align = topologyEdgeAlign(edge.inXY, edge.outXY)
  const names = topologyTooltipTitleNames(edgeDataRow.key, props.data, props.nodeTitle)
  const titleText = props.tooltipTitle(names, align)
  const contentText = props.tooltipText(edgeDataRow, align)

  const fontSize = theme('topologyTooltipFontSize')
  const w = computeBoxWidth([measureTextWidth(titleText, fontSize), measureTextWidth(contentText, fontSize)], PADDING)
  const h = fontSize * 1.2 * 2 + PADDING

  const pos = topologyTooltipPosition(align, edge.outXY, w, h, ANCHOR, theme('topologyEdgePointRadius'))
  const points = topologyBalloonPoints(align === 'end' ? 'bottom' : 'top', w, h, ANCHOR)
  const titleY = PADDING * 2 + (align === 'end' ? ANCHOR : 0)

  return {
    x: pos.x,
    y: pos.y,
    points,
    width: w,
    height: h,
    titleText,
    contentText,
    titleY,
    contentY: titleY + TEXT_Y + PADDING / 2,
  }
})

// ---- Pan/zoom viewport (`pannable`/`zoomable`, ported from `widget/topologyctrl.js`) -------------

const svgRoot = ref<SVGSVGElement | null>(null)
const viewportScale = ref(1)
const viewportView = ref<TopologyViewportPoint>({ x: 0, y: 0 })
const viewportTransform = computed(() => topologyViewportTransform(viewportScale.value, viewportView.value.x, viewportView.value.y))

// Converts a mouse event's client coordinates into this SVG's own user-unit (viewBox) space, so
// panning stays 1:1 with the pointer even when `max-width: 100%` has scaled the rendered SVG down
// from its `width`/`height` attributes (e.g. a narrow viewport) - source has no such concern since
// it assumes a fixed-pixel, non-responsive layout throughout.
function toViewportPoint(e: MouseEvent): TopologyViewportPoint {
  const svg = svgRoot.value
  if (!svg) return { x: e.clientX, y: e.clientY }
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width > 0 ? props.width / rect.width : 1
  const scaleY = rect.height > 0 ? props.height / rect.height : 1
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
}

interface PanDrag {
  viewAtStart: TopologyViewportPoint
  pointerAtStart: TopologyViewportPoint
}
const panDrag = ref<PanDrag | null>(null)

function onBackgroundMouseDown(e: MouseEvent) {
  resetActive(e)
  if (!props.pannable) return
  panDrag.value = { viewAtStart: { ...viewportView.value }, pointerAtStart: toViewportPoint(e) }
}

function onWindowMouseMove(e: MouseEvent) {
  if (!panDrag.value) return
  viewportView.value = computeTopologyPan(panDrag.value.viewAtStart, panDrag.value.pointerAtStart, toViewportPoint(e))
}

function endPanDrag() {
  panDrag.value = null
}

function onWheel(e: WheelEvent) {
  if (!props.zoomable) return
  e.preventDefault()
  viewportScale.value = clampTopologyZoomScale(viewportScale.value, topologyZoomDirection(e.deltaY))
}

onMounted(() => {
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', endPanDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', endPanDrag)
})
</script>

<template>
  <svg ref="svgRoot" :width="props.width" :height="props.height" :viewBox="`0 0 ${props.width} ${props.height}`" class="jui-chart-vue-root" @wheel="onWheel">
    <rect
      :x="0"
      :y="0"
      :width="props.width"
      :height="props.height"
      :fill="theme('backgroundColor')"
      :style="{ cursor: props.pannable ? (panDrag ? 'grabbing' : 'grab') : 'default' }"
      @mousedown="onBackgroundMouseDown"
    />

    <!-- `pannable`/`zoomable` viewport transform (`widget/topologyctrl.js`) - identity (`scale(1)
         translate(0, 0)`) when both props are off, so this wrapper is a no-op at defaults. See
         `useTopologyZoom.ts` for the derivation confirming this is exactly equivalent to source's
         own per-node/per-edge scale multiplication. -->
    <g :transform="viewportTransform">
      <g>
        <g v-for="re in renderEdges" :key="re.key" style="cursor: pointer" @mouseover="onEdgeMouseOver(re.key)" @mouseout="onEdgeMouseOut(re.key)" @[props.activeEvent]="(e: MouseEvent) => onEdgeActivate(edgeByKey.get(re.key)!, e)">
          <line v-if="re.ownsLine" :x1="re.x1" :y1="re.y1" :x2="re.x2" :y2="re.y2" :stroke="re.lineColor" :stroke-width="re.lineWidth" :stroke-opacity="re.lineOpacity" shape-rendering="geometricPrecision" />
          <circle :cx="re.cx" :cy="re.cy" :r="re.circleR" :fill="re.circleColor" :fill-opacity="re.circleOpacity" :stroke="theme('backgroundColor')" :stroke-width="theme('topologyEdgeWidth') * 2" />
          <text
            v-if="re.text"
            :x="re.text.x"
            :y="re.text.y"
            :text-anchor="re.text.anchor"
            :fill="theme('topologyEdgeFontColor')"
            :font-size="theme('topologyEdgeFontSize')"
            :transform="`rotate(${re.text.rotateDeg}, ${re.text.cx}, ${re.text.cy})`"
          >
            {{ re.text.content }}
          </text>
        </g>
      </g>

      <g>
        <g
          v-for="node in positionedNodes"
          :key="node.key"
          :transform="`translate(${node.x}, ${node.y})`"
          style="cursor: pointer"
          @click="(e) => onNodeEvent('click', node, e)"
          @dblclick="(e) => onNodeEvent('dblclick', node, e)"
          @contextmenu="
            (e) => {
              e.preventDefault()
              onNodeEvent('contextmenu', node, e)
            }
          "
          @mouseover="(e) => onNodeEvent('mouseover', node, e)"
          @mouseout="(e) => onNodeEvent('mouseout', node, e)"
        >
          <image v-if="node.imageHref" :href="node.imageHref" :width="node.radius * 2" :height="node.radius * 2" :x="-node.radius" :y="-node.radius" />
          <circle v-else class="circle" :r="node.radius" :fill="node.color" />
          <text v-if="node.text" class="text" :x="0.1" :y="node.radius / 2" :fill="theme('topologyNodeFontColor')" :font-size="theme('topologyNodeFontSize')" text-anchor="middle">
            {{ node.text }}
          </text>
          <text v-if="node.titleText" class="title" :x="0.1" :y="node.radius + 13" :fill="theme('topologyNodeTitleFontColor')" :font-size="theme('topologyNodeTitleFontSize')" font-weight="bold" text-anchor="middle">
            {{ node.titleText }}
          </text>
        </g>
      </g>

      <g v-if="tooltip" :transform="`translate(${tooltip.x}, ${tooltip.y})`">
        <polygon :points="tooltip.points" :fill="theme('topologyTooltipBackgroundColor')" :stroke="theme('topologyTooltipBorderColor')" stroke-width="1" />
        <text :x="PADDING" :y="tooltip.titleY" font-weight="bold" :font-size="theme('topologyTooltipFontSize')" :fill="theme('topologyTooltipFontColor')">{{ tooltip.titleText }}</text>
        <text :x="PADDING" :y="tooltip.contentY" :font-size="theme('topologyTooltipFontSize')" :fill="theme('topologyTooltipFontColor')">{{ tooltip.contentText }}</text>
      </g>
    </g>

    <ChartTitle v-if="props.title" :text="props.title" :x="props.width / 2" :y="16" :color="theme('titleFontColor')" :size="theme('titleFontSize')" :weight="theme('titleFontWeight')" />
  </svg>
</template>

<style scoped>
.jui-chart-vue-root {
  display: block;
  max-width: 100%;
  font-family: inherit;
}
</style>
