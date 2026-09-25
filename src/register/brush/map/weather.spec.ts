import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Chart from '../../../Chart.vue'
import { installStubMapXhr } from './testMapXhrStub'

describe('map.weather brush', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installStubMapXhr()
  })
  afterEach(() => {
    uninstall()
  })

  it('mounts without throwing against a map axis (real weather-card placement is Playwright-verified against the live site)', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 400,
        height: 300,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.weather' }],
      },
    })

    expect(wrapper.element.querySelector('svg')).not.toBeNull()
  })

  it('setup() defaults format:null', () => {
    const wrapper = mount(Chart, {
      props: {
        width: 200,
        height: 200,
        axis: [{ map: { path: 'nonexistent.svg', width: 100, height: 100 }, data: [] }],
        brush: [{ type: 'map.weather' }],
      },
    })

    const builder = (wrapper.vm as unknown as { getBuilder(): { get(type: string, key: number): Record<string, unknown> } }).getBuilder()
    expect(builder.get('brush', 0).format).toBeNull()
  })
})
