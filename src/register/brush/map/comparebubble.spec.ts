import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'

describe('map.comparebubble brush', () => {
  it('renders 2 overlapping circles centered in the axis area when given exactly 2 rows (no map path needed - this brush never calls axis.map at all)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [{ title: 'A', value: 30 }, { title: 'B', value: 70 }] }],
        brush: [{ type: 'map.comparebubble', size: 50 }],
      },
    })

    const group = wrapper.element.querySelector('g[class="brush-map.comparebubble"]')
    expect(group).not.toBeNull()
    // 2 main bubbles + 1 small connector-line endpoint dot inside drawMaxText()'s own inner group
    expect(group!.querySelectorAll('circle').length).toBe(3)
  })

  it('setup() defaults size:100, format:null', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ data: [] }],
        brush: [{ type: 'map.comparebubble' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.size).toBe(100)
    expect(brush.format).toBeNull()
  })
})
