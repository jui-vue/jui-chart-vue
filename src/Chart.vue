<script setup lang="ts">
// The single public entry point (PLAN.md's Phase 1 architecture): assembles axis/brush/widget/
// theme/style/width/height/padding props into the plain options object `jui-graph-ts`'s `Builder`
// expects, then lets `Builder`'s real engine do 100% of the rendering (imperative DOM, not a Vue
// template) - `<template>` below really is just the one `<div ref="rootEl" />`.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Builder } from 'jui-graph-ts'
import { GRID_TYPES } from './register/setup'

export interface AxisPadding {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export interface AxisConfig {
  x?: Record<string, unknown> | null
  y?: Record<string, unknown> | null
  z?: Record<string, unknown> | null
  c?: Record<string, unknown> | null
  map?: Record<string, unknown> | null
  area?: Record<string, unknown>
  padding?: number | AxisPadding
  extend?: number | null
  data?: unknown[]
  keymap?: Record<string, string>
  [key: string]: unknown
}

export interface BrushConfig {
  type: string
  axis?: number
  target?: string[] | string
  colors?: unknown
  [key: string]: unknown
}

export interface WidgetConfig {
  type: string
  axis?: number
  [key: string]: unknown
}

const props = defineProps<{
  width?: number | string
  height?: number | string
  padding?: number | AxisPadding
  axis?: AxisConfig | AxisConfig[]
  brush?: BrushConfig | BrushConfig[]
  widget?: WidgetConfig | WidgetConfig[]
  theme?: string | Record<string, unknown>
  style?: Record<string, unknown>
  /** Forwarded to `Builder`'s own `render` option (see its `setup()` default: `true`). */
  render?: boolean
  /**
   * Forwarded to `Builder`'s own `icon` option (`{ type, path }` - `Builder.setup()`'s default is
   * `{ type: 'classic', path: null }`). `path` is what `Builder.setVectorFontIcons()` needs to
   * actually inject a real `@font-face` rule (a string or array of font file URLs) - WITHOUT it,
   * `chart.text()`'s `{key}`-style icon placeholders (`parseIconInText()`) still resolve to real
   * Private-Use-Area codepoints (via `registerIcon('classic', ...)`, always registered - see
   * `register/icon/classic.ts`), but those codepoints render as invisible/"tofu" glyphs with no
   * font backing them. Left unset, this component defaults `path` to this project's own bundled
   * `public/fonts/icomoon.*` files (copied verbatim from the legacy `images/icon/` directory) - a
   * working default is more useful than a footgun for the common case; pass `icon` explicitly to
   * override (e.g. a different font, or `path: null` to opt out of the `@font-face` injection
   * entirely while keeping the `classic` codepoint map registered).
   *
   * OPEN ISSUE, NOT FIXED (flagged, not being actively investigated further for now): in real
   * Chromium, icon glyphs may still render as "tofu" boxes despite the font loading successfully,
   * the `@font-face` rule being present exactly once in `document.head`, and the CSS `font-family`
   * cascade resolving correctly (`classic` in the stack) - every layer independently verified
   * correct except the final glyph paint. A prior investigation attributed this to
   * `Builder.setVectorFontIcons()`'s specific CSS-injection technique and "fixed" it by changing
   * that technique - a LATER, more rigorous re-test disproved that diagnosis (the technique was
   * never the real differentiator; that was a confounded test). The true root cause is unknown -
   * see `register/icon/classic.ts`'s header comment for the full history.
   */
  icon?: { type: string; path?: string | string[] | null }
}>()

/** `import.meta.env.BASE_URL` (Vite's own configured `base`, `/` by default) rather than a bare
 * `/fonts/...` literal, so these URLs stay correct if this app is ever deployed under a sub-path
 * (e.g. GitHub Pages) - the exact same portability concern any other Vite-served static asset has. */
const DEFAULT_ICON_FONT_PATHS = ['icomoon.eot', 'icomoon.woff', 'icomoon.ttf', 'icomoon.svg'].map((f) => `${import.meta.env.BASE_URL}fonts/${f}`)

const rootEl = ref<HTMLDivElement>()
let builder: Builder | null = null
// Vue nulls out a template ref (`rootEl.value`) as part of tearing down the DOM during unmount,
// which can happen before `onUnmounted` callbacks run - captured separately here so the cleanup
// below can still reach the real element instead of silently no-op'ing on a null ref.
let mountedEl: HTMLDivElement | null = null

const assembledOptions = computed(() => ({
  width: props.width,
  height: props.height,
  padding: props.padding,
  axis: props.axis,
  brush: props.brush,
  widget: props.widget,
  theme: props.theme,
  style: props.style,
  render: props.render,
  icon: props.icon ?? { type: 'classic', path: DEFAULT_ICON_FONT_PATHS },
}))

/**
 * `jui-graph-ts`'s `Builder` has no `reload(options)` method (verified by reading `base/builder.ts`
 * in full - only `Axis` has one) and its own incremental `addBrush`/`removeBrush`/`updateBrush`/
 * `addWidget`/`removeWidget`/`updateWidget`/`setTheme`/`setSize` don't support wholesale-replacing
 * the `axis`/`brush`/`widget` arrays the way a reactive prop change needs to. The pragmatic,
 * faithful approach: tear down the root element's DOM ourselves and construct a completely fresh
 * `Builder` from scratch on every (re)mount - re-running the full init/render pipeline, exactly as
 * a first mount would.
 */
function remount(): void {
  const el = rootEl.value
  if (!el) return

  el.innerHTML = ''
  mountedEl = el

  const b = new Builder()
  // `Builder` never declares/populates `gridTypes`/`mapType` itself (see `register/gridTypes.ts`'s
  // header comment) - stamped on directly before `.mount()`, since `mount()` renders synchronously.
  Object.assign(b, { gridTypes: GRID_TYPES })
  b.mount(el, assembledOptions.value as never)

  builder = b
}

onMounted(remount)

watch(assembledOptions, remount, { deep: true })

onUnmounted(() => {
  // `Core.destroy()` is an intentional no-op in `jui-graph-ts` (documented at length in
  // `base/core.ts` - a preserved-structure-not-preserved-effect port of a bug that only mattered
  // under the original's shared-prototype registry). Clear the root element ourselves instead.
  if (mountedEl) mountedEl.innerHTML = ''
  mountedEl = null
  builder = null
})

defineExpose({
  /** Escape hatch for tests/advanced use - the live `Builder` instance backing this render. */
  getBuilder: () => builder,
})
</script>

<template>
  <div ref="rootEl" class="jui-chart"></div>
</template>
