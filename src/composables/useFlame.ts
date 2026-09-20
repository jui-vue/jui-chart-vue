/**
 * Pure logic for `FlameChart.vue`, ported from `flame.js` (390 lines) - see that component's own
 * header comment for the full source-confirmed data model, structural precedent, and the
 * deliberate simplification made to the zoom/`activeIndex` filtering (dropping `flame.js`'s own
 * `createFilteredNodes()`/`createIndexData()`/`QuickSort`/`axis.cacheNodes` reindexing dance in
 * favor of an equivalent, much simpler parent-pointer walk over a stable tree - algebraically
 * verified equivalent by hand-tracing both a 1-ancestor and a 2-ancestor zoom case, see
 * `filterFlameActive()`'s own doc comment and `useFlame.spec.ts`).
 *
 * The tree itself, and this file's tree-building/layout functions, are new logic with no direct
 * upstream equivalent (this port's first genuinely hierarchical brush) - `flame.js` instead reuses
 * `treemap.js`'s `chart.brush.treemap.nodemanager` (a stateful, DOM-index-keyed tree builder) for
 * the same job. Kept pure and unit-tested with a hand-traced 4-level tree, matching this port's
 * established convention for recursive/geometric math (see `usePyramid.ts`/`useTimeline.ts`).
 */

/** One row of the flat, index-keyed input shape confirmed from `drawBefore()`'s `nodes.insertNode()`
 * loop and `examples/resources/flamedata.js`'s real sample data: `index` is a dot-separated tree
 * path (`"0"` = root, `"0.1"` = root's 2nd child, `"0.1.0"` = that child's 1st child, ...), `text`/
 * `value` are read via `getValue(d,"text","")`/`getValue(d,"value",0)`. **Rows must appear in
 * parent-before-child order, with the very first row as the tree's root** - matching how
 * `chart.brush.treemap.nodemanager`'s own `insertNode()` requires an already-inserted parent to
 * attach a child to (a row whose parent hasn't appeared yet is silently dropped here, a deliberate,
 * flagged simplification of what would be a hard crash upstream - see `buildFlameTree()`). */
export interface FlameSourceRow {
  index: string
  text?: string | number
  value?: number
}

/** A positioned-free tree node - `depth` matches `chart.brush.treemap.node`'s own `reload()`
 * formula (`index.split(".").length`, so the root is depth `1`, not `0`). `parent` back-pointers
 * exist purely to make `filterFlameActive()`'s ancestor walk trivial - `flame.js` gets the same
 * pointer from `chart.brush.treemap.node`'s own `this.parent`. */
export interface FlameTreeNode {
  index: string
  text: string
  value: number
  depth: number
  children: FlameTreeNode[]
  parent: FlameTreeNode | null
}

/**
 * Ported from `drawBefore()`'s `nodes.insertNode(k, {...})` loop, replacing
 * `chart.brush.treemap.nodemanager`'s imperative, index-string-parsing `insertNode`/
 * `getNodeParent`/`Node.reload()` machinery with one pure pass building a plain object tree (this
 * port's own tree shape, not a port of `chart.brush.treemap.node`'s class). The parent of row
 * `"a.b.c"` is looked up as row `"a.b"` (the index string minus its last dot segment) in a running
 * `Map`; the very first row becomes the root unconditionally (matching every real usage upstream,
 * including `flamedata.js`'s own first entry `{index:"0", ...}` - `insertNode`'s own literal
 * `parseInt(index)==0` root-detection quirk, which would technically also fire on a malformed first
 * index like `"0.5"`, is not reproduced - a row's actual position in the array, not its index
 * string, decides the root here). Returns `null` for an empty `rows` array.
 */
export function buildFlameTree(rows: FlameSourceRow[]): FlameTreeNode | null {
  if (rows.length === 0) return null

  const byIndex = new Map<string, FlameTreeNode>()
  let root: FlameTreeNode | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const index = String(row.index)
    const node: FlameTreeNode = {
      index,
      text: String(row.text ?? ''),
      value: Number(row.value ?? 0),
      depth: index.split('.').length,
      children: [],
      parent: null,
    }
    byIndex.set(index, node)

    if (i === 0) {
      root = node
      continue
    }

    const dot = index.lastIndexOf('.')
    const parent = dot === -1 ? null : byIndex.get(index.slice(0, dot))
    if (parent) {
      node.parent = parent
      parent.children.push(node)
    }
    // else: parent row hasn't appeared yet (malformed input) - node is built but left detached,
    // so it's simply absent from any traversal starting at `root`.
  }

  return root
}

/** Ported from `getMaxDepth()`: the deepest `depth` value across every node in the tree (root
 * included, so a single-node tree has `maxDepth = 1`, never `0`). */
export function getFlameMaxDepth(root: FlameTreeNode): number {
  let max = root.depth
  const stack: FlameTreeNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as FlameTreeNode
    if (node.depth > max) max = node.depth
    for (const child of node.children) stack.push(child)
  }
  return max
}

