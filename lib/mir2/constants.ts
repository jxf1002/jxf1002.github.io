// 传奇挂机（mir2）常量表：数值与旧 public/mir2/js/game.js 保持一致
import type { Job } from "./types.ts"

// ponytail: 怪物强度用 Lvl+HP 双条件匹配，杀得动才选，保证 1x 速度下 30 秒内一只
export const SLOT_OF: Record<number, string> = { 5: "weapon", 6: "weapon", 10: "clothes", 11: "clothes", 15: "helm", 19: "neck", 20: "neck", 21: "neck", 22: "ring", 23: "ring", 24: "brace", 26: "brace" }
export const SLOTS: Array<[string, string]> = [["weapon", "武器"], ["clothes", "衣服"], ["helm", "头盔"], ["neck", "项链"], ["brace1", "手镯①"], ["brace2", "手镯②"], ["ring1", "戒指①"], ["ring2", "戒指②"]]
export const WAR_BONUS: Record<string, number[]> = { 基本剑术: [0.1, 0.2, 0.3], 攻杀剑术: [0.25, 0.4, 0.55], 刺杀剑术: [0.4, 0.6, 0.8], 半月弯刀: [0.5, 0.7, 0.9], 烈火剑法: [1.2, 1.8, 2.5] }
export const MAGE_ATK = ["火球术", "大火球", "地狱火", "疾光电影", "雷电术", "爆裂火焰", "地狱雷光", "冰咆哮", "火墙"]
export const JOBS: Job[] = [
  { key: "warrior", name: "战士", job: 0, main: "dc" },
  { key: "mage", name: "法师", job: 1, main: "mc" },
  { key: "taoist", name: "道士", job: 2, main: "sc" },
]
export const SAVE_KEY = "mir2-save-v1"
// 挂机遇到精英概率；水货/测试怪（数值错乱的数字后缀变体）直接移出普通池
export const ELITE_RATE = 0.01
// 暴击：全员锁定 20% 概率，命中时伤害翻倍
export const CRIT_RATE = 0.2
export const CRIT_MULT = 2
// 50级起遭遇倍数 m=1+(Lv-50)×0.25：后台仍打一只，结算经验×N、掉落独立掷N遍
export const MULTI_BASE_LEVEL = 50
export const MULTI_STEP = 0.25
// 经验补偿（只乘经验）：落后最高10%开，领先另外两人各10%关，可双开
export const COMP_COEF: Record<string, number> = { warrior: 1.5, mage: 2.8, taoist: 2.2 }
export const COMP_LAG = 0.10
export const COMP_LEAD = 1.1
export const JUNK = ["鸡1", "鹿1", "稻草人1", "白野猪1", "沃玛教主1", "邪恶钳虫1", "邪恶毒蛇1", "沃玛卫士1", "骷髅精灵1", "祖玛卫士00"]
// BOSS 挑战：三人 35 级可打紫装首领，橙装首领 36 级起解锁，每只每小时一次
export const CHALLENGE_MIN_LEVEL = 35
export const BOSS_COOLDOWN_MS = 3600000

// 倍速用金币逐档解锁，初始上限 ×1；1→40 约 60 分钟、买满约 3350 万（仿真值）
export const SPEED_TIERS = [1, 2, 3, 5, 8, 12, 20, 35, 60, 100, 160, 250, 380, 500]
export const SPEED_COST: Record<number, number> = { 2: 100, 3: 500, 5: 2000, 8: 8000, 12: 25000, 20: 80000, 35: 250000, 60: 700000, 100: 1200000, 160: 2500000, 250: 5000000, 380: 9000000, 500: 16000000 }

// 首领掉率加成：每次挑战前按所选档位扣金币，概率乘倍率（封顶 100%）
export const BOOST_TIERS = [1, 2, 3, 5, 10, 20, 50]
export const BOOST_COST: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 5: 40000, 10: 100000, 20: 250000, 50: 1000000 }
