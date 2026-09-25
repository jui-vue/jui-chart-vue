import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('scatterpath brush', () => {
  it('renders exactly 5 batched <path> elements (one per round-robin group) inside a <g class="brush-scatterpath">, regardless of point count', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ x: i, y: i % 5 }))

    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 12] },
            y: { type: 'range', domain: [0, 5] },
            data,
          },
        ],
        brush: [{ type: 'scatterpath', target: ['y'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-scatterpath')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(5)

    // At least some of the 5 batches got real point data (`d` set via PathSymbolElement.add()).
    const withD = Array.from(paths).filter((p) => p.getAttribute('d'))
    expect(withD.length).toBeGreaterThan(0)
  })

  it('setup() defaults symbol:"circle", size:7, strokeWidth:1', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: [0, 10] }, y: { type: 'range', domain: [0, 10] }, data: [{ x: 1, y: 1 }] }],
        brush: [{ type: 'scatterpath', target: ['y'] }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.symbol).toBe('circle')
    expect(brush.size).toBe(7)
    expect(brush.strokeWidth).toBe(1)
  })
})
