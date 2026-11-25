// SEE ― ゲーム本体（状態管理・描画・会話・天候）。世界のデータは world.js。
{
// ================= 世界の組み立て =================
const W = 960, H = 540, GROUND = 452, SPEED = 230, NONO_H = 128;
const FIG_H = NONO_H * 193 / 224; // nonoの絵の、余白を除いた実際の背丈。住人はこれに合わせる
// 頭の大きな絵柄の役者は、頭の大きさがnonoと同じになるよう体ごと縮める（nonoの頭は背丈の約0.37）
const ACTOR_H = { courier: .71, girl: .74, greenboy: .69, kimono_girl: .8, okappa: .84, apprentice: .8, lanternman: .8, researcher: .71 };
const C = window.SEE_WORLD.countries;
let acc = 0;
for (const [i, c] of C.entries()) {
  c.i = i; c.x0 = acc; c.w = c.screens * W; acc += c.w; c.x1 = acc;
  for (const n of c.npcs) { n.ax = c.x0 + n.x; n.c = c; }
}
const WORLD = acc;
const NPCS = C.flatMap(c => c.npcs);
const present = n => (!n.when || n.when(st.flags, isBack(n.c))) && !st.flags[n.id + 'Gone'] && !(n.leaveWhen && n.leaveWhen(st.flags) && n.off);
const npcX = n => n.ax + (n.off || 0);
// 帰り道かどうか（いちばん東まで行ってから、この国へ戻ってきた）。帰り専用の遠景・天候・時間帯・住人に使う
const isBack = c => st.maxX >= c.x1 - 2 && st.x < c.x1;
const farOf = c => (isBack(c) && c.farBack) || c.far;
const timeOf = c => (isBack(c) && c.timeBack) || c.time || 'dusk';
const nameOf = n => typeof n.name === 'function' ? n.name(st.flags) : n.name;
const spriteOf = n => typeof n.sprite === 'function' ? n.sprite(st.flags) : n.sprite;
const countryAt = x => C.find(c => x < c.x1) || C[C.length - 1];

// ================= 画像（必要になった国から順に読み込む） =================
const cache = {};
function img(src) {
  let e = cache[src];
  if (!e) { e = cache[src] = { ok: false, im: new Image() }; e.im.onload = () => { e.ok = true; }; e.im.src = src; }
  return e.ok ? e.im : null;
}
const P = {
  far: k => `assets/far/${k}.webp`, b: k => `assets/buildings/${k}.webp`, a: (k, f) => `assets/actors/${k}_${f}.webp`,
  nono: 'assets/nono_side.webp', face: 'assets/nono_full.webp', trees: 'assets/far_trees.webp', grass: 'assets/shore_grass.webp', rabbit: 'assets/rabbit.webp'
};
function prefetch(c) {
  if (!c || c._pf) return; c._pf = true;
  img(P.far(farOf(c))); c.buildings.forEach(b => img(P.b(b[0]))); c.npcs.forEach(n => n.sprite ? img(`assets/actors/${spriteOf(n)}.webp`) : img(P.a(n.actor, n.sheet ? 'sheet' : 'normal')));
  if (c.gap) { img(P.b('rope_bridge_broken')); img(P.b('rope_bridge_fixed')); }
  (c.props || []).forEach(p => img(`assets/props/${p[0]}.webp`));
}
[P.nono, P.face, P.trees, P.grass, P.rabbit].forEach(img);

// ================= 状態とセーブ =================
const fresh = () => ({ x: 200, dir: 1, moving: false, phase: 0, flags: {}, evidence: [], insights: [], met: {}, maxX: 200, visited: {},
  talking: null, journal: false, cool: 0, keyL: false, keyR: false, t: 0, cur: null });
let st = fresh();
const KEY = 'see-save-v1';
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ x: st.x, flags: st.flags, evidence: st.evidence, insights: st.insights, met: st.met, maxX: st.maxX, visited: st.visited })); } catch (e) { /* 保存できない環境では何もしない */ }
}
function loadSave() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* 同上 */ } }

// ================= うわさと確信度（ベイズ更新。画面に数式は出さない） =================
const RUMOR = {
  text: '東の吊り橋が落ちたらしい', prior: 0.6,
  ev: {
    heard: { lr: 1, who: 'ゴンジ（村人）', note: '隣村の人から聞いた、と言っていた' },
    sound: { lr: 2.6, who: 'ダイ（木こり）', note: '夜中に東の谷でドーンと大きな音がした' },
    crossed: { lr: 0.22, who: 'ミツ（運び屋）', note: '今朝その橋を渡ってきた。揺れはひどかった' },
    seen: { lr: 0.03, who: '自分の目', note: '橋は架かっていた。切れていたのは手すりの縄だった' }
  }
};
function confidenceTrail() {
  if (!st.flags.heard) return [];
  let odds = RUMOR.prior / (1 - RUMOR.prior);
  const out = [{ key: 'heard', p: RUMOR.prior }];
  for (const k of st.evidence) { if (k === 'heard' || !RUMOR.ev[k]) continue; odds *= RUMOR.ev[k].lr; out.push({ key: k, p: odds / (1 + odds) }); }
  return out;
}
const word = p => p >= .85 ? 'ほぼ確か' : p >= .65 ? 'たぶん本当' : p >= .4 ? 'どちらとも言えない' : p >= .15 ? 'あやしい' : 'ちがったみたい';
const shift = (a, b) => { const d = b - a; return d > .25 ? 'ぐっと信じた' : d > .05 ? '少し信じた' : d < -.25 ? 'ぐっと疑った' : d < -.05 ? '少し疑った' : '変わらない'; };

