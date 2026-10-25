// 体感温度页的纯逻辑：等级边界、格式化、缓存合并与天气解析
import assert from "node:assert/strict"
import test from "node:test"
import type { City, CityWeather, WeatherStore } from "../lib/weather.ts"
import {
  CACHE_KEY,
  CACHE_TTL,
  RETRY_BASE,
  RETRY_MAX,
  fmt,
  levelOf,
  mergeWeather,
  nextRetryDelay,
  parseCities,
  readCache,
  staleCities,
  stamp,
  weatherText,
  writeCache,
} from "../lib/weather.ts"

const mem = new Map<string, string>()
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => mem.set(key, value),
    removeItem: (key: string) => mem.delete(key),
  },
})

const city = (name: string): City => ({ name, lon: 0, lat: 0 })
const weather = (name: string, feels: number | null): CityWeather => ({
  name,
  feels,
  min: null,
  max: null,
  level: levelOf(feels),
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
})

test("解析：按当前小时切 24 小时、体感取整、缺数据不崩", () => {
  const cities = [city("甲"), city("乙")]
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

test("合并：新数据覆盖，取不到的城市保留旧值，旧 null 被清掉", () => {
  const prev: WeatherStore = {
    甲: { ...weather("甲", 10), ts: 100 },
    乙: { ...weather("乙", 20), ts: 100 },
    丙: weather("丙", null),
  }
  const merged = mergeWeather(
    prev,
    {
      甲: weather("甲", 30),
      乙: weather("乙", null),
      丁: weather("丁", null),
    },
    200,
  )
  assert.deepEqual(merged.甲, { ...weather("甲", 30), ts: 200 })
  assert.deepEqual(merged.乙, { ...weather("乙", 20), ts: 100 })
  assert.equal(merged.丙, undefined)
  assert.equal(merged.丁, undefined)
})

test("缓存：过期仍可用，逐城时间缺失时用整体时间回填", () => {
  const data: WeatherStore = { 甲: weather("甲", 10) }
  const old = Date.now() - CACHE_TTL - 1
  mem.set(CACHE_KEY, JSON.stringify({ ts: old, data }))

  const cache = readCache()
  assert.ok(cache)
  assert.equal(cache.ts, old)
  assert.equal(cache.data.甲.ts, old)

  // 超过 1 小时：读得到，但会被判为过期需要刷新
  assert.deepEqual(staleCities([city("甲")], cache.data, Date.now()), [
    city("甲"),
  ])

  // 刚写入的数据不算过期
  writeCache(data)
  const fresh = readCache()
  assert.ok(fresh)
  assert.deepEqual(staleCities([city("甲")], fresh.data, Date.now()), [])

  // 缓存里有条目但没数据（feels 为 null），时间再新也算问题
  const noData: WeatherStore = {
    甲: { ...weather("甲", null), ts: Date.now() },
  }
  assert.deepEqual(staleCities([city("甲")], noData, Date.now()), [city("甲")])

  // 正好 1 小时算过期
  assert.deepEqual(
    staleCities(
      [city("甲")],
      { 甲: { ...weather("甲", 10), ts: 1000 } },
      1000 + CACHE_TTL,
    ),
    [city("甲")],
  )

  mem.set(CACHE_KEY, "{坏的 json")
  assert.equal(readCache(), null)
})

test("补全退避：成功回到 1 分钟，失败翻倍封顶 30 分钟", () => {
  assert.equal(nextRetryDelay(RETRY_BASE, true), RETRY_BASE)
  assert.equal(nextRetryDelay(RETRY_BASE, false), RETRY_BASE * 2)
  assert.equal(nextRetryDelay(RETRY_BASE * 2, false), RETRY_BASE * 4)
  assert.equal(nextRetryDelay(RETRY_BASE * 4, false), RETRY_BASE * 8)
  assert.equal(nextRetryDelay(RETRY_MAX, false), RETRY_MAX)
  assert.equal(nextRetryDelay(RETRY_MAX, true), RETRY_BASE)
})
