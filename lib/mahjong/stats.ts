// 战绩显示口径（从 ui.js 拆出来的纯函数）：宝牌胡单独计，自摸数里扣掉宝牌
import type { PerStat } from './types.ts'

export type StatView = {
  zong: number
  zimo: number
  dianpao: number
  heipaoHu: number
  dianhei: number
  baopi: number
}

export function statOf(s: { stat?: Partial<PerStat> } | null | undefined): StatView {
  const st: Partial<PerStat> = (s && s.stat) || {}
  const baopi = st.baopi || 0
  const zimo = Math.max(0, (st.zimo || 0) - baopi)
  const dianpao = st.dianpao || 0
  const heipaoHu = st.heipao || 0
  const dianhei = st.dianhei || 0
  return {
    zong: dianpao + heipaoHu + zimo + baopi,
    zimo,
    dianpao,
    heipaoHu,
    dianhei,
    baopi,
  }
}
