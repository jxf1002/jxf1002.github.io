"use client"

import type { ReactNode } from "react"
import type { Char } from "../../lib/mir2/types"
import { COMP_COEF, DB, SLOTS, fmtRange, itemQuality, shortName } from "../../lib/mir2/game"
import { charNeed, charPct, formatLog, statRows, tipText } from "../../lib/mir2/view"

const JOB_ICON: Record<string, string> = { warrior: "🗡️", mage: "🔮", taoist: "📿" }

// 一张角色卡：等级 / 经验 / 装备 / 属性 / 击杀 / 当前战斗 + 日志
export default function CharColumn({ c, onSkills }: { c: Char; onSkills: (key: string) => void }) {
  const need = charNeed(c)
  const pct = charPct(c)
  const t = c.target
  const coef = COMP_COEF[c.key] || 1
  let mob: ReactNode = "寻找怪物中…"
  if (t) {
    if (t.kind === "boss") mob = "讨伐【" + t.Name + "】中…"
    else {
      const name = t.kind === "elite" ? <b className="elite-name">{shortName(t.Name)}</b> : shortName(t.Name)
      mob = <>{name}{(t.count || 1) > 1 ? "×" + t.count : ""}（{Math.max(0, t.HP)} / {t.MaxHP}）</>
    }
  }

  return (
    <div className={"mir2-col job-" + c.key} id={"char-" + c.key}>
      <div>
        <div className="char-head">
          <b>{(JOB_ICON[c.key] || "") + c.name}</b>
          <span className="lv">Lv.{c.level}</span>
          <span
            className="comp-lamp q4"
            title={c.comp ? "落后补偿中：经验×" + coef + "，领先另外两人各 10% 后关闭" : ""}
          >
            {c.comp ? "经验×" + coef : null}
          </span>
          <button type="button" className="btn" data-skill={c.key} onClick={() => onSkills(c.key)}>
            技能
          </button>
        </div>
        <div className="exp-row">
          <div className="mir2-bar exp">
            <i className="expbar" style={{ width: pct + "%" }} />
          </div>
          <span className="exptext">{c.exp} / {need}</span>
        </div>
        <div className="sec-t">装备</div>
        <div className="mir2-equips">
          {SLOTS.map(([k, label]) => {
            const nm = c.equip[k]
            const q = nm ? itemQuality(DB.itemByName[nm]) : 0
            return (
              <div className="eq" key={k}>
                <span>{label}</span>
                <b
                  className={"q" + q}
                  data-tip={nm ? tipText(nm) : undefined}
                  data-q={nm ? q : undefined}
                  data-name={nm || undefined}
                >
                  {nm || "空"}
                </b>
              </div>
            )
          })}
        </div>
        <div className="sec-t">属性</div>
        <div className="mir2-stats">
          {statRows(c).map(([k, r]) => (
            <div className="stat" key={k}>
              <span>{k}</span>
              <b>{fmtRange(r)}</b>
            </div>
          ))}
        </div>
        <div className="kills">
          <span className="kill-chip">普通 <b>{c.killsNormal}</b></span>
          <span className="kill-chip k-elite">精英 <b>{c.killsElite}</b></span>
          <span className="kill-chip k-boss">首领 <b>{c.killsBoss}</b></span>
        </div>
      </div>
      <div className="mir2-fight">
        <div className="mob">{mob}</div>
        <div className="mir2-bar">
          <i className="mobbar" style={{ width: (t ? Math.max(0, (t.HP / t.MaxHP) * 100) : 0) + "%" }} />
        </div>
        <div className="mir2-log">
          {c.logs.slice().reverse().map((l, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: formatLog(l) }} />
          ))}
        </div>
      </div>
    </div>
  )
}
