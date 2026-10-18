import type { Meld, Tile } from "../../lib/mahjong/types"
import { label as tileLabel, tid } from "../../lib/mahjong/tile"

// 牌面对应 public/mahjong/svg/ 下的图片：1m=一万 1p=一筒 1s=一条 7z=红中
export function svgName(t: Tile): string {
  if (t.type === "zhong") return "7z"
  const suit = t.type === "wan" ? "m" : t.type === "tong" ? "p" : "s"
  return t.num + suit
}

type TileProps = {
  tile: Tile
  folded?: boolean
  clickable?: boolean
  tingTarget?: boolean
  isNew?: boolean
  claimed?: boolean
  mini?: boolean
  armed?: boolean
  className?: string
  onClick?: () => void
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: () => void
}

export function TableTile({
  tile,
  folded,
  clickable,
  tingTarget,
  isNew,
  claimed,
  mini,
  armed,
  className = "",
  onClick,
  onMouseEnter,
  onMouseLeave,
}: TileProps) {
  let cls = "tile"
  if (clickable) cls += " clickable"
  if (folded) cls += " folded"
  if (tingTarget) cls += " ting-target"
  if (isNew) cls += " new"
  if (claimed) cls += " claimed"
  if (mini) cls += " mini"
  if (armed) cls += " ting-armed"
  if (className) cls += " " + className
  return (
    <div
      className={cls}
      title={tileLabel(tile)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {folded ? null : (
        <img
          className="face-img"
          src={"/mahjong/svg/" + svgName(tile) + ".svg"}
          alt={tileLabel(tile)}
          draggable={false}
        />
      )}
    </div>
  )
}

// 吃碰的副露里，被吃碰的那张排中间
export function orderedMeldTiles(m: Meld): Tile[] {
  if (!m.claimedId || (m.type !== "chi" && m.type !== "peng")) return m.ts
  const claimed = m.ts.find((t) => tid(t) === m.claimedId)
  if (!claimed) return m.ts
  const others = m.ts.filter((t) => t !== claimed)
  others.sort((a, b) => a.num - b.num)
  return [others[0], claimed, others[1]]
}

// 副露渲染：吃碰三张正放、被吃碰张居中染黄；杠底 3 + 顶 1 叠中牌，暗杠底 3 扣着
export function MeldGroup({ meld }: { meld: Meld }) {
  if (meld.type === "kong" && meld.ts.length === 4) {
    const anGang = !meld.claimedId
    return (
      <div className="meld kong-meld">
        <div className="kong-row">
          {meld.ts.slice(0, 3).map((t, i) => (
            <TableTile key={i} tile={t} folded={anGang} />
          ))}
        </div>
        <div className="kong-top">
          <TableTile
            tile={meld.ts[3]}
            className={anGang ? "top" : "top claimed"}
          />
        </div>
      </div>
    )
  }
  return (
    <div className="meld">
      {orderedMeldTiles(meld).map((t, i) => (
        <TableTile
          key={i}
          tile={t}
          claimed={i === 1 && !!meld.claimedId}
        />
      ))}
    </div>
  )
}
