<script setup lang="ts">
// Ported (adapted) from `chart.widget.legend` (`jui-chart/src/widget/legend.js`, `extend:
// "chart.widget.core"`, confirmed from source). **Architectural adaptation, not a literal port**
// - see `PORT_STATUS.md`'s "legend.js" entry for the full reasoning, summarized here:
//
// Source's `LegendWidget` never takes its own explicit label/color list - it introspects a
// *sibling brush* on the same shared chart instance (`getBrushAll()` -> `chart.get("brush",
// index)`, reading that brush's own `target` array for labels and `chart.color(i, widget.colors
// || brush.colors)` for colors) because in the original engine, a widget and the brush(es) it
// decorates are attached to one shared `chart` object with a live `get("brush", i)` accessor. This
// port's chart types (`LineChart`, `BarChart`, ...) are independent Vue components with no shared
// chart instance to introspect - there is no "sibling brush" a widget component could reach into.
// So `ChartLegend` instead takes an explicit `items: {label, color}[]` prop, and the demo page
// below builds that array from the SAME `target`/`colors` values it already passes to the paired
// chart component - the caller bridges the two components explicitly, where the original relied
// on implicit shared state.
//
// Click-to-toggle: ported from source's `filter: true` mode (`getLegendIcon()`'s click handler ->
// `changeTargetOption()` -> `chart.updateBrush(index, {target, colors})` + `chart.render()` +
// `chart.emit("legend.filter", [target])`) - clicking a swatch there mutates the sibling brush's
// own `target` array (removing the deselected key) and re-renders. This port can't reach into a
// sibling component's props to mutate them the same way, so `ChartLegend` instead emits a
// `toggle` event with `{ label, index }` and stays otherwise uncontrolled over what "toggled off"
// means - the demo page owns a `hidden` array of labels (passed back in via the `hidden` prop, so
// the swatch/text dim correctly) and filters the PAIRED CHART's own `target` prop by it. That's
// actually a closer semantic match to source's `changeTargetOption()` (which also works by
// filtering the brush's `target` array) than adding a new `hide`-per-series prop would have been -
// see `ChartLegendPage.vue`'s header comment. (`ScatterChart`/`LineChart`'s existing `hide` prop,
// checked before assuming, is a whole-chart boolean - not a per-series toggle - so it isn't reused
// here.)
//
// Swatch visual: source's `filter:true` mode draws a sliding pill/toggle-switch (a rounded-cap
// `<line>` + a `<circle>` knob that slides from x=WIDTH to x=0 on toggle, `filter:false` mode
// draws a plain color circle with NO click wiring at all). This port simplifies to one swatch
// shape for both: a plain circle, colored normally when active, and recolored to
// `legendSwitchDisableColor` (the SAME token source uses for its own disabled-state recolor) with
// dimmed text when toggled off (`toggleable` prop) - documented deviation from the literal
// sliding-pill visual, chosen so one swatch shape works whether or not `toggleable` is set, and so
// "is this series visible" is verifiable via a single `fill` attribute rather than a `<circle
// cx>` slide position.
//
// Layout: `useLegend.ts`'s `computeLegendLayout` - see that file's header comment for the
// orient/align adaptation (source's `top`/`bottom`/`left`/`right`, tied to a chart's plot-area
// edges, collapses to `horizontal`/`vertical` here since a standalone legend has no plot area to
// hug).
import { computed, toRef } from 'vue'
import { computeLegendLayout, LEGEND_PADDING, type LegendAlign, type LegendItem, type LegendOrient } from '../composables/useLegend'
import { measureTextWidth } from '../composables/tooltipMeasure'
import { useTheme } from '../composables/useTheme'
import type { ThemeName } from '../types'

