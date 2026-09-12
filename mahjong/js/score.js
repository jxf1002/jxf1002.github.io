import { PLAYER_COUNT } from './constants.js';

// 番数（累加）：黑炮 +2，庄家 +1，自摸 +1，宝牌（仅自摸）+1
export function calcFan({ isDealer, isZimo, isBaopi, heipao }) {
  let fan = 0;
  if (heipao) fan += 2;
  if (isDealer) fan += 1;
  if (isZimo) fan += 1;
  if (isBaopi) fan += 1;
  return fan;
}

// 每份分数 = 2^番数
export function calcScore({ fan, isZimo, discarderIsTing, discarder, winner, dealer }) {
  let deltas = new Array(PLAYER_COUNT).fill(0);
  let gain = 0;

  if (isZimo) {
    // 自摸：三家各付，庄家付双倍（多 1 番）
    for (let i = 0; i < PLAYER_COUNT; i++) {
      if (i === winner) continue;
      let pay = Math.pow(2, (i === dealer) ? fan + 1 : fan);
      deltas[i] -= pay;
      gain += pay;
    }
  } else if (!discarderIsTing) {
    // 黑炮：放炮者独付；放炮者若为庄家，同样多 1 番
    let pay = Math.pow(2, (discarder === dealer) ? fan + 1 : fan);
    deltas[discarder] -= pay;
    gain += pay;
  } else {
    // 听牌点炮：三家共付，庄家付双倍
    for (let i = 0; i < PLAYER_COUNT; i++) {
      if (i === winner) continue;
      let pay = Math.pow(2, (i === dealer) ? fan + 1 : fan);
      deltas[i] -= pay;
      gain += pay;
    }
  }

  deltas[winner] += gain;
  return { deltas, gain };
}
