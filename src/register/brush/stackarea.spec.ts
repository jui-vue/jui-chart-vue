import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('stackarea brush', () => {
  it('renders one closed fill path per target, stacked (getStackXY, not getXY)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'block', domain: ['A', 'B'] },
            y: { type: 'range', domain: [0, 100] },
            data: [
              { name: 'A', a: 10, b: 20 },
              { name: 'B', a: 15, b: 25 },
            ],
          },
        ],
        brush: [{ type: 'stackarea', target: ['a', 'b'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-stackarea')
    expect(group).not.toBeNull()

    // 2 targets * (1 closed fill path + 1 visible line path, since brush.line defaults true) = 4.
    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(4)
  })
})
