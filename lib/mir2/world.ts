// 静态数据加载：URL 保持相对路径，页面在 /mir2/ 下解析到 /mir2/data/*
import { DB, S, loadDrops, newWorld, rebalanceEquips, setDB } from "./game.ts"
import { load } from "./storage.ts"
import type { Item, LevelRow, Magic, Monster } from "./types.ts"

const V = 18
const DATA = ["levels", "items", "magics", "monsters", "elites", "bosses", "drops"] as const

async function get<T>(file: string): Promise<T> {
  const res = await fetch("data/" + file + ".json?v=" + V)
  return (await res.json()) as T // JSON 边界：数据表形状由 data/*.json 保证
}

export async function loadWorld() {
  const [levels, items, magics, monsters, elites, bosses, drops] = await Promise.all([
    get<LevelRow[]>("levels"),
    get<Item[]>("items"),
    get<Magic[]>("magics"),
    get<Monster[]>("monsters"),
    get<Monster[]>("elites"),
    get<Monster[]>("bosses"),
    get<Record<string, string[]>>("drops"),
  ])
  setDB({ levels, items, magics, monsters, elites, bosses })
  loadDrops(drops) // 掉落表静态，一次性载入
  const loaded = load()
  if (!loaded) newWorld()
  for (const n of Object.keys(S.bag)) if (!DB.itemByName[n]) delete S.bag[n]
  rebalanceEquips(true)
  return loaded
}
