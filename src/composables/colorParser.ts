/**
 * Byte-faithful port of `ColorUtil.parseGradient`/`parseAttr`/`parseStop` - jui-chart's mini
 * `"linear(...)"`/`"radial(...)"` gradient-string DSL. These live in the `jui-core`/`jui-graph`
 * dependency jui-chart bundles (NOT in jui-chart's own `src/`) - ported here from the unminified
 * `jui-core/src/util/color.js` (`ColorUtil.regex`/`.parseGradient`/`.parseAttr`/`.parseStop`,
 * lines ~45, ~381-490), cross-checked against jui-chart's compiled `dist/jui-chart.js`
 * (`:5738`, `:6076-6190`, the same logic post-minification - both copies agree byte-for-byte on
 * control flow).
 *
 * This is the piece `useTheme.ts`'s header doc comment previously documented as a deliberate
 * scope boundary ("this port does NOT implement that parser...") - now implemented. See
 * `useColorResolver.ts` for the `createColor()`-equivalent dispatcher that calls these functions
 * and turns their output into registered SVG `<defs>` + a `url(#id)` reference, and
 * PORT_STATUS.md for the full writeup including the two confirmed-real upstream quirks this file
 * preserves on purpose (documented in detail on `parseStop` below).
 */

/** `ColorUtil.regex` verbatim - group 1 = `linear`/`radial`, group 2 = the parenthesized
 *  direction/position arg, group 3 = everything after the closing paren (the stop list). */
const GRADIENT_REGEX = /(linear|radial)\((.*)\)(.*)/i

export interface LinearGradientAttr {
  x1: number | string
  y1: number | string
  x2: number | string
  y2: number | string
  /** Only present for the 8 named directions (`""`/`"left"`/`"right"`/`"top"`/`"bottom"`/
   *  `"top left"`/`"top right"`/`"bottom left"`/`"bottom right"`) - absent for the raw
   *  `x1,y1,x2,y2` numeric-list form, matching upstream exactly (the `default:` branch's
   *  returned object never sets a `direction` key at all). */
  direction?: string
  /** Never set by `parseAttr` itself (upstream's `parseGradient`/`parseAttr` don't know about
   *  ids at all) - `useColorResolver.ts`'s `resolve()` fills this in when it registers the
   *  descriptor, matching `createGradient()`'s own `obj.attr.id = id`. */
  id?: string
}

export interface RadialGradientAttr {
  cx: number | string
  cy: number | string
  r: number | string
  fx: number | string
  fy: number | string
  /** See `LinearGradientAttr.id`'s doc comment - same deal. */
  id?: string
}

export interface GradientStop {
  type: 'stop'
  attr: {
    offset?: string
    'stop-color': string
    'stop-opacity'?: string
  }
}

export interface GradientDescriptor {
  /** `type + "Gradient"` verbatim - upstream's `/i` case-insensitive regex means a mixed-case
   *  input like `"Linear(top)..."` would produce `"LinearGradient"` here (an invalid SVG tag
   *  name) rather than being normalized to lowercase; preserved as-is since every real token in
   *  this port's theme data is already lowercase. */
  type: string
  attr: LinearGradientAttr | RadialGradientAttr
  children: GradientStop[]
}

/**
 * `ColorUtil.parseAttr(type, str)` verbatim.
 *
 * `type` is compared with `===` against the literal `'linear'` (upstream: `type == 'linear'`,
 * itself already whatever casing `parseGradient`'s regex matched - `type` is NOT lowercased
 * anywhere upstream, so a mixed-case gradient string like `"Linear(top)..."` falls through to the
 * radial branch's raw-numeric-list parsing instead of the named-direction table; preserved as-is).
 */
export function parseAttr(type: string, str: string): LinearGradientAttr | RadialGradientAttr {
  if (type === 'linear') {
    switch (str) {
      case '':
      case 'left':
        return { x1: 0, y1: 0, x2: 1, y2: 0, direction: str || 'left' }
      case 'right':
        return { x1: 1, y1: 0, x2: 0, y2: 0, direction: str }
      case 'top':
        return { x1: 0, y1: 0, x2: 0, y2: 1, direction: str }
      case 'bottom':
        return { x1: 0, y1: 1, x2: 0, y2: 0, direction: str }
      case 'top left':
        return { x1: 0, y1: 0, x2: 1, y2: 1, direction: str }
      case 'top right':
        return { x1: 1, y1: 0, x2: 0, y2: 1, direction: str }
      case 'bottom left':
        return { x1: 0, y1: 1, x2: 1, y2: 0, direction: str }
      case 'bottom right':
        return { x1: 1, y1: 1, x2: 0, y2: 0, direction: str }
      default: {
        const arr = str.split(',').map((v) => (v.indexOf('%') === -1 ? parseFloat(v) : v))
        return { x1: arr[0], y1: arr[1], x2: arr[2], y2: arr[3] }
      }
    }
  }

  const arr = str.split(',').map((v) => (v.indexOf('%') === -1 ? parseFloat(v) : v))
  return { cx: arr[0], cy: arr[1], r: arr[2], fx: arr[3], fy: arr[4] }
}

/** `parseStop`'s internal per-stop shape - carries BOTH the publicly-returned `attr` (what
 *  `SVGUtil.createObject`/this port's `SvgDefNode.vue` actually reads to build the `<stop>`
 *  element) and a second, top-level `offset` field that mirrors upstream's own `stop.offset`
 *  (see the big doc comment on `parseStop` below for why these two are never the same field). */
interface InternalStop extends GradientStop {
  offset?: string | number
}

