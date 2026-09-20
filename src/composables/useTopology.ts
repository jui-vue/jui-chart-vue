/**
 * Pure logic for `TopologyChart.vue`, ported from `chart.brush.topologynode` (711 lines) plus the
 * two things it actually depends on to position nodes at all:
 *
 * - `grid/topologytable.js`'s `chart.topology.sort.linear`/`chart.topology.sort.random` - the
 *   BRUSH ITSELF never computes a layout; it calls `self.axis.c(index)`, and the ONLY thing that
 *   ever answers that call in the real engine is this "c"-slot grid (wired via
 *   `axis: [{ c: { type: "topologytable" }, data }]` - confirmed from `examples/topology.html`).
 *   **Confirmed by reading both sort functions in full: this is NOT force-directed physics and
 *   does NOT read caller-supplied x/y from the data rows at all** (the example's `data2` has
 *   `x`/`y` fields but `topologytable.js` never looks at them) - it's a purely procedural
 *   placement (a zigzag column scan for "linear", `Math.random()` for "random") within the grid's
 *   own axis area. This port implements those two algorithms directly as pure functions rather
 *   than porting the generic `chart.grid.c`/`chart.grid.core` indirection layer itself - the same
 *   "extract the real algorithm, not the engine plumbing around it" choice `usePie.ts` made for
 *   `axis.c` (pie/donut center math) and `useTreemap.ts`/`useFlame.ts` made for the tree engine.
 * - `topologynode.js`'s own `getDistanceXY()`/`setDataEdges()`/edge-reciprocity ("connect") logic.
 *
 * `widget/topologyctrl.js` (pan/zoom/drag) is a genuinely OPTIONAL add-on, confirmed by reading it
 * in full: it only ever calls `axis.c(key).setX/setY/setScale/setView(...)` (mutators the grid
 * itself exposes) and forces a re-render - the brush renders and is fully interactive (node/edge
 * click, hover, tooltip) with zero knowledge of whether that widget is even present, exactly like
 * `focus.js` turned out not to need `zoom.js`. Not ported this iteration (Phase D item).
 *
 * **The data model, confirmed from `draw()`'s `this.eachData()` loop and `setDataEdges()`**: real
 * graph nodes+edges, NOT the flat dot-separated-index-path tree shape `treemap.js`/`flame.js`
 * share. Each row is `{ key: string, outgoing: string[], ...arbitrary fields }` - `outgoing` is a
 * list of OTHER rows' `key`s this row has a directed edge to. There is no separate top-level
 * `edges`/`links` array for the graph topology itself (edges are derived from `outgoing`); the
 * optional `edgeData` array is a SEPARATE, purely-metadata list (`{ key: "start:end", ...fields }`)
 * consulted only for tooltip/label/opacity content on an edge that already exists via `outgoing` -
 * an edge with no matching `edgeData` row still renders (line + endpoint dot), just with no label
 * and the theme's default opacity.
 */

export interface TopologyNodeRow {
  key: string
  outgoing: string[]
  [field: string]: unknown
}

export interface TopologyEdgeDataRow {
  key: string
  [field: string]: unknown
}

export interface TopologyArea {
  x: number
  y: number
  width: number
  height: number
}

export interface TopologyPoint {
  x: number
  y: number
}

// ---------------------------------------------------------------------------------------------
// Layout - ported from `grid/topologytable.js`'s `chart.topology.sort.*`.
// ---------------------------------------------------------------------------------------------

/**
 * Ported from `chart.topology.sort.random`: each node lands at a uniformly random point inside
 * `area` (inset by `space` on the right/bottom so the node stays inside the area). `rng` defaults
 * to `Math.random` (source's own hardcoded choice) but is injectable for deterministic tests/demos.
 */
export function layoutTopologyRandom(count: number, area: TopologyArea, space: number, rng: () => number = Math.random): TopologyPoint[] {
  const points: TopologyPoint[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * (area.width - space))
    const y = Math.floor(rng() * (area.height - space))
    points.push({ x: area.x + x, y: area.y + y })
  }
  return points
}