/** Depth-first lookup by exact `index` string - the pure-tree equivalent of
 * `chart.brush.treemap.nodemanager.getNode(index)`. Returns `null` when not found. */
export function findFlameNode(root: FlameTreeNode, index: string): FlameTreeNode | null {
  if (root.index === index) return root
  for (const child of root.children) {
    const found = findFlameNode(child, index)
    if (found) return found
  }
  return null
}

export interface FlameActiveFilter {
  root: FlameTreeNode
  activeDepth: number
}

/**
 * Ported from `draw()`'s active-zoom branch (`createFilteredNodes()` + `setCacheParents()` +
 * `setCacheChildren()` + `sortingCacheNodes()` + `createIndexData()`/`createChildIndexData()`),
 * **deliberately re-derived as a much simpler equivalent, not a literal line-by-line port** - see
 * this file's own header comment for why (source's version exists only to cope with a fresh,
 * re-indexed `NodeManager` being rebuilt on every draw call; this port's tree is a stable
 * `computed()`, so there's no re-indexing problem to solve).
 *
 * **Algebraic derivation, hand-verified against source with two traced cases (1-ancestor and
 * 2-ancestor chains) before being trusted - see `useFlame.spec.ts`**: source's
 * `setCacheParents(activeNode, activeNode.value)` walks from `activeNode` up to the root, forcing
 * every ANCESTOR's `value` to equal `activeNode.value` (so each ancestor-to-child `rate =
 * child.value/node.value` along that single-child chain evaluates to exactly `1`, i.e. full width) -
 * `activeNode` itself keeps its own real value unchanged (the call's first iteration sets
 * `node.value = value` where `value` already equals `node.value`, a no-op). `activeNode`'s real
 * subtree (via `setCacheChildren`) is carried over untouched. This function reproduces exactly that
 * shape directly: build a synthetic single-child chain of shallow ancestor clones (their real
 * `text`/`depth`, `value` forced to `activeNode.value`) from the outermost ancestor down to (but not
 * including) `activeNode`, whose own node object - real value, real subtree - terminates the chain.
 * Every node's `depth` is left exactly as in the original tree (unlike source's temporary
 * `"0"`/`"0.0"`/... reindexing, which happens to land on the same depths anyway) - so row Y
 * positions never shift between a zoomed and unzoomed view of the same tree, only widths do.
 *
 * `activeDepth` = `activeNode.depth` (unchanged from source), consumed by
 * `flameNodeOpacity()`/`flameTextOpacity()` to dim every node strictly above `activeNode` in the
 * chain (matches `getNodeAndTextOpacity()`).
 *
 * Returns `null` when `activeIndex` isn't found in the tree - a **deliberate, flagged deviation**:
 * source's `setCacheParents` would immediately throw (`null.value`) on a bad index with no guard
 * anywhere upstream; this port renders the full, unfiltered tree instead (see `FlameChart.vue`).
 */
export function filterFlameActive(root: FlameTreeNode, activeIndex: string): FlameActiveFilter | null {
  const activeNode = findFlameNode(root, activeIndex)
  if (!activeNode) return null

  const ancestors: FlameTreeNode[] = []
  let p = activeNode.parent
  while (p) {
    ancestors.unshift(p)
    p = p.parent
  }

  if (ancestors.length === 0) {
    return { root: activeNode, activeDepth: activeNode.depth }
  }

  // Build the synthetic chain outermost-first, each clone's single child being the next clone
  // (or, for the innermost ancestor, `activeNode` itself, unmodified).
  let child: FlameTreeNode = activeNode
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i]
    const clone: FlameTreeNode = { index: a.index, text: a.text, value: activeNode.value, depth: a.depth, children: [child], parent: null }
    child.parent = clone
    child = clone
  }

  return { root: child, activeDepth: activeNode.depth }
}

export interface FlamePositionedNode {
  index: string
  text: string
  value: number
  depth: number
  x: number
  y: number
  width: number
  height: number
}

