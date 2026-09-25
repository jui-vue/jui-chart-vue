import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubMapXhr } from './testMapXhrStub'

describe('map.bubble brush', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('mounts without throwing against a map axis (jsdom has no real XHR/geo-SVG support, so axis.map(id) never resolves to a path for any row - real per-bubble rendering is Playwright-verified against the live site instead)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.bubble', min: 5, max: 50 }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()
  })

  it('setup() defaults min:10, max:30, showText:false', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.bubble' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.min).toBe(10)
    expect(brush.max).toBe(30)
    expect(brush.showText).toBe(false)
  })
})
