import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('imagebar brush', () => {
  it('renders one <image> per (row, target) cell, each inside its own bar <g>, inside a <g class="brush-imagebar">', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100], step: 10 },
            y: { type: 'block', domain: 'quarter' },
            data: [
              { quarter: '1Q', twitter: 50, facebook: 70 },
              { quarter: '2Q', twitter: 20, facebook: 40 },
            ],
          },
        ],
        brush: [{ type: 'imagebar', target: ['twitter', 'facebook'], width: 45, height: 40, uri: (k: string) => `${k}.png` }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-imagebar')
    expect(group).not.toBeNull()

    const images = group!.querySelectorAll('image')
    expect(images.length).toBe(4)
    expect(images[0].getAttribute('xlink:href')).toBe('twitter.png')
  })

  it('fixed:true (the default) backs each image with a colored <rect> filling the remaining bar length', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [
          {
            x: { type: 'range', domain: [0, 100], step: 10 },
            y: { type: 'block', domain: 'quarter' },
            data: [{ quarter: '1Q', twitter: 90 }],
          },
        ],
        brush: [{ type: 'imagebar', target: ['twitter'], width: 10, height: 10, uri: () => 'a.png' }],
      },
    })

    const group = wrapper.element.querySelector('g.brush-imagebar')!
    expect(group.querySelectorAll('rect').length).toBe(1)
  })

  it('setup() defaults innerPadding:2, fixed:true', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ x: { type: 'range', domain: [0, 100] }, y: { type: 'block', domain: 'q' }, data: [{ q: '1Q', twitter: 1 }] }],
        brush: [{ type: 'imagebar', target: ['twitter'], uri: () => 'a.png' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.innerPadding).toBe(2)
    expect(brush.fixed).toBe(true)
  })
})
