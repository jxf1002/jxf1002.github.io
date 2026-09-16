// 传奇挂机 game.js 单元测试：node --test test/
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as G from '../js/game.js'

const data = (n) => JSON.parse(fs.readFileSync(new URL('../data/' + n, import.meta.url), 'utf-8'))
const realRandom = Math.random
const realFetch = globalThis.fetch
const mockRandom = (v) => { Math.random = () => v }

beforeEach(() => {
  G.setDB({ levels: data('levels.json'), items: data('items.json'), magics: data('magics.json'), monsters: data('monsters.json'), elites: data('elites.json'), bosses: data('bosses.json') })
  G.newWorld()
  for (const k of Object.keys(G.dropCache)) delete G.dropCache[k]
})
afterEach(() => {
  Math.random = realRandom
  globalThis.fetch = realFetch
})

const warrior = (level = 1) => { const c = G.newChar(G.JOBS[0]); c.level = level; return c }
const mage = (level = 1) => { const c = G.newChar(G.JOBS[1]); c.level = level; return c }
const taoist = (level = 1) => { const c = G.newChar(G.JOBS[2]); c.level = level; return c }

describe('setDB / newWorld', () => {
  it('普通池去重、剔水货/精英/首领并按 HP 排序', () => {
    const names = G.DB.monsters.map((m) => m.Name)
    assert.equal(names.length, new Set(names).size)
    assert.ok(G.DB.monsters.every((m, i, a) => i === 0 || a[i - 1].HP <= m.HP))
    assert.equal(G.DB.monsters.length, 140)
    for (const n of ['鸡1', '祖玛卫士00', '祖玛教主', '白野猪']) assert.ok(!names.includes(n))
    assert.ok(names.includes('鸡'))
    assert.equal(G.DB.elites.length, 16)
    assert.equal(G.DB.bosses.length, 17)
  })
  it('itemByName 取首个同名', () => {
    assert.equal(G.DB.itemByName['乌木剑'].StdMode, 5)
  })
  it('空输入不崩', () => {
    G.setDB({})
    assert.deepEqual(G.DB.monsters, [])
  })
  it('newWorld 初始化三职业', () => {
    assert.deepEqual(G.S.chars.map((c) => c.key), ['warrior', 'mage', 'taoist'])
    assert.equal(G.S.gold, 0)
  })
})

describe('skillLevel / magicByName / jobMagics', () => {
  it('按 NeedL1/L2/L3 分档', () => {
    const m = G.magicByName('雷电术') // 17/20/23
    assert.equal(G.skillLevel(null, 99), 0)
    assert.equal(G.skillLevel(m, 16), 0)
    assert.equal(G.skillLevel(m, 17), 1)
    assert.equal(G.skillLevel(m, 20), 2)
    assert.equal(G.skillLevel(m, 23), 3)
    assert.equal(G.skillLevel(m, 99), 3)
  })
  it('jobMagics 按职业过滤', () => {
    assert.ok(G.jobMagics(0).every((m) => m.Job === 0))
    assert.ok(G.jobMagics(1).some((m) => m.MagName === '雷电术'))
    assert.ok(G.jobMagics(2).some((m) => m.MagName === '灵魂火符'))
  })
})

describe('stats', () => {
  it('三职业 1 级基础不同', () => {
    assert.deepEqual(G.stats(warrior()).dc, [2, 4])
    assert.deepEqual(G.stats(mage()).mc, [2, 4])
    assert.deepEqual(G.stats(taoist()).sc, [2, 4])
  })
  it('等级成长：主属性上限每级 +1，下限每 2 级 +1', () => {
    assert.deepEqual(G.stats(warrior(5)).dc, [4, 8])
    assert.deepEqual(G.stats(mage(5)).mc, [4, 8])
  })
  it('装备求和，未知装备名跳过', () => {
    const c = warrior(10)
    c.equip = { weapon: '乌木剑', ring1: '不存在的装备' }
    assert.deepEqual(G.stats(c).dc, [10, 21]) // 基础[6,13]+乌木剑攻4-8
  })
})

