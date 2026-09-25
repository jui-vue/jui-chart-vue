import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../Chart.vue'

describe('title widget', () => {
  it('renders the configured text as a <text class="widget-title"> element', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        widget: [{ type: 'title', text: 'Hello Chart' }],
      },
    })

    const text = wrapper.element.querySelector('text.widget-title')
    expect(text).not.toBeNull()
    expect(text!.textContent).toBe('Hello Chart')
  })

  it('anchors to "start" when align is "start"', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
        widget: [{ type: 'title', text: 'Left', align: 'start' }],
      },
    })

    const text = wrapper.element.querySelector('text.widget-title')!
    expect(text.getAttribute('text-anchor')).toBe('start')
  })
})
