import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'

function mount3d(brush: Record<string, unknown>) {
  return mount(Chart, {
    props: {
      width: 400,
      height: 300,
      axis: [
        {
          x: { type: 'block', domain: ['Q1', 'Q2', 'Q3'] },
          y: { type: 'range', domain: [0, 30] },
          z: { type: 'block', domain: ['sales', 'profit'] },
          data: [
            { sales: 10, profit: 5 },
            { sales: 15, profit: 8 },
            { sales: 12, profit: 6 },
          ],
          depth: 100,
          degree: { x: 30, y: 45, z: 0 },
          perspective: 0.8,
        },
      ],
      brush: [brush],
    },
  })
}

describe('polygon.line3d brush', () => {
  it('renders one <polygon> ribbon-quad per (dataIndex -> dataIndex+1, targetIndex) segment inside a <g class="brush-polygon.line3d">', () => {
    const wrapper = mount3d({ type: 'polygon.line3d', target: ['sales', 'profit'] })

    const group = wrapper.element.querySelector('g[class="brush-polygon.line3d"]')
    expect(group).not.toBeNull()

    const polygons = group!.querySelectorAll('polygon')
    // (3 rows - 1) segments * 2 targets = 4
    expect(polygons.length).toBe(4)

    for (const p of polygons) {
      // Each ribbon quad is built from 4 PointPolygon corners via 4 separate `.point()` calls;
      // `PolyElement.join()` (`util/svg/element.poly.ts`) then closes the shape by repeating the
      // first point once more (a Firefox `<polygon>` rendering workaround), so the rendered
      // `points` attribute has 5 coordinate pairs, the last equal to the first.
      const coords = p.getAttribute('points')?.trim().split(/\s+/).filter(Boolean) ?? []
      expect(coords.length).toBe(5)
      expect(coords[4]).toBe(coords[0])
    }
  })

  it('setup() defaults padding/clip', () => {
    const wrapper = mount3d({ type: 'polygon.line3d', target: ['sales'] })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.padding).toBe(10)
    expect(brush.clip).toBe(false)
  })
})