describe('equipScore', () => {
  it('各职业只看主属性', () => {
    const w = warrior(20), f = mage(20), t = taoist(20)
    const haihun = G.DB.itemByName['海魂'] // 攻3-10 魔1-2
    const wumu = G.DB.itemByName['乌木剑'] // 攻4-8 魔0-1
    const xiuluo = G.DB.itemByName['修罗'] // 攻0-20
    assert.ok(G.equipScore(w, xiuluo) > G.equipScore(w, haihun)) // 战士只看攻击
    assert.ok(G.equipScore(w, haihun) > G.equipScore(w, wumu))
    assert.ok(G.equipScore(f, haihun) > G.equipScore(f, wumu)) // 法师只看魔法
    const fenghuang = G.DB.itemByName['凤凰明珠'] // 道1-2
    assert.ok(G.equipScore(t, fenghuang) > G.equipScore(t, G.DB.itemByName['传统项链']))
  })
})

describe('bestSkill 自动选最高伤害', () => {
  it('战士：1级普攻 / 7级基本剑术 / 35级烈火剑法', () => {
    assert.equal(G.bestSkill(warrior(1)).name, '普通攻击')
    assert.equal(G.bestSkill(warrior(7)).name, '基本剑术')
    assert.equal(G.bestSkill(warrior(35)).name, '烈火剑法')
  })
  it('法师：1级普攻 / 7级火球术 / 20级雷电术', () => {
    assert.equal(G.bestSkill(mage(1)).name, '普通攻击')
    assert.equal(G.bestSkill(mage(7)).name, '火球术')
    assert.equal(G.bestSkill(mage(20)).name, '雷电术')
  })
  it('道士：1级普攻 / 18级灵魂火符', () => {
    assert.equal(G.bestSkill(taoist(1)).name, '普通攻击')
    assert.equal(G.bestSkill(taoist(18)).name, '灵魂火符')
  })
  it('道士低级靠毒与宝宝也有加成', () => {
    const a = G.bestSkill(taoist(1)).avg
    const b = G.bestSkill(taoist(19)).avg // 施毒+骷髅
    assert.ok(b > a)
  })
})

describe('calcDamage', () => {
  it('战士伤害落在技能加成区间内', () => {
    mockRandom(0)
    const c = warrior(35)
    c.target = { Name: 'x', HP: 9999, MaxHP: 9999, AC: 0, MAC: 0 }
    const { dmg, skill } = G.calcDamage(c)
    assert.equal(skill, '烈火剑法')
    assert.equal(dmg, Math.round(19 * 2.2)) // dc下限19 × (1+1.2)，35级烈火刚学是Lv.1
  })
  it('护甲减伤且保底 1 点', () => {
    mockRandom(0.9999)
    const c = warrior(1)
    c.target = { Name: 'x', HP: 9999, MaxHP: 9999, AC: 9999, MAC: 0 }
    assert.equal(G.calcDamage(c).dmg, 1)
  })
  it('法术吃魔御不吃物防', () => {
    mockRandom(0.9999)
    const c = mage(20)
    c.target = { Name: 'x', HP: 9999, MaxHP: 9999, AC: 9999, MAC: 0 }
    const { dmg, skill } = G.calcDamage(c)
    assert.equal(skill, '雷电术')
    assert.ok(dmg > 30)
  })
  it('道士火符伤害含毒与宝宝加成', () => {
    mockRandom(0)
    const c = taoist(35) // 火符Lv3 + 毒Lv3 + 骷髅Lv3 + 神兽Lv1
    c.target = { Name: 'x', HP: 9999, MaxHP: 9999, AC: 0, MAC: 0 }
    const { dmg } = G.calcDamage(c)
    assert.ok(dmg >= 15 + 2 + 6 + 12 + 15)
  })
  it('无技能时用主属性平砍', () => {
    mockRandom(0)
    const c = mage(1)
    c.target = { Name: 'x', HP: 9999, MaxHP: 9999, AC: 0, MAC: 0 }
    assert.equal(G.calcDamage(c).dmg, 2)
  })
})

