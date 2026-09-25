import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'

function mount3d(brush: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'block', domain: ['Q1', 'Q2'] },
          y: { type: 'range', domain: [0, 30] },
          z: { type: 'block', domain: ['sales', 'profit'] },
          data: [
            { sales: 10, profit: 5 },
            { sales: 15, profit: 8 },
          ],
          depth: 100,
          degree: { x: 30, y: 20, z: 0 },
          perspective: 0.6,
          ...extra,
        },
      ],
      brush: [brush],
    },
  })
}

describe('polygon.column3d brush', () => {
  it('renders one <polygon> face per visible CubePolygon face (6 faces) per (dataIndex, targetIndex) cell inside a <g class="brush-polygon.column3d">', () => {
    const wrapper = mount3d({ type: 'polygon.column3d', target: ['sales', 'profit'] })

    const group = wrapper.element.querySelector('g[class="brush-polygon.column3d"]')
    expect(group).not.toBeNull()

    const polygons = group!.querySelectorAll('polygon')
    // 2 dataIndex * 2 targetIndex cells * 6 cube faces = 24
    expect(polygons.length).toBe(24)
  })

  it('setup() defaults width/height/padding/clip', () => {
    const wrapper = mount3d({ type: 'polygon.column3d', target: ['sales'] })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.width).toBe(0)
    expect(brush.height).toBe(0)
    expect(brush.padding).toBe(20)
    expect(brush.clip).toBe(false)
  })
})