const props = withDefaults(
  defineProps<{
    items: LegendItem[]
    width?: number
    /** Box height - only meaningful for `orient="vertical"` (`align` positions the column within
     * it; see this file's header comment on why `align` has no visible effect until this is set).
     * `orient="horizontal"` always auto-sizes its own height to the wrapped content instead. */
    height?: number
    theme?: ThemeName
    /** `horizontal` wraps items left-to-right into rows (source's `orient: "top"/"bottom"`);
     * `vertical` stacks them in a single column (source's `orient: "left"/"right"`). */
    orient?: LegendOrient
    /** Aligns the laid-out block within the box, along the wrap axis. For `orient="vertical"`,
     * has no visible effect unless `height` is also set (with no explicit `height`, the box is
     * exactly the content's own height, so start/center/end all coincide). */
    align?: LegendAlign
    /** Overrides the theme's `legendFontSize`. */
    fontSize?: number
    /** Enables click-to-toggle: clicking a swatch/label emits `toggle` and shows a
     * pointer cursor + hover affordance. Ported from source's `filter` option. */
    toggleable?: boolean
    /** Labels currently toggled off - controlled by the caller (see this file's header comment),
     * matching the `active`/`activeEvent` controlled-prop convention already used by
     * `LineChart`/`ScatterChart` elsewhere in this codebase. */
    hidden?: string[]
    dx?: number
    dy?: number
  }>(),
  {
    width: 600,
    height: undefined,
    theme: 'classic',
    orient: 'horizontal',
    align: 'center',
    fontSize: undefined,
    toggleable: false,
    hidden: () => [],
    dx: 0,
    dy: 0,
  },
)

const emit = defineEmits<{
  toggle: [payload: { label: string; index: number }]
}>()

const themeName = toRef(props, 'theme')
const { theme } = useTheme(themeName)

const fontSize = computed(() => props.fontSize ?? theme('legendFontSize'))

// See the `height` prop's own doc comment: with no explicit `height`, the box IS the content's
// own extent, so `align` degenerates to a no-op for orient="vertical" - forcing 'start' avoids a
// circular "need contentHeight to pick a box height that's used to compute contentHeight" and is
// visually identical to 'center'/'end' in that case anyway (box height == content height).
const effectiveAlign = computed(() => (props.orient === 'vertical' && props.height === undefined ? 'start' : props.align))
const effectiveHeight = computed(() => props.height ?? 0)

const layout = computed(() =>
  computeLegendLayout(props.items, {
    width: props.width,
    height: effectiveHeight.value,
    orient: props.orient,
    align: effectiveAlign.value,
    fontSize: fontSize.value,
    hidden: props.hidden,
    measure: (label) => measureTextWidth(label, fontSize.value),
    dx: props.dx,
    dy: props.dy,
  }),
)

const svgWidth = computed(() => props.width)
const svgHeight = computed(() => {
  const contentBottom = layout.value.contentHeight + Math.max(props.dy, 0)
  const boxBottom = props.orient === 'vertical' ? effectiveHeight.value + Math.max(props.dy, 0) : 0
  return Math.max(contentBottom, boxBottom) + LEGEND_PADDING * 2
})

function swatchCenterY(itemY: number, itemHeight: number): number {
  return itemY + itemHeight / 2
}

function onItemClick(label: string, index: number) {
  if (!props.toggleable) return
  emit('toggle', { label, index })
}
</script>

<template>
  <svg :width="svgWidth" :height="svgHeight" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" class="jui-chart-vue-root jui-chart-vue-legend">
    <g
      v-for="entry in layout.items"
      :key="entry.label"
      class="jui-chart-vue-legend-item"
      :class="{ 'jui-chart-vue-legend-item--toggleable': toggleable }"
      :data-legend-label="entry.label"
      :data-legend-active="entry.active"
      :style="toggleable ? { cursor: 'pointer' } : undefined"
      @click="onItemClick(entry.label, entry.index)"
    >
      <circle
        class="jui-chart-vue-legend-swatch"
        :cx="entry.x + fontSize / 2"
        :cy="swatchCenterY(entry.y, entry.height)"
        :r="fontSize / 2"
        :fill="entry.active ? entry.color : theme('legendSwitchDisableColor')"
      />
      <text
        class="jui-chart-vue-legend-label"
        :x="entry.x + fontSize + LEGEND_PADDING"
        :y="swatchCenterY(entry.y, entry.height)"
        dominant-baseline="central"
        text-anchor="start"
        :font-size="fontSize"
        :font-family="theme('fontFamily')"
        :fill="entry.active ? theme('legendFontColor') : theme('legendSwitchDisableColor')"
      >{{ entry.label }}</text>
    </g>
  </svg>
</template>
