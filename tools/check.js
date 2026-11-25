// 機械チェック（観点4「実装可能性」と、観点2「固有性」の機械で拾える部分）
// 使い方：node tools/check.js [国ID ...]   … 国IDを付けるとその国だけ表示
// 終了コード：エラーがあれば 1
const fs = require('fs');
const path = require('path');
const { loadWorld, simulate } = require('./sim');

const ROOT = path.join(__dirname, '..');
const world = loadWorld();
const { log } = simulate(world);
const only = process.argv.slice(2);
const has = p => fs.existsSync(path.join(ROOT, p));
const rep = {}; // id -> {E:[], W:[]}
const R = (c, lv, msg) => { (rep[c] = rep[c] || { E: [], W: [] })[lv].push(msg); };
const MAXLEN = 60;

// ---- 国ごとのチェック
const allIds = {};
for (const c of world.C) {
  const id = c.id;
  rep[id] = rep[id] || { E: [], W: [] };
  if (!has(`assets/far/${c.far}.webp`)) R(id, 'E', `遠景がない: ${c.far}`);
  if (c.screens < 4 || c.screens > 8) R(id, 'W', `広さが 4〜8 画面の外: ${c.screens}`);
  for (const [b] of c.buildings) if (!has(`assets/buildings/${b}.webp`)) R(id, 'E', `建物がない: ${b}`);
  for (const [p] of c.props || []) if (!has(`assets/props/${p}.webp`)) R(id, 'E', `小物がない: ${p}`);
  for (const [k, x] of c.animals || []) {
    if (!has(`assets/animals/${k}_0.webp`)) R(id, 'E', `動物の絵がない: ${k}`);
    if (x < 40 || x > c.screens * 960 - 40) R(id, 'E', `動物 ${k} が国の外にいる: x=${x}`);
  }
  const W = c.screens * 960;
  const xs = [];
  for (const n of c.npcs) {
    if (allIds[n.id]) R(id, 'E', `住人IDが重複: ${n.id}（${allIds[n.id]} と）`); allIds[n.id] = id;
    if (!c.talk[n.id]) R(id, 'E', `会話がない: ${n.id}`);
    if (n.x < 150 || n.x > W - 150) R(id, 'E', `住人が国の端に近すぎる/外: ${n.id} @${n.x}`);
    xs.push([n.x, n.id]);
    if (n.sprite) {
      for (const f of [{}, { yuiKnown: 1, reiKnown: 1 }]) {
        const s = typeof n.sprite === 'function' ? n.sprite(f) : n.sprite;
        if (!has(`assets/actors/${s}.webp`)) R(id, 'E', `立ち絵がない: ${s}`);
      }
    } else if (n.sheet) { if (!has(`assets/actors/${n.actor}_sheet.webp`)) R(id, 'E', `シートがない: ${n.actor}`); }
    else if (!has(`assets/actors/${n.actor}_normal.webp`)) R(id, 'E', `顔がない: ${n.actor}`);
  }
  for (const k of Object.keys(c.talk)) if (!c.npcs.some(n => n.id === k) && !(k === 'bridge' && c.gap) && !(c.places || []).some(p => p.id === k)) R(id, 'E', `住人も場所もない会話: ${k}`);
  for (const p of c.places || []) if (!c.talk[p.id]) R(id, 'E', `場所の会話がない: ${p.id}`);
  xs.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < xs.length; i++) {
    const d = xs[i][0] - xs[i - 1][0];
    if (d < 180) R(id, 'E', `住人が近すぎて話しかけ分けられない: ${xs[i - 1][1]} と ${xs[i][1]}（${d}px）`);
    else if (d < 300) R(id, 'W', `住人の間が狭い: ${xs[i - 1][1]} と ${xs[i][1]}（${d}px）`);
  }
}

