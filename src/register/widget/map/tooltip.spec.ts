import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubMapXhr } from '../../brush/map/testMapXhrStub'

describe('map.tooltip widget', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('mounts without throwing against a map axis (real hover-tooltip behavior is Playwright-verified against the live site)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        widget: [{ type: 'map.tooltip', orient: 'top' }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()
  })

  it('inherits the base tooltip widget\'s orient/format defaults', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        widget: [{ type: 'map.tooltip' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const widget = builder.get('widget', 0)

    expect(widget.orient).toBe('top')
    expect(widget.format).toBeNull()
  })
})
