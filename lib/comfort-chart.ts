// 体感温度地图用的 echarts 实例。这里必须静态按需引入：
// 直接 import("echarts/charts") 这类 barrel 会把整包图表类型都打进产物
import * as echarts from "echarts/core"
import { MapChart } from "echarts/charts"
import {
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([
  MapChart,
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { echarts }