// ---- 乗り物：walk through the world なので、乗り物は歩いて越えられない所だけ
{
  const N = world.C.length;
  world.C.forEach((c, i) => {
    if (!c.ride) return;
    if (!['ship', 'self'].includes(c.ride)) R(c.id, 'E', `ride は 'ship'（海を越える船旅）か 'self'（自分の力で渡る）だけ。陸で運ばれる乗り物は使わない: ${c.ride}`);
    if (c.ride === 'ship' && !c.sea) R(c.id, 'E', '船旅の国は sea: true（地図で航路を描く）にする');
    const near = world.C.findIndex((d, j) => j < i && i - j < 8 && d.ride);
    if (near >= 0) R(c.id, 'W', `乗り物の国が近い（${world.C[near].id}）。8か国以上あける`);
  });
  const ships = world.C.filter(c => c.ride === 'ship').length, selfs = world.C.filter(c => c.ride === 'self').length;
  if (ships > Math.max(1, Math.ceil(N / 15))) R('_world', 'W', `船旅が ${ships} か国（目安は15か国に1か国、上限 ${Math.ceil(N / 15)}）`);
  if (selfs > Math.max(1, Math.floor(N / 30))) R('_world', 'W', `自分で漕いで渡る国が ${selfs} か国（目安は30か国に1か国）`);
  // ride のない国の地の文に、乗って運ばれる描写がないか
  const RIDE = /(馬車|汽車|列車|バス|荷車|渡し舟|舟|船|カヌー|ボート|馬)に(乗|の)(る|って|せて|った|り)/;
  world.C.forEach(c => { if (c.ride) return; for (const [id, fn] of Object.entries(c.talk)) {
    for (const back of [false, true]) { try { const st = { f: {}, back, ev() {}, has: () => false, met: () => false };
      for (const l of fn(st) || []) if (l[0] === 'me' && RIDE.test(l[2]) && !/乗れ|乗らな/.test(l[2])) R(c.id, 'W', `nono が乗り物に乗る描写（ride なし）: ${id}「${l[2].slice(0, 30)}」`); } catch (_) {} } } });
}

// ---- 上半身だけの絵（192×256 の胸像）は街に立たせない
{
  const BUST = new Set(['villager', 'elder', 'archer', 'porter', 'craftsman', 'wizard', 'mermaid', 'lumber', 'elf', 'yui', 'goatgirl', 'traveler']);
  world.C.forEach(c => c.npcs.forEach(n => { if (n.actor && BUST.has(n.actor)) R(c.id, 'E', `役者 ${n.actor} は上半身だけの絵。全身の住人に替える: ${n.id}`); }));
}

// ---- 骨組みのラベル：同じ型の国が続かないように
world.C.forEach((c, i) => {
  if (!c.shape) { R(c.id, 'W', '骨組みのラベル（shape）がない'); return; }
  const prev = world.C.slice(Math.max(0, i - 2), i).filter(d => d.shape === c.shape);
  if (prev.length) R(c.id, 'W', `骨組みが直前の国と同じ「${c.shape}」: ${prev.map(d => d.id).join('、')}`);
});

// ---- 特別枠（伝説＝うわさの正体が本物だった／ゲスト＝ライバル本人）は、10か国に1か国まで
{
  const sp = world.C.filter(c => c.npcs.some(n => n.special));
  const cap = Math.max(1, Math.floor(world.C.length / 10));
  if (sp.length > cap) R('_world', 'E', `特別枠の国が ${sp.length} か国（上限 ${cap}）: ${sp.map(c => c.id).join('、')}`);
  world.C.forEach((c, i) => {
    if (!c.npcs.some(n => n.special)) return;
    const near = world.C.findIndex((d, j) => j !== i && Math.abs(j - i) < 5 && d.npcs.some(n => n.special));
    if (near >= 0) R(c.id, 'W', `特別枠が ${world.C[near].id} と近い（5か国以上あけたい）`);
    c.npcs.filter(n => n.special && !['legend', 'guest'].includes(n.special)).forEach(n => R(c.id, 'E', `special は 'legend' か 'guest': ${n.id}`));
  });
}