describe('log 上限 40 条', () => {
  it('超限丢弃最旧', () => {
    const c = warrior()
    for (let i = 0; i < 50; i++) G.log(c, 'm' + i)
    assert.equal(c.logs.length, 40)
    assert.equal(c.logs[0], 'm10')
  })
})

describe('pickMonster 按等级匹配', () => {
  it('1 级只打最弱的怪', () => {
    mockRandom(0)
    const { mon, kind } = G.pickMonster(warrior(1))
    assert.equal(kind, 'normal')
    assert.ok(['蝙蝠', '鸡'].includes(mon.Name))
  })
  it('高级打更强的怪', () => {
    mockRandom(0)
    const weak = G.pickMonster(warrior(1)).mon.HP
    const strong = G.pickMonster(warrior(50)).mon.HP
    assert.ok(strong > weak)
  })
  it('全都打不动时退回原池', () => {
    G.setDB({ levels: [], items: [], magics: [], monsters: [{ Name: '巨兽', HP: 100000, Lvl: 1, AC: 0, MAC: 0, Exp: 1 }] })
    mockRandom(0)
    assert.equal(G.pickMonster(warrior(1)).mon.Name, '巨兽')
  })
  it('1 级杀不动精英则回落，6 级就能撞上幻影蜘蛛', () => {
    mockRandom(0)
    assert.equal(G.pickElite(warrior(1)), null)
    assert.equal(G.pickElite(warrior(6)).Name, '幻影蜘蛛')
  })
  it('高级 1% 概率遇到精英并计入精英击杀', () => {
    const seq = [0.005, 0] // 首次掷骰命中精英，再选怪
    Math.random = () => seq.shift() ?? 0
    const c = warrior(50)
    G.attack(c) // 遭遇
    assert.equal(c.target.kind, 'elite')
    assert.ok(c.logs[0].includes('精英'))
    c.target.HP = 1
    G.setDrops(c.target.Name, [])
    G.attack(c) // 击杀
    assert.equal(c.killsElite, 1)
    assert.equal(c.killsNormal, 0)
  })
})

describe('loadDrops', () => {
  it('一次性载入全部掉落表', () => {
    G.loadDrops({ 鸡: ['10/10 金币 300', '10/200 乌木剑'], 无怪: [] })
    assert.deepEqual(G.dropCache['鸡'], ['10/10 金币 300', '10/200 乌木剑'])
    assert.deepEqual(G.dropCache['无怪'], [])
    G.loadDrops({}) // 空输入不崩
  })
})

