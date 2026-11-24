// レビュー結果の検証：bugs の引用が台本（review/tx/<id>.txt）に本当にあるかを照合する
// 使い方：node tools/review_check.js review/results/<回>.jsonl
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
if (!file) { console.error('usage: node tools/review_check.js review/results/<回>.jsonl'); process.exit(2); }
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
let bad = 0;
const norm = s => s.replace(/\s/g, '');
for (const r of rows) {
  const tx = norm(fs.readFileSync(path.join(__dirname, '..', 'review', 'tx', `${r.id}.txt`), 'utf8'));
  const total = r.axes.reduce((a, b) => a + b, 0);
  const lowGate = [0, 2, 4, 6].some(i => r.axes[i] <= 2);
  const gate = total <= 27 ? '作り直し' : (r.kanten.includes('×') || lowGate) ? '要改善' : total >= 32 ? '合格' : '要改善';
  const missing = (r.bugs || []).filter(b => !tx.includes(norm(b.quote)));
  bad += missing.length;
  if (r.total !== undefined && r.total !== total) console.log(`  ! ${r.id}: total ${r.total} は計算値 ${total} と合わない`);
  if (r.gate && r.gate !== gate) console.log(`  ! ${r.id}: gate「${r.gate}」は判定ゲートの「${gate}」と合わない`);
  console.log(`${r.id.padEnd(10)} ${total}点 ${gate.padEnd(4)} 観点 ${r.kanten.join('')}  不具合 ${(r.bugs || []).length}件${missing.length ? `（引用が台本に見つからない ${missing.length}件: ${missing.map(m => '「' + m.quote + '」').join(' ')}）` : ''}`);
}
console.log(bad ? `\n引用の見つからない指摘: ${bad}件（読み違い・創作の疑い）` : '\n引用はすべて台本で確認できた');
process.exit(bad ? 1 : 0);