/**
 * `ColorUtil.parseStop(stop)` verbatim, **including a confirmed-real upstream bug**, hand-traced
 * from `jui-core/src/util/color.js:396-454` and cross-checked against jui-graph's own copy in
 * `src/base/builder.js` and jui-chart's compiled `dist/jui-chart.js:6094-6152` (all three agree).
 *
 * **The bug**: each stop is built as `{ type: "stop", attr: { offset, "stop-color", ... } }` -
 * the offset (when the raw string gave one) lives at `stop.attr.offset`. But the SECOND pass
 * below - the one that's supposed to (a) default the first stop's offset to `0` and the last
 * stop's to `1`, and (b) linearly interpolate any run of interior stops with no explicit offset
 * between two that have one - reads and writes a **top-level** `stop.offset`, a field that is
 * NEVER the same as `stop.attr.offset` and is never copied to/from it anywhere. Since only this
 * very code ever assigns the top-level field (and only for the first/last index), that means:
 *
 * - The "first stop -> offset 0 / last stop -> offset 1" defaults are dead writes: they set
 *   `stop.offset`, but `SVGUtil.createObject()` (and this port's `SvgDefNode.vue`) only ever
 *   reads `stop.attr`, so these defaults never reach the rendered `<stop offset="...">`. In
 *   practice this is harmless for a MISSING first-stop offset (SVG itself defaults a missing
 *   `offset` to `0`), but does nothing for a missing last-stop offset either.
 * - Gap interpolation is essentially unreachable for realistic input: `start` can only ever land
 *   on the first INTERIOR index (index 1) - the boundary-default write means index 0 and
 *   `len - 1` always look "already defined" by the time the gap-check runs on them, even when
 *   their own `attr.offset` was never set. And `end` gets set on the VERY NEXT index regardless
 *   of what that index's own `attr.offset` actually was (the top-level field is never populated
 *   for interior stops by anything else), so a gradient with >= 4 total stops and an interior run
 *   with no explicit offsets **throws** (`stops[end].offset.indexOf` reads a property of
 *   `undefined`) - confirmed by hand-tracing, not guessed; see `colorParser.spec.ts`'s
 *   corresponding test. Every real color token in this port's theme data (`gradientColors`,
 *   `patternColors`-adjacent `*BackgroundColor` overrides) is 1- or 2-stop, so this throw path is
 *   never hit by anything this port ships - preserved for fidelity, not because it's desirable.
 *
 * Net effect actually observed for every real 2-stop token in this port (e.g.
 * `"linear(top) #9694e0,0.9 #7977C2"`): the first stop ends up with NO `offset` attr at all (SVG
 * treats that as `0` anyway) and the second keeps whatever explicit offset the raw string gave it
 * - visually indistinguishable from the "intended" 0/explicit behavior, which is presumably why
 * this bug was never noticed upstream.
 */
export function parseStop(stop: string): GradientStop[] {
  const stopList = stop.split(',')
  const stops: InternalStop[] = []

  for (let i = 0, len = stopList.length; i < len; i++) {
    const arr = stopList[i].split(' ')

    if (arr.length === 0) continue

    if (arr.length === 1) {
      stops.push({ type: 'stop', attr: { 'stop-color': arr[0] } })
    } else if (arr.length === 2) {
      stops.push({ type: 'stop', attr: { offset: arr[0], 'stop-color': arr[1] } })
    } else if (arr.length === 3) {
      stops.push({ type: 'stop', attr: { offset: arr[0], 'stop-color': arr[1], 'stop-opacity': arr[2] } })
    }
  }

  let start = -1
  let end = -1
  for (let i = 0, len = stops.length; i < len; i++) {
    const s = stops[i]

    if (i === 0) {
      if (!s.offset) s.offset = 0
    } else if (i === len - 1) {
      if (!s.offset) s.offset = 1
    }

    if (start === -1 && typeof s.offset === 'undefined') {
      start = i
    } else if (end === -1 && typeof s.offset === 'undefined') {
      end = i

      const count = end - start
      // Preserved upstream bug (see doc comment above): `stops[end].offset` is guaranteed
      // `undefined` here (that's exactly the condition that got us into this branch), so this
      // throws, matching `stops[end].offset.indexOf(...)` throwing upstream for the same input.
      const endRaw = stops[end].offset as unknown as string
      const startRaw = stops[start].offset as unknown as string
      const endOffset = endRaw.indexOf('%') > -1 ? parseFloat(endRaw) / 100 : Number(endRaw)
      const startOffset = startRaw.indexOf('%') > -1 ? parseFloat(startRaw) / 100 : Number(startRaw)

      const dist = endOffset - startOffset
      const value = dist / count

      let offset = startOffset + value
      for (let index = start + 1; index < end; index++) {
        stops[index].offset = offset
        offset += value
      }

      start = end
      end = -1
    }
  }

  return stops.map(({ type, attr }) => ({ type, attr }))
}

/**
 * `ColorUtil.parse`/`.parseGradient(color)` verbatim: returns `color` unchanged when it doesn't
 * match `GRADIENT_REGEX` (the caller's `result === color` check is how `createColor()`/
 * `useColorResolver.ts`'s `resolve()` detects "this isn't a gradient string, treat it as a plain
 * color"), otherwise a full `{ type, attr, children }` descriptor.
 */
export function parseGradient(color: string): string | GradientDescriptor {
  const matches = color.match(GRADIENT_REGEX)
  if (!matches) return color

  const type = matches[1].trim()
  const attr = parseAttr(type, matches[2].trim())
  const children = parseStop(matches[3].trim())

  return { type: `${type}Gradient`, attr, children }
}
