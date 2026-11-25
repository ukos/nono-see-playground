// SEE ― 旅のシミュレーション（tx.js と check.js が共用）
// world.js を読み込み、旅人が実際に歩く順に住人へ話しかけて、会話を記録する。
//   行き：国ごとに、東へ歩きながら全員に話す → 国の中を西・東と行き来して、話が変わった相手とだけ話す（最大3往復）
//   帰り：世界の東端まで行ったあと、西へ戻りながら全員に1回ずつ話す
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadWorld(file) {
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'world.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'world.js' });
  const C = sandbox.window.SEE_WORLD.countries;
  let acc = 0;
  for (const c of C) { c.x0 = acc; c.w = c.screens * 960; acc += c.w; c.x1 = acc; }
  return { C, WORLD: acc, src };
}

function simulate(world) {
  const { C, WORLD } = world;
  const st = { flags: {}, evidence: [], met: {}, maxX: 0, x: 0 };
  const log = []; // {c, phase, npc, name, lines, x}
  const last = {};
  const pre = {}; // 国ごと：気づきが出る直前の flags
  const nameOf = n => typeof n.name === 'function' ? n.name(st.flags) : n.name;
  const present = (n, c) => (!n.when || n.when(st.flags, st.maxX >= c.x1 - 2 && st.x < c.x1)) && !st.flags[n.id + 'Gone'];
  const ctx = c => ({
    f: st.flags, back: st.maxX >= c.x1 - 2 && st.x < c.x1,
    ev: k => { if (!st.evidence.includes(k)) st.evidence.push(k); },
    has: k => st.evidence.includes(k), met: id => !!st.met[id]
  });
  const targets = c => {
    const t = c.npcs.map(n => ({ n, x: n.x, id: n.id }));
    if (c.gap) t.push({ n: { id: 'bridge', name: '（吊り橋）' }, x: c.gap.x - 100, id: 'bridge', place: true });
    for (const p of c.places || []) t.push({ n: { id: p.id, name: `（${p.name}）`, when: p.when }, x: p.x, id: p.id, place: true });
    return t;
  };
  function talk(c, t, phase, onlyChanged) {
    const fn = c.talk[t.id]; if (!fn) return false;
    const px = st.x; st.x = c.x0 + t.x;
    if (!present(t.n, c)) { st.x = px; return false; }
    const snapshot = JSON.stringify([st.flags, st.evidence]);
    const ls = fn(ctx(c)) || [];
    const key = c.id + '/' + t.id, sig = JSON.stringify(ls);
    if (onlyChanged && last[key] === sig) { // 変わらない会話は記録しない（状態も戻す）
      const [f, e] = JSON.parse(snapshot); Object.assign(st, { flags: f, evidence: e }); return false;
    }
    last[key] = sig;
    if (!t.place) st.met[t.id] = true;
    if (t.n.leaveWhen && t.n.leaveWhen(st.flags)) st.flags[t.id + 'Gone'] = true;
    log.push({ c: c.id, phase, npc: t.id, name: t.place ? t.n.name : nameOf(t.n), lines: ls, x: t.x });
    if (phase === '行き' && !pre[c.id] && ls.some(l => l[0] === 'insight')) pre[c.id] = JSON.parse(snapshot)[0]; // 解決直前の状態
    return true;
  }
  for (const c of C) {
    const ts = targets(c).sort((a, b) => a.x - b.x);
    st.maxX = Math.max(st.maxX, c.x0 + c.w / 2);
    for (const t of ts) talk(c, t, '行き', false);
    for (let k = 0; k < 3; k++) {
      let any = false;
      for (const t of [...ts].reverse()) any = talk(c, t, '行き', true) || any;
      for (const t of ts) any = talk(c, t, '行き', true) || any;
      if (!any) break;
    }
    st.maxX = Math.max(st.maxX, c.x1 - 60);
  }
  st.maxX = WORLD;
  for (const c of [...C].reverse()) {
    const ts = targets(c).sort((a, b) => b.x - a.x);
    for (const t of ts) talk(c, t, '帰り', false);
  }
  return { log, st, pre };
}

module.exports = { loadWorld, simulate };