describe('tryEquip 自动换装', () => {
  it('未知物品与非装备跳过', () => {
    const c = warrior(10)
    G.tryEquip(c, '不存在')
    G.tryEquip(c, '金创药(小量)') // StdMode 0
    assert.deepEqual(c.equip, {})
  })
  it('等级不够不穿', () => {
    const c = warrior(1)
    G.tryEquip(c, '井中月')
    assert.deepEqual(c.equip, {})
  })
  it('穿更好的，同槽不降级', () => {
    const c = warrior(15)
    G.S.bag = { 海魂: 1, 乌木剑: 1 }
    G.tryEquip(c, '海魂', true)
    G.tryEquip(c, '乌木剑', true) // 战士穿乌木剑不如海魂，不降级
    assert.equal(c.equip.weapon, '海魂')
  })
  it('双槽替换较差的一侧', () => {
    const c = warrior(10)
    G.S.bag = { 古铜戒指: 1, 牛角戒指: 1 }
    G.tryEquip(c, '古铜戒指', true)
    G.tryEquip(c, '牛角戒指', true) // 牛角(攻0-1+魔御0-1) > 古铜(攻0-1)，进空槽
    assert.ok(Object.values(c.equip).includes('古铜戒指'))
    const vals = [c.equip.ring1, c.equip.ring2].filter(Boolean)
    assert.equal(vals.length, 2)
  })
  it('换装默认写日志，silent 不写', () => {
    const c = warrior(10)
    G.S.bag = { 乌木剑: 1 }
    G.tryEquip(c, '乌木剑')
    assert.ok(c.logs.some((l) => l.includes('装备了【乌木剑】')))
    const n = c.logs.length
    G.tryEquip(c, '乌木剑', true)
    assert.equal(c.logs.length, n)
  })
  it('穿不上提示一次，升级后自动穿上', () => {
    const c = warrior(10)
    c.equip = { weapon: '乌木剑' }
    G.S.bag = { 海魂: 1 } // 需15级，战士穿更强
    G.tryEquip(c, '海魂')
    assert.equal(c.equip.weapon, '乌木剑')
    assert.ok(c.logs.some((l) => l.includes('还穿不上【海魂】')))
    const n = c.logs.length
    G.tryEquip(c, '海魂')
    assert.equal(c.logs.length, n) // 不重复提示
    c.level = 15
    G.recheckEquips(c)
    assert.equal(c.equip.weapon, '海魂')
  })
  it('recheckEquips 静默穿背包最优', () => {
    const c = mage(15)
    G.S.bag = { 乌木剑: 5, 海魂: 2 }
    G.recheckEquips(c)
    assert.equal(c.equip.weapon, '海魂')
    assert.equal(c.logs.length, 0)
  })
  it('数量不够不重复穿：1 枚戒指只占一个槽，2 枚才占满', () => {
    const c = warrior(30)
    G.S.bag = { 珊瑚戒指: 1 }
    G.recheckEquips(c)
    assert.deepEqual([c.equip.ring1, c.equip.ring2].filter(Boolean), ['珊瑚戒指'])
    c.equip = {}
    G.S.bag = { 珊瑚戒指: 2 }
    G.recheckEquips(c)
    assert.equal([c.equip.ring1, c.equip.ring2].filter((v) => v === '珊瑚戒指').length, 2)
  })
  it('全队共享数量：1 枚戒指只能被一个角色穿', () => {
    for (const c of G.S.chars) c.level = 30
    G.S.bag = { 珊瑚戒指: 1 }
    for (const c of G.S.chars) G.recheckEquips(c)
    const worn = G.S.chars.flatMap((c) => [c.equip.ring1, c.equip.ring2]).filter((n) => n === '珊瑚戒指')
    assert.equal(worn.length, 1)
  })
  it('rebalanceEquips 按背包数量重分配：1 枚只占一槽，2 枚占满，优先级给收益最高的角色', () => {
    const w = G.S.chars.find((c) => c.key === 'warrior')
    const t = G.S.chars.find((c) => c.key === 'taoist')
    w.level = 40
    t.level = 40
    G.S.bag = { 珊瑚戒指: 1, 凤凰明珠: 1 } // 项链道士收益(道1-2)高于战士
    G.rebalanceEquips()
    assert.equal([w.equip.ring1, w.equip.ring2].filter((v) => v === '珊瑚戒指').length, 1)
    assert.equal(t.equip.neck, '凤凰明珠')
    G.S.bag = { 珊瑚戒指: 2 }
    G.rebalanceEquips()
    assert.equal([w.equip.ring1, w.equip.ring2].filter((v) => v === '珊瑚戒指').length, 2)
  })
})