/**
 * Ported from `chart.topology.sort.linear`. **Confirmed by re-deriving the index math by hand
 * (see `useTopology.spec.ts`)**: this does NOT return `result[i]` = row `i`'s own point. The X
 * coordinate is a deterministic zigzag (even rows walk left-to-right in increasing column steps,
 * odd rows walk right-to-left), but the loop writes each row's point into a SEPARATE "slot" index
 * (`left`/`right` running pointers, not the row's own loop index `i`) - and the brush later reads
 * a row's position with a DIRECT index into this same array (`axis.c(index)` = `cacheXY[index]`,
 * confirmed from `topologytable.js`'s own `scale()` function). The net effect, preserved here
 * exactly rather than "fixed": **row `i`'s rendered position is generally the point computed for
 * a DIFFERENT row** - specifically, even row `i` computes its X for slot `i/2`, and odd row `i`
 * computes its X for slot `count-1-(i-1)/2`; whichever row's computation happened to land on slot
 * `i` is what row `i` actually gets drawn at. A caller relying on this mode should not assume any
 * particular row-to-position correspondence (this port's demo notes this explicitly).
 *
 * The Y coordinate is NOT deterministic even in "linear" mode: `getRandomRowIndex()` picks a
 * random row slot (avoiding repeats until every row has been used once, then resetting) via the
 * same injectable `rng`. **Not reproduced**: source's `cache` for this is a MODULE-level variable
 * (declared once outside the returned function, in the `jui.define` factory that runs once per
 * page), so in the original it leaks across every topology chart instance and every call on the
 * page - almost certainly an unintentional bug, not a documented feature of the algorithm's shape
 * (unlike e.g. treemap's grouping quirk). This port gives each `layoutTopologyLinear()` call its
 * own fresh cache instead.
 */
export function layoutTopologyLinear(count: number, area: TopologyArea, space: number, rng: () => number = Math.random): TopologyPoint[] {
  const rowCount = Math.floor(area.height / space)
  const colCount = Math.floor(area.width / space)
  const colStep = Math.floor(colCount / Math.max(1, count))

  const usedRows = new Set<number>()
  function randomRowIndex(): number {
    const idx = Math.floor(rng() * rowCount)
    if (usedRows.has(idx)) {
      if (usedRows.size < rowCount) return randomRowIndex()
      usedRows.clear()
    } else {
      usedRows.add(idx)
    }
    return idx
  }

  const slots: TopologyPoint[] = new Array(count)
  let colIndex = 0
  let left = -1
  let right = count

  for (let i = 0; i < count; i++) {
    let x: number
    let slot: number

    if (i % 2 === 0) {
      x = colIndex * space
      colIndex += colStep
      left += 1
      slot = left
    } else {
      x = (colCount - colIndex) * space + space
      right -= 1
      slot = right
    }

    const y = randomRowIndex() * space
    slots[slot] = { x: area.x + x + space, y: area.y + y + space / 2 }
  }

  return slots
}

// ---------------------------------------------------------------------------------------------
// Edge geometry - ported from `topologynode.js`'s `getDistanceXY()`/`setDataEdges()`.
// ---------------------------------------------------------------------------------------------

export interface DistanceXY {
  x: number
  y: number
  /** Radians, `Math.atan2`-style - the direction FROM `(x1,y1)` TOWARD `(x2,y2)`. */
  angle: number
  /** The real (undamped) distance between the two input points. */
  distance: number
}

/**
 * Ported from `getDistanceXY()`: the point reached by walking from `(x1,y1)` toward `(x2,y2)` for
 * a distance of `distance(x1,y1,x2,y2) + dist` (so a negative `dist` stops short of `(x2,y2)`).
 */
export function getDistanceXY(x1: number, y1: number, x2: number, y2: number, dist = 0): DistanceXY {
  const a = x1 - x2
  const b = y1 - y2
  const c = Math.sqrt(a * a + b * b)
  const angle = Math.atan2(y2 - y1, x2 - x1)

  return {
    x: x1 + Math.cos(angle) * (c + dist),
    y: y1 + Math.sin(angle) * (c + dist),
    angle,
    distance: c,
  }
}

export interface TopologyPositionedNode {
  key: string
  data: TopologyNodeRow
  x: number
  y: number
  /** Global pan/zoom scale - always `1` in this port (the `topologyctrl.js` widget that could
   * change it isn't ported). Kept as a field, not a hardcoded `1` inline, purely so the geometry
   * formulas below read the same as source's. */
  scale: number
  /** `topologyNodeRadius * nodeScale(data)` - see `TopologyChart.vue`. */
  radius: number
}

export interface TopologyBuiltEdge {
  key: string
  reverseKey: string
  start: string
  end: string
  /** Near the START (source) node, pulled back by the source's own radius + point radius + 1. */
  inXY: DistanceXY
  /** Near the END (target) node, pulled back by the target's own radius + point radius + 1 - this
   * is also where the small directional end-marker dot is drawn. */
  outXY: DistanceXY
  /** The SOURCE node's own scale (source multiplies both pull-back distances by the source's
   * `xy.scale`, never the target's - confirmed from `setDataEdges()`, preserved exactly). */
  scale: number
  /** `true` when this edge's reverse (`end + ":" + start`) was already built when this one was -
   * i.e. this is the "second" direction of a reciprocal pair. */
  connect: boolean
  /** `!connect` - only the first-built direction of a reciprocal pair renders the actual `<line>`
   * (the second reuses it, matching source's `if(!edge.connect()) { g.append(line) }`); every
   * edge, `connect` or not, still gets its own end-marker circle. */
  ownsLine: boolean
}

