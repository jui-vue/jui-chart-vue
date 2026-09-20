import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TopologyChart from './TopologyChart.vue'
import { layoutTopologyLinear, layoutTopologyRandom, type TopologyArea, type TopologyPoint } from '../composables/useTopology'

const DATA = [
  { key: 'a', outgoing: ['b'] },
  { key: 'b', outgoing: [] },
]

// Node position `<g :transform="translate(x, y)">` (TopologyChart.vue:609) vs. the outer
// pan/zoom viewport wrapper `<g :transform="scale(k) translate(x, y)">` (:586,
// `topologyViewportTransform`) - filter to the plain-`translate(...)`-only ones so this doesn't
// accidentally read the viewport wrapper's own (always-present) transform as "node 0".
function nodeTranslates(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll('g')
    .map((g) => g.attributes('transform'))
    .filter((t): t is string => !!t && t.startsWith('translate('))
}

describe('TopologyChart sort resolution', () => {
  // Confirms `topologySortStrategies`/`resolveTopologySort` (TopologyChart.vue) still dispatch the
  // two built-in string values to the exact same pure functions `useTopology.ts` exports - the
  // Record refactor (replacing a ternary) must not change which function each string selects.
  it('sort="linear" (default) renders nodes at layoutTopologyLinear\'s own X positions', () => {
    // Only the X coordinate is asserted: layoutTopologyLinear's Y is intentionally
    // non-deterministic (a real, preserved source quirk of "linear" mode - see its own doc comment
    // in useTopology.ts), so it can't be used as a cross-invocation oracle without a carefully
    // reset shared rng sequence; X alone is enough to prove the Record dispatch selected
    // layoutTopologyLinear (not layoutTopologyRandom, which would place BOTH nodes near the same
    // rng-driven spot, not a deterministic zigzag).
    const wrapper = mount(TopologyChart, { props: { data: DATA, width: 300, height: 200 } })
    const area: TopologyArea = { x: 0, y: 0, width: 300, height: 200 } // no `title` prop -> titleReserve=0
    const expected = layoutTopologyLinear(DATA.length, area, 50)
    const xs = nodeTranslates(wrapper).map((t) => Number(t.match(/translate\((-?\d+),/)?.[1]))
    expect(xs).toEqual(expected.map((p) => p.x))
  })

  it('sort="random" dispatches to layoutTopologyRandom, not layoutTopologyLinear', () => {
    const area: TopologyArea = { x: 0, y: 0, width: 300, height: 200 }
    // Constant rng: layoutTopologyLinear's own y-jitter retry loop can infinite-loop on a
    // never-changing rng (a real, preserved source quirk - see useTopology.ts), so only
    // layoutTopologyRandom (which never retries) is safe to hand-compute this way.
    const rng = () => 0.5
    const expected = layoutTopologyRandom(DATA.length, area, 50, rng)
    // x = floor(0.5*(300-50)) = 125, y = floor(0.5*(200-50)) = 75 for both nodes (rng is constant,
    // not index-dependent) - hand-traced to confirm `expected` itself before trusting it as oracle.
    expect(expected).toEqual([{ x: 125, y: 75 }, { x: 125, y: 75 }])
    const originalRandom = Math.random
    try {
      Math.random = rng
      const wrapper = mount(TopologyChart, { props: { data: DATA, width: 300, height: 200, sort: 'random' } })
      expect(nodeTranslates(wrapper)).toEqual(expected.map((p) => `translate(${p.x}, ${p.y})`))
    } finally {
      Math.random = originalRandom
    }
  })

  // The real new coverage: source's `jui.include(this.grid.sort)` fallback (a caller-registered
  // custom sort module, looked up by name) has no equivalent in a registry-free ES-module port -
  // this port's replacement is accepting the layout FUNCTION ITSELF as `sort`, bypassing both
  // built-in strategies entirely. See `sort` prop's doc comment in TopologyChart.vue.
  it('sort accepts a custom TopologyLayoutFn directly, bypassing both built-in strategies', () => {
    const customLayout = (count: number, area: TopologyArea): TopologyPoint[] =>
      Array.from({ length: count }, (_, i) => ({ x: area.x + i * 1000, y: area.y + i * 2000 }))

    const wrapper = mount(TopologyChart, { props: { data: DATA, width: 300, height: 200, sort: customLayout } })
    expect(nodeTranslates(wrapper)).toEqual(['translate(0, 0)', 'translate(1000, 2000)'])
  })
})
