/**
 * Pure logic for `TreemapChart.vue`, ported from `treemap.js` (774 lines) - see that component's
 * own header comment for the full source-confirmed data model, algorithm, and rendering rules.
 *
 * **The layout algorithm, confirmed from `chart.brush.treemap.calculator`'s `squarify()`/
 * `improvesRatio()`/`calculateRatio()` plus `chart.brush.treemap.container`'s `getCoordinates()`/
 * `cutArea()`**: this is the SQUARIFIED treemap algorithm (Bruls, Huizing, van Wijk, "Squarified
 * Treemaps"), NOT slice-and-dice - confirmed by `calculateRatio()`'s explicit worst-aspect-ratio
 * computation and `improvesRatio()`'s row-accumulation decision (`currentratio >= newratio`, with a
 * source comment noting a direction fix vs. the original paper's pseudocode). Input values are
 * processed in the GIVEN order (no descending sort anywhere in `treemap.js` - confirmed by reading
 * the whole `calculator` object) - reproduced as-is; callers wanting the paper's typical
 * good-aspect-ratio behavior must pre-sort their own data descending by value.
 *
 * **`squarifyRects()` (the actual squarify core) is VENDORED, not hand-ported** - per PORT_STATUS.
 * md's Phase F audit, `treemap.js`'s `calculator`/`container` modules were themselves traced to a
 * specific, confirmed, singular external library (`imranghory/treemap-squared`, MIT, 2012, GitHub-
 * only), not original jui-chart code. `squarifyRects()` delegates to `src/vendor/treemap-squared.js`
 * (the real upstream source, vendored near-unmodified) instead of re-deriving the same math by hand
 * - see that function's own doc comment and `src/vendor/treemap-squared.js`'s header for the full
 * evidence. Everything else in this file (the tree/grouping model below) remains a genuine hand-port
 * of jui-chart's own code, same as every other Phase A-D composable.
 *
 * **The data model, confirmed from `drawBefore()`'s `nodes.insertNode(k, {...})` loop**: the SAME
 * flat, dot-separated-index-path row shape as `flame.js` (`{index, text, value}`), reusing
 * `chart.brush.treemap.nodemanager` directly (not just borrowed like `flame.js` does) - see
 * `TreemapChart.vue`'s header comment. **Genuinely different from `flame.js` in one load-bearing
 * way**: `flame.js`'s own port (`buildFlameTree`) assumes the FIRST row is unconditionally THE
 * single root (a call-stack has exactly one root frame). `chart.brush.treemap.nodemanager`'s real
 * `root` is a SYNTHETIC, never-rendered wrapper - `root.children` (i.e. every row whose `index` has
 * no dot) can hold MANY top-level siblings, matching realistic treemap data (e.g. several top-level
 * disk folders, not one all-containing root). `buildTreemapForest()` below reflects this: it
 * returns an ARRAY of top-level nodes, not a single root.
 *
 * **The nested-grouping algorithm, re-derived from `convertNodeToArray()` + `treemapMultidimensional()`
 * and algebraically reduced to an equivalent, much simpler 2-pass form - hand-verified against both
 * a 2-level and a 3-level tree before being trusted (see `useTreemap.spec.ts`)**: naive reading
 * suggests `treemapMultidimensional()`'s own recursion could nest arbitrarily deep to match the
 * source tree's real depth, but `convertNodeToArray()` - the function that actually turns the node
 * tree into the array shape `treemapMultidimensional()` consumes - always produces a flat
 * `number[][]` (an array of GROUPS, each group a plain array of numbers), **exactly 2 levels deep,
 * REGARDLESS of the source tree's real depth**: at any level, each LEAF sibling's value is pushed
 * into one shared running array (`now` in source); each NON-LEAF sibling instead triggers an
 * immediate recursive call that pushes ITS OWN flattened leaf-descendant array as a separate,
 * sibling entry in the SAME shared `result` list (not nested inside `now`) - and the running `now`
 * array (the "leaf run" for that level) is only pushed to `result` at the very end of that level's
 * loop. Since `treemapMultidimensional()` only ever checks ONE level of `data[0]` array-ness, this
 * flat `number[][]` shape means its own recursion is ALWAYS exactly 2 calls deep in practice: an
 * outer squarify of each group's value-SUM (producing one rectangle per group), then an inner
 * squarify of each group's own raw leaf values within that group's rectangle. `collectTreemapGroups()`
 * below reproduces this exact grouping (leaf run bundled and pushed LAST, each non-leaf sibling as
 * its own immediate single-node group) directly on the tree, and `layoutTreemapForest()` performs
 * exactly those 2 squarify passes - **an algebraic equivalence, not a simplification of behavior**.
 *
 * **A real, confirmed-by-hand-trace quirk this preserves, not fixes**: because of the above, a
 * chain of single-child non-leaf ancestors (A -> B -> [C1, C2]) is geometrically harmless (B's own
 * "group" degenerates to a single real sub-group plus zero-value placeholder groups that consume no
 * area) - but siblings THREE OR MORE levels apart that are NOT part of a simple chain lose their
 * intermediate grouping boundary entirely: all their leaf descendants effectively get squarified
 * together as one flat run relative to their nearest leaf-bearing ancestor, not nested per
 * intermediate parent. This only matters for trees deeper than the common 2-level (category -> leaf)
 * shape - see `useTreemap.spec.ts`'s dedicated 3-level test for a concrete traced example.
 *
 * **Rendering-relevant fact confirmed from `mergeArrayToNode()`/`isDrawNode()`**: only LEAF nodes
 * ever receive real `x`/`y`/`width`/`height` - `mergeArrayToNode()`'s recursive walk only assigns
 * geometry to the innermost (non-array) index entries, which are always leaves; every non-leaf node
 * keeps its `drawBefore()`-time default geometry (`0,0,0,0`), and `isDrawNode()` explicitly skips
 * drawing any node whose x/y/width/height are ALL zero - i.e. non-leaf nodes are NEVER drawn as
 * rectangles, only used as invisible grouping containers (and, per `titleDepth`, a title label).
 * This port never computes geometry for non-leaf nodes at all (`layoutTreemapForest()` returns only
 * positioned LEAVES) - title-label placement for a non-leaf node instead uses
 * `treemapTitleAnchor()`, the exact port of `getMinimumXY()`'s own real behavior (see its own doc
 * comment - it does NOT compute a true bounding-box minimum).
 */

