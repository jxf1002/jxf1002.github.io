// 体感温度页的纯逻辑：等级边界、格式化、缓存与天气解析
import assert from "node:assert/strict"
import test from "node:test"
import {
  CACHE_KEY,
  CACHE_TTL,
  chunk,
  fmt,
  levelOf,
  parseCities,
  readCache,
  stamp,
  weatherText,
  writeCache,
} from "../lib/weather.ts"

const store = new Map<string, string>()
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
})

test("等级：边界值落在正确档位，缺失为 -1", () => {
  assert.equal(levelOf(null), -1)
  assert.equal(levelOf(undefined), -1)
  assert.equal(levelOf(Number.NaN), -1)
  assert.equal(levelOf(-0.1), 0)
  assert.equal(levelOf(0), 1)
  assert.equal(levelOf(14.9), 1)
  assert.equal(levelOf(15), 2)
  assert.equal(levelOf(26.9), 2)
  assert.equal(levelOf(27), 3)
  assert.equal(levelOf(32), 4)
})

test("格式化：温度取整、天气码映射、时间戳补零", () => {
  assert.equal(fmt(null), "—")
  assert.equal(fmt(Number.NaN), "—")
  assert.equal(fmt(20.4), "20°C")
  assert.equal(fmt(20.5), "21°C")
  assert.equal(weatherText(0), "晴")
  assert.equal(weatherText(95), "雷阵雨")
  assert.equal(weatherText(12345), "—")
  assert.equal(weatherText(null), "—")
  assert.equal(stamp(new Date(2026, 0, 2, 3, 4).getTime()), "01-02 03:04")
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]])
})

test("解析：按当前小时切 24 小时、体感取整、缺数据不崩", () => {
  const cities = [
    { name: "甲", lon: 0, lat: 0 },
    { name: "乙", lon: 0, lat: 0 },
  ]
  const result = parseCities(cities, [
    {
      current: {
        time: "2026-10-25T10:00",
        temperature_2m: 20.4,
        apparent_temperature: 19.6,
        weather_code: 61,
      },
      hourly: {
        time: [
          "2026-10-25T09:00",
          "2026-10-25T10:00",
          "2026-10-25T11:00",
          "2026-10-25T12:00",
        ],
        temperature_2m: [1, 2, 3, null],
      },
    },
    {},
  ])
  assert.deepEqual(result.甲, {
    name: "甲",
    temp: 20.4,
    feels: 20,
    code: 61,
    min: 2,
    max: 3,
    level: 2,
  })
  assert.deepEqual(result.乙, {
    name: "乙",
    temp: undefined,
    feels: null,
    code: undefined,
    min: null,
    max: null,
    level: -1,
  })
})

test("缓存：命中、过期与坏数据", () => {
  const data = { 甲: { name: "甲", feels: null, min: null, max: null, level: -1 } }
  store.clear()
  assert.equal(readCache(), null)

  writeCache(data)
  assert.deepEqual(readCache()?.data, data)

  store.set(
    CACHE_KEY,
    JSON.stringify({ ts: Date.now() - CACHE_TTL - 1, data }),
  )
  assert.equal(readCache(), null)

  store.set(CACHE_KEY, "{坏的 json")
  assert.equal(readCache(), null)
})
