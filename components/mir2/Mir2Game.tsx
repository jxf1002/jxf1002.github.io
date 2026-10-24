"use client"

import type { MouseEvent, ReactNode } from "react"
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import * as Game from "../../lib/mir2/game"
import { BOOST_TIERS, DB, S } from "../../lib/mir2/game"
import { fmtCdShort, fmtDropTime, fmtGold, fmtNum } from "../../lib/mir2/format"
import { startLoop, stopLoop } from "../../lib/mir2/loop"
import { clearSave, importText, save, saveText } from "../../lib/mir2/storage"
import {
  QNAME,
  bagRows,
  boostIndex,
  boostLabel,
  boostMaxIdx,
  bossState,
  bossTip,
  formatLog,
  mobClass,
  sellSummary,
  skillRows,
  tipText,
} from "../../lib/mir2/view"
import { loadWorld } from "../../lib/mir2/world"
import CharColumn from "./CharColumn"

type ModalKind = "help" | "skills" | "gate" | "boss-list" | "battle" | "victory" | "drops" | "sell" | "export" | "import" | "reset"
type Modal = { kind: ModalKind; key?: string }

// 打开首领相关弹窗时暂停挂机（旧 app.js 的 bossOpen）
function isBossModal(m: Modal | null) {
  return !!m && (m.kind === "gate" || m.kind === "boss-list" || m.kind === "battle" || m.kind === "victory")
}

type Tip = { x: number; y: number; name: string; q: number; text?: string; html?: string }

const HELP = [
  "你有战士、法师、道士三人小队，每人每秒自动砍怪一次，不用操作",
  "杀怪得经验升级、掉金币和装备；打不过的怪会自动换弱的打，越高级怪越好",
  "装备自动穿属性最好的（战士看攻击、法师看魔法、道士看道术），背包三人共用、只记数量不消耗",
  "技能到等级自动学会，战斗中自动用伤害最高的那个打",
  "挂机有 1% 概率遇到精英怪，掉落更好",
  "三人 35 级后可组队挑战首领，每只首领每小时能打一次，胜利掉落多多",
  "进度每 5 秒自动保存，可导出备份；速度条最高 100 倍",
]

