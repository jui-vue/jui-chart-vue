import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

function mountColumn3d(brush: Record<string, unknown>) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'block', domain: ['Q1', 'Q2'] },
          y: { type: 'range', domain: 'total' },
          c: { type: 'grid3d' },
          data: [
            { sales: 12, profit: 10, total: 20 },
            { sales: 15, profit: 6, total: 20 },
          ],
          depth: 20,
          degree: 30,
        },
      ],
      brush: [brush],
    },
  })
}

describe('column3d brush', () => {
  it('renders one extruded rect3d <g> per (row, target) cell inside a <g class="brush-column3d">', () => {
    const wrapper = mountColumn3d({ type: 'column3d', target: ['sales', 'profit'] })
    const group = wrapper.element.querySelector('g.brush-column3d')
    expect(group).not.toBeNull()
    expect(group!.querySelectorAll('path').length).toBe(12)
  })

  it('setup() defaults outerPadding:10, innerPadding:5', () => {
    const wrapper = mountColumn3d({ type: 'column3d', target: ['sales'] })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)
    expect(brush.outerPadding).toBe(10)
    expect(brush.innerPadding).toBe(5)
  })
})
