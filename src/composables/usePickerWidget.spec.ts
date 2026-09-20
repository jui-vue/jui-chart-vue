import { describe, expect, it, vi } from 'vitest'
import { runPickerCheck } from './usePickerWidget'

describe('runPickerCheck', () => {
  it('returns null when no checker is registered (source: chart.getCache("picker") === null)', () => {
    expect(runPickerCheck(null, 10, 20)).toBeNull()
  })

  it('calls the registered checker with (x, y) and returns its result on a hit', () => {
    const check = vi.fn((x: number, y: number) => (x === 10 && y === 20 ? 'hit-row' : null))
    expect(runPickerCheck(check, 10, 20)).toBe('hit-row')
    expect(check).toHaveBeenCalledWith(10, 20)
  })

  it('passes through a null result on a miss (caller decides whether to emit, matching source\'s own `data != null` gate at the call site)', () => {
    const check = () => null
    expect(runPickerCheck(check, 1, 1)).toBeNull()
  })
})
