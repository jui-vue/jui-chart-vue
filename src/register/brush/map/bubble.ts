// Port of legacy `src/brush/map/bubble.js` ("chart.brush.map.bubble", extend:
// "chart.brush.map.core") - draws one value-scaled circle per data row at its `axis.map(id)`
// projected `{x,y}` position (`jui-graph-ts`'s already-ported `base/map.ts` `Map` engine's own
// rendered `MapScale`).
import { registerBrush, MapCoreBrush, mathUtil } from 'jui-graph-ts'
import type { BrushData } from 'jui-graph-ts'

type MapScaleFn = (id: string) => { x: number; y: number } | undefined

/** Own `chart.brush.map.bubble.setup()` fields - see legacy `map/bubble.js`. */
export const MAP_BUBBLE_BRUSH_OWN_DEFAULTS = {
  min: 10,
  max: 30,
  showText: false,
  format: null as ((...args: unknown[]) => unknown) | null,
}

export class MapBubbleBrush extends MapCoreBrush {
  private getMinMaxValues(): { min: number; max: number } {
    let min = 0
    let max = 0
    const dataList = this.listData() as BrushData[]

    for (let i = 0; i < dataList.length; i++) {
      const value = this.axis.getValue(dataList[i], 'value', 0) as number

      min = i == 0 ? value : Math.min(value, min)
      max = i == 0 ? value : Math.max(value, max)
    }

    return { min, max }
  }

  drawText(value: unknown, x: number, y: number): any {
    let text = value

    if (typeof (this.brush as Record<string, unknown>).format === 'function') {
      text = this.format(value)
    }

    return this.chart.text(
      {
        'font-size': this.chart.theme('mapBubbleFontSize'),
        fill: this.chart.theme('mapBubbleFontColor'),
        x,
        y: y + 3,
        'text-anchor': 'middle',
      },
      String(text),
    )
  }

  draw = (): any => {
    const g = this.chart.svg.group()
    const minmax = this.getMinMaxValues()
    const brush = this.brush as Record<string, unknown>

    this.eachData((d, i) => {
      const row = d as BrushData
      const index = i as number
      const value = this.axis.getValue(row, 'value', 0) as number
      const size = mathUtil.scaleValue(value, minmax.min, minmax.max, brush.min as number, brush.max as number)
      const xy = ((this.axis as unknown as Record<string, unknown>).map as unknown as MapScaleFn)(this.axis.getValue(row, 'id', null) as string)
      const color = this.color(index, 0)

      if (xy != null) {
        const c = this.chart.svg.circle({
          cx: xy.x,
          cy: xy.y,
          r: size,
          fill: color,
          'fill-opacity': this.chart.theme('mapBubbleBackgroundOpacity'),
          stroke: color,
          'stroke-width': this.chart.theme('mapBubbleBorderWidth'),
        })

        g.append(c)

        if (brush.showText) {
          g.append(this.drawText(value, xy.x, xy.y))
        }
      }
    })

    return g
  }

  static setup(): Record<string, unknown> {
    return MAP_BUBBLE_BRUSH_OWN_DEFAULTS
  }
}

registerBrush('map.bubble', MapBubbleBrush)