// ================= 天候 =================
// 時間帯：画面にかける光の色（夜は暗く青く、朝はやわらかい暖色、昼はそのまま）
const TIME = { morning: { name: '朝', fill: 'rgba(255,214,170,.07)' }, noon: { name: '昼', fill: null }, dusk: { name: '夕暮れ', fill: null }, night: { name: '夜', fill: 'rgba(14,18,52,.34)' } };
const WN = { clear: '晴れ', drizzle: '小雨', squall: 'スコール', typhoon: '台風', wind: '強風', fog: '霧', densefog: '濃霧', snow: '雪' };
const WX = {
  clear: {},
  drizzle: { rain: 150, len: 10, spd: 520, slant: .12, width: 1, dark: .10 },
  squall: { rain: 520, len: 22, spd: 900, slant: .22, width: 1.6, dark: .26, splash: 1 },
  typhoon: { rain: 620, len: 26, spd: 1000, slant: .95, width: 1.6, dark: .34, leaves: 45, wind: 1, flash: 1, splash: 1 },
  wind: { leaves: 55, wind: .8, streak: 26, dark: .04 },
  fog: { fog: .42, dark: .04 },
  densefog: { fog: .8, hole: 1, dark: .06 },
  snow: { snow: 260, dark: .03 }
};
const wx = { type: 'clear', k: 1, next: null, timer: 30, flash: 0, dir: -1 };
const rain = [], snow = [], leaves = [], streaks = [], splashes = [];
function pickWeather(c) {
  const w = (isBack(c) && c.weatherBack) || c.weather || { clear: 1 }; let tot = 0; for (const k in w) tot += w[k];
  let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'clear';
}
function setWeather(t) { if (t !== wx.type || wx.next) wx.next = t; }
function wxp(name) { return (WX[wx.type][name] || 0) * wx.k; }
function windSpeedFactor() { // 向かい風は重く、追い風は少し軽い
  const w = (WX[wx.type].wind || 0) * wx.k; if (!w || !st.moving) return 1;
  return st.dir === wx.dir ? 1 + .15 * w : 1 - .35 * w;
}
function updateWeather(dt, camDx) {
  wx.timer -= dt;
  if (wx.timer <= 0) { wx.timer = 40 + Math.random() * 50; setWeather(pickWeather(st.cur)); }
  if (wx.next) { wx.k -= dt / 2.5; if (wx.k <= 0) { wx.type = wx.next; wx.next = null; wx.k = 0; } }
  else wx.k = Math.min(1, wx.k + dt / 2.5);
  const p = WX[wx.type], d = wx.dir;
  // 雨
  const nr = Math.round((p.rain || 0) * wx.k);
  while (rain.length < nr) rain.push({ x: Math.random() * (W + 400) - 200, y: Math.random() * H - H, v: Math.random() });
  rain.length = Math.min(rain.length, nr);
  for (const r of rain) {
    r.y += p.spd * dt * (.8 + r.v * .4); r.x += p.spd * p.slant * d * dt - camDx;
    if (r.y > GROUND + 20 + r.v * 70) {
      if (p.splash && splashes.length < 80 && Math.random() < .5) splashes.push({ x: r.x, y: r.y, life: .25 });
      r.y = -20 - Math.random() * 120; r.x = Math.random() * (W + 600) - 300;
    }
  }
  for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].life -= dt; splashes[i].x -= camDx; if (splashes[i].life <= 0) splashes.splice(i, 1); }
  // 雪
  const ns = Math.round((p.snow || 0) * wx.k);
  while (snow.length < ns) snow.push({ x: Math.random() * W, y: Math.random() * H - H * .5, r: Math.random(), ph: Math.random() * 6 });
  snow.length = Math.min(snow.length, ns);
  for (const s of snow) {
    s.y += (28 + s.r * 26) * dt; s.x += Math.sin(st.t * 1.3 + s.ph) * 18 * dt - camDx * (.6 + s.r * .4);
    if (s.y > H) { s.y = -6; s.x = Math.random() * W; }
    if (s.x < -10) s.x += W + 20; if (s.x > W + 10) s.x -= W + 20;
  }
  // 木の葉と風の筋
  const nl = Math.round((p.leaves || 0) * wx.k);
  while (leaves.length < nl) leaves.push({ x: d < 0 ? W + Math.random() * 300 : -Math.random() * 300, y: Math.random() * (GROUND + 40), r: Math.random() * 6, vr: (Math.random() - .5) * 10, v: Math.random(), c: ['#6a8a3a', '#a08a3a', '#8a5a2a', '#5a7a4a'][Math.floor(Math.random() * 4)] });
  leaves.length = Math.min(leaves.length, nl);
  for (const l of leaves) {
    l.x += d * (380 + l.v * 300) * (p.wind || .5) * dt - camDx; l.y += Math.sin(st.t * 3 + l.r) * 40 * dt + 12 * dt; l.r += l.vr * dt;
    if ((d < 0 && l.x < -20) || (d > 0 && l.x > W + 20) || l.y > H) { l.x = d < 0 ? W + 20 + Math.random() * 100 : -20 - Math.random() * 100; l.y = Math.random() * (GROUND + 20); }
  }
  const nk = Math.round((p.streak || 0) * wx.k);
  while (streaks.length < nk) streaks.push({ x: Math.random() * W, y: Math.random() * GROUND, l: 40 + Math.random() * 90, v: Math.random() });
  streaks.length = Math.min(streaks.length, nk);
  for (const s of streaks) { s.x += d * (900 + s.v * 500) * dt - camDx; if (s.x < -150) { s.x = W + 50; s.y = Math.random() * GROUND; } if (s.x > W + 150) { s.x = -50; s.y = Math.random() * GROUND; } }
  // 稲光（台風）
  if (p.flash && wx.k > .6 && Math.random() < dt * .07) wx.flash = 1;
  wx.flash = Math.max(0, wx.flash - dt * 2.2);
}
let fogTex = null;
function fogTexture() {
  if (fogTex) return fogTex;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const q = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 1024, y = 60 + Math.random() * 230, r = 60 + Math.random() * 140;
    for (const dx of [-1024, 0, 1024]) { // 横につなげても継ぎ目が出ないように
      const gr = q.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, 'rgba(235,238,245,.28)'); gr.addColorStop(1, 'rgba(235,238,245,0)');
      q.fillStyle = gr; q.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  return fogTex = c;
}
function drawWeather(cam, nx) {
  const p = WX[wx.type], k = wx.k;
  if (rain.length) {
    g.strokeStyle = `rgba(200,215,240,${.35 + .25 * k})`; g.lineWidth = p.width || 1; g.beginPath();
    const sl = p.slant * wx.dir;
    for (const r of rain) { g.moveTo(r.x, r.y); g.lineTo(r.x - sl * p.len, r.y - p.len); }
    g.stroke();
    g.strokeStyle = 'rgba(210,225,245,.5)'; g.lineWidth = 1;
    for (const s of splashes) { g.beginPath(); g.ellipse(s.x, s.y, 6 * (1 - s.life * 3), 2, 0, 0, Math.PI * 2); g.stroke(); }
  }
  if (snow.length) { g.fillStyle = 'rgba(250,252,255,.9)'; for (const s of snow) { const z = 2 + s.r * 3; g.fillRect(s.x, s.y, z, z); } }
  if (streaks.length) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); for (const s of streaks) { g.moveTo(s.x, s.y); g.lineTo(s.x + s.l, s.y); } g.stroke(); }
  for (const l of leaves) { g.save(); g.translate(l.x, l.y); g.rotate(l.r); g.fillStyle = l.c; g.fillRect(-4, -2, 8, 4); g.restore(); }
  const fog = wxp('fog');
  if (fog) {
    const t = fogTexture();
    for (const [sp, y, a] of [[.35, GROUND - 300, .8], [.7, GROUND - 200, 1]]) {
      const off = -((cam * sp + st.t * 14 * sp) % t.width);
      g.globalAlpha = Math.min(1, fog * a * (p.hole ? .7 : 1.6));
      for (let x = off; x < W; x += t.width) g.drawImage(t, x, y, t.width, t.height);
    }
    g.globalAlpha = 1;
    if (p.hole) { // 濃霧：自分のまわりだけ少し見える
      const gr = g.createRadialGradient(nx, GROUND - 70, 120, nx, GROUND - 70, 470);
      gr.addColorStop(0, 'rgba(214,220,230,0)'); gr.addColorStop(1, `rgba(214,220,230,${.88 * k})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else { g.fillStyle = `rgba(214,220,230,${.18 * fog})`; g.fillRect(0, 0, W, H); }
  }
  const dark = wxp('dark'); if (dark) { g.fillStyle = `rgba(10,14,30,${dark})`; g.fillRect(0, 0, W, H); }
  if (wx.flash > 0) { g.fillStyle = `rgba(240,245,255,${wx.flash * .55})`; g.fillRect(0, 0, W, H); }
}

// ================= 会話 =================
const $ = id => document.getElementById(id);
const talk = $('talk'), tsay = $('tsay'), twho = $('twho'), tpic = $('tpic'), ins = $('insight');
let typing = null;
function ctx(c) {
  return {
    f: st.flags, back: st.maxX >= c.x1 - 2 && st.x < c.x1,
    ev: k => { if (!st.evidence.includes(k)) st.evidence.push(k); },
    has: k => st.evidence.includes(k), met: id => !!st.met[id]
  };
}
function startTalk(target) {
  const c = target.c, fn = c.talk[target.id]; if (!fn) return;
  const ls = fn(ctx(c)); if (!ls || !ls.length) return;
  st.met[target.id] = true;
  st.talking = { ls, i: 0, who: target }; st.moving = false; showLine();
}
function showLine() {
  const c = st.talking, [sp, face, text] = c.ls[c.i];
  if (sp === 'insight') {
    talk.classList.remove('on'); $('ibody').textContent = text; ins.classList.add('on');
    if (!st.insights.some(x => x.text === text)) { st.insights.push({ c: c.who.c.name, text }); save(); }
    return;
  }
  ins.classList.remove('on'); talk.classList.add('on');
  if (sp === 'npc' && c.who.sprite) {
    twho.textContent = nameOf(c.who); tpic.onerror = null; tpic.src = `assets/actors/${spriteOf(c.who)}.webp`;
  } else if (sp === 'npc' && c.who.actor) {
    twho.textContent = nameOf(c.who);
    const normal = P.a(c.who.actor, c.who.sheet ? 'full' : 'normal'); // 歩く絵のある役者は、その全身を会話の絵に
    tpic.onerror = () => { tpic.onerror = null; tpic.src = normal; };
    tpic.src = face && !c.who.sheet ? P.a(c.who.actor, face) : normal;
  } else { twho.textContent = 'nono'; tpic.onerror = null; tpic.src = P.face; }
  let n = 0; tsay.textContent = ''; clearInterval(typing);
  typing = setInterval(() => { n++; tsay.textContent = text.slice(0, n); if (n >= text.length) { clearInterval(typing); typing = null; } }, 32);
}
function advance() {
  const c = st.talking; if (!c) return;
  if (typing) { clearInterval(typing); typing = null; tsay.textContent = c.ls[c.i][2]; return; }
  c.i++;
  if (c.i >= c.ls.length) { st.talking = null; st.cool = st.t + .35; talk.classList.remove('on'); ins.classList.remove('on'); save(); return; }
  showLine();
}

// ================= 旅日誌 =================
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function renderJournal() {
  const tr = confidenceTrail();
  if (!tr.length) $('jr').innerHTML = '<p class="empty">まだ、うわさは聞いていない。</p>';
  else {
    const p = tr[tr.length - 1].p;
    $('jr').innerHTML = `<div class="rumor"><div class="q">「${esc(RUMOR.text)}」</div>
      <div class="meter"><div class="bar"><div class="fill" style="width:${Math.round(p * 100)}%"></div></div><span class="w">${esc(word(p))}</span></div>
      <div class="trail" aria-label="見え方の移り変わり">${tr.map(t => `<i style="height:${Math.max(4, Math.round(t.p * 34))}px"></i>`).join('')}</div>
      <ul class="log">${tr.map((t, i) => `<li><b>${esc(RUMOR.ev[t.key].who)}</b>：${esc(RUMOR.ev[t.key].note)}${i ? `　→ ${esc(shift(tr[i - 1].p, t.p))}` : '　→ 話を聞いた'}</li>`).join('')}</ul></div>`;
  }
  $('ji').innerHTML = st.insights.length
    ? `<ul class="log">${st.insights.map(s => `<li><span class="c">${esc(s.c)}</span>${esc(s.text)}</li>`).join('')}</ul>`
    : '<p class="empty">まだ、ない。</p>';
  const n = C.filter(c => st.visited[c.id]).length;
  $('jv').innerHTML = `<span>${n} / ${C.length}</span>` + C.map(c => st.visited[c.id] ? `<span>${esc(c.name)}</span>` : '<span class="no">？？？</span>').join('');
}
// ================= 地図（行った国に印。印か一覧から、その国へ移る） =================
// 世界地図の絵（assets/ui/world_map.webp、1432×640）。経度・緯度から絵の上の位置へ（絵に合わせて測った値）
const mxy = ([la, lo]) => [706 + 3.8 * lo, 342 - 3.76 * la];
function renderMap() {
  const svg = $('msvg'), here = st.cur;
  let h = '<image href="assets/ui/world_map.webp" x="0" y="0" width="1432" height="640"/>';
  // 歩いてきた道のり：行った国を旅の順に線でつなぐ（船旅の区間は c.sea で点線）
  const way = C.filter(c => c.map && st.visited[c.id]);
  for (let k = 1; k < way.length; k++) {
    const [x1, y1] = mxy(way[k - 1].map), [x2, y2] = mxy(way[k].map), sea = way[k].sea || way[k - 1].sea;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.min(60, Math.hypot(x2 - x1, y2 - y1) * 0.12); // ゆるい弧
    h += `<path class="way${sea ? ' sea' : ''}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>`;
  }
  for (const c of C) {
    if (!c.map || !st.visited[c.id]) continue;
    const [x, y] = mxy(c.map), me = c === here;
    h += `<g class="mk${me ? ' here' : ''}" data-id="${c.id}"><circle cx="${x}" cy="${y}" r="${me ? 14 : 11}"/><text x="${x + 16}" y="${y + 9}">${c.name}</text></g>`;
  }
  svg.innerHTML = h;
  $('mlist').innerHTML = C.filter(c => st.visited[c.id]).map(c =>
    `<li class="${c === here ? 'here' : ''}"><button data-id="${c.id}">${c.i + 1}. ${c.name}<small>${c.sub}${c === here ? '・いまここ' : ''}</small></button></li>`).join('');
}
function toggleMap(on) { st.map = on ?? !st.map; $('map').classList.toggle('on', st.map); if (st.map) { st.auto = 0; renderMap(); } }
function warpTo(id) {
  const c = C.find(c => c.id === id); if (!c) return;
  st.x = c.x0 + 160; st.dir = 1; st.auto = 0; st.run = false; toggleMap(false); save();
}
$('map').addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el) warpTo(el.dataset.id); });
$('bm').addEventListener('click', e => { e.stopPropagation(); toggleJournal(false); toggleMap(); });
$('mclose').addEventListener('click', () => toggleMap(false));

