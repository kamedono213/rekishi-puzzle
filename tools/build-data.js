// れきしパズルのデータを作る。data/items.txt → app/data/rekishi.json
// 図はたての年表(上が昔、下が今)。時代ごとに同じ高さの帯にし、帯の中では年の位置に番号を置く。
// 実行: node tools/build-data.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const grade = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kanji-grade.json'), 'utf8'));
const EASY = new Set((grade[1] + grade[2] + grade[3] + grade[4]).split(''));
const errors = [], notes = [];

// 「|」で区切る。ただし {漢字|よみ} の中の「|」では切らない
function split(str) { const out = ['']; let depth = 0; for (const ch of str) { if (ch === '{') depth++; if (ch === '}') depth--; if (ch === '|' && !depth) out.push(''); else out[out.length - 1] += ch; } return out; }
const segsOf = name => name.split('/').map(s => { const [t, y] = s.split(':'); return y ? { t, r: y } : { t }; });
const lines = fs.readFileSync(path.join(ROOT, 'data/items.txt'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'));

// 時代の帯
const W = 360, BAND = 110, TOP = 16;
const eraRows = lines.filter(l => l.startsWith('era|')).map(split);
const eras = [];
for (let i = 0; i < eraRows.length - 1; i++) {
  const [, name, start, hint] = eraRows[i], end = +eraRows[i + 1][2];
  const segs = segsOf(name);
  eras.push({ name: segs.map(s => s.t).join(''), segs, s: +start, e: end, y0: TOP + i * BAND, y1: TOP + (i + 1) * BAND, hint });
}
const H = TOP * 2 + eras.length * BAND;
const eraOf = year => eras.find(e => year >= e.s && year < e.e);
const yOf = year => { const e = eraOf(year); if (!e) { errors.push('時代の外の年 ' + year); return 0; } return e.y0 + 14 + (year - e.s) / (e.e - e.s) * (BAND - 28); };

const items = [];
eras.forEach((e, i) => items.push({ id: 'era-' + i, cat: 'era', lv: 1, segs: e.segs, x: 52, y: (e.y0 + e.y1) / 2, region: '', hint: e.hint, key: 'era-' + i }));
for (const l of lines.filter(l => /^(person|event)\|/.test(l))) {
  const [cat, lv, name, year, hint] = split(l);
  const y = +year, e = eraOf(y);
  if (!hint) errors.push('列が足りない ' + l);
  items.push({ id: cat + '-' + items.length, cat, lv: +lv, segs: segsOf(name), year: y, era: e ? e.name : '', x: 0, y: yOf(y), region: e ? e.name + '時代' : '', hint });
}

// 横の位置: 近い年の番号が重ならないよう、4つの列にふり分ける(人物と出来事は別々のステージなので別々に)
const LANES = [150, 210, 270, 330], GAP = 24;
for (const cat of ['person', 'event']) {
  const placed = [];
  for (const it of items.filter(i => i.cat === cat).sort((a, b) => a.y - b.y)) {
    const lane = LANES.find(x => !placed.some(p => p.x === x && Math.abs(p.y - it.y) < GAP)) || LANES[placed.length % LANES.length];
    it.x = lane; placed.push(it);
  }
}
// 近い年どうしは、どちらの番号に入れても正解にする(1〜2年ちがいを位置だけで区別するのは無理なため)
// 1800年より前は8年以内、それより後は2年以内、同じ時代の中だけ
for (const cat of ['person', 'event']) {
  const its = items.filter(i => i.cat === cat).sort((a, b) => a.year - b.year);
  let g = 0;
  its.forEach((it, i) => {
    const p = its[i - 1];
    const close = p && p.era === it.era && (it.year - p.year) <= (it.year < 1800 ? 8 : 2);
    if (!close) g++;
    it.key = cat + '-g' + g;
  });
  const groups = {};
  its.forEach(it => (groups[it.key] = groups[it.key] || []).push(it.segs.map(s => s.t).join('') + it.year));
  Object.values(groups).filter(g => g.length > 1).forEach(g => notes.push('どちらでも正解: ' + g.join(' / ')));
}

// 小学生レベルの文に、ふりがなのない「4年生までに習わない漢字」が残っていないか(名前は全部よみつき)
for (const it of items.filter(i => i.lv === 1)) {
  const plain = it.hint.replace(/\{[^|}]+\|[^}]+\}/g, '');
  const hard = [...new Set([...plain].filter(ch => /[一-鿿]/.test(ch) && !EASY.has(ch)))];
  if (hard.length) notes.push('ふりがなが必要: ' + it.segs.map(s => s.t).join('') + ' … ' + hard.join(''));
}

const out = { board: { w: W, h: H, eras: eras.map(e => ({ name: e.name, segs: e.segs, y0: e.y0, y1: e.y1, s: e.s })) }, items: items.map(i => ({ ...i, x: Math.round(i.x * 10) / 10, y: Math.round(i.y * 10) / 10 })) };
fs.mkdirSync(path.join(ROOT, 'app/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'app/data/rekishi.json'), JSON.stringify(out));
for (const L of [1, 2, 3]) console.log('L' + L, ['era', 'person', 'event'].map(c => c + ' ' + items.filter(i => i.cat === c && i.lv <= L).length).join('  '));
if (notes.length) console.log('\n' + notes.join('\n'));
if (errors.length) { console.log('\nERRORS:\n' + errors.join('\n')); process.exit(1); }
