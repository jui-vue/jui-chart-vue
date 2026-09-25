// Smoke test (task step 4's own explicit ask): confirms `Builder` genuinely produces real SVG DOM
// under jsdom, mounted through `<Chart>`, the same way it would in a browser - and that unmounting
// tears the SVG back out again.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from './Chart.vue'

describe('Chart.vue', () => {
  it('mounts and renders a real <svg> element into its root div, sized from props', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
      },
    })

    const svg = wrapper.element.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('width')).toBe('400')
    expect(svg!.getAttribute('height')).toBe('300')
  })

  it('re-renders (a fresh Builder + fresh <svg>) when props change reactively', async () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ data: [] }],
      },
    })

    const firstSvg = wrapper.element.querySelector('svg')
    expect(firstSvg).not.toBeNull()

    await wrapper.setProps({ width: 500 })

    const svgs = wrapper.element.querySelectorAll('svg')
    // remount() clears the root's innerHTML before building fresh, so there should still be
    // exactly one <svg>, now sized from the new prop.
    expect(svgs.length).toBe(1)
    expect(svgs[0].getAttribute('width')).toBe('500')
  })

  it('clears the root element on unmount (Core.destroy() is an intentional no-op)', () => {
    const wrapper = mount(Chart, {
      props: { axis: [{ data: [] }] },
    })

    const el = wrapper.element as HTMLElement
    expect(el.querySelector('svg')).not.toBeNull()

    wrapper.unmount()

    expect(el.querySelector('svg')).toBeNull()
  })

  it('defaults to the registered "classic" theme (renders without an unregistered-theme error)', () => {
    expect(() =>
      mount(Chart, {
        props: { axis: [{ data: [] }] },
      }),
    ).not.toThrow()
  })
})
