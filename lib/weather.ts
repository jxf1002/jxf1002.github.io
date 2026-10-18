// 体感温度页的数据与网络逻辑，不依赖 React
export const LEVELS = [
  { name: "寒冷", color: "#313695" },
  { name: "凉爽", color: "#74ADD1" },
  { name: "舒适", color: "#1A9850" },
  { name: "偏热", color: "#FDAE61" },
  { name: "炎热", color: "#D73027" },
]

export const WMO: Record<number, string> = {
  0: "晴",
  1: "多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "毛毛雨",
  53: "毛毛雨",
  55: "毛毛雨",
  56: "冻毛毛雨",
  57: "冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "阵雨",
  82: "暴雨",
  85: "阵雪",
  86: "阵雪",
  95: "雷阵雨",
  96: "雷阵雨伴冰雹",
  99: "雷阵雨伴冰雹",
}

export const MAP_URLS = [
  "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/china-cities.json",
  "https://unpkg.com/echarts@4.9.0/map/json/china-cities.json",
]

export const CACHE_KEY = "comfort-weather-v1"
export const CACHE_TTL = 3600e3 // 天气每小时刷新一次
export const MAX_ZOOM = 6
export const LABEL_ZOOM = 5.5 // 接近最大倍数时才显示地级市名称

export type City = { name: string; lon: number; lat: number }

export type CityWeather = {
  name: string
  temp?: number
  feels: number | null
  code?: number
  min: number | null
  max: number | null
  level: number
}

export type WeatherStore = Record<string, CityWeather>

export type ChinaGeoJson = {
  features: Array<{
    properties: { name: string; cp: [number, number] }
  }>
}

type OpenMeteoEntry = {
  current?: {
    time?: string
    temperature_2m?: number
    apparent_temperature?: number
    weather_code?: number
  }
  hourly?: { time?: string[]; temperature_2m?: Array<number | null> }
}

export function levelOf(feels: number | null | undefined): number {
  if (feels == null || isNaN(feels)) return -1
  if (feels < 0) return 0
  if (feels < 15) return 1
  if (feels < 27) return 2
  if (feels < 32) return 3
  return 4
}

export function fmt(value: number | null | undefined): string {
  return value == null || isNaN(value) ? "—" : Math.round(value) + "°C"
}

export function weatherText(code: number | null | undefined): string {
  return code != null ? WMO[code] || "—" : "—"
}

export function stamp(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => ("0" + n).slice(-2)
  return (
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes())
  )
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function readCache(): { ts: number; data: WeatherStore } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { ts: number; data: WeatherStore } | null
    if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL && cached.data) {
      return cached
    }
  } catch (e) {
    // 隐私模式下 localStorage 可能不可用，忽略
  }
  return null
}

export function writeCache(store: WeatherStore): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: store }),
    )
  } catch (e) {
    // 同上
  }
}

export function loadMapJson(): Promise<ChinaGeoJson> {
  return MAP_URLS.reduce<Promise<ChinaGeoJson>>(
    (promise, url) =>
      promise.catch(() =>
        fetch(url).then((response) => {
          if (!response.ok) throw new Error("map load failed")
          return response.json() as Promise<ChinaGeoJson>
        }),
      ),
    Promise.reject(new Error("no url")),
  )
}

function parseCities(cities: City[], data: OpenMeteoEntry[]): WeatherStore {
  const entries: WeatherStore = {}
  cities.forEach((city, index) => {
    const weather = data[index] || {}
    const current = weather.current || {}
    const times = (weather.hourly && weather.hourly.time) || []
    const temps = (weather.hourly && weather.hourly.temperature_2m) || []
    let startIndex = 0
    if (current.time) {
      const hourKey = String(current.time).slice(0, 13)
      const found = times.findIndex((t) => String(t).slice(0, 13) === hourKey)
      if (found >= 0) startIndex = found
    }
    const slice = temps
      .slice(startIndex, startIndex + 24)
      .filter((value) => value != null) as number[]
    let feels: number | null = current.apparent_temperature ?? null
    if (feels != null && !isNaN(feels)) feels = Math.round(feels)
    entries[city.name] = {
      name: city.name,
      temp: current.temperature_2m,
      feels,
      code: current.weather_code,
      min: slice.length ? Math.min(...slice) : null,
      max: slice.length ? Math.max(...slice) : null,
      level: levelOf(feels),
    }
  })
  return entries
}

// 每 40 个城市一个请求，单个失败不影响其他分组
export function fetchWeather(cities: City[]): Promise<WeatherStore> {
  const groups = chunk(cities, 40)
  return Promise.all(
    groups.map((group) => {
      const lat = group.map((c) => c.lat.toFixed(2)).join(",")
      const lon = group.map((c) => c.lon.toFixed(2)).join(",")
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        lat +
        "&longitude=" +
        lon +
        "&current=temperature_2m,apparent_temperature,weather_code" +
        "&hourly=temperature_2m&timezone=Asia%2FShanghai&forecast_days=2"
      return fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error("weather failed")
          return response.json() as Promise<OpenMeteoEntry[] | OpenMeteoEntry>
        })
        .then((data) => ({
          cities: group,
          data: Array.isArray(data) ? data : [data],
        }))
        .catch(() => ({ cities: group, data: [] as OpenMeteoEntry[] }))
    }),
  ).then((results) => {
    let entries: WeatherStore = {}
    results.forEach((result) => {
      entries = { ...entries, ...parseCities(result.cities, result.data) }
    })
    return entries
  })
}
