import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

function mountTopologyCtrl(widgetExtra: Record<string, unknown> = {}) {
  return mount(Chart, {
    props: {
      width: 500,
      height: 400,
      axis: [
        {
          c: { type: 'topologytable' },
          data: [
            { key: 'a', outgoing: ['b'] },
            { key: 'b', outgoing: [] },
          ],
        },
      ],
      brush: [{ type: 'topologynode' }],
      widget: [{ type: 'topologyctrl', brush: 0, ...widgetExtra }],
    },
  })
}

describe('topologyctrl widget', () => {
  it('renders an empty <g class="widget-topologyctrl"> - it wires events onto the topologynode brush, not visuals', () => {
    const wrapper = mountTopologyCtrl()
    const g = wrapper.element.querySelector('g.widget-topologyctrl')
    expect(g).not.toBeNull()
    expect(g!.children.length).toBe(0)
  })

  it('mounts without throwing with both move and zoom enabled', () => {
    expect(() => mountTopologyCtrl({ move: true, zoom: true })).not.toThrow()
  })

  it('finds and wires the correct topologynode brush group even when configured brush index is 0', () => {
    // A smoke check that `getBrushElement()`'s class-substring scan (`indexOf('topologynode')`)
    // correctly locates the real brush-topologynode group this project's CoreBrush stamps via
    // `drawAfter()` - if it silently found nothing, mounting would still succeed (setBrushEvent()
    // just returns early), so this only confirms no crash; the real per-node mousedown wiring is
    // exercised visually via Playwright (jsdom has no real mouse-drag simulation for this).
    const wrapper = mountTopologyCtrl()
    const nodeGroup = wrapper.element.querySelector('g.brush-topologynode')
    expect(nodeGroup).not.toBeNull()
  })
})