describe('gainExp 升级', () => {
  it('经验不足不升级', () => {
    const c = warrior()
    G.gainExp(c, 79) // 1级需80
    assert.equal(c.level, 1)
    assert.equal(c.exp, 79)
  })
  it('连升多级并写日志', () => {
    const c = warrior()
    G.gainExp(c, 80 + 160)
    assert.equal(c.level, 3)
    assert.equal(c.exp, 0)
    assert.ok(c.logs.some((l) => l.includes('Lv.3')))
  })
  it('满级（无下一级）只累积', () => {
    const c = warrior(100)
    G.gainExp(c, 999)
    assert.equal(c.level, 100)
  })
  it('升级时回扫背包穿上新装备', () => {
    const c = warrior(9)
    G.S.bag = { '青铜头盔': 1 } // 需10级
    G.gainExp(c, 100000)
    assert.ok(c.level >= 10)
    assert.equal(c.equip.helm, '青铜头盔')
  })
  it('升级到够级后穿上背包里最好的（多件候选取最优），并写日志', () => {
    const c = warrior(9)
    G.S.bag = { 乌木剑: 1, 海魂: 1, 裁决之杖: 1 } // 海魂需15、裁决需30
    G.gainExp(c, 100000)
    assert.ok(c.level >= 15)
    assert.equal(c.equip.weapon, '海魂')
    assert.ok(c.logs.some((l) => l.includes('装备了【海魂】')))
  })
})

describe('rollDrops 掉落判定', () => {
  it('10/10 必掉：金币累加、物品进包并自动换装', () => {
    mockRandom(0)
    const c = G.S.chars[0]
    c.level = 10
    G.setDrops('稻草人', ['10/10 金币 300', '10/10 乌木剑'])
    G.rollDrops(c, { Name: '稻草人' })
    assert.equal(G.S.gold, 300)
    assert.equal(G.S.bag['乌木剑'], 1)
    assert.equal(c.equip.weapon, '乌木剑')
    assert.ok(c.logs.some((l) => l.includes('300金币')))
  })
  it('共享背包：其他角色也会自动换上掉落装备', () => {
    mockRandom(0)
    const w = G.S.chars.find((c) => c.key === 'warrior')
    w.level = 45
    w.equip = { clothes: '重盔甲(男)' }
    G.setDrops('怪', ['10/10 天魔神甲'])
    G.rollDrops(G.S.chars.find((c) => c.key === 'mage'), { Name: '怪' })
    assert.equal(w.equip.clothes, '天魔神甲')
    assert.ok(w.logs.some((l) => l.includes('装备了【天魔神甲】')))
  })
  it('概率不够不掉', () => {
    mockRandom(0.5)
    const c = warrior()
    G.setDrops('蝙蝠', ['10/200 金币 300', '格式错误行', '10/10'])
    G.rollDrops(c, { Name: '蝙蝠' })
    assert.equal(G.S.gold, 0)
    assert.deepEqual(G.S.bag, {})
  })
  it('金币无数量默认 1', () => {
    mockRandom(0)
    const c = warrior()
    G.setDrops('怪', ['10/10 金币'])
    G.rollDrops(c, { Name: '怪' })
    assert.equal(G.S.gold, 1)
  })
  it('掉落表里查无此物的名字（罗刹等）不进包，避免永远穿不上的装备堆积', () => {
    mockRandom(0)
    const c = warrior(45)
    G.setDrops('怪', ['10/10 罗刹', '10/10 乌木剑'])
    G.rollDrops(c, { Name: '怪' })
    assert.deepEqual(G.S.bag, { 乌木剑: 1 })
  })
  it('无掉落表不崩', () => {
    G.rollDrops(warrior(), { Name: '从没见过的怪' })
    assert.equal(G.S.gold, 0)
  })
})

describe('attack 战斗循环', () => {
  it('无目标时遭遇怪物', () => {
    mockRandom(0)
    const c = warrior()
    G.attack(c)
    assert.ok(c.target)
    assert.ok(c.logs[0].includes('遭遇到了'))
  })
  it('1x 速度记录每次伤害', () => {
    mockRandom(0)
    const c = warrior()
    G.S.speed = 1
    c.target = { Name: '木桩', HP: 9999, MaxHP: 9999, AC: 0, MAC: 0, Exp: 1 }
    G.attack(c)
    assert.ok(c.logs.some((l) => l.includes('造成')))
  })
  it('高速时只记击杀不记伤害', () => {
    mockRandom(0)
    const c = warrior()
    G.S.speed = 100
    c.target = { Name: '木桩', HP: 1, MaxHP: 1, AC: 0, MAC: 0, Exp: 5 }
    G.setDrops('木桩', [])
    G.attack(c)
    assert.equal(c.killsNormal, 1)
    assert.equal(c.target, null)
    assert.ok(!c.logs.some((l) => l.includes('造成')))
    assert.ok(c.logs.some((l) => l.includes('击杀了')))
  })
})

