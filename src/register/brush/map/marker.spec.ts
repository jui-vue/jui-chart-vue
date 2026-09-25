import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubMapXhr } from './testMapXhrStub'

describe('map.marker brush', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('mounts without throwing against a map axis (real marker placement is Playwright-verified against the live site)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.marker', width: 20, height: 20, html: '<b>x</b>' }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()
  })

  it('setup() defaults width:0, height:0, html:null, svg:null', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.marker' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    const brush = builder.get('brush', 0)

    expect(brush.width).toBe(0)
    expect(brush.height).toBe(0)
    expect(brush.html).toBeNull()
    expect(brush.svg).toBeNull()
  })
})
