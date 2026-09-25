import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('path brush', () => {
  it('renders one closed <path> per target inside a <g class="brush-path"> (radar-style c axis)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            c: { type: 'radar', domain: 'type' },
            data: [
              { type: 'STR', warrior: 100, wizard: 30 },
              { type: 'VIT', warrior: 80, wizard: 50 },
              { type: 'DEX', warrior: 50, wizard: 70 },
            ],
          },
        ],
        brush: [{ type: 'path', target: ['warrior', 'wizard'] }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-path')
    expect(group).not.toBeNull()

    const paths = group!.querySelectorAll('path')
    expect(paths.length).toBe(2)
    for (const p of paths) {
      // ClosePath() appends a "Z" close command
      expect(p.getAttribute('d')).toMatch(/Z$/)
    }
  })
})