describe('loadChars 存档迁移', () => {
  it('老存档 kills 并入 killsNormal', () => {
    G.loadChars([{ key: 'warrior', level: 10, exp: 5, kills: 7, equip: {} }])
    const c = G.S.chars[0]
    assert.equal(c.killsNormal, 7)
    assert.equal(c.killsElite, 0)
    assert.equal(G.S.chars[1].level, 1)
  })
  it('新存档完整恢复', () => {
    G.loadChars([{ key: 'mage', level: 20, exp: 1, killsNormal: 3, killsElite: 2, killsBoss: 1, equip: {} }])
    const c = G.S.chars.find((x) => x.key === 'mage')
    assert.deepEqual([c.level, c.killsNormal, c.killsElite, c.killsBoss], [20, 3, 2, 1])
  })
})

describe('首领挑战', () => {
  const lv40 = () => { for (const c of G.S.chars) c.level = 40 }
  it('未满 35 级拒绝', () => {
    assert.deepEqual(G.startChallenge('祖玛教主'), { ok: false, reason: 'level' })
    assert.equal(G.canChallenge(), false)
  })
  it('从 35 级起每级解锁 2 只，等级不够锁定', () => {
    assert.equal(G.bossUnlockLevel(0), 35)
    assert.equal(G.bossUnlockLevel(1), 35)
    assert.equal(G.bossUnlockLevel(2), 36)
    assert.equal(G.bossUnlockLevel(4), 37)
    for (const c of G.S.chars) c.level = 35
    assert.equal(G.minCharLevel(), 35)
    assert.deepEqual(G.startChallenge(G.DB.bosses[2].Name), { ok: false, reason: 'locked', level: 36 })
  })
  it('不存在的首领', () => {
    lv40()
    assert.deepEqual(G.startChallenge('没这个怪'), { ok: false, reason: 'missing' })
  })
  it('冷却中拒绝（冷却为游戏内剩余毫秒）', () => {
    lv40()
    G.S.bossCd['祖玛教主'] = 1000
    assert.deepEqual(G.startChallenge('祖玛教主'), { ok: false, reason: 'cooldown' })
    assert.equal(G.bossCooldownLeft('祖玛教主'), 1000)
    assert.equal(G.bossCooldownLeft('牛魔王'), 0)
  })
  it('冷却随倍速流逝', () => {
    G.S.bossCd['祖玛教主'] = 1000
    G.advanceCooldowns(400)
    assert.equal(G.bossCooldownLeft('祖玛教主'), 600)
    G.advanceCooldowns(999999)
    assert.equal(G.bossCooldownLeft('祖玛教主'), 0)
  })
  it('挑战中不能再开', () => {
    lv40()
    assert.ok(G.startChallenge('祖玛教主').ok)
    assert.deepEqual(G.startChallenge('牛魔王'), { ok: false, reason: 'busy' })
  })
  it('三人集火击杀：经验共享、掉落一次、冷却、首领+1', () => {
    mockRandom(0)
    lv40()
    G.setDrops('祖玛教主', ['10/10 金币 1000', '10/10 力量戒指'])
    assert.ok(G.startChallenge('祖玛教主').ok)
    assert.ok(G.S.chars.every((c) => c.target && c.target.kind === 'boss'))
    let guard = 0
    while (!G.S.challenge.done && guard++ < 5000) G.challengeTick()
    assert.ok(G.S.challenge.done)
    const r = G.S.challenge.result
    assert.equal(r.gold, 1000)
    assert.deepEqual(r.items, ['力量戒指'])
    assert.equal(G.S.bag['力量戒指'], 1) // 只掉一次
    assert.ok(G.S.chars.every((c) => c.killsBoss === 1 && c.target === null))
    assert.equal(G.bossCooldownLeft('祖玛教主'), G.BOSS_COOLDOWN_MS)
    assert.ok(G.S.challenge.logs.some((l) => l.includes('1000金币')))
  })
  it('每行独立判定：重复行累加、行末数字为数量', () => {
    mockRandom(0) // 全部命中
    G.setDrops('测试怪', ['10/10 强效太阳水', '10/10 强效太阳水', '10/10 强效魔法药 3', '10/10 金币 1000'])
    const r = G.rollDropLines('测试怪')
    assert.deepEqual(r.items, ['强效太阳水', '强效魔法药'])
    assert.equal(r.counts['强效太阳水'], 2)
    assert.equal(r.counts['强效魔法药'], 3)
    assert.equal(r.gold, 1000)
  })
  it('未命中的行不产出', () => {
    mockRandom(0.5)
    G.setDrops('测试怪', ['10/1000000 强效太阳水'])
    const r = G.rollDropLines('测试怪')
    assert.deepEqual(r.items, [])
    assert.equal(r.gold, 0)
  })
  it('胜利后换装并记录（道士拿凤凰明珠）', () => {
    mockRandom(0)
    lv40()
    G.S.bag = {}
    const t = G.S.chars.find((c) => c.key === 'taoist')
    G.setDrops('沃玛教主', ['10/10 凤凰明珠'])
    G.startChallenge('沃玛教主')
    let guard = 0
    while (!G.S.challenge.done && guard++ < 5000) G.challengeTick()
    assert.equal(t.equip.neck, '凤凰明珠')
  })
  it('打完一只后可以接着挑另一只（冷却各自独立）', () => {
    mockRandom(0)
    lv40()
    G.setDrops('祖玛教主', ['10/10 力量戒指'])
    G.setDrops('牛魔王', ['10/10 力量戒指'])
    G.startChallenge('祖玛教主')
    let guard = 0
    while (!G.S.challenge.done && guard++ < 5000) G.challengeTick()
    assert.ok(G.bossCooldownLeft('祖玛教主') > 0)
    assert.equal(G.bossCooldownLeft('牛魔王'), 0) // 冷却互不影响
    const r2 = G.startChallenge('牛魔王')
    assert.ok(r2.ok)
    assert.equal(G.S.challenge.name, '牛魔王')
  })
  it('closeChallenge 清场回挂机', () => {
    lv40()
    G.startChallenge('牛魔王')
    G.closeChallenge()
    assert.equal(G.S.challenge, null)
    assert.ok(G.S.chars.every((c) => c.target === null))
  })
})