// ---- 役者の使い回し（同じ顔の別人が近い国に出ると、同一人物に見える）
{
  const seen = {};
  // ストック（普段は使わない）役者：十二支を含むライバル15人、妖怪、骸骨、人魚・エルフなど人間でない者
  const STOCK = new Set(['nibulus', 'iwao', 'kotetsu', 'shiro', 'homura', 'mizuchi', 'hayate', 'mei', 'sasuke', 'kogane', 'kurogane', 'gou', 'tanurio', 'akane', 'yoru',
    'kappa', 'mummy', 'oni', 'tengu', 'skeleton', 'hitotsume', 'hitotsume2', 'rokuro',
    'mermaid', 'mermaid2', 'pinkmermaid', 'merking', 'elf', 'elf2', 'woodelf', 'moon']);
  world.C.forEach((c, i) => c.npcs.forEach(n => {
    const key = n.actor || (typeof n.sprite === 'string' ? n.sprite : null); if (!key) return;
    if (STOCK.has(key.replace(/_(sheet|neck)$/, '')) && !n.special) R(c.id, 'E', `役者 ${key} はストック扱い。出すなら特別枠（npc に special: 'legend' か 'guest'）にする`);
    const nm = typeof n.name === 'function' ? n.name({}) : n.name;
    for (const [j, name, cid] of seen[key] || []) {
      if (name === nm || j === i) continue; // 同じ人物の再登場、同じ国の中は対象外
      const d = i - j;
      if (d < 6) R(c.id, 'E', `役者 ${key} が ${d} か国前の「${name}」（${cid}）と別人として出る。6か国以上あける`);
      else R(c.id, 'W', `役者 ${key} を ${d} か国前の「${name}」（${cid}）と使い回している`);
    }
    (seen[key] = seen[key] || []).push([i, nm, c.id]);
  }));
}

// ---- シミュレーション結果のチェック
for (const c of world.C) {
  const L = log.filter(e => e.c === c.id);
  const ins = L.filter(e => e.lines.some(l => l[0] === 'insight'));
  if (!ins.length) R(c.id, 'E', '気づきに到達できない（行き・帰りのどちらでも）');
  if (ins.length > 1) R(c.id, 'W', `気づきが ${ins.length} 回出る`);
  for (const n of c.npcs) if (!L.some(e => e.npc === n.id) && !n.when) R(c.id, 'E', `一度も話せない住人: ${n.id}`);
  for (const e of L) for (const [sp, face, t] of e.lines) {
    if ([...t].length > MAXLEN) R(c.id, 'E', `${MAXLEN}字超（${[...t].length}字）: 「${t.slice(0, 20)}…」`);
    if (sp === 'npc' && face && face !== 'normal') {
      const n = c.npcs.find(n => n.id === e.npc);
      if (n && n.actor && !n.sheet && !has(`assets/actors/${n.actor}_${face}.webp`)) R(c.id, 'W', `表情 ${face} の絵がない（通常顔になる）: ${n.actor}`);
    }
  }
  // 行きと帰りで会話が変わる住人がいるか（SEE の核）
  const lastGo = {}, changed = [];
  for (const e of L) if (e.phase === '行き') lastGo[e.npc] = JSON.stringify(e.lines);
  for (const e of L) if (e.phase === '帰り' && lastGo[e.npc] && lastGo[e.npc] !== JSON.stringify(e.lines)) changed.push(e.npc);
  if (!changed.length) R(c.id, 'W', '帰り道で会話が変わる住人がいない（行きと帰りの差がない）');
  // 帰り道で長い話を丸ごと繰り返す
  for (const e of L) if (e.phase === '帰り' && e.lines.length >= 3 && L.some(g => g.phase === '行き' && g.npc === e.npc && JSON.stringify(g.lines) === JSON.stringify(e.lines)))
    R(c.id, 'W', `帰り道で同じ長い話を繰り返す: ${e.npc}「${e.lines[0][2].slice(0, 15)}…」`);
}

