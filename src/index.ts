// Library entry point. Importing this module registers every brush/widget/theme this project
// covers as a side effect (via `./register/setup`).
import './register/setup'

export { default as Chart } from './Chart.vue'
export type { AxisConfig, AxisPadding, BrushConfig, WidgetConfig } from './Chart.vue'

// Re-exported for consumers (e.g. www.jui-vue.io's play/chart legacy `chart.builder` shim) that
// need the raw jui-graph-ts `Builder` directly instead of going through `<Chart>` - same engine,
// same registered types, just the imperative `chart.builder(selector, options)`-shaped API that
// legacy demo code (`chart.axis(0).update(...)`, `chart.render()`, `chart.updateBrush(...)`, etc.)
// expects. `GRID_TYPES` must be assigned onto every `Builder` instance before `.mount()` (see
// `Chart.vue`'s own `remount()`), exactly mirroring how the real engine wires registered axis types.
export { Builder } from 'jui-graph-ts'
export { GRID_TYPES } from './register/setup'
