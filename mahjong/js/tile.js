import { TT, SN } from './constants.js';
export { TT, SN };

export function tid(t) { return t.id; }
export function css(t) { return t.type === 'zhong' ? 'mj-zhong' : 'mj-' + t.type; }
export function label(t) { return t.type === 'zhong' ? '红中' : t.num + t.suit; }
export function isYao(t) { return t.type === 'zhong' || t.num === 1 || t.num === 9; }

export function mkDeck() {
  let d = [];
  TT.forEach(t => {
    for (let i = 1; i <= 9; i++) for (let n = 0; n < 4; n++) {
      d.push({ type: t, num: i, suit: SN[t], id: i + t });
    }
  });
  for (let n = 0; n < 4; n++) d.push({ type: 'zhong', num: 0, suit: '红中', id: '红中' });
  return d;
}

export function shuffle(d) {
  for (let i = d.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function sortTiles(tiles) {
  return [...tiles].sort((a, b) => {
    let d = TT.indexOf(a.type) - TT.indexOf(b.type);
    if (d !== 0) return d;
    return a.num - b.num;
  });
}

function countOf(tiles, tile) {
  return tiles.filter(t => tid(t) === tid(tile)).length;
}

function removeTiles(tiles, tile, n) {
  let res = [], removed = 0;
  for (let t of tiles) {
    if (tid(t) === tid(tile) && removed < n) removed++;
    else res.push(t);
  }
  return res;
}

function decomposeAll(tiles) {
  if (tiles.length === 0) return [[]];
  if (tiles.length % 3 !== 0) return [];
  let sorted = sortTiles(tiles);
  let first = sorted[0];
  let results = [];

  if (countOf(sorted, first) >= 3) {
    let rest = removeTiles(sorted, first, 3);
    for (let d of decomposeAll(rest)) {
      results.push([{ kind: 'tri', type: first.type, num: first.num }, ...d]);
    }
  }

  if (first.type !== 'zhong' && first.num <= 7) {
    let t2 = sorted.find(t => t.type === first.type && t.num === first.num + 1);
    let t3 = sorted.find(t => t.type === first.type && t.num === first.num + 2);
    if (t2 && t3) {
      let rest = removeTiles(removeTiles(removeTiles(sorted, first, 1), t2, 1), t3, 1);
      for (let d of decomposeAll(rest)) {
        results.push([{ kind: 'seq', type: first.type, num: first.num }, ...d]);
      }
    }
  }
  return results;
}

function allTilesOf(hand, melds) {
  let all = [...hand];
  melds.forEach(m => all.push(...m.ts));
  return all;
}

function winInfo(hand, melds) {
  melds = melds || [];
  let need = 4 - melds.length;
  if (need < 0) return null;
  if (hand.length !== need * 3 + 2) return null;

  let sorted = sortTiles(hand);
  let seen = new Set();
  for (let t of sorted) {
    if (seen.has(tid(t))) continue;
    seen.add(tid(t));
    if (countOf(sorted, t) < 2) continue;

    let rest = removeTiles(sorted, t, 2);
    let meldGroups = melds.map(m => ({ kind: m.type === 'chi' ? 'seq' : 'tri' }));
    let hasYao = allTilesOf(hand, melds).some(isYao);

    for (let groups of decomposeAll(rest)) {
      let all = [...meldGroups, ...groups];
      let hasSeq = all.some(g => g.kind === 'seq');
      let hasTri = all.some(g => g.kind === 'tri');
      if (!hasYao) break;
      if (t.type === 'zhong') {
        if (hasSeq) return { pair: t, groups: all };
      } else if (hasSeq && hasTri) {
        return { pair: t, groups: all };
      }
    }
  }
  return null;
}

export function canWin(hand, melds) {
  return winInfo(hand, melds) !== null;
}

export function winTiles(hand, melds) {
  melds = melds || [];
  let need = 4 - melds.length;
  if (need < 0) return [];
  if (hand.length !== need * 3 + 1) return [];

  let all = allTilesOf(hand, melds);
  let res = [];
  TT.forEach(type => {
    for (let n = 1; n <= 9; n++) {
      let tile = { type, num: n, suit: SN[type], id: n + type };
      if (countOf(all, tile) >= 4) continue;
      if (canWin([...hand, tile], melds)) res.push(tile);
    }
  });
  let zt = { type: 'zhong', num: 0, suit: '红中', id: '红中' };
  if (countOf(all, zt) < 4 && canWin([...hand, zt], melds)) res.push(zt);
  return res;
}

export function isTing(hand, melds) {
  return winTiles(hand, melds).length > 0;
}

function tileIdx(t) {
  if (t.type === 'zhong') return 27;
  return TT.indexOf(t.type) * 9 + (t.num - 1);
}

// 向听数：0 表示听牌，-1 表示已和牌
export function shanten(hand, melds) {
  melds = melds || [];
  let c = new Array(34).fill(0);
  hand.forEach(t => { c[tileIdx(t)]++; });
  let best = 8;

  function dfs(i, sets, partials, head) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) {
      if (sets + partials > 4) return;
      let s = 8 - 2 * sets - partials - (head ? 1 : 0);
      if (s < best) best = s;
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; dfs(i, sets + 1, partials, head); c[i] += 3; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      dfs(i, sets + 1, partials, head);
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (!head && c[i] >= 2) { c[i] -= 2; dfs(i, sets, partials, true); c[i] += 2; }
    if (c[i] >= 2) { c[i] -= 2; dfs(i, sets, partials + 1, head); c[i] += 2; }
    if (i < 27 && i % 9 <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--; dfs(i, sets, partials + 1, head); c[i]++; c[i + 1]++;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 2] > 0) {
      c[i]--; c[i + 2]--; dfs(i, sets, partials + 1, head); c[i]++; c[i + 2]++;
    }
    c[i]--; dfs(i, sets, partials, head); c[i]++;
  }

  dfs(0, melds.length, 0, false);
  return best;
}
