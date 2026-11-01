/** Registers only the ECharts pieces the dashboard uses (keeps the bundle small). */
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent])

/** Shared tooltip look, matching the Figma tooltip components. */
export const tooltipBase = {
  backgroundColor: '#fff',
  borderColor: '#e6ecf3',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: '#333c5d', fontFamily: 'Noto Sans Hebrew', fontSize: 13 },
  extraCssText: 'box-shadow: 0 4px 16px rgb(7 25 56 / 12%); border-radius: 8px; direction: rtl;',
}

export const axisText = { color: '#68727d', fontFamily: 'Noto Sans Hebrew', fontSize: 12 }