function toggleJournal(on) { st.journal = on ?? !st.journal; $('journal').classList.toggle('on', st.journal); if (st.journal) renderJournal(); }

// ================= 吊り橋（オランジェの谷） =================
function bridgeOf(c) {
  if (!c.gap) return null;
  const gx = c.x0 + c.gap.x;
  return { gx, bx: gx - 130, deck0: gx + 10, deck1: gx + 596, end: gx + 700 };
}
function groundOffset(x) { // 吊り橋の上では足もとが下がる
  const b = bridgeOf(countryAt(x)); if (!b || x < b.deck0 || x > b.deck1) return 0;
  const t = (x - b.deck0) / (b.deck1 - b.deck0), edge = Math.min(1, (x - b.deck0) / 30, (b.deck1 - x) / 30);
  return 26 * edge + 18 * Math.sin(Math.PI * t);
}

// ================= 入力 =================
function nearTarget() {
  let best = null, bd = 90;
  for (const n of NPCS) { if (!present(n)) continue; const d = Math.abs(n.ax - st.x); if (d < bd) { bd = d; best = n; } }
  if (best) return best;
  const c = countryAt(st.x), b = bridgeOf(c);
  if (b && st.x > b.gx - 220 && st.x < b.gx + 40) return { id: 'bridge', c, isPlace: true, verb: '見る' };
  for (const p of c.places || []) { // 見る・聞くだけの場所（足あと、窓、鈴の音など）
    if ((!p.when || p.when(st.flags, isBack(c))) && Math.abs(c.x0 + p.x - st.x) < 90) return { id: p.id, c, isPlace: true, verb: p.verb || '見る', ax: c.x0 + p.x };
  }
  return null;
}
function act() {
  if (st.journal) return toggleJournal(false);
  if (st.map) return toggleMap(false);
  if (ins.classList.contains('on') || st.talking) return advance();
  if (st.t < st.cool) return;
  const t = nearTarget(); if (t) startTalk(t);
}
addEventListener('keydown', e => {
  if (!$('game').classList.contains('on')) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') st.keyL = true;
  if (e.key === 'ArrowRight' || e.key === 'd') st.keyR = true;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') { e.preventDefault(); act(); }
  if (e.key === 'j' || e.key === 'J') toggleJournal();
  if (e.key === 'm' || e.key === 'M') toggleMap();
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') st.keyL = false; if (e.key === 'ArrowRight' || e.key === 'd') st.keyR = false; });
function holdBtn(el, k) {
  const on = e => { e.preventDefault(); st[k] = true; el.classList.add('hold'); };
  const off = () => { st[k] = false; el.classList.remove('hold'); };
  el.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, off));
}
// スワイプで歩く：左右にはらうと、その向きへ歩きつづける。同じ向きにもう一度で走る。タップで止まる
st.auto = 0; st.run = false;
try { if (localStorage.getItem('see-swiped')) $('hint').style.opacity = 0; } catch (_) {}
{
  let sx = 0, sy = 0, down = false;
  const game = $('game'), ui = e => e.target.closest('button,#talk,#insight,#journal,#map');
  game.addEventListener('pointerdown', e => { if (ui(e)) return; down = true; sx = e.clientX; sy = e.clientY; });
  game.addEventListener('pointerup', e => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const d = Math.sign(dx);
      if (st.auto === d) st.run = true; else { st.auto = d; st.run = false; }
      $('hint').style.opacity = 0; try { localStorage.setItem('see-swiped', '1'); } catch (_) {}
    } else if (st.auto) { st.auto = 0; st.run = false; }
  });
  game.addEventListener('pointercancel', () => { down = false; });
}
$('bt').addEventListener('click', e => { e.stopPropagation(); st.auto = 0; st.run = false; act(); }); $('bj').addEventListener('click', () => { toggleMap(false); toggleJournal(); });
$('jclose').addEventListener('click', () => toggleJournal(false));
talk.addEventListener('click', advance); ins.addEventListener('click', advance);