/**
 * Ported from `draw()`'s `this.eachData(... setDataEdges(i, j) ...)` loop. Builds one
 * `TopologyBuiltEdge` per `(node, outgoing target)` pair, in that iteration order (matching
 * source's `TopologyEdgeManager`, whose insertion order is exactly this). A target key not
 * present in `nodes` is skipped (source's `getNodeData()` would return `null` and
 * `self.axis.c(targetKey)` has no defined value to fall back to); a self-referencing `outgoing`
 * entry (`key === targetKey`) is skipped too, matching source's explicit guard.
 */
export function buildTopologyEdges(nodes: TopologyPositionedNode[], pointRadius: number): TopologyBuiltEdge[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  const built = new Map<string, TopologyBuiltEdge>()

  for (const node of nodes) {
    for (const targetKey of node.data.outgoing ?? []) {
      if (targetKey === node.key) continue
      const target = byKey.get(targetKey)
      if (!target) continue

      const inDist = (node.radius + pointRadius + 1) * node.scale
      const outDist = (target.radius + pointRadius + 1) * node.scale

      const inXY = getDistanceXY(target.x, target.y, node.x, node.y, -inDist)
      const outXY = getDistanceXY(node.x, node.y, target.x, target.y, -outDist)

      const key = `${node.key}:${targetKey}`
      const reverseKey = `${targetKey}:${node.key}`
      const connect = built.has(reverseKey)

      built.set(key, { key, reverseKey, start: node.key, end: targetKey, inXY, outXY, scale: node.scale, connect, ownsLine: !connect })
    }
  }

  return Array.from(built.values())
}

// ---------------------------------------------------------------------------------------------
// Active-state cascading - ported from `onNodeActiveHandler()`/`onEdgeActiveHandler()`.
// ---------------------------------------------------------------------------------------------

/**
 * Ported from `onNodeActiveHandler()`'s `activeEdges` build-up. **A real, order-dependent
 * asymmetry, preserved exactly**: for each of the node's own `outgoing` edges, the reciprocal
 * (`edges.get(edge.reverseKey())`) is only added when THAT SPECIFIC direction's own `connect` flag
 * is `true` - not "whenever a reciprocal exists". For a genuine reciprocal pair, exactly one
 * direction has `connect: true` (whichever was built second - see `buildTopologyEdges`), so
 * whether activating a node cascades to a reciprocal edge depends on which direction happens to be
 * named `node.key + ":" + target` versus the reverse, which itself depends on data/build order.
 */
export function topologyActiveEdgeKeysForNode(node: Pick<TopologyNodeRow, 'key' | 'outgoing'>, edges: TopologyBuiltEdge[]): Set<string> {
  const byKey = new Map(edges.map((e) => [e.key, e]))
  const result = new Set<string>()

  for (const target of node.outgoing ?? []) {
    const edge = byKey.get(`${node.key}:${target}`)
    if (edge) {
      result.add(edge.key)
      if (edge.connect) result.add(edge.reverseKey)
    }
  }

  return result
}

/** Ported from `onEdgeActiveHandler()`'s `activeEdges` build-up: same `connect`-gated reciprocal
 * cascade as `topologyActiveEdgeKeysForNode`, for a single directly-activated edge. */
export function topologyActiveEdgeKeysForEdge(edgeKey: string, edges: TopologyBuiltEdge[]): Set<string> {
  const byKey = new Map(edges.map((e) => [e.key, e]))
  const edge = byKey.get(edgeKey)
  const result = new Set<string>()
  if (!edge) return result

  result.add(edge.key)
  if (edge.connect) result.add(edge.reverseKey)
  return result
}

// ---------------------------------------------------------------------------------------------
// Edge text/tooltip placement - ported from `createEdgeText()`/`showTooltip()`.
// ---------------------------------------------------------------------------------------------

export type TopologyEdgeAlign = 'start' | 'end'

/** Ported from `createEdgeText()`'s `edgeAlign`/`showTooltip()`'s `align` (same formula, both
 * call sites). */
export function topologyEdgeAlign(inXY: TopologyPoint, outXY: TopologyPoint): TopologyEdgeAlign {
  return outXY.x > inXY.x ? 'end' : 'start'
}

