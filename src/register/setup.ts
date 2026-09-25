// Single module-load side-effect entry point: registers `jui-graph-ts`'s real `Axis` (required
// before `Builder.drawAxis()` will work at all - it throws `"no Axis implementation registered"`
// otherwise), plus every brush/widget/theme this project covers so far. Imported once (for its
// side effects) by `Chart.vue`.
import { registerAxis, Axis } from 'jui-graph-ts'

registerAxis(Axis as unknown as Parameters<typeof registerAxis>[0])

// Phase 1
import './brush/bar'
import './brush/column'
import './brush/line'
import './brush/area'
import './brush/pie'

import './widget/title'
import './widget/tooltip'
import './widget/legend'

import './theme/classic'
import './theme/dark'
import './theme/gradient'
import './theme/pattern'

import './icon/classic'

import './pattern/classic'

// Phase 2, batch 1: bar-derived family
import './brush/rangebar'
import './brush/rangecolumn'
import './brush/stackbar'
import './brush/stackcolumn'
import './brush/fullstackbar'
import './brush/fullstackcolumn'
import './brush/equalizerbar'
import './brush/equalizercolumn'
import './brush/ratebar'
import './brush/bargauge'

// Phase 2, batch 2: line/area-derived + scatter-derived family
import './brush/stackline'
import './brush/stackarea'
import './brush/rangearea'
import './brush/scatter'
import './brush/bubble'
import './brush/stackscatter'

// Phase 2, batch 3: pie/gauge-derived family + candlestick/selectbox
import './brush/donut'
import './brush/fullgauge'
import './brush/equalizer'
import './brush/pin'
import './brush/candlestick'
import './brush/selectbox'

// Phase 2, batch 4a: heatmap-derived + misc simpler brushes
import './brush/heatmap'
import './brush/heatmapscatter'
import './brush/focus'
import './brush/pyramid'
import './brush/arcequalizer'

// Phase 2, batch 4b: the complex/unique ones (LAST brush batch - all 36 legacy brushes now done)
import './brush/treemap'
import './brush/flame'
import './brush/timeline'
import './brush/topologynode'

// Phase 3, widget batch 1: simple/standalone widgets
import './widget/raycast'
import './widget/scroll'
import './widget/vscroll'
import './widget/cross'

// Phase 3, widget batch 2: selection-rectangle family
import './widget/dragselect'
import './widget/guideline'
import './widget/zoomselect'

// Phase 3, widget batch 3 (LAST widget batch): zoom/pan family
import './widget/topologyctrl'
import './widget/zoom'
import './widget/zoomscroll'

export { GRID_TYPES } from './gridTypes'