// ================= 描画 =================
const cv = $('cv'), g = cv.getContext('2d');
function fitCanvas() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); }
const ro = new ResizeObserver(fitCanvas); ro.observe(cv);
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function drawFarImage(im, cam, alpha) {
  if (!im) return;
  const h = H * 0.92, w = im.width * h / im.height, off = -(cam * 0.06) % (w * 2);
  g.globalAlpha = alpha;
  for (let x = off - w * 2; x < W + w; x += w) {
    const k = Math.round((x - off) / w); // 交互に左右反転して継ぎ目を消す
    if (k % 2) { g.save(); g.translate(x + w, 0); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore(); } else g.drawImage(im, x, 0, w, h);
  }
  g.globalAlpha = 1;
}
function drawFar(cam) {
  g.fillStyle = '#2a2040'; g.fillRect(0, 0, W, H);
  const center = cam + W / 2, c = countryAt(center);
  drawFarImage(img(P.far(farOf(c))), cam, 1);
  const dR = c.x1 - center, dL = center - c.x0, nx = C[c.i + 1], pv = C[c.i - 1];
  if (nx && dR < 480) drawFarImage(img(P.far(farOf(nx))), cam, (480 - dR) / 960);
  else if (pv && dL < 480) drawFarImage(img(P.far(farOf(pv))), cam, (480 - dL) / 960);
  g.fillStyle = '#151a1c'; g.fillRect(0, H * 0.92 - 2, W, H);
  return c;
}
function drawMid(cam, c) {
  const tr = img(P.trees);
  if (c.mid === 'trees' && tr) {
    const w = 1100, h = tr.height * w / tr.width, off = -(cam * 0.3) % w;
    g.globalAlpha = .85; for (let x = off - w; x < W + w; x += w) g.drawImage(tr, x, GROUND - h + 18, w, h); g.globalAlpha = 1;
  }
  g.fillStyle = c.hill || '#1e2a2a';
  g.beginPath(); g.moveTo(0, GROUND + 4);
  for (let x = 0; x <= W; x += 16) { const wx2 = x + cam * 0.45; g.lineTo(x, GROUND - 14 - Math.sin(wx2 / 230) * 10 - Math.sin(wx2 / 71) * 4); }
  g.lineTo(W, GROUND + 4); g.closePath(); g.fill();
}
function drawGround(cam) {
  for (const c of C) {
    if (c.x1 < cam || c.x0 > cam + W) continue;
    const [top, base, road] = c.ground || ['#5d8a55', '#3e5a3c', '#6b5a45'];
    const a = Math.max(0, c.x0 - cam), z = Math.min(W, c.x1 - cam);
    const grd = g.createLinearGradient(0, GROUND, 0, H); grd.addColorStop(0, base); grd.addColorStop(1, '#171f1c');
    g.fillStyle = grd; g.fillRect(a, GROUND, z - a + 1, H - GROUND);
    g.fillStyle = road; g.fillRect(a, GROUND + 20, z - a + 1, 26);
    g.fillStyle = top;
    for (let i = Math.floor((cam + a) / 8); i < (cam + z) / 8; i++) g.fillRect(i * 8 - cam, GROUND - 4 * rnd(i), 8, 6);
    const b = bridgeOf(c);
    if (b) { g.fillStyle = '#0d0c14'; g.fillRect(b.gx - cam, GROUND - 6, b.end - b.gx, H - GROUND + 6); }
  }
}
function drawBridge(cam) {
  const c = countryAt(cam + W / 2), b = bridgeOf(c) || bridgeOf(C[c.i + 1] || c); if (!b) return;
  if (b.bx - cam > W || b.bx + 866 - cam < 0) return;
  const im = img(P.b(st.flags.bridgeFixed ? 'rope_bridge_fixed' : 'rope_bridge_broken'));
  if (im) g.drawImage(im, b.bx - cam, GROUND - 37 - 32, 866, im.height * 866 / im.width);
}
function drawSign(x, label) {
  if (x < -200 || x > W + 200) return;
  g.font = '15px "DotGothic16",monospace'; const tw = g.measureText(label).width + 24;
  g.fillStyle = '#4a3726'; g.fillRect(x - 3, GROUND - 70, 6, 70);
  g.fillStyle = '#8a6a48'; g.fillRect(x - tw / 2, GROUND - 78, tw, 28);
  g.fillStyle = '#f6eee6'; g.textAlign = 'center'; g.fillText(label, x, GROUND - 58);
}
// 船の上：甲板の板目と、奥の手すり
function drawDeck(cam) {
  for (const c of C) {
    if (!c.ship || c.x1 < cam || c.x0 > cam + W) continue;
    const a = Math.max(0, c.x0 - cam), z = Math.min(W, c.x1 - cam);
    g.fillStyle = 'rgba(40,25,15,.35)';
    for (let y = GROUND + 10; y < H; y += 14) g.fillRect(a, y, z - a, 2);
    for (let x = c.x0 + 40; x < c.x1; x += 120) { const sx = x - cam; if (sx > -10 && sx < W + 10) for (let y = GROUND + 10, k = 0; y < H; y += 14, k++) g.fillRect(sx + (k % 2) * 60, y, 2, 12); }
    const rail = img('assets/props/ship_rail.webp'); if (!rail) continue;
    const h = 52, w = rail.width * h / rail.height;
    for (let x = c.x0; x < c.x1; x += w - 4) { const sx = x - cam; if (sx > -w && sx < W) g.drawImage(rail, sx, GROUND + 6 - h, Math.min(w, c.x1 - x), h); }
  }
}
// 船の上のカモメ
function drawGulls(cam, k) {
  if (k <= 0) return;
  g.save(); g.globalAlpha = k; g.strokeStyle = '#f4f1ea'; g.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    const x = ((st.t * (18 + i * 5) + i * 260 - cam * 0.15) % (W + 200) + W + 200) % (W + 200) - 100, y = 70 + i * 28 + Math.sin(st.t * 0.8 + i) * 12, f = Math.sin(st.t * 7 + i * 2) * 6;
    g.beginPath(); g.moveTo(x - 11, y - f); g.quadraticCurveTo(x - 5, y - 4, x, y); g.quadraticCurveTo(x + 5, y - 4, x + 11, y - f); g.stroke();
  }
  g.restore();
}
function shipAmount(cam) { // 画面の真ん中が船の上なら 1、岸に近づくと 0 へ
  const center = cam + W / 2, c = countryAt(center); if (!c.ship) return 0;
  return Math.max(0, Math.min(1, (center - c.x0) / 400, (c.x1 - center) / 400));
}
function drawProps(cam, front) {
  for (const c of C) {
    if (!c.props || c.x1 < cam - 800 || c.x0 > cam + W + 800) continue;
    const back = st.maxX >= c.x1 - 2 && st.x < c.x1;
    for (const [name, rx, ph, when, lift] of c.props) {
      if (!!lift !== !!front) continue; // lift（持ち上げ）つきの小物は建物の手前、屋根の上などに描く
      if (when && !when(st.flags, back)) continue; // 条件つきの小物（帰り道だけ現れる絵など）
      const im = img(`assets/props/${name}.webp`); if (!im) continue;
      const h = ph, w = im.width * h / im.height, x = c.x0 + rx - cam;
      if (x > W + 20 || x + w < -20) continue;
      g.drawImage(im, x, GROUND + 8 - h - (lift || 0), w, h);
    }
  }
}
function drawBuildings(cam) {
  for (const c of C) {
    if (c.x1 < cam - 800 || c.x0 > cam + W + 800) continue;
    for (const [name, rx, sc] of c.buildings) {
      const im = img(P.b(name)); if (!im) continue;
      const s = (sc || 1) * (c.bscale || 1), w = im.width * s, h = im.height * s, x = c.x0 + rx - cam;
      if (x > W + 20 || x + w < -20) continue;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + w / 2, GROUND + 4, w * .52, 9, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(im, x, GROUND + 6 - h, w, h);
    }
  }
}
function drawActor(n, cam) {
  if ((n.when && !n.when(st.flags, isBack(n.c))) || st.flags[n.id + 'Gone']) return;
  const x = npcX(n) - cam; if (x < -160 || x > W + 160) return;
  if (n.sprite) {
    const im = img(`assets/actors/${spriteOf(n)}.webp`); if (!im) return;
    const h = FIG_H * (n.h || ACTOR_H[n.actor] || 1), w = im.width * h / im.height;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, GROUND + 4, 28, 6, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, 0); g.scale(n.face || -1, 1); g.drawImage(im, -w / 2, GROUND + 6 - h + Math.sin(st.t * 1.6 + n.ax) * 1, w, h); g.restore();
    return;
  }
  if (n.sheet) {
    const im = img(P.a(n.actor, 'sheet')); if (!im) return;
    const S = n.sheet, leaving = Math.abs(n.off || 0) > 0;
    const fr = leaving ? S.frames[Math.floor(st.t * 6) % 2 ? 'walk1' : 'walk2'] : (S.frames[(n.pose && n.pose(st.flags)) || 'idle'] ?? 0);
    const s = FIG_H * (S.h || 1) / S.figure, w = S.fw * s, h = S.fh * s;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, GROUND + 4, 30, 6, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, 0); g.scale(leaving ? (n.leaveDir || 1) : (n.face || 1), 1);
    g.drawImage(im, fr * S.fw, 0, S.fw, S.fh, -w / 2, GROUND + 6 - h, w, h); g.restore();
    return;
  }
  const im = img(P.a(n.actor, 'normal')), h = FIG_H * (n.h || ACTOR_H[n.actor] || 1), w = im ? im.width * h / im.height : h * .6;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, GROUND + 4, Math.min(34, w * .45), 7, 0, 0, Math.PI * 2); g.fill();
  if (im) { g.save(); g.translate(x, 0); g.scale(n.off && !n.follow ? -(n.leaveDir || 1) : (n.face || -1), 1); g.drawImage(im, -w / 2, GROUND - h + 4 + Math.sin(st.t * 1.6 + n.ax) * 1.2, w, h); g.restore(); }
}
// ---------------------------------------------------------------- 動物（ペット・家畜・鳥）
// 国の animals: [[種類, x, {mode, range, when, back, face}]]
//   mode: 'walk'（うろうろ歩く・既定）／'stay'（その場にいる）／'fly'（空を回る）
//   back: 'only'（帰り道だけ）／'not'（行きだけ）
//   h: 表示の高さを上書き（子羊など）／shy: 近づくと逃げる／follow(f, back): 真のあいだ nono のうしろをついて歩く
//   moveTo: [条件(f), 新しいx] 条件が真になったら、そこを住みかにする
// 種類の表：[表示の高さ, コマ数, ふるまい]  ふるまい dog＝寄ってくる／cat＝気ままに／bird＝近づくと逃げる／big＝のんびり
const ANIM = {
  dog_samoyed: [46, 2, 'dog'], dog_shiba: [44, 2, 'dog'], dog_spot: [40, 2, 'dog'], dog_puppy: [38, 2, 'dog'], dog_brown: [44, 2, 'dog'],
  dog_mastiff: [56, 1, 'dog'], dog_akita: [50, 2, 'dog'], dog_bulldog: [40, 2, 'dog'], dog_husky: [50, 2, 'dog'], dog_dane: [72, 2, 'dog'],
  dog_pug: [34, 2, 'dog'], dog_borzoi: [62, 2, 'dog'],
  cat_calico: [34, 2, 'cat'], cat_black: [34, 2, 'cat'], cat_orange: [34, 2, 'cat'], cat_white: [34, 2, 'cat'], cat_persian: [38, 2, 'cat'], cat_siamese: [36, 2, 'cat'],
  owl: [42, 2, 'bird'], duck: [36, 2, 'bird'], chicks: [26, 2, 'bird'], crow: [34, 2, 'bird'], rooster: [34, 1, 'bird'], hen: [30, 1, 'bird'],
  sheep: [50, 2, 'big'], horse: [118, 1, 'big'], horse_bay: [120, 2, 'big'], cow: [92, 1, 'big'], donkey: [88, 1, 'big'], camel: [128, 1, 'big'],
  yak: [92, 1, 'big'], llama: [110, 1, 'big'], turtle: [28, 1, 'big'], hawk: [40, 1, 'fly'],
  stork: [70, 1, 'big'], stork_fly: [56, 1, 'fly']
};
const ANIMALS = [];
C.forEach(c => (c.animals || []).forEach(([k, x, o = {}], j) => {
  const a = ANIM[k]; if (!a) return;
  ANIMALS.push({ k, c, home: c.x0 + x, x: c.x0 + x, dir: o.face || (j % 2 ? -1 : 1), o, h: o.h || a[0], n: a[1], kind: o.mode === 'fly' ? 'fly' : a[2],
    mode: o.mode || (a[2] === 'big' && a[1] === 1 ? 'stay' : 'walk'), range: o.range || (a[2] === 'big' ? 160 : 260), pause: Math.random() * 2, ph: Math.random() * 9 });
}));
function animalShown(a) {
  if (a.o.when && !a.o.when(st.flags)) return false;
  const back = st.maxX >= a.c.x1 - 2 && st.x < a.c.x1;
  return !(a.o.back === 'only' && !back) && !(a.o.back === 'not' && back);
}
function drawAnimals(cam, dt) {
  const followers = [];
  for (const a of ANIMALS) {
    if (a.x - cam < -400 || a.x - cam > W + 400 || !animalShown(a)) continue;
    const d = st.x - a.x, near = Math.abs(d) < 150;
    let moving = false;
    const back = st.maxX >= a.c.x1 - 2 && st.x < a.c.x1;
    if (a.o.moveTo && !a.moved && a.o.moveTo[0](st.flags)) { a.moved = true; a.home = a.c.x0 + a.o.moveTo[1]; if (!a.following) a.x = a.home; }
    a.following = !!(a.o.follow && a.o.follow(st.flags, back));
    if (a.following) {
      const tx = st.x - st.dir * 80, dd = tx - a.x;
      if (Math.abs(dd) > 6) { a.dir = Math.sign(dd); a.x += a.dir * Math.min(Math.abs(dd), (Math.abs(dd) > 160 ? 320 : st.moving ? 235 : 90) * dt); moving = true; }
      else a.dir = st.dir;
      followers.push([a, moving]); continue;
    }
    if (a.kind === 'fly') { a.x = a.home + Math.sin(st.t * 0.25 + a.ph) * 380; moving = true; }
    else if (a.mode === 'walk') {
      const sp = a.kind === 'bird' ? 55 : a.kind === 'big' ? 22 : 42;
      if ((a.kind === 'bird' || a.o.shy) && near) { a.dir = d > 0 ? -1 : 1; a.x += a.dir * 120 * dt; moving = true; }
      else if (a.kind === 'dog' && near && Math.abs(d) > 70) { a.dir = Math.sign(d); a.x += a.dir * 70 * dt; moving = true; }
      else if (a.kind === 'dog' && near) { a.dir = Math.sign(d) || 1; }
      else if ((a.pause -= dt) < 0) {
        a.x += a.dir * sp * dt; moving = true;
        if (Math.abs(a.x - a.home) > a.range / 2) { a.dir = Math.sign(a.home - a.x); a.pause = 1 + Math.random() * 3; }
        else if (Math.random() < dt * 0.25) a.pause = 0.8 + Math.random() * 2.5;
      }
      a.x = Math.max(a.c.x0 + 40, Math.min(a.c.x1 - 40, a.x)); // 国の外へは出ない
    } else if (near && a.kind !== 'big') a.dir = Math.sign(d) || a.dir;
    drawAnimal(a, cam, moving);
  }
  for (const [a, m] of followers) drawAnimal(a, cam, m); // ついてくる動物は手前に
}
function drawAnimal(a, cam, moving) {
  {
    const fi = a.n > 1 ? (moving ? Math.floor(st.t * 6 + a.ph) % 2 : (a.mode === 'stay' ? Math.floor(st.t / 3 + a.ph) % 2 : 0)) : 0;
    const im = img(`assets/animals/${a.k}_${fi}.webp`); if (!im) return;
    const h = a.h, w = im.width * h / im.height, x = a.x - cam;
    const y = a.kind === 'fly' ? 70 + Math.sin(st.t * 0.6 + a.ph) * 18 : GROUND + 6 - h - (moving && a.n === 1 ? Math.abs(Math.sin(st.t * 8 + a.ph)) * 2 : 0);
    const dir = a.kind === 'fly' ? 1 : a.dir;
    if (a.kind !== 'fly') { g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(x, GROUND + 5, w * 0.36, 4, 0, 0, Math.PI * 2); g.fill(); }
    g.save(); g.translate(x, 0); g.scale(dir, 1); g.drawImage(im, -w / 2, y, w, h); g.restore();
  }
}