// ---- フラグ（読むだけで立てない／立てるだけで読まない）
{
  const src = world.src;
  const set = new Set([...src.matchAll(/\bf\.(\w+)\s*=(?!=)/g)].map(m => m[1]));
  const read = new Set([...src.matchAll(/\bf\.(\w+)\b(?!\s*=(?!=))/g)].map(m => m[1]));
  const sys = new Set(['secondGone']);
  for (const k of read) if (!set.has(k) && !k.endsWith('Gone')) R('_world', 'E', `読むだけで、どこでも立てないフラグ: ${k}`);
  for (const k of set) if (!read.has(k) && !sys.has(k)) R('_world', 'W', `立てるだけで、どこでも読まないフラグ: ${k}`);
}

// ---- 固有性の機械検出（観点2の補助）
{
  const byText = {};
  for (const e of log) for (const [sp, , t] of e.lines) if (sp !== 'me') (byText[t] = byText[t] || new Set()).add(e.c);
  for (const [t, s] of Object.entries(byText)) if (s.size > 1) R('_world', 'W', `同じ台詞が複数の国に: 「${t}」（${[...s].join('、')}）`);
  // 6文字の言い回しが4か国以上に出る
  const gram = {};
  for (const e of log) for (const [sp, , t] of e.lines) {
    if (sp === 'me') continue;
    const s = t.replace(/[、。！？「」…\s]/g, '');
    const seen = new Set();
    for (let i = 0; i + 6 <= s.length; i++) seen.add(s.slice(i, i + 6));
    for (const g of seen) (gram[g] = gram[g] || new Set()).add(e.c);
  }
  const hot = Object.entries(gram).filter(([, s]) => s.size >= 4).map(([g, s]) => `「${g}」${s.size}か国`);
  if (hot.length) R('_world', 'W', `4か国以上で使い回している言い回し: ${hot.slice(0, 10).join('、')}`);
  // 骨組みの反復：気づきが「行きで一度話した相手を、別の誰かと話したあとに再訪」したときに出る（ABA型）
  const shape = {};
  for (const c of world.C) {
    const go = log.filter(e => e.c === c.id && e.phase === '行き');
    const k = go.findIndex(e => e.lines.some(l => l[0] === 'insight'));
    if (k < 0) continue;
    const giver = go[k].npc, before = go.slice(0, k).map(e => e.npc);
    const t = before.includes(giver) && before.slice(before.lastIndexOf(giver) + 1).length ? 'ABA型（Aに聞く→Bに聞く→Aに戻ると気づき）' : 'その他';
    (shape[t] = shape[t] || []).push(c.id);
  }
  for (const [t, ids] of Object.entries(shape)) if (t !== 'その他' && ids.length >= Math.max(3, Math.ceil(world.C.length / 3)))
    R('_world', 'W', `同じ骨組みの国が ${ids.length}/${world.C.length}: ${t} … ${ids.join('、')}`);
  // 気づきの文型（「〜は、〜。」）
  const insights = log.flatMap(e => e.lines.filter(l => l[0] === 'insight').map(l => [e.c, l[2]]));
  const aph = insights.filter(([, t]) => /^[^、。]{2,14}[はが]、/.test(t));
  if (aph.length >= Math.ceil(insights.length / 2)) R('_world', 'W', `気づきの半分以上が同じ格言の文型（「〜は、〜。」）: ${aph.map(a => a[0]).join('、')}`);
}

// ---- 出力
let errs = 0;
const ids = ['_world', ...world.C.map(c => c.id)].filter(i => !only.length || only.includes(i) || i === '_world');
for (const id of ids) {
  const r = rep[id]; if (!r) continue;
  const c = world.C.find(c => c.id === id);
  console.log(`\n■ ${c ? `${c.name}（${id}）` : '世界全体'}  エラー ${r.E.length} ／ 注意 ${r.W.length}`);
  for (const m of r.E) console.log('  ✗ ' + m);
  for (const m of r.W) console.log('  △ ' + m);
  errs += r.E.length;
}
console.log(`\n合計エラー: ${errs}`);
process.exit(errs ? 1 : 0);