describe('金币买倍速', () => {
  it('初始上限 ×1，逐档解锁且钱不够不给买', () => {
    assert.equal(G.S.speedMax, 1)
    assert.deepEqual(G.nextSpeed(), { tier: 2, cost: 100 })
    G.S.gold = 99
    assert.equal(G.buySpeed().ok, false)
    G.S.gold = 100
    assert.deepEqual(G.buySpeed(), { ok: true, tier: 2, cost: 100 })
    assert.equal(G.S.speedMax, 2)
    assert.equal(G.S.speed, 2)
    assert.equal(G.S.gold, 0)
  })
  it('买满后 nextSpeed 为 null', () => {
    G.S.speedMax = 500
    assert.equal(G.nextSpeed(), null)
    assert.deepEqual(G.buySpeed(), { ok: false, reason: 'max' })
  })
  it('买满总价约 3350~3500 万', () => {
    const total = Object.values(G.SPEED_COST).reduce((a, b) => a + b, 0)
    assert.ok(total > 30000000 && total < 40000000, '总价 ' + total)
  })
})

describe('首领掉率加成', () => {
  it('所选档位金币不足则提示，不降档', () => {
    assert.deepEqual(G.boostCheck(5, 0), { ok: false, boost: 5, cost: 40000 })
    assert.deepEqual(G.boostCheck(20, 249999), { ok: false, boost: 20, cost: 250000 })
    assert.deepEqual(G.boostCheck(5, 40000), { ok: true, boost: 5 })
    assert.deepEqual(G.boostCheck(1, 0), { ok: true, boost: 1 })
  })
  it('金币不足时挑战被拒绝且不扣钱', () => {
    for (const c of G.S.chars) c.level = 40
    G.S.boost = 20
    G.S.gold = 100000
    const r = G.startChallenge(G.DB.bosses[4].Name)
    assert.deepEqual(r, { ok: false, reason: 'gold', boost: 20, cost: 250000 })
    assert.equal(G.S.challenge, null)
    assert.equal(G.S.gold, 100000)
  })
  it('加成放大每行概率且封顶 100%', () => {
    mockRandom(0.5)
    G.setDrops('测试怪', ['10/100 乌木剑'])
    assert.deepEqual(G.rollDropLines('测试怪').items, [])
    assert.deepEqual(G.rollDropLines('测试怪', 20).items, ['乌木剑'])
  })
  it('挑战时按所选档位扣金币并记录倍率', () => {
    for (const c of G.S.chars) c.level = 40
    G.S.boost = 5
    G.S.gold = 100000
    const r = G.startChallenge(G.DB.bosses[4].Name)
    assert.ok(r.ok)
    assert.equal(r.boost, 5)
    assert.equal(G.S.challenge.boost, 5)
    assert.equal(G.S.gold, 60000)
  })
})