const rabbit = { hop: 0, dx: 0 };
function drawRabbit(cam) {
  const c = C.find(c => c.rabbit != null); if (!c) return;
  const im = img(P.rabbit); const wxr = c.x0 + c.rabbit + rabbit.dx, x = wxr - cam; if (!im || x < -80 || x > W + 80) return;
  const near = Math.abs(wxr - st.x) < 160; rabbit.hop = near ? Math.abs(Math.sin(st.t * 9)) * 10 : 0;
  if (near) rabbit.dx += (wxr > st.x ? 1 : -1) * 40 / 60;
  const h = 46, w = im.width * h / im.height; g.drawImage(im, x - w / 2, GROUND - h + 6 - rabbit.hop, w, h);
}
function drawNono(cam) {
  const im = img(P.nono), x = st.x - cam, h = NONO_H, w = h * 176 / 224, oy = groundOffset(st.x);
  g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x, GROUND + 4 + oy, 30, 6, 0, 0, Math.PI * 2); g.fill();
  if (!im) return;
  const row = st.dir > 0 ? 0 : 1, col = st.moving ? [0, 1, 2, 1][Math.floor(st.phase) % 4] : 1;
  const bob = st.moving ? Math.abs(Math.sin(st.phase * Math.PI)) * 3 : 0;
  g.save(); g.translate(x, GROUND + 6 - h - bob + oy);
  g.drawImage(im, col * 176, row * 224, 176, 224, -w / 2, 0, w, h);
  g.restore();
}
function drawFore(cam) {
  const im = img(P.grass); if (!im) return;
  for (let i = Math.floor(cam * 1.2 / 520) - 1; i < (cam * 1.2 + W) / 520 + 1; i++) {
    const wxg = (i * 520 + rnd(i) * 260) / 1.2, c = countryAt(wxg), b = bridgeOf(c);
    if (c.fore === false || (b && wxg > b.gx - 60 && wxg < b.end)) continue;
    const x = i * 520 + rnd(i) * 260 - cam * 1.2, h = 70 + rnd(i + 3) * 30, w = im.width * h / im.height;
    g.globalAlpha = .9; g.drawImage(im, x, H - h + 20, w, h); g.globalAlpha = 1;
  }
}
function drawPlaces(cam) {
  for (const c of C) {
    if (!c.places || c.x1 < cam || c.x0 > cam + W) continue;
    for (const p of c.places) {
      if (p.when && !p.when(st.flags, isBack(c))) continue;
      const x = c.x0 + p.x - cam; if (x < -20 || x > W + 20) continue;
      const a = .35 + .25 * Math.sin(st.t * 3 + p.x);
      g.fillStyle = `rgba(255,236,180,${a})`; g.beginPath(); g.ellipse(x, GROUND + 6, 18, 4, 0, 0, Math.PI * 2); g.fill();
    }
  }
}
function drawPrompt(cam) {
  if (st.talking || st.journal) return; const t = nearTarget(); if (!t) return;
  const x = (t.isPlace ? (t.ax || st.x) : npcX(t)) - cam, y = GROUND - 165 + Math.sin(st.t * 4) * 3, label = t.isPlace ? t.verb : '話す';
  g.font = '16px "DotGothic16",monospace'; g.textAlign = 'center';
  g.fillStyle = 'rgba(18,13,31,.85)'; g.fillRect(x - 34, y - 20, 68, 28); g.strokeStyle = '#f3a07a'; g.lineWidth = 2; g.strokeRect(x - 34, y - 20, 68, 28);
  g.fillStyle = '#f6eee6'; g.fillText('▼' + label, x, y);
}
function drawHUD(c) {
  const label = `${c.name}　${TIME[timeOf(c)].name}・${WN[wx.next || wx.type]}`;
  g.font = '15px "DotGothic16",monospace'; g.textAlign = 'left';
  const tw = Math.max(220, g.measureText(label).width + 24);
  g.fillStyle = 'rgba(18,13,31,.6)'; g.fillRect(16, 14, tw, 50);
  g.fillStyle = '#f6eee6'; g.fillText(label, 26, 36);
  const bw = tw - 20; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(26, 48, bw, 4);
  g.fillStyle = 'rgba(255,255,255,.45)'; for (const k of C) g.fillRect(26 + k.x0 / WORLD * bw, 45, 1, 10);
  g.fillStyle = '#f3a07a'; g.fillRect(26 + st.x / WORLD * bw - 3, 44, 6, 12);
}
let bannerT = null;
function showBanner(c) {
  const b = $('banner'); b.innerHTML = `${esc(c.name)}<small>${esc(c.sub || '')}　${c.i + 1} / ${C.length}</small>`;
  b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 2600);
}