import treemapSquared from '../vendor/treemap-squared'
import type { TreemapCoordinate } from '../vendor/treemap-squared'

export interface TreemapSourceRow {
  index: string
  text?: string | number
  value?: number
}

/** A positioned-free tree node. `topAncestorIndex` is the exact equivalent of source's
 * `getRootNodeSeq(node)` - the 0-based position of this node's top-level (depth-1) ancestor among
 * ALL top-level siblings (`root.children` upstream) - computed once at build time from real node
 * positions rather than re-parsed from the index string on every color lookup (source re-walks
 * `node.parent` on every call; this port precomputes and inherits it down the tree instead, same
 * "prefer real object references over source's index-string bookkeeping" choice `useFlame.ts` made
 * for `parent`). */
export interface TreemapTreeNode {
  index: string
  text: string
  value: number
  depth: number
  children: TreemapTreeNode[]
  parent: TreemapTreeNode | null
  topAncestorIndex: number
}

/** The common {index, text, value, depth} shape `format()` is called with - satisfied structurally
 * by both `TreemapTreeNode` (a title label, possibly non-leaf) and `TreemapPositionedNode` (a
 * regular per-leaf label), matching source's own `this.format(node)` being called with either a
 * leaf OR non-leaf node interchangeably. */
export interface TreemapFormatNode {
  index: string
  text: string
  value: number
  depth: number
}

/**
 * Ported from `drawBefore()`'s `nodes.insertNode(k, {...})` loop, replacing
 * `chart.brush.treemap.nodemanager`'s imperative index-string-parsing `insertNode`/`getNodeParent`
 * machinery with one pure pass building a plain object forest (same approach as `useFlame.ts`'s
 * `buildFlameTree()`, but returning an ARRAY of top-level nodes, not a single root - see this file's
 * header comment on why). Rows must appear in parent-before-child order; a row whose parent index
 * hasn't appeared yet is silently dropped (left detached), the same documented simplification
 * `buildFlameTree()` makes of an upstream hard crash.
 */
export function buildTreemapForest(rows: TreemapSourceRow[]): TreemapTreeNode[] {
  const byIndex = new Map<string, TreemapTreeNode>()
  const topLevel: TreemapTreeNode[] = []

  for (const row of rows) {
    const index = String(row.index)
    const node: TreemapTreeNode = {
      index,
      text: String(row.text ?? ''),
      value: Number(row.value ?? 0),
      depth: index.split('.').length,
      children: [],
      parent: null,
      topAncestorIndex: -1,
    }
    byIndex.set(index, node)

    const dot = index.lastIndexOf('.')
    if (dot === -1) {
      node.topAncestorIndex = topLevel.length
      topLevel.push(node)
      continue
    }

    const parent = byIndex.get(index.slice(0, dot))
    if (parent) {
      node.parent = parent
      node.topAncestorIndex = parent.topAncestorIndex
      parent.children.push(node)
    }
    // else: parent row hasn't appeared yet (malformed input) - node built but left detached.
  }

  return topLevel
}

