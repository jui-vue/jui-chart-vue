import { ref, type Ref } from 'vue'
import { parseGradient, type GradientDescriptor } from './colorParser'
import { patternClassic, type PatternDescriptor } from './patternClassic'

export interface ColorDefsEntry {
  id: string
  descriptor: GradientDescriptor | PatternDescriptor
}

export interface ColorResolver {
  /** SVG `<defs>` entries registered so far by this resolver, in registration order - render
   *  each via `SvgDefNode.vue` inside the chart's own `<defs>` (see `ChartBase.vue`). Reactive:
   *  mutated (pushed to) as a side effect of `resolve()` calls made while rendering series marks,
   *  so the chart's `<defs>` fills in as its brush layer resolves theme colors. */
  defs: Ref<ColorDefsEntry[]>
  /** `chart.color(index)`/`createColor()` equivalent: resolves one raw theme color value to
   *  either a plain CSS color (unchanged) or a `url(#id)` SVG reference, registering a `<defs>`
   *  entry the first time a given raw gradient/pattern string is seen. */
  resolve: (raw: string | null | undefined) => string
}

/**
 * This port's `createColor()` equivalent (`dist/jui-chart.js:11927-11952`, unminified original at
 * `jui-graph/src/base/builder.js:364-390`) plus its `createGradient()`/`createPattern()` helpers
 * (`:11850-11926` / `:286-362`) - the dispatcher `useTheme.ts`'s `color(index)`/`theme(key)` now
 * route every raw theme color string through, turning `"linear(...)"`/`"pattern-jennifer-NN"`
 * theme tokens into real registered SVG defs + a `url(#id)` fill/stroke reference instead of
 * passing the raw (browser-invalid) string straight through.
 *
 * **Scope**: one `useColorResolver()` call = one chart instance's worth of state (hash caches +
 * the registered `defs` list) - see `BarChart.vue`/etc.'s wiring (each top-level chart-type
 * component creates its own instance and hands it down to its `<ChartBase>` as a prop) and
 * `ChartBase.vue`'s own fallback (an internal instance when no resolver prop is given, e.g. a
 * bare `<ChartBase>` usage or a unit test that doesn't wire one up).
 *
 * **Two deliberate, documented deviations from upstream's real dispatch logic** (both explained
 * in full in PORT_STATUS.md and cross-referenced from `useTheme.ts`'s header doc comment):
 *
 * 1. **Pattern lookup**: upstream's `createPattern()` splits a `"pattern-jennifer-01"` string on
 *    `"-"`, pops the last segment off as a method key, and looks the REMAINING prefix up as a
 *    registry path (`jui.include("chart.pattern.jennifer")`) - which does NOT match the actually-
 *    registered `"chart.pattern.classic"` module name (confirmed by reading `include()`: a plain
 *    exact-string registry lookup, no aliasing). That's a genuine, real upstream bug that likely
 *    means `theme="pattern"` never actually resolved to a real pattern fill upstream either. This
 *    port does not reproduce it: since there is only ever one pattern source in scope here
 *    (`patternClassic.ts`, ported from `pattern/classic.js`), `resolvePattern()` below ignores the
 *    prefix entirely and indexes directly into `patternClassic` by the trailing method key.
 * 2. **Gradient/pattern id numbering**: upstream's `_index` (used as both `"gradient-" + _index`
 *    and, for the object-form pattern branch, `"pattern-" + _index`) is set ONCE per chart, to
 *    that chart's page-wide creation order (`_index = this.index = JUI.size()`), and is NEVER
 *    incremented again (confirmed: no `_index++`/`_index +=` anywhere in `jui-graph/src/base/
 *    builder.js`). That means EVERY distinct gradient resolved within one real upstream chart
 *    instance gets the exact same `id`, so `_defs` ends up with multiple `<linearGradient>`
 *    elements sharing one duplicate `id` - and since `url(#id)` resolves to whichever element
 *    with that id the browser picks (first in document order, typically), every themed element in
 *    that chart ends up referencing the SAME gradient regardless of its intended palette index.
 *    That would defeat the entire point of implementing a working defs-registry here, and
 *    contradicts this port's own required "two different chart instances get independently-
 *    numbered ids" scoping. This port intentionally implements the sane, presumably-intended
 *    behavior instead: `nextIndex` below auto-increments once per NEWLY-registered distinct
 *    gradient, scoped to this resolver instance (i.e. per chart), producing real
 *    `gradient-0`/`gradient-1`/... sequences that each resolve to their own distinct def.
 */
export function useColorResolver(): ColorResolver {
  const defs: Ref<ColorDefsEntry[]> = ref([])
  // Mirrors upstream's `_hash` dedup cache. Gradients are keyed by the ORIGINAL raw string
  // (matching `createGradient(obj, hashKey)`'s `hashKey` param); patterns are keyed by the
  // resolved pattern id (matching this port's own scope decision above, not upstream's raw-input
  // keying - see `resolvePattern()`).
  const gradientHash = new Map<string, string>()
  const patternHash = new Map<string, string>()
  let nextIndex = 0

  function resolvePattern(raw: string): string | null {
    const stripped = raw.startsWith('url(#') && raw.endsWith(')') ? raw.slice(5, -1) : raw
    if (stripped.indexOf('pattern-') === -1) return null

    const parts = stripped.split('-')
    const method = parts[parts.length - 1]
    const def = patternClassic[method]
    if (!def) return null

    const id = def.attr.id
    if (!patternHash.has(id)) {
      patternHash.set(id, id)
      defs.value.push({ id, descriptor: def })
    }
    return `url(#${id})`
  }

  function resolve(raw: string | null | undefined): string {
    if (raw == null) return 'none'

    const patternUrl = resolvePattern(raw)
    if (patternUrl) return patternUrl

    const parsed = parseGradient(raw)
    // `parseGradient` returns the SAME string unchanged when `raw` isn't a gradient string - the
    // `typeof` check (rather than `parsed === raw`) is what lets TS narrow `parsed` down to
    // `GradientDescriptor` below; the two checks are equivalent per `parseGradient`'s contract.
    if (typeof parsed === 'string') return parsed

    const cached = gradientHash.get(raw)
    if (cached) return `url(#${cached})`

    const id = `gradient-${nextIndex++}`
    const descriptor: GradientDescriptor = { ...parsed, attr: { ...parsed.attr, id } }
    gradientHash.set(raw, id)
    defs.value.push({ id, descriptor })
    return `url(#${id})`
  }

  return { defs, resolve }
}
