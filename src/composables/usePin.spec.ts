import { describe, expect, it } from 'vitest'
import { pinGeometry, pinTrianglePoints } from './usePin'

describe('pinGeometry', () => {
  it('hand-traced: centerX=100, areaTop=20, areaBottom=368, size=6, fontSize=10', () => {
    // paddingY = 10/2 = 5. triangleTop = 20+5 = 25. triangleBottom = 25+6 = 31.
    // triangleLeftX = 100-3 = 97. triangleRightX = 100+3 = 103.
    const g = pinGeometry(100, 20, 368, 6, 10)
    expect(g).toEqual({
      x: 100,
      textY: 20,
      triangleTop: 25,
      triangleBottom: 31,
      triangleLeftX: 97,
      triangleRightX: 103,
      lineY1: 25,
      lineY2: 368,
    })
  })

  it('hand-traced: a different center/size/fontSize', () => {
    // paddingY = 12/2 = 6. triangleTop = 40+6 = 46. triangleBottom = 46+10 = 56.
    // triangleLeftX = 250-5 = 245. triangleRightX = 250+5 = 255.
    const g = pinGeometry(250, 40, 400, 10, 12)
    expect(g).toEqual({
      x: 250,
      textY: 40,
      triangleTop: 46,
      triangleBottom: 56,
      triangleLeftX: 245,
      triangleRightX: 255,
      lineY1: 46,
      lineY2: 400,
    })
  })

  it('the line always spans the whole plot height, independent of the triangle', () => {
    const g = pinGeometry(0, 0, 300, 6, 10)
    expect(g.lineY1).toBe(5)
    expect(g.lineY2).toBe(300)
  })
})

describe('pinTrianglePoints', () => {
  it('builds an SVG points string from the geometry', () => {
    const g = pinGeometry(100, 20, 368, 6, 10)
    expect(pinTrianglePoints(g)).toBe('97,25 103,25 100,31')
  })
})
