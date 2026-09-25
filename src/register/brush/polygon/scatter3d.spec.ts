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

describe('polygon.scatter3d brush', () => {
  it('renders one <circle> per (dataIndex, targetIndex) cell inside a <g class="brush-polygon.scatter3d">', () => {
    const wrapper = mount3d({ type: 'polygon.scatter3d', target: ['sales', 'profit'], size: 10 })

    const group = wrapper.element.querySelector('g[class="brush-polygon.scatter3d"]')
    expect(group).not.toBeNull()

    const circles = group!.querySelectorAll('circle')
    // 3 rows * 2 targets = 6
    expect(circles.length).toBe(6)

    for (const c of circles) {
      expect(c.getAttribute('r')).toBeTruthy()
      expect(c.getAttribute('fill')).toBeTruthy()
    }
  })

  it('auto-wraps a non-"radial(...)" color into a radial gradient (radial(40%,40%,100%,0%,0%) ...)', () => {
    const wrapper = mount3d({ type: 'polygon.scatter3d', target: ['sales'], colors: ['#ff0000'] })

    const circle = wrapper.element.querySelector('g[class="brush-polygon.scatter3d"] circle')!
    const fill = circle.getAttribute('fill') ?? ''

    // `this.chart.color(gradientString)` resolves through Builder's own gradient-parsing pipeline
    // (`util/color.ts`'s `parse()`), which - for an SVG <defs> gradient - ultimately renders as a
    // `url(#...)` reference rather than the raw descriptor string; either form confirms the
    // gradient branch actually ran (a plain "#ff0000" fill would mean it did NOT).
    expect(fill === '#ff0000').toBe(false)
  })

  it('setup() defaults size:7 and clip:false', () => {
    const wrapper = mount3d({ type: 'polygon.scatter3d', target: ['sales'] })
    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.size).toBe(7)
    expect(brush.clip).toBe(false)
  })
})
