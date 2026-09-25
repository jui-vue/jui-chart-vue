import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

function mountBar3d(brush: Record<string, unknown>) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'range', domain: 'total' },
          y: { type: 'block', domain: ['Q1', 'Q2'] },
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

describe('bar3d brush', () => {
  it('renders one extruded rect3d <g> per (row, target) cell inside a <g class="brush-bar3d">', () => {
    const wrapper = mountBar3d({ type: 'bar3d', target: ['sales', 'profit'] })
    const group = wrapper.element.querySelector('g.brush-bar3d')
    expect(group).not.toBeNull()
    // rect3d() builds a <g> of 3 shaded <path> faces per cell -> 2 rows * 2 targets * 3 = 12
    expect(group!.querySelectorAll('path').length).toBe(12)
  })

  it('setup() defaults outerPadding:10, innerPadding:5', () => {
    const wrapper = mountBar3d({ type: 'bar3d', target: ['sales'] })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)
    expect(brush.outerPadding).toBe(10)
    expect(brush.innerPadding).toBe(5)
  })
})