export default function Mir2Game() {
  const [, force] = useReducer((n: number) => n + 1, 0)
  const [modal, setModal] = useState<Modal | null>(null)
  const [bagFilter, setBagFilter] = useState("")
  const [bagQuality, setBagQuality] = useState<number | null>(null)
  const [sellQs, setSellQs] = useState<Set<number>>(new Set([4, 3, 2, 1, 0]))
  const [boostTip, setBoostTip] = useState("")
  const [copyTip, setCopyTip] = useState("")
  const [tip, setTip] = useState<Tip | null>(null)

  const modalRef = useRef<Modal | null>(null)
  const pausedRef = useRef(false)
  const resettingRef = useRef(false)
  const ioRef = useRef<HTMLTextAreaElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const boostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  modalRef.current = modal
  pausedRef.current = isBossModal(modal)

  // ===== 引擎 → React 桥：引擎照旧命令式跑，只通过 setUI 喊更新 =====
  useEffect(() => {
    let alive = true
    Game.setUI({
      update: () => force(),
      bossDone: () => {
        if (modalRef.current?.kind === "battle") setModal({ kind: "victory" })
      },
    })
    void (async () => {
      try {
        await loadWorld()
      } catch {
        Game.newWorld()
      }
      if (!alive) return
      force()
      if (DB.monsters.length) startLoop(() => pausedRef.current)
    })()
    return () => {
      alive = false
      stopLoop()
      Game.setUI(null)
    }
  }, [])

  // 关页面时补一次存档（重置时跳过，否则删了也白删）
  useEffect(() => {
    const onUnload = () => {
      if (!resettingRef.current && DB.monsters.length) save()
    }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [])

  // 悬停提示跟随鼠标：位置按提示框实际尺寸翻边
  useLayoutEffect(() => {
    const el = tipRef.current
    if (!tip || !el) return
    const pad = 12
    const r = el.getBoundingClientRect()
    let x = tip.x + 16
    let y = tip.y + 16
    if (x + r.width > window.innerWidth - pad) x = tip.x - r.width - 12
    if (y + r.height > window.innerHeight - pad) y = tip.y - r.height - 12
    el.style.left = Math.max(pad, x) + "px"
    el.style.top = Math.max(pad, y) + "px"
  }, [tip])

  const showBoostTip = (msg: string) => {
    setBoostTip(msg)
    if (boostTimer.current) clearTimeout(boostTimer.current)
    boostTimer.current = setTimeout(() => setBoostTip(""), 3000)
  }
  useEffect(() => () => {
    if (boostTimer.current) clearTimeout(boostTimer.current)
  }, [])

  const tipOn = !!tip
  useEffect(() => {
    if (!tipOn) return
    const hide = () => setTip(null)
    document.addEventListener("scroll", hide, true)
    return () => document.removeEventListener("scroll", hide, true)
  }, [tipOn])

  const onTip = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.("[data-tip]") as HTMLElement | null
    if (!el) {
      setTip(null)
      return
    }
    const name = el.dataset.name || ""
    if (el.dataset.boss) {
      const bt = bossTip(name)
      setTip((t) => (t && t.name === name && t.html === bt.html ? { ...t, x: e.clientX, y: e.clientY } : { x: e.clientX, y: e.clientY, name, q: bt.topQ, html: bt.html }))
      return
    }
    const text = el.dataset.tip || ""
    setTip((t) => (t && t.name === name && t.text === text ? { ...t, x: e.clientX, y: e.clientY } : { x: e.clientX, y: e.clientY, name, q: Number(el.dataset.q || 0), text }))
  }

  const closeModal = () => {
    if (isBossModal(modalRef.current)) Game.closeChallenge()
    setCopyTip("")
    setBoostTip("")
    setModal(null)
  }

  const openBossList = () => {
    const max = boostMaxIdx()
    if (BOOST_TIERS.indexOf(S.boost) > max) S.boost = BOOST_TIERS[max]
    setBoostTip("")
    setModal({ kind: "boss-list" })
  }

  const tryFight = (name: string) => {
    const r = Game.startChallenge(name)
    if (!r.ok) {
      if (r.reason === "level") setModal({ kind: "gate" })
      else if (r.reason === "gold") showBoostTip("金币不足，无法使用 ×" + r.boost + " 加成（需 " + fmtGold(r.cost) + "）")
      else if (r.reason === "locked" && r.boost) showBoostTip("×" + r.boost + " 加成需三人 " + r.level + " 级")
      else openBossList()
      return
    }
    setModal({ kind: "battle" })
  }

  const openBoss = () => {
    if (!Game.canChallenge()) setModal({ kind: "gate" })
    else openBossList()
  }

  const sellOne = () => {
    Game.sellBag([...sellQs])
    force()
    closeModal()
  }

  const doExport = () => {
    save()
    setCopyTip("")
    setModal({ kind: "export" })
  }

  const copySave = () => {
    const el = ioRef.current
    const done = () => setCopyTip("已复制，去粘贴备份吧")
    const manual = () => {
      el?.select()
      try {
        document.execCommand("copy")
        done()
      } catch {
        setCopyTip("复制失败，请手动长按复制")
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el?.value || "").then(done, manual)
    else manual()
  }

  const doImport = () => {
    if (importText(ioRef.current?.value || "")) location.reload()
    else alert("导入失败：文本无效")
  }

  const doReset = () => {
    resettingRef.current = true
    clearSave()
    location.reload()
  }

  // ===== 弹窗内容 =====
  let title = ""
  let box = ""
  let body: ReactNode = null

  if (modal) {
    if (modal.kind === "help") {
      title = "玩法说明"
      body = <ol className="help-list">{HELP.map((t) => <li key={t}>{t}</li>)}</ol>
    } else if (modal.kind === "skills") {
      const c = S.chars.find((x) => x.key === modal.key)
      title = (c ? c.name : "") + "的技能（数字为解锁等级）"
      const rows = c ? skillRows(c) : []
      body = (
        <>
          <div className="skill-grid head">
            <span>技能</span><span>当前</span><span className="q1">Lv1</span><span className="q2">Lv2</span><span className="q3">Lv3</span>
          </div>
          {rows.map((r) => (
            <div className="skill-grid" key={r.name}>
              <span className="sk-name">{r.name}</span>
              <span className={"sk-cur " + (r.lv ? "q" + r.lv : "")}>{r.lv ? "Lv." + r.lv : "-"}</span>
              {r.need.map((n, i) => (
                <span className={c && c.level >= n ? "q" + (i + 1) : undefined} key={i}>{n}</span>
              ))}
            </div>
          ))}
          {!rows.length ? <div>暂无技能</div> : null}
        </>
      )
    } else if (modal.kind === "gate") {
      title = "挑战首领"
      body = (
        <>
          <div className="boss-hint">⚠️ 打开本页暂停挂机，关闭恢复</div>
          <div>三名角色都要达到 <b>35 级</b>才能组队挑战首领。</div>
          <div className="gate-now">
            当前：{S.chars.map((c, i) => (
              <span key={c.key}>{i ? "　" : null}{c.name} <b>Lv.{c.level}</b></span>
            ))}
          </div>
        </>
      )
    } else if (modal.kind === "boss-list") {
      title = "挑战首领"
      box = " list-box"
      const max = boostMaxIdx()
      const cur = boostIndex()
      const next = BOOST_TIERS[max + 1]
      body = (
        <>
          <div className="boss-hint">⚠️ 打开本页暂停挂机，关闭恢复</div>
          <div className="boost-bar">
            <span className="boost-label">掉率加成</span>
            <input
              id="boost"
              type="range"
              min={0}
              max={max}
              step={1}
              value={cur}
              onChange={(e) => {
                S.boost = BOOST_TIERS[Number(e.target.value)]
                setBoostTip("")
                force()
              }}
            />
            <b id="boost-val">{boostLabel(BOOST_TIERS[cur])}</b>
          </div>
          {next ? <div className="boost-next">下一档 ×{next}（Lv.{Game.boostUnlockLevel(next)}解锁）</div> : null}
          <span className="boost-tip" id="boost-tip">{boostTip}</span>
          <div className="boss-list">
            {DB.bosses.length ? DB.bosses.map((b) => {
              const st = bossState(b.Name)
              const bt = bossTip(b.Name)
              const hasTip = bt.html.length > 0
              return (
                <div className="boss-row" key={b.Name}>
                  <div className="boss-info">
                    <b
                      className={"q" + bt.topQ}
                      data-tip={hasTip ? "" : undefined}
                      data-boss={hasTip ? b.Name : undefined}
                      data-q={hasTip ? bt.topQ : undefined}
                      data-name={hasTip ? b.Name : undefined}
                    >
                      {b.Name}
                    </b>
                    <span className="boss-lv">Lv.{b.Lvl}</span><span className="boss-hp">血 {b.HP}</span>
                  </div>
                  <div className="boss-action" data-action={b.Name} data-state={st.state}>
                    {st.state === "locked" ? (
                      <button type="button" className="btn" disabled>Lv.{st.unlock} 解锁</button>
                    ) : st.state === "cd" ? (
                      <button type="button" className="btn boss-cd-btn" disabled>冷却 {fmtCdShort(st.left)}</button>
                    ) : (
                      <button type="button" className="btn" data-fight={b.Name} onClick={() => tryFight(b.Name)}>挑战</button>
                    )}
                  </div>
                </div>
              )
            }) : <div className="bag-empty">暂无首领</div>}
          </div>
        </>
      )
    } else if (modal.kind === "battle") {
      const ch = S.challenge
      if (ch) {
        title = "讨伐 " + ch.name + (ch.boost > 1 ? "（掉率 ×" + ch.boost + "）" : "")
        body = (
          <>
            <div id="boss-hp-text">{ch.name}（{Math.max(0, ch.hp)} / {ch.maxHp}）</div>
            <div className="mir2-bar">
              <i id="boss-hpbar" style={{ width: Math.max(0, (ch.hp / ch.maxHp) * 100) + "%" }} />
            </div>
            <div className="mir2-log" id="boss-log">
              {ch.logs.slice().reverse().map((l, i) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: formatLog(l) }} />
              ))}
            </div>
          </>
        )
      }
    } else if (modal.kind === "victory") {
      const ch = S.challenge
      const r = ch?.result
      if (ch && r) {
        box = " win-box"
        title = "击败首领 " + r.name + "！"
        // 从好到差：品质降序，同品质按使用等级降序
        const names = r.items.slice().sort((a, b) => {
          const ia = DB.itemByName[a]
          const ib = DB.itemByName[b]
          return (Game.itemQuality(ib) - Game.itemQuality(ia)) || (((ib && ib.NeedLevel) || 0) - ((ia && ia.NeedLevel) || 0))
        })
        body = (
          <>
            <div className="win-summary">
              <div className="win-stat"><span>每人经验</span><b>+{r.exp}</b></div>
              <div className="win-stat win-gold"><span>金币</span><b>+{r.gold}</b></div>
            </div>
            <div className="win-section-title">掉落物品</div>
            <div className="win-drops">
              {names.length ? names.map((n) => {
                const q = Game.itemQuality(DB.itemByName[n])
                const cnt = (r.counts && r.counts[n]) || 1
                return <div className={"drop-row q" + q} key={n}><span>{n}</span><b>× {cnt}</b></div>
              }) : <div className="drop-empty">（本次没有物品掉落）</div>}
            </div>
            <div className="modal-btns">
              <button type="button" className="btn" id="btn-next-boss" onClick={openBossList}>继续挑战下一个</button>
            </div>
          </>
        )
      }
    } else if (modal.kind === "drops") {
      title = "掉落查询"
      body = (
        <>
          <div className="boss-hint">仅支持本次登录橙色装备掉落查询</div>
          {S.dropInfo.length ? (
            <div className="drop-list">
              <table className="sell-table">
                <tbody>
                  <tr><th>装备</th><th>击杀</th><th>掉落怪物</th><th>时间</th></tr>
                  {S.dropInfo.map((d, i) => (
                    <tr key={i}>
                      <td className="q4" data-tip={tipText(d.name)} data-q={4} data-name={d.name}>{d.name}</td>
                      <td>{d.by}</td>
                      <td>{mobClass(d.from) ? <b className={mobClass(d.from)}>{d.from}</b> : d.from}</td>
                      <td>{fmtDropTime(d.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="bag-empty">还没有橙色掉落记录。</div>}
        </>
      )
    } else if (modal.kind === "sell") {
      title = "一键出售"
      const sum = sellSummary([...sellQs])
      body = (
        <>
          <div>勾选要出售的品质：</div>
          <div className="sell-qs">
            {[4, 3, 2, 1, 0].map((q) => (
              <label className={"sell-q q" + q} key={q}>
                <input
                  type="checkbox"
                  data-sq={q}
                  checked={sellQs.has(q)}
                  onChange={(e) => {
                    const next = new Set(sellQs)
                    if (e.target.checked) next.add(q)
                    else next.delete(q)
                    setSellQs(next)
                  }}
                />
                {QNAME[q]}
              </label>
            ))}
          </div>
          {!sum.total ? <div className="bag-empty">没有可出售的所选品质闲置物品。</div> : (
            <>
              <table className="sell-table">
                <tbody>
                  <tr><th>品质</th><th>种数</th><th>件数</th><th>金币</th></tr>
                  {[4, 3, 2, 1, 0].filter((q) => sum.byQ[q]).map((q) => (
                    <tr key={q}>
                      <td className={"q" + q}>{QNAME[q]}色</td>
                      <td>{sum.byQ[q].kinds}</td>
                      <td>{sum.byQ[q].n}</td>
                      <td>+{fmtNum(sum.byQ[q].gold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sell-total">
                <div><span>共计件数</span><b>{sum.rows.length}种 {sum.count}件</b></div>
                <div><span>共计金币</span><b>+{fmtNum(sum.total)}</b></div>
              </div>
            </>
          )}
          <div className="modal-btns">
            <button type="button" className="btn" id="sell-no" onClick={closeModal}>取消</button>
            <button type="button" className="btn" id="sell-yes" disabled={!sum.total} onClick={sellOne}>确认出售</button>
          </div>
        </>
      )
    } else if (modal.kind === "export") {
      title = "导出存档"
      body = (
        <>
          <textarea id="io-text" ref={ioRef} readOnly value={saveText()} />
          <div className="modal-btns">
            <button type="button" className="btn" id="btn-copy" onClick={copySave}>一键复制</button>
            <span id="copy-tip">{copyTip}</span>
          </div>
        </>
      )
    } else if (modal.kind === "import") {
      title = "导入存档"
      body = (
        <>
          <textarea id="io-text" ref={ioRef} placeholder="粘贴存档文本" />
          <div className="modal-btns">
            <button type="button" className="btn" id="io-do" onClick={doImport}>确认导入</button>
          </div>
        </>
      )
    } else if (modal.kind === "reset") {
      title = "重置进度"
      body = (
        <>
          <div>确定要清空全部进度吗？等级、装备、背包、金币和首领冷却都会丢失，建议先导出存档备份。</div>
          <div className="modal-btns">
            <button type="button" className="btn" id="reset-no" onClick={closeModal}>取消</button>
            <button type="button" className="btn" id="reset-yes" onClick={doReset}>确认重置</button>
          </div>
        </>
      )
    }
  }

  const speedUp = Game.nextSpeed()
  const gold = fmtNum(S.gold)
  const rows = bagRows(bagFilter, bagQuality)

  return (
    <>
      <Page className="mir2-page">
        <PageHeader
          title="传奇挂机小游戏"
          description="战法道三人小队全自动打怪升级，也可组队挑战首领。"
          actions={
            <button type="button" className="linklike" id="btn-help" onClick={() => setModal({ kind: "help" })}>玩法说明</button>
          }
        />
        <div className="mir2-wrap" onMouseOver={onTip} onMouseMove={onTip} onMouseLeave={() => setTip(null)}>
        <div className="mir2-controls">
          <button type="button" className="btn" id="btn-boss" onClick={openBoss}>⚔ 挑战首领</button>
          <span className="ctl-right">
            <label>
              速度{" "}
              <input
                id="speed"
                type="range"
                min={1}
                max={S.speedMax}
                value={S.speed}
                onChange={(e) => {
                  S.speed = Math.min(Number(e.target.value), S.speedMax)
                  force()
                }}
              />{" "}
              <b id="speed-val">{S.speed}</b>倍
            </label>
            <button
              type="button"
              className="btn"
              id="btn-speed-up"
              disabled={!speedUp || S.gold < speedUp.cost}
              onClick={() => {
                if (Game.buySpeed().ok) force()
              }}
            >
              {speedUp ? (
                <span className="upbtn">
                  <span>升 ×{speedUp.tier}</span><span>·</span><i className="coin" /><span>{fmtGold(speedUp.cost)}</span>
                </span>
              ) : "速度已满"}
            </button>
            <span className="mir2-gold mobile-gold"><i className="coin" /> 金币：<span className="gold-num">{gold}</span></span>
            <button type="button" className="btn" id="btn-export" onClick={doExport}>导出存档</button>
            <button type="button" className="btn" id="btn-import" onClick={() => setModal({ kind: "import" })}>导入存档</button>
            <button
              type="button"
              className="btn"
              id="btn-run"
              onClick={() => {
                S.running = !S.running
                force()
              }}
            >
              {S.running ? "⏸ 暂停" : "▶ 继续"}
            </button>
            <button type="button" className="btn" id="btn-reset" onClick={() => setModal({ kind: "reset" })}>重置</button>
          </span>
          <span id="save-tip" />
        </div>
        <div className="mir2-main">
          <div className="mir2-chars" id="chars">
            {S.chars.map((c) => <CharColumn c={c} key={c.key} onSkills={(key) => setModal({ kind: "skills", key })} />)}
          </div>
          <div className="mir2-bag">
            <h3>
              🎒 背包（共享）
              <button type="button" className="btn" id="btn-sell" onClick={() => setModal({ kind: "sell" })}>一键出售</button>
              <button type="button" className="btn" id="btn-drops" onClick={() => setModal({ kind: "drops" })}>掉落查询</button>
            </h3>
            <div className="mir2-gold"><i className="coin" /> 金币：<span className="gold-num">{gold}</span></div>
            <input
              className="bag-search"
              id="bag-search"
              placeholder="搜索物品…"
              value={bagFilter}
              onChange={(e) => setBagFilter(e.target.value.trim())}
            />
            <div className="bag-filter" id="bag-filter">
              {(["all", 4, 3, 2, 1, 0] as const).map((q) => (
                <button
                  type="button"
                  key={q}
                  data-q={q}
                  className={(q === "all" ? "" : "q" + q) + ((q === "all" ? bagQuality === null : bagQuality === q) ? " active" : "")}
                  onClick={() => setBagQuality(q === "all" ? null : q)}
                >
                  {q === "all" ? "全部" : QNAME[q]}
                </button>
              ))}
            </div>
            <div className="mir2-bag-list" id="bag">
              {rows.length ? rows.map((row) => (
                <div
                  className="bag-row"
                  data-item={row.name}
                  key={row.name}
                  onClick={() => {
                    for (const c of S.chars) Game.equipItem(c, row.name, true)
                    force()
                  }}
                >
                  <span className={"q" + row.q} data-tip={tipText(row.name)} data-q={row.q} data-name={row.name}>{row.name}</span>
                  <b>× {row.n}</b>
                </div>
              )) : <div className="bag-empty">空空如也，快去打怪</div>}
            </div>
          </div>
        </div>
      </div>
      </Page>

      <div
        className={"mir2-modal" + (modal ? " open" : "")}
        id="modal"
        onMouseOver={onTip}
        onMouseMove={onTip}
        onMouseLeave={() => setTip(null)}
      >
        <div className={"mir2-modal-box" + box}>
          <button type="button" className="modal-x" id="modal-close" aria-label="关闭" onClick={closeModal}>×</button>
          <h3 id="modal-title">{title}</h3>
          <div id="modal-body">{body}</div>
        </div>
      </div>
      <div id="tooltip" ref={tipRef} style={{ display: tip ? "block" : "none" }}>
        {tip ? (
          <>
            <b className={"q" + tip.q}>{tip.name}</b>
            <div className="tip-sep" />
            {tip.html ? <div dangerouslySetInnerHTML={{ __html: tip.html }} /> : <div>{tip.text}</div>}
          </>
        ) : null}
      </div>
    </>
  )
}
