import { createRouter, createWebHistory } from 'vue-router'

export interface ExampleRoute {
  path: string
  name: string
  label: string
  source: string
  component: () => Promise<unknown>
}

export const exampleRoutes: ExampleRoute[] = [
  { path: '/bar', name: 'bar', label: 'Bar / Column', source: 'examples/bar.html', component: () => import('./pages/BarPage.vue') },
  { path: '/line', name: 'line', label: 'Line', source: 'src/brush/line.js', component: () => import('./pages/LinePage.vue') },
  { path: '/area', name: 'area', label: 'Area', source: 'src/brush/area.js', component: () => import('./pages/AreaPage.vue') },
  { path: '/pie', name: 'pie', label: 'Pie', source: 'src/brush/pie.js', component: () => import('./pages/PiePage.vue') },
  { path: '/donut', name: 'donut', label: 'Donut', source: 'src/brush/donut.js', component: () => import('./pages/DonutPage.vue') },
  { path: '/scatter', name: 'scatter', label: 'Scatter', source: 'src/brush/scatter.js', component: () => import('./pages/ScatterPage.vue') },
  { path: '/bubble', name: 'bubble', label: 'Bubble', source: 'src/brush/bubble.js', component: () => import('./pages/BubblePage.vue') },
  { path: '/rangearea', name: 'rangearea', label: 'Range area', source: 'src/brush/rangearea.js', component: () => import('./pages/RangeAreaPage.vue') },
  { path: '/rangebar', name: 'rangebar', label: 'Range bar / column', source: 'src/brush/rangebar.js', component: () => import('./pages/RangeBarPage.vue') },
  { path: '/candlestick', name: 'candlestick', label: 'Candlestick', source: 'src/brush/candlestick.js', component: () => import('./pages/CandlestickPage.vue') },
  { path: '/equalizer', name: 'equalizer', label: 'Equalizer', source: 'src/brush/equalizer.js', component: () => import('./pages/EqualizerPage.vue') },
  { path: '/ratebar', name: 'ratebar', label: 'Rate bar', source: 'src/brush/ratebar.js', component: () => import('./pages/RateBarPage.vue') },
  { path: '/bargauge', name: 'bargauge', label: 'Bar gauge', source: 'src/brush/bargauge.js', component: () => import('./pages/BarGaugePage.vue') },
  { path: '/fullgauge', name: 'fullgauge', label: 'Full gauge', source: 'examples/fullgauge.html', component: () => import('./pages/FullGaugePage.vue') },
  { path: '/pin', name: 'pin', label: 'Pin', source: 'src/brush/pin.js', component: () => import('./pages/PinPage.vue') },
  { path: '/selectbox', name: 'selectbox', label: 'Select box', source: 'src/brush/selectbox.js', component: () => import('./pages/SelectBoxPage.vue') },
  { path: '/focus', name: 'focus', label: 'Focus', source: 'src/brush/focus.js', component: () => import('./pages/FocusPage.vue') },
  { path: '/heatmap', name: 'heatmap', label: 'Heatmap', source: 'src/brush/heatmap.js', component: () => import('./pages/HeatmapPage.vue') },
  { path: '/heatmapscatter', name: 'heatmapscatter', label: 'Heatmap scatter', source: 'src/brush/heatmapscatter.js', component: () => import('./pages/HeatmapScatterPage.vue') },
  { path: '/pyramid', name: 'pyramid', label: 'Pyramid', source: 'src/brush/pyramid.js', component: () => import('./pages/PyramidPage.vue') },
  { path: '/arcequalizer', name: 'arcequalizer', label: 'Arc equalizer', source: 'src/brush/arcequalizer.js', component: () => import('./pages/ArcEqualizerPage.vue') },
  { path: '/timeline', name: 'timeline', label: 'Timeline', source: 'src/brush/timeline.js', component: () => import('./pages/TimelinePage.vue') },
  { path: '/flame', name: 'flame', label: 'Flame graph', source: 'src/brush/flame.js', component: () => import('./pages/FlamePage.vue') },
  { path: '/treemap', name: 'treemap', label: 'Treemap', source: 'src/brush/treemap.js', component: () => import('./pages/TreemapPage.vue') },
  { path: '/topology', name: 'topology', label: 'Topology', source: 'examples/topology.html', component: () => import('./pages/TopologyPage.vue') },
  { path: '/legend', name: 'legend', label: 'Legend', source: 'src/widget/legend.js', component: () => import('./pages/ChartLegendPage.vue') },
  { path: '/axis-orient', name: 'axis-orient', label: 'Axis orientation', source: 'node_modules/juijs-graph/src/base/axis.js', component: () => import('./pages/AxisOrientPage.vue') },
  { path: '/canvas-demo', name: 'canvas-demo', label: 'Canvas infra + kinetic (Phase E)', source: 'src/brush/canvas/base/kinetic.js', component: () => import('./pages/CanvasDemoPage.vue') },
  { path: '/bubble-demo', name: 'bubble-demo', label: 'Bubble / MortalBubble (Phase E)', source: 'src/brush/canvas/base/bubble.js, mortalbubble.js', component: () => import('./pages/BubbleDemoPage.vue') },
  { path: '/activebubble', name: 'activebubble', label: 'Active bubble (Phase E)', source: 'src/brush/canvas/activebubble.js', component: () => import('./pages/ActiveBubblePage.vue') },
  { path: '/bubblecloud', name: 'bubblecloud', label: 'Bubble cloud (Phase E)', source: 'src/brush/canvas/bubblecloud.js', component: () => import('./pages/BubbleCloudPage.vue') },
  { path: '/activecircle', name: 'activecircle', label: 'Active circle (Phase E)', source: 'src/brush/canvas/activecircle.js', component: () => import('./pages/ActiveCirclePage.vue') },
  { path: '/dot3d', name: 'dot3d', label: 'Dot3D (Phase E)', source: 'src/brush/canvas/dot3d.js', component: () => import('./pages/Dot3DPage.vue') },
  {
    path: '/equalizercolumn',
    name: 'equalizercolumn',
    label: 'Equalizer column (Phase E)',
    source: 'src/brush/canvas/equalizercolumn.js, widget/raycast.js, widget/canvas/picker.js',
    component: () => import('./pages/EqualizerColumnPage.vue'),
  },
  { path: '/column3d', name: 'column3d', label: 'Column3D (Phase E)', source: 'src/brush/polygon/column3d.js', component: () => import('./pages/Column3DPage.vue') },
  { path: '/line3d', name: 'line3d', label: 'Line3D (Phase E)', source: 'src/brush/polygon/line3d.js', component: () => import('./pages/Line3DPage.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', redirect: '/bar' }, ...exampleRoutes.map((r) => ({ path: r.path, name: r.name, component: r.component }))],
})
