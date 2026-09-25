// Library entry point (for future packaging - not required by this phase's tests/demos, which
// import `./Chart.vue` directly). Importing this module also registers Phase 1's brushes/widgets/
// theme as a side effect (via `./register/setup`).
import './register/setup'

export { default as Chart } from './Chart.vue'
export type { AxisConfig, AxisPadding, BrushConfig, WidgetConfig } from './Chart.vue'
