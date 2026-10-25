// 地图压缩几何的编解码与简化
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { decodeRing, encodeRing, simplifyRing } from "../lib/china-map.ts"
import type { ChinaGeoJson, Ring } from "../lib/china-map.ts"

test("地图：压缩几何编解码往返误差不超过 1/1024 度", () => {
  const ring: Ring = [
    [116.4, 39.9],
    [116.5, 39.95],
    [116.6, 39.9],
  ]
  const { encoded, offset } = encodeRing(ring)
  const decoded = decodeRing(encoded, offset)
  assert.equal(decoded.length, ring.length)
  decoded.forEach(([lng, lat], index) => {
    assert.ok(Math.abs(lng - ring[index][0]) <= 1 / 1024)
    assert.ok(Math.abs(lat - ring[index][1]) <= 1 / 1024)
  })
})

test("地图：简化会删掉共线的中间点，保留首尾", () => {
  const ring: Ring = [
    [0, 0],
    [0.1, 0.1],
    [0.2, 0.2],
    [0.3, 0.1],
    [0.4, 0],
  ]
  const simplified = simplifyRing(ring, 0.01)
  assert.ok(simplified.length < ring.length)
  assert.deepEqual(simplified[0], [0, 0])
  assert.deepEqual(simplified[simplified.length - 1], [0.4, 0])
})

test("地图：部署文件保留全部城市，坐标在国境范围内", () => {
  const geo = JSON.parse(
    readFileSync(
      new URL("../public/data/china-cities.json", import.meta.url),
      "utf8",
    ),
  ) as ChinaGeoJson
  assert.equal(geo.UTF8Encoding, true)
  assert.equal(geo.features.length, 367)
  for (const feature of geo.features) {
    const name = feature.properties.name
    assert.ok(name.length > 0)
    const [lng, lat] = feature.properties.cp
    assert.ok(lng > 73 && lng < 136, name)
    assert.ok(lat > 2 && lat < 54, name)

    const geometry = feature.geometry
    let ring = ""
    let offset: [number, number] = [0, 0]
    if (geometry.type === "Polygon") {
      ring = geometry.coordinates[0]
      offset = geometry.encodeOffsets[0]
    } else {
      ring = geometry.coordinates[0][0]
      offset = geometry.encodeOffsets[0][0]
    }
    assert.ok(decodeRing(ring, offset).length >= 4, name)
  }
})