// ================= ループ =================
let last = 0, lastCam = null, saveT = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; st.t += dt;
  const busy = st.talking || st.journal || st.map || ins.classList.contains('on');
  if (busy) { st.auto = 0; st.run = false; }
  if (st.keyL || st.keyR) st.auto = 0;
  const v = busy ? 0 : ((st.keyR ? 1 : 0) - (st.keyL ? 1 : 0)) || st.auto;
  const runK = st.auto && st.run ? 1.9 : 1;
  st.moving = v !== 0; if (v) st.dir = v;
  const nx = st.x + v * SPEED * runK * windSpeedFactor() * dt;
  st.x = Math.max(60, Math.min(WORLD - 60, nx));
  if (st.x !== nx) { st.auto = 0; st.run = false; } // 世界の端で止まる
  if (st.moving) st.phase += dt * 6.2 * runK;
  { const t = busy ? null : nearTarget(), bt = $('bt'), lab = t && t.isPlace ? t.verb : '話す';
    bt.classList.toggle('near', !!t); bt.classList.toggle('hide', !!busy); $('hint').style.visibility = busy ? 'hidden' : '';
    if (bt.textContent !== lab) bt.textContent = lab;
    $('bj').classList.toggle('hide', !!st.journal || !!st.map); $('bm').classList.toggle('hide', !!st.journal || !!st.map); }
  st.maxX = Math.max(st.maxX, st.x);
  const here = countryAt(st.x);
  if (here !== st.cur) {
    const first = !st.visited[here.id]; st.cur = here; st.visited[here.id] = true;
    showBanner(here); setWeather(pickWeather(here)); wx.timer = 40 + Math.random() * 50; if (first) save();
  }
  prefetch(here); prefetch(C[here.i + 1]); prefetch(C[here.i - 1]);
  // ついてくる住人（迷子の子など）：follow(f) が真のあいだ、nono のうしろを歩く
  if (!busy) for (const n of NPCS) if (n.follow && n.follow(st.flags) && st.x > n.c.x0 && st.x < n.c.x1) { // 国の外へはついてこない
    const t = st.x - st.dir * 80 - n.ax; n.off = (n.off || 0) + (t - (n.off || 0)) * Math.min(1, dt * 2.2);
  }
  if (!busy) for (const n of NPCS) {
    if (!n.leaveWhen || !n.leaveWhen(st.flags) || st.flags[n.id + 'Gone']) continue;
    if (!n.wait) n.wait = st.t + 1.2; // 手を挙げてから歩き出す
    if (st.t > n.wait) { n.off = (n.off || 0) + 120 * dt * (n.leaveDir || 1); if (Math.abs(n.off) > 1400) st.flags[n.id + 'Gone'] = true; }
  }
  const cam = Math.max(0, Math.min(WORLD - W, st.x - W * 0.42));
  const camDx = lastCam == null ? 0 : cam - lastCam; lastCam = cam;
  updateWeather(dt, camDx);
  saveT += dt; if (saveT > 4) { saveT = 0; save(); }

  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); g.imageSmoothingQuality = 'high';
  const sk = shipAmount(cam);
  if (sk > 0) { // 船の上は、ゆっくり揺れる
    g.save(); g.translate(W / 2, H / 2); g.rotate(Math.sin(st.t * 0.9) * 0.012 * sk); g.scale(1 + 0.04 * sk, 1 + 0.04 * sk);
    g.translate(-W / 2, -H / 2 + Math.sin(st.t * 1.3) * 3 * sk);
  }
  const cc = drawFar(cam); drawMid(cam, cc); drawGround(cam); drawDeck(cam); drawGulls(cam, sk);
  const first = C[0]; drawSign(first.x0 + 430 - cam, first.name);
  for (const c of C.slice(1)) drawSign(c.x0 - cam, `← ${C[c.i - 1].name} ｜ ${c.name} →`);
  drawSign(WORLD - 260 - cam, '← ここから先は、来た道');
  drawProps(cam); drawBuildings(cam); drawProps(cam, true); drawBridge(cam);
  drawAnimals(cam, busy ? 0 : dt);
  for (const n of NPCS) drawActor(n, cam);
  drawPlaces(cam); drawRabbit(cam); drawNono(cam); drawFore(cam);
  if (sk > 0) g.restore();
  g.fillStyle = cc.tint || 'rgba(80,40,90,.10)'; g.fillRect(0, 0, W, H);
  const tl = TIME[timeOf(cc)]; if (tl.fill) { g.fillStyle = tl.fill; g.fillRect(0, 0, W, H); }
  drawWeather(cam, st.x - cam);
  drawPrompt(cam); drawHUD(cc);
  requestAnimationFrame(frame);
}

// ================= タイトル =================
const saved = loadSave();
if (saved) { $('start').textContent = '旅をつづける'; $('restart').hidden = false; }
let started = false, armed = false;
function begin(data) {
  if (started) return; started = true;
  if (data) Object.assign(st, { x: data.x, flags: data.flags || {}, evidence: data.evidence || [], insights: data.insights || [], met: data.met || {}, maxX: data.maxX || data.x, visited: data.visited || {} });
  $('title').classList.remove('on'); $('game').classList.add('on'); fitCanvas();
  requestAnimationFrame(frame);
}
$('start').addEventListener('click', () => begin(saved));
$('restart').addEventListener('click', () => {
  if (!armed) { armed = true; $('restart').textContent = 'もう一度押すと、はじめから'; return; }
  clearSave(); begin(null);
});
window.__st = st; window.__wx = wx; window.__setWeather = t => { wx.type = t; wx.next = null; wx.k = 1; }; // 試作の確認用
}
