// 地图数据是 echarts 的 UTF8Encoding 压缩几何：每个点 2 个字符，
// 字符值 - 64 后做 zigzag 还原，再按差值累加，最后除以 scale 得到经纬度。
// 这里只实现解码/简化/重编码，读写在 scripts/build-china-map.ts。
export type Ring = [number, number][]

type PolygonGeometry = {
  type: "Polygon"
  coordinates: string[]
  encodeOffsets: [number, number][]
}

type MultiPolygonGeometry = {
  type: "MultiPolygon"
  coordinates: string[][]
  encodeOffsets: [number, number][][]
}

export type ChinaFeature = {
  id?: string | number
  geometry: PolygonGeometry | MultiPolygonGeometry
  properties: { name: string; cp: [number, number] }
}

export type ChinaGeoJson = {
  UTF8Encoding: true
  type: "FeatureCollection"
  features: ChinaFeature[]
}

const SCALE = 1024

function zigzag(value: number): number {
  return (value << 1) ^ (value >> 31)
}

function unzigzag(value: number): number {
  return (value >> 1) ^ -(value & 1)
}

export function decodeRing(
  encoded: string,
  offset: [number, number],
  scale = SCALE,
): Ring {
  let prevX = offset[0]
  let prevY = offset[1]
  const ring: Ring = []
  for (let i = 0; i < encoded.length; i += 2) {
    const x = prevX + unzigzag(encoded.charCodeAt(i) - 64)
    const y = prevY + unzigzag(encoded.charCodeAt(i + 1) - 64)
    prevX = x
    prevY = y
    ring.push([x / scale, y / scale])
  }
  return ring
}

export function encodeRing(
  ring: Ring,
  scale = SCALE,
): { encoded: string; offset: [number, number] } {
  const first = ring[0]
  const offset: [number, number] = [
    Math.round(first[0] * scale),
    Math.round(first[1] * scale),
  ]
  let prevX = offset[0]
  let prevY = offset[1]
  let encoded = ""
  // 每个点只占 2 个 UTF-16 码元；跨度太大时 fromCharCode 会截断，宁可让 data:map 失败
  const char = (delta: number) => {
    const value = zigzag(delta) + 64
    if (value > 0xffff) throw new Error("地图环的相邻点跨度太大，无法编码")
    return String.fromCharCode(value)
  }
  for (const [lng, lat] of ring) {
    const x = Math.round(lng * scale)
    const y = Math.round(lat * scale)
    encoded += char(x - prevX) + char(y - prevY)
    prevX = x
    prevY = y
  }
  return { encoded, offset }
}

// Douglas-Peucker：eps 是经纬度（度），0.02° 约 2km，全国视图上看不出差别。
// 闭合环的首尾是同一点，不能拿它当基线（长度为 0，所有点都会被判成共线），先拆开再补回
export function simplifyRing(ring: Ring, eps: number): Ring {
  const closed =
    ring.length > 3 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  const points = closed ? ring.slice(0, -1) : ring
  if (points.length <= 2) return ring
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop() as [number, number]
    if (to <= from + 1) continue
    const [ax, ay] = points[from]
    const [bx, by] = points[to]
    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy) || 1e-12
    let best = -1
    let at = -1
    for (let i = from + 1; i < to; i += 1) {
      const [x, y] = points[i]
      const distance = Math.abs(dy * x - dx * y + bx * ay - by * ax) / length
      if (distance > best) {
        best = distance
        at = i
      }
    }
    if (best > eps) {
      keep[at] = 1
      stack.push([from, at], [at, to])
    }
  }
  const simplified = points.filter((_, index) => keep[index] === 1)
  return closed ? [...simplified, simplified[0]] : simplified
}

// 简化后不足 4 个点的环画不出多边形；整块都画不出时退回最长的原始环，
// 否则地图上会缺一块城市（城市中心 cp 仍在，列表和标签不受影响）
function encodeRings(
  rings: string[],
  offsets: [number, number][],
  eps: number,
): { encoded: string; offset: [number, number] }[] {
  if (!rings.length) return []
  const original = rings.map((ring, index) => decodeRing(ring, offsets[index]))
  const kept = original
    .map((ring) => simplifyRing(ring, eps))
    .filter((ring) => ring.length >= 4)
  if (kept.length) return kept.map((ring) => encodeRing(ring))
  const longest = original.reduce((a, b) => (b.length > a.length ? b : a))
  return longest.length >= 3 ? [encodeRing(longest)] : []
}

export function simplifyGeometry(feature: ChinaFeature, eps: number): ChinaFeature {
  const geometry = feature.geometry
  if (geometry.type === "Polygon") {
    const rings = encodeRings(geometry.coordinates, geometry.encodeOffsets, eps)
    return {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: rings.map((ring) => ring.encoded),
        encodeOffsets: rings.map((ring) => ring.offset),
      },
    }
  }
  const polygons = geometry.coordinates.map((rings, index) =>
    encodeRings(rings, geometry.encodeOffsets[index], eps),
  )
  return {
    ...feature,
    geometry: {
      type: "MultiPolygon",
      coordinates: polygons.map((rings) => rings.map((ring) => ring.encoded)),
      encodeOffsets: polygons.map((rings) => rings.map((ring) => ring.offset)),
    },
  }
}