export interface FlameLayoutOptions {
  /** Plot area's left edge (`this.axis.area().x`). */
  areaX: number
  /** Plot area's full width (`this.axis.area().width`) - the ROOT node always spans exactly this,
   * regardless of the root's own `value` (only child-vs-parent ratios matter below the root). */
  areaWidth: number
  /** Plot area's full height (`this.axis.area().height`) - `maxHeight` upstream. */
  areaHeight: number
  /** Row height in px, i.e. `areaHeight / maxDepth` - precomputed by the caller (once per render,
   * from the UNFILTERED tree's own max depth) since `maxDepth`/row height stay fixed across zoom,
   * matching `drawBefore()` computing `height` once, before any `activeIndex` filtering. */
  rowHeight: number
  /** `brush.nodeOrient` - `"bottom"` (default) puts the root at the BOTTOM row, depth increasing
   * upward; `"top"` puts the root at `y = rowHeight` (row 1, not row 0 - depths start at `1`, so
   * upstream's plain `height * node.depth` never actually reaches `y = 0`, reproduced literally,
   * not "fixed"). */
  nodeOrient: 'top' | 'bottom'
  /** `brush.nodeAlign` - `"start"` lays out children left-to-right accumulating from the node's own
   * left edge; `"end"` lays out the same children right-to-left accumulating from the node's own
   * right edge. Both produce the SAME final left-to-right positions for well-formed data (see
   * `useFlame.spec.ts`'s hand-traced equivalence case) - ported as two genuinely different
   * algorithms anyway, matching source exactly rather than collapsing them, since they can differ
   * by floating-point rounding on ratios that don't divide evenly. */
  nodeAlign: 'start' | 'end'
}

/**
 * Ported from `drawNodeAll()`'s recursion: the ROOT spans the full plot width at `areaX`; each
 * child's width is `parent.width * (child.value / parent.value)` (a plain share of its OWN
 * parent's width, not the grand-total) - **no normalization against the parent's real children-sum
 * ever happens** (a faithfully-preserved upstream quirk: if a node's children's values don't sum to
 * the node's own `value`, the last child stops short of - or overflows past - the node's far edge;
 * not clamped or redistributed here either). `y` is `rowHeight * depth` counted from the top
 * (`nodeOrient: "top"`) or from the bottom (`nodeOrient: "bottom"`, upstream's default and the more
 * common flame-graph convention: root anchored at the bottom, deeper frames stacking upward).
 * Returns a flat list (pre-order, parent before children - render z-order is immaterial since
 * distinct depths never share a row and siblings never overlap for well-formed data).
 */
export function layoutFlameNodes(root: FlameTreeNode, opts: FlameLayoutOptions): FlamePositionedNode[] {
  const out: FlamePositionedNode[] = []

  function place(node: FlameTreeNode, width: number, x: number) {
    const y = opts.nodeOrient === 'bottom' ? opts.areaHeight - opts.rowHeight * node.depth : opts.rowHeight * node.depth

    out.push({ index: node.index, text: node.text, value: node.value, depth: node.depth, x, y, width, height: opts.rowHeight })

    const children = node.children
    if (children.length === 0) return

    if (opts.nodeAlign === 'start') {
      let cStartX = x
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        const cWidth = width * (c.value / node.value)
        place(c, cWidth, cStartX)
        cStartX += cWidth
      }
    } else {
      let cStartX = x + width
      for (let i = children.length - 1; i >= 0; i--) {
        const c = children[i]
        const cWidth = width * (c.value / node.value)
        cStartX -= cWidth
        place(c, cWidth, cStartX)
      }
    }
  }

  place(root, opts.areaWidth, opts.areaX)
  return out
}

/** Ported from `getNodeAndTextOpacity(depth)`, shared by both the node rect and its label text
 * (source calls the exact same function for both). `activeDepth == null` (no zoom active) always
 * returns `1`; otherwise every node strictly SHALLOWER than the active node's depth (i.e. its
 * dimmed ancestor chain) gets `disableOpacity`, and the active node plus its whole subtree stay at
 * full opacity. */
export function flameNodeOpacity(depth: number, activeDepth: number | null, disableOpacity: number): number {
  if (activeDepth == null) return 1
  return depth < activeDepth ? disableOpacity : 1
}

/** Ported from `createTextElement()`'s `startX` branch on `brush.textAlign` - the text's own `x`
 * position before the SVG `text-anchor` attribute (set to the same `textAlign` value) aligns the
 * glyphs against it. `TEXT_MARGIN = 3` upstream. Source has **no width-vs-text-length check
 * anywhere** (confirmed by re-reading `createTextElement()` in full) - a label is always rendered
 * whenever `format` is supplied, regardless of how narrow its node is; not given any truncation/
 * hide-on-overflow behavior here either, matching that absence exactly rather than inventing one. */
export function flameTextX(nodeX: number, nodeWidth: number, textAlign: 'start' | 'middle' | 'end'): number {
  const TEXT_MARGIN = 3
  if (textAlign === 'middle') return nodeX + nodeWidth / 2
  if (textAlign === 'end') return nodeX + nodeWidth - TEXT_MARGIN
  return nodeX + TEXT_MARGIN
}

/** Ported from `createTextElement()`'s `y` formula: `node.y + (fontSize/3) + (height/2)` - vertical
 * centering within the node's own row band, `height` being the shared per-row height (not the
 * individual node's own `height`, though they're always equal here - kept as two separate
 * parameters to mirror the source formula's own two distinct variable names). */
export function flameTextY(nodeY: number, rowHeight: number, fontSize: number): number {
  return nodeY + fontSize / 3 + rowHeight / 2
}