describe('itemQuality 装备品质', () => {
  it('每职业每部位最强为橙，凑齐全套即全橙', () => {
    // 每个职业、每个部位至少有一件橙
    for (const job of G.JOBS) {
      for (const slot of new Set(Object.values(G.SLOT_OF))) {
        const best = Math.max(...Object.values(G.DB.itemByName).filter((it) => G.SLOT_OF[it.StdMode] === slot).map((it) => G.equipScore({ key: job.key }, it)))
        const orangeBest = Object.values(G.DB.itemByName).some((it) => G.SLOT_OF[it.StdMode] === slot && G.equipScore({ key: job.key }, it) === best && G.itemQuality(it) === 4)
        assert.ok(orangeBest, job.name + ' 的 ' + slot + ' 最强应为橙色')
      }
    }
    assert.equal(G.itemQuality(G.DB.itemByName['裁决之杖']), 4)
    assert.equal(G.itemQuality(G.DB.itemByName['法神项链']), 4)
    assert.equal(G.itemQuality(G.DB.itemByName['龙纹剑']), 4)
    const oranges = Object.values(G.DB.itemByName).filter((it) => G.itemQuality(it) === 4)
    assert.equal(oranges.length, 21)
  })
  it('低级白板与等级保底', () => {
    assert.equal(G.itemQuality(G.DB.itemByName['乌木剑']), 0)
    assert.equal(G.itemQuality(G.DB.itemByName['力量戒指']), 3) // need46 保底紫，但战士戒指最强是圣战戒指
    assert.equal(G.itemQuality(null), 0)
    assert.equal(G.itemQuality(G.DB.itemByName['金创药(小量)']), 0)
  })
})

describe('杂项', () => {
  it('addBag 累加', () => {
    G.addBag('鸡肉', 1)
    G.addBag('鸡肉', 2)
    assert.equal(G.S.bag['鸡肉'], 3)
  })
  it('fmtRange / itemTip', () => {
    assert.equal(G.fmtRange([3, 10]), '3-10')
    assert.ok(G.itemTip('乌木剑').includes('乌木剑'))
    assert.equal(G.itemTip('不存在'), '不存在')
  })
  it('rand 家族边界', () => {
    mockRandom(0)
    assert.equal(G.randi(2, 4), 2)
    assert.equal(G.pick(['a', 'b']), 'a')
    mockRandom(0.9999)
    assert.equal(G.randi(2, 4), 4)
    assert.equal(G.pick(['a', 'b']), 'b')
  })
})