/** DFS pre-order flatten of the whole forest (top-level nodes first, then each one's descendants
 * before moving to the next top-level sibling) - the equivalent of source's `getNodeAll()`, used by
 * `TreemapChart.vue` to find every node at `titleDepth` (title labels can apply to non-leaf nodes,
 * which never appear in `layoutTreemapForest()`'s leaf-only output). */
export function flattenTreemapForest(topLevel: TreemapTreeNode[]): TreemapTreeNode[] {
  const out: TreemapTreeNode[] = []
  function walk(nodes: TreemapTreeNode[]) {
    for (const node of nodes) {
      out.push(node)
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(topLevel)
  return out
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function sumArray(values: number[]): number {
  let s = 0
  for (const v of values) s += v
  return s
}

/**
 * The squarified treemap algorithm (Bruls et al.) for a single, flat array of values within one
 * container - values are normalized to areas summing to `rect.width * rect.height` first, then
 * greedily accumulated into rows, each row cut off (and a new one started against the remaining
 * container) as soon as adding the next value would make the worst aspect ratio in the row WORSE
 * rather than better. Returns one rect per input value, in the SAME order as `values`. Input is
 * used in the GIVEN order - **no descending sort happens** (see this file's header comment).
 *
 * **Not a hand-port** (unlike the rest of this file): per PORT_STATUS.md's Phase F audit, this
 * exact algorithm - same `Container`/`normalize`/`squarify`/`improvesRatio`/`calculateRatio`/
 * `flattenTreemap`/`sumMultidimensionalArray` function set, same `getCoordinates`/`cutArea`/
 * `shortestEdge` Container methods, AND the same idiosyncratic "the pseudocode in the Bruls paper
 * has the direction of the comparison wrong, this is the correct one" bugfix comment - was traced
 * to a specific, confirmed, singular external library: `imranghory/treemap-squared` (MIT, 2012,
 * GitHub-only, never published to npm). `jui-chart/src/brush/treemap.js`'s own `calculator`/
 * `container` modules are themselves a restructured adaptation of this same library, not
 * independent original code. This delegates to the vendored, near-unmodified original instead of
 * re-deriving the same math by hand a second time - see `src/vendor/treemap-squared.js`'s own
 * header comment and PORT_STATUS.md's Phase F `useTreemap.ts` entry for the full evidence and
 * reasoning, and `src/vendor/treemap-squared.spec.ts` for an integration-level sanity check
 * against the vendored file directly (following this project's `kinetic.js` precedent).
 *
 * `values.length === 0` is special-cased here rather than delegated: the vendored library's own
 * `squarify()` has a real upstream bug in that exact base case (a bare `return;` instead of
 * `return stack;`, so `flattenTreemap(undefined)` throws) - confirmed by a differential test
 * against the pre-vendoring hand-port before this swap was made; this guard works around that
 * upstream bug rather than reimplementing any real layout logic.
 */
export function squarifyRects(values: number[], rect: Rect): Rect[] {
  if (values.length === 0) return []

  const coords = treemapSquared.generate(values, rect.width, rect.height, rect.x, rect.y) as TreemapCoordinate[]
  return coords.map(([x1, y1, x2, y2]) => ({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }))
}

interface TreemapGroup {
  values: number[]
  leaves: TreemapTreeNode[]
}

/** Ported from `convertNodeToArray()` (called with `key="value"` upstream, generalized here to also
 * carry the real leaf node references instead of a second, parallel index-string pass) - see this
 * file's header comment for the full derivation of why this always produces a flat, 2-level grouping
 * regardless of tree depth. */
function collectTreemapGroups(nodes: TreemapTreeNode[], groups: TreemapGroup[], current: TreemapGroup | null): void {
  const g = current ?? { values: [], leaves: [] }

  for (const node of nodes) {
    if (node.children.length === 0) {
      g.values.push(node.value)
      g.leaves.push(node)
    } else {
      collectTreemapGroups(node.children, groups, null)
    }
  }

  groups.push(g)
}

export interface TreemapPositionedNode {
  index: string
  text: string
  value: number
  depth: number
  topAncestorIndex: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * Ported from `Calculator(preData, width, height)` (= `treemapMultidimensional`) +
 * `mergeArrayToNode()`, algebraically reduced to the 2-pass form derived in this file's header
 * comment: group `topLevel`'s entire subtree via `collectTreemapGroups()`, squarify the GROUP SUMS
 * once (one rect per group), then squarify each group's own raw leaf values within its rect. Returns
 * only LEAF nodes, positioned (non-leaf nodes are never drawn - see `isDrawableTreemapNode()`/this
 * file's header comment), in the same relative order `collectTreemapGroups()` visits them (matching
 * source's own DFS-with-deferred-leaf-run order, not a strict pre-order).
 */
export function layoutTreemapForest(topLevel: TreemapTreeNode[], rect: Rect): TreemapPositionedNode[] {
  const groups: TreemapGroup[] = []
  collectTreemapGroups(topLevel, groups, null)

  const sums = groups.map((g) => sumArray(g.values))
  const groupRects = squarifyRects(sums, rect)

  const out: TreemapPositionedNode[] = []
  for (let i = 0; i < groups.length; i++) {
    const leafRects = squarifyRects(groups[i].values, groupRects[i])
    const leaves = groups[i].leaves
    for (let j = 0; j < leaves.length; j++) {
      const n = leaves[j]
      const r = leafRects[j]
      out.push({ index: n.index, text: n.text, value: n.value, depth: n.depth, topAncestorIndex: n.topAncestorIndex, x: r.x, y: r.y, width: r.width, height: r.height })
    }
  }
  return out
}

/** Ported from `isDrawNode()`: a leaf is skipped only when ALL FOUR of x/y/width/height are exactly
 * zero (an "uninitialized geometry" sentinel, not a general zero-area check) - reproduced literally,
 * including the edge case where a genuinely zero-value leaf that happens to land elsewhere than the
 * origin still renders as a degenerate point-sized rect. */
export function isDrawableTreemapNode(n: TreemapPositionedNode): boolean {
  return !(n.width === 0 && n.height === 0 && n.x === 0 && n.y === 0)
}

/** Ported from `getMinimumXY()`: **not a true bounding-box minimum** - it always descends via
 * `node.children[0]` (the first child) until it reaches a leaf, and returns that leaf's own real
 * `x`/`y` (the only nodes with real geometry - see this file's header comment). This is a correct
 * "top-left of this node's rendered area" proxy ONLY because squarify's own row/column placement
 * order happens to put its first-processed box top-left-most for well-formed data - reproduced
 * literally rather than replaced with a true min(), matching this port's "preserve source's actual
 * formula" convention throughout. Returns `null` if `node` has no leaf descendant at all (e.g. an
 * empty-children non-leaf - shouldn't occur for real data, matches source's own unguarded assumption
 * that every non-leaf has at least one child leaf somewhere down the chain, just without the crash).
 */
export function treemapTitleAnchor(node: TreemapTreeNode, positionedByIndex: Map<string, TreemapPositionedNode>): { x: number; y: number } | null {
  let cur = node
  while (cur.children.length > 0) cur = cur.children[0]
  const p = positionedByIndex.get(cur.index)
  return p ? { x: p.x, y: p.y } : null
}

/** Ported from `draw()`'s per-node text `cx` formula: `textAlign` picks the horizontal anchor
 * (`"start"` -> left edge + `TEXT_MARGIN_LEFT`; `"end"` -> right edge - the same margin; anything
 * else, i.e. the default `"middle"`, -> horizontal center). `TEXT_MARGIN_LEFT = 3` upstream. */
export function treemapTextX(x: number, width: number, textAlign: 'start' | 'middle' | 'end'): number {
  const TEXT_MARGIN_LEFT = 3
  if (textAlign === 'start') return x + TEXT_MARGIN_LEFT
  if (textAlign === 'end') return x + width - TEXT_MARGIN_LEFT
  return x + width / 2
}

/** Ported from `draw()`'s per-node text `cy` formula: `textOrient === "top"` -> `y + fontSize`;
 * `"bottom"` -> `y + height - fontSize/2`; anything else (the default, source's own doc-commented
 * `"center"`) -> vertical center. Independent of `treemapTextX()` - source computes the two axes
 * from two entirely separate config values (`textAlign`/`textOrient`), not one combined "position"
 * setting. */
export function treemapTextY(y: number, height: number, fontSize: number, textOrient: 'top' | 'center' | 'bottom'): number {
  if (textOrient === 'top') return y + fontSize
  if (textOrient === 'bottom') return y + height - fontSize / 2
  return y + height / 2
}
