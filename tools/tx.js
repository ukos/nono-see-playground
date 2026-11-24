// 台本の書き出し：review/tx/<国ID>.txt
// 使い方：node tools/tx.js
const fs = require('fs');
const path = require('path');
const { loadWorld, simulate } = require('./sim');

const world = loadWorld();
const { log } = simulate(world);
const out = path.join(__dirname, '..', 'review', 'tx');
fs.mkdirSync(out, { recursive: true });
const TIME = { morning: '朝', noon: '昼', dusk: '夕暮れ', night: '夜' };
const WN = { clear: '晴れ', drizzle: '小雨', squall: 'スコール', typhoon: '台風', wind: '強風', fog: '霧', densefog: '濃霧', snow: '雪' };

for (const c of world.C) {
  const w = c.weather || {}; const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const head = [
    `== 国: ${c.name}（${c.sub}）`,
    `〔${c.i == null ? '' : ''}${world.C.indexOf(c) + 1}番目の国／広さ ${c.screens} 画面／${TIME[c.time || 'dusk']}／遠景 ${c.far}〕`,
    `〔天候：${Object.entries(w).map(([k, v]) => `${WN[k]} ${Math.round(v / tot * 100)}%`).join('、')}〕`,
    `〔建物：${c.buildings.map(b => b[0]).join('、')}${c.props ? '／小物：' + c.props.map(p => p[0]).join('、') : ''}〕`,
    `〔住人（西から）：${[...c.npcs].sort((a, b) => a.x - b.x).map(n => `${typeof n.name === 'function' ? n.name({}) : n.name} @${n.x}`).join('、')}${c.gap ? `、吊り橋 @${c.gap.x}` : ''}〕`,
    ''
  ];
  const body = []; let phase = '';
  for (const e of log.filter(e => e.c === c.id)) {
    if (e.phase !== phase) { phase = e.phase; body.push(`〔${phase}〕`); }
    body.push(`-- ${e.name} @${e.x}`);
    for (const [sp, face, text] of e.lines) {
      if (sp === 'insight') body.push(`★気づき: ${text}`);
      else if (sp === 'me') body.push(`nono: ${text}`);
      else body.push(`${e.name}${face && face !== 'normal' ? `(${face})` : ''}: ${text}`);
    }
    body.push('');
  }
  fs.writeFileSync(path.join(out, `${c.id}.txt`), head.concat(body).join('\n'));
}
console.log(`wrote ${world.C.length} transcripts to review/tx/`);