export interface TopologyEdgeTextPosition {
  x: number
  y: number
  /** Degrees, for an SVG `rotate(deg, cx, cy)` transform. */
  rotateDeg: number
  cx: number
  cy: number
  textAnchor: TopologyEdgeAlign
}

const RADIAN_TO_DEGREE = 180 / Math.PI

/** Ported from `createEdgeText()`'s two branches (`align === "end"` vs `"start"`). */
export function topologyEdgeTextPosition(align: TopologyEdgeAlign, inXY: DistanceXY, outXY: DistanceXY): TopologyEdgeTextPosition {
  if (align === 'end') {
    return { x: outXY.x - 9, y: outXY.y + 13, rotateDeg: outXY.angle * RADIAN_TO_DEGREE, cx: outXY.x, cy: outXY.y, textAnchor: 'end' }
  }
  return { x: outXY.x + 8, y: outXY.y - 7, rotateDeg: inXY.angle * RADIAN_TO_DEGREE, cx: outXY.x, cy: outXY.y, textAnchor: 'start' }
}

/**
 * Ported from `draw.js`'s `balloonPoints()` (shared engine helper, not topology-specific
 * upstream, but not previously ported to this codebase - `ChartTooltip.vue`/`PinChart.vue` each
 * use their own, differently-shaped balloon, so this is a fresh port rather than a reuse). Only
 * `"top"`/`"bottom"` are ever requested by `showTooltip()`; `"left"`/`"right"`/default are ported
 * too, for source fidelity, though nothing in this brush exercises them.
 */
export function topologyBalloonPoints(type: 'top' | 'bottom' | 'left' | 'right' | null, w: number, h: number, anchor: number): string {
  const points: [number, number][] = []

  if (type === 'top') {
    points.push([0, 0], [w, 0], [w, h], [w / 2 + anchor / 2, h], [w / 2, h + anchor], [w / 2 - anchor / 2, h], [0, h], [0, 0])
  } else if (type === 'bottom') {
    points.push([0, anchor], [w / 2 - anchor / 2, anchor], [w / 2, 0], [w / 2 + anchor / 2, anchor], [w, anchor], [w, anchor + h], [0, anchor + h], [0, anchor])
  } else if (type === 'left') {
    points.push([0, 0], [w, 0], [w, h / 2 - anchor / 2], [w + anchor, h / 2], [w, h / 2 + anchor / 2], [w, h], [0, h], [0, 0])
  } else if (type === 'right') {
    points.push([0, 0], [w, 0], [w, h], [0, h], [0, h / 2 + anchor / 2], [0 - anchor, h / 2], [0, h / 2 - anchor / 2], [0, 0])
  } else {
    points.push([0, 0], [w, 0], [w, h], [0, h], [0, 0])
  }

  return points.map((p) => p.join(',')).join(' ')
}

/** Ported from `showTooltip()`'s final `tooltip.translate(x, ...)` call. */
export function topologyTooltipPosition(align: TopologyEdgeAlign, outXY: TopologyPoint, w: number, h: number, anchor: number, point: number): TopologyPoint {
  const x = outXY.x - w / 2 + anchor / 2 + point / 2
  if (align === 'end') return { x, y: outXY.y + anchor / 2 + point }
  return { x, y: outXY.y - anchor - h + point }
}

/**
 * Ported from `getTooltipTitle()`: resolves an edge key's two endpoint display names (via
 * `nodeTitle`, falling back to the raw node key), for `tooltipTitle(names, align)`. Returns the
 * raw `key` string itself (matching source's own `if(names.length>0) return names; return key`)
 * on the edge case where NEITHER endpoint is found among `nodes`.
 */
export function topologyTooltipTitleNames(key: string, nodes: TopologyNodeRow[], nodeTitle?: (data: TopologyNodeRow) => string): [string, string] | string {
  const [startKey, endKey] = key.split(':')
  const names: string[] = []

  for (const data of nodes) {
    const title = nodeTitle ? nodeTitle(data) : ''
    if (data.key === startKey) names[0] = title || data.key
    if (data.key === endKey) names[1] = title || data.key
  }

  if (names.length > 0) return [names[0] ?? startKey, names[1] ?? endKey]
  return key
}

/** Ported from `getNodeData()`/`getEdgeData()` - linear lookups by key (small graphs; matches
 * source's own linear scans exactly rather than pre-indexing). */
export function findTopologyNode(nodes: TopologyNodeRow[], key: string): TopologyNodeRow | null {
  return nodes.find((n) => n.key === key) ?? null
}

export function findTopologyEdgeData(edgeData: TopologyEdgeDataRow[], key: string): TopologyEdgeDataRow | null {
  return edgeData.find((e) => e.key === key) ?? null
}
