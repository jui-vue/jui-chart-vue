/**
 * Hand-written types for the vendored, near-unmodified `treemap-squared.js` (see that file's own
 * header comment and PORT_STATUS.md's Phase F `useTreemap.ts` entry for the full writeup on why
 * this generic squarified-treemap layout algorithm is imported as-is rather than hand-ported).
 * No layout logic lives here - this file exists purely so `../composables/useTreemap.ts` gets
 * full type safety over the real, original algorithm.
 *
 * Shape traced directly from the vendored source: `Treemap.generate` IS the callable
 * `treemapMultidimensional(data, width, height, xoffset?, yoffset?)` function itself (the
 * upstream file assigns it via an immediately-invoked `function(){ ...; return
 * treemapMultidimensional; }()` - already invoked, not a factory to call again), unlike
 * `kinetic.js`'s `{ name, extend, component() }` module-descriptor shape - no `.component()`-style
 * indirection is needed here.
 *
 * `data` accepts either a flat `number[]` (single-dimensional - one squarify pass, returns a flat
 * array of `[x1, y1, x2, y2]` coordinate tuples in the SAME order as `data`) or a nested array of
 * `number[]` groups (multidimensional - the outer level is squarified first by each group's sum,
 * then each group's own inner values are squarified within that group's resulting rect; returns
 * one flat coordinate-tuple array PER outer group, i.e. `result[groupIndex][indexWithinGroup]`).
 * Upstream supports arbitrary recursive nesting beyond 2 levels (each element of `data` may itself
 * be nested further, handled by recursing again) - typed generally below to match, even though
 * `useTreemap.ts`'s own shim only ever feeds it flat or exactly-2-level data.
 */

/** `[x1, y1, x2, y2]` - top-left/bottom-right corners of one placed rectangle. */
export type TreemapCoordinate = [number, number, number, number]

/** Input data: a flat array of values (single-dimensional), or an array of nested `TreemapData`
 * (multidimensional, arbitrary depth). */
export type TreemapData = number[] | TreemapData[]

/** Output shape mirrors the input's own nesting depth: a flat `number[]` input yields a flat
 * array of coordinate tuples; an array of N nested groups yields an array of N `TreemapResult`
 * (one per group, each itself either a flat tuple array or, for depth > 2, nested further). */
export type TreemapResult = TreemapCoordinate[] | TreemapResult[]

export interface TreemapGenerate {
  (data: TreemapData, width: number, height: number, xoffset?: number, yoffset?: number): TreemapResult
}

export interface TreemapNamespace {
  generate: TreemapGenerate
}

declare const Treemap: TreemapNamespace
export default Treemap
