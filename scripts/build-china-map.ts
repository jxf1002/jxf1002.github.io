// 把 assets 里的原始地图简化成部署文件。
// 用法：npm run data:map（原始数据更新后跑一次）
import { readFileSync, writeFileSync } from "node:fs"
import { simplifyGeometry } from "../lib/china-map.ts"
import type { ChinaGeoJson } from "../lib/china-map.ts"

// 0.02° 约 2km，全国视图下小于 1px；再大海岸线就会出现明显折角
const EPS = 0.02

const source = JSON.parse(
  readFileSync(new URL("../assets/china-cities.source.json", import.meta.url), "utf8"),
) as ChinaGeoJson

const features = source.features.map((feature) =>
  simplifyGeometry(
    {
      id: feature.id,
      geometry: feature.geometry,
      // childNum 页面没用到，去掉省体积
      properties: { name: feature.properties.name, cp: feature.properties.cp },
    },
    EPS,
  ),
)

const output: ChinaGeoJson = {
  UTF8Encoding: true,
  type: "FeatureCollection",
  features,
}
const text = JSON.stringify(output) + "\n"
writeFileSync(new URL("../public/data/china-cities.json", import.meta.url), text)

console.log(
  "china-cities:",
  features.length,
  "个城市，",
  (text.length / 1024).toFixed(0) + "KB",
  `（eps=${EPS}°）`,
)
