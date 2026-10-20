// からだパズルの app.js / index.html を、れきしパズル用に書きかえる(一度きりの作業用)
const fs = require('fs');
const path = require('path');
const jsP = path.join(__dirname, '../app/app.js'), cssP = path.join(__dirname, '../app/index.html');
let js = fs.readFileSync(jsP, 'utf8'), css = fs.readFileSync(cssP, 'utf8');
function rep(a, b) { if (!js.includes(a)) throw new Error('見つからない: ' + a.slice(0, 80)); js = js.split(a).join(b); }

rep('// からだパズル: 骨・関節・筋肉のカードを、からだの図の正しい番号にはめるパズル。', '// れきしパズル: 時代・人物・出来事のカードを、たての年表の正しい番号にはめるパズル。');
rep("// データは tools/build-data.js が作った data/body.json(図は data/skeleton.svg・data/muscles.svg)。", '// データは tools/build-data.js が作った data/rekishi.json。');
rep("'karada:'", "'rekishi:'");
rep(`  { n: 1, html: '<ruby>小学生<rt>しょうがくせい</rt></ruby>', note: '4年生の理科「人の体のつくりと運動」くらい。やさしい名前で、ふりがなつき。' },
  { n: 2, html: '中学生', note: '中学校の理科でならう、骨や筋肉の正しい名前。読みにくい名前にはふりがな。' },
  { n: 3, html: '高校生', note: 'もっとくわしく。背骨の区分、手と足の骨、背中の筋肉まで。' },`,
  `  { n: 1, html: '<ruby>小学生<rt>しょうがくせい</rt></ruby>', note: '6年生の社会でならう時代と人物(42人)。名前はふりがなつき。' },
  { n: 2, html: '中学生', note: '時代・人物に、中学校でならう主な出来事と年号が加わるよ。' },
  { n: 3, html: '高校生', note: 'もっとくわしい出来事まで。' },`);
rep(`// 1つの「編」だけ。図は種類ごとにちがう(骨・関節=骨格図、筋肉=筋肉図)
const AREAS = { body: { name: 'からだ' } };
const CATS = {
  bone: { html: '<ruby>骨<rt>ほね</rt></ruby>', plain: '骨', ic: '🦴', col: '#d6455a', bg: '#f8e1e4', sub: '頭の骨・むねの骨・せぼね…' },
  joint: { html: '関節', plain: '関節', ic: '🦵', col: '#2f7fd1', bg: '#dceafa', sub: 'かた・ひじ・ひざ…' },
  muscle: { html: '<ruby>筋肉<rt>きんにく</rt></ruby>', plain: '筋肉', ic: '💪', col: '#2f9e6b', bg: '#e1f2e8', sub: '力こぶ・ふくらはぎ…(前と後ろの図)' },
};
const CAT_ORDER = { body: ['bone', 'joint', 'muscle'] };`,
  `// 図は1つ(たての年表)。上が昔、下が今
const AREAS = { rekishi: { name: '日本の歴史' } };
const CATS = {
  era: { html: '時代', plain: '時代', ic: '⏳', col: '#8e5fb8', bg: '#ece2f5' },
  person: { html: '人物', plain: '人物', ic: '👤', col: '#e8743b', bg: '#fde3d2' },
  event: { html: '出来事', plain: '出来事', ic: '📜', col: '#2f7fd1', bg: '#dceafa' },
};
const CAT_ORDER = { rekishi: ['era', 'person', 'event'] };
// モード: かんたん=年表に時代名(出来事は年も)が出る、むずかしい=時代名も年もなく、位置だけ
const MODE_CATS = ['person', 'event'];
let MODE = store.get('mode', 'easy');
const modeKey = cat => MODE_CATS.includes(cat) ? ':' + MODE : '';
const MODES = [{ k: 'easy', html: 'かんたん<small>時代名あり</small>' }, { k: 'hard', html: 'むずかしい<small>時代名なし</small>' }];`);
rep(`// ---------- ステージ分け(レベルごとに出る名前がちがう。小学生は「うでの骨」、中学生は「上腕骨」のように)
function itemsFor(area, cat, L) { return DATA.body.items.filter(i => i.cat === cat && i.lvs.includes(L)); }
const mapOf = cat => DATA.body.maps[cat === 'muscle' ? 'muscle' : 'skel'];`,
  `// ---------- ステージ分け(上のレベルは下のレベルの問題もふくむ)
function itemsFor(area, cat, L) { return DATA.r.items.filter(i => i.cat === cat && i.lv <= L); }
const mapOf = cat => DATA.r.board;`);
rep(`  // 頭から足へ並べ、近い場所どうしを同じステージにする。筋肉は前の図→後ろの図の順
  items.sort((a, b) => (cat === 'muscle' ? (a.x > 200 ? 1000 : 0) - (b.x > 200 ? 1000 : 0) : 0) + a.y - b.y);`,
  `  // 昔から今へ並べ、近い時代どうしを同じステージにする
  items.sort((a, b) => a.y - b.y || a.x - b.x);`);
rep("const st = out.map((its, i) => ({ key: `${area}:${L}:${cat}:${i}`, no: i + 1, items: its }));", "const st = out.map((its, i) => ({ key: `${area}:${L}:${cat}:${i}${modeKey(cat)}`, no: i + 1, items: its }));");
rep("if (n > 7) st.push({ key: `${area}:${L}:${cat}:all`, no: 0, items });", "if (n > 7) st.push({ key: `${area}:${L}:${cat}:all${modeKey(cat)}`, no: 0, items });");

// ホーム
const h0 = js.indexOf('// ---------- ホーム'), h1 = js.indexOf('// ---------- ステージ一覧');
js = js.slice(0, h0) + `// ---------- ホーム(レベルと、時代・人物・出来事)
function home() {
  const area = 'rekishi';
  const cats = CAT_ORDER.rekishi.filter(c => itemsFor(area, c, LEVEL).length);
  const eras = DATA.r.board.eras;
  const COL = ['#f6e7c8', '#e9f0dc', '#e2ecf6', '#f4e2ea'];
  app.innerHTML = \`<div class="page">
    <div class="top"><h1>れきしパズル</h1><span class="grow"></span>\${soundBtn()}</div>
    <div class="hero"><svg viewBox="0 0 \${eras.length * 40} 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">\${eras.map((e, i) => \`<rect x="\${i * 40}" y="0" width="40" height="80" fill="\${COL[i % 4]}"/><text x="\${i * 40 + 20}" y="44" font-size="11" text-anchor="middle" font-weight="800" fill="#4a4436" writing-mode="tb">\${e.name}</text>\`).join('')}</svg></div>
    <p class="lead">カードを1まいえらんで、年表の正しい番号にはめていこう。上が昔、下が今だよ。ヒントは何回でもつかえるよ。</p>
    \${levelsHTML()}
    <div class="cats">\${cats.map(c => {
      const st = stagesFor(area, c, LEVEL), got = st.reduce((a, s) => a + best(s.key), 0);
      return \`<button class="cat" data-cat="\${c}"><span class="ic" style="background:\${CATS[c].bg}">\${CATS[c].ic}</span>
        <span><b>\${ruby(catHTML(area, c))}</b><small>\${itemsFor(area, c, LEVEL).length}こ ・ \${st.length}ステージ</small></span>
        <span class="prog">★ \${got}/\${st.length * 3}</span></button>\`;
    }).join('')}</div>
    <div class="howto"><b>あそびかた</b><ol>
      <li>下のカードを、年表の番号までドラッグする</li>
      <li>カードをタップしてから、番号をタップしても、はめられる</li>
      <li>こまったら、ヒント。<b>何回つかっても、星はへらない</b>よ</li>
      <li>年が近いもの(数年ちがい)は、どちらの番号に入れても正解になるよ</li></ol></div>
    <p class="foot">人物は、小学校学習指導要領(平成29年告示)の社会 第6学年で例にあげられている42人。よみも同じ資料のふりがなに合わせています。年表の時代の長さは、見やすいように同じ高さにしています(実際の長さとはちがいます)。レベル分けは目安です。</p>
  </div>\`;
  bindSound();
  bindLevels(home);
  app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { SE.play('select'); go({ s: 'cat', area, cat: b.dataset.cat }); });
}

` + js.slice(h1);

// ステージ一覧のモード切りかえ
rep(`    <p class="lead">\${LEVELS[LEVEL - 1].html.replace(/<rt>.*?<\\/rt>|<\\/?ruby>/g, '')}レベル ・ \${itemsFor(area, cat, LEVEL).length}こ</p>`,
  `    <p class="lead">\${LEVELS[LEVEL - 1].html.replace(/<rt>.*?<\\/rt>|<\\/?ruby>/g, '')}レベル ・ \${itemsFor(area, cat, LEVEL).length}こ</p>
    \${MODE_CATS.includes(cat) ? \`<div class="levels modes" role="group" aria-label="モード">\${MODES.map(m => \`<button data-mode="\${m.k}" aria-pressed="\${MODE === m.k}">\${m.html}</button>\`).join('')}</div>
    <p class="levelnote">\${MODE === 'easy' ? (cat === 'event' ? '年表に、時代名と年が出るよ。' : '年表に、時代名が出るよ。') : '時代名も年も出ないよ。位置だけで考えよう。'}</p>\` : ''}`);
rep(`  app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => go({ s: 'play', area, cat, key: b.dataset.key }));`,
  `  app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => go({ s: 'play', area, cat, key: b.dataset.key }));
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { MODE = b.dataset.mode; store.set('mode', MODE); SE.play('select'); catPage(area, cat); });`);

// 正解: 近い年どうし(同じ key)は、どちらの番号でも正解
rep('const match = (card, slot) => card.id === slot.id;', 'const match = (card, slot) => card.key === slot.key;');
rep(`  const numbered = items.slice().sort((a, b) => (cat === 'muscle' ? (a.x > 200 ? 1000 : 0) - (b.x > 200 ? 1000 : 0) : 0) + (a.y + a.x * 0.1) - (b.y + b.x * 0.1));`,
  `  const numbered = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);`);
// 年表を描く
rep(`  const base = \`<rect x="-2000" y="-2000" width="\${W + 4000}" height="\${H + 4000}" fill="#f7f3ea"/><image href="\${D.src}" width="\${W}" height="\${H}"/>\`
    + (cat === 'muscle' ? \`<text x="\${W * 0.24}" y="8" class="label" font-size="7" text-anchor="middle">前から</text><text x="\${W * 0.76}" y="8" class="label" font-size="7" text-anchor="middle">後ろから</text>\` : '');`,
  `  const showEra = cat !== 'era' && (MODE === 'easy' || !MODE_CATS.includes(cat)), showYear = cat === 'event' && MODE === 'easy';
  const COL = ['#f6e7c8', '#e9f0dc', '#e2ecf6', '#f4e2ea'];
  const base = \`<rect x="-2000" y="-2000" width="\${W + 4000}" height="\${H + 4000}" fill="#f7f3ea"/>\`
    + D.eras.map((e, i) => \`<rect x="0" y="\${e.y0}" width="\${W}" height="\${e.y1 - e.y0}" fill="\${COL[i % 4]}"/><line x1="0" x2="\${W}" y1="\${e.y0}" y2="\${e.y0}" stroke="#c9b994" stroke-width="1" vector-effect="non-scaling-stroke"/>\`
      + (showEra ? \`<text x="52" y="\${(e.y0 + e.y1) / 2 + 6}" font-size="17" font-weight="800" text-anchor="middle" fill="#4a4436" font-family="var(--display)">\${esc(e.name)}</text>\` : '')).join('')
    + \`<line x1="104" x2="104" y1="\${D.eras[0].y0}" y2="\${D.eras[D.eras.length - 1].y1}" stroke="#8a7a5c" stroke-width="2" vector-effect="non-scaling-stroke"/>\`
    + \`<text x="\${W - 6}" y="\${D.eras[0].y0 + 14}" font-size="11" text-anchor="end" fill="#8a7a5c">↑ むかし</text><text x="\${W - 6}" y="\${D.eras[D.eras.length - 1].y1 - 6}" font-size="11" text-anchor="end" fill="#8a7a5c">↓ いま</text>\`
    + (showYear ? items.map(i => \`<text class="yr" x="\${i.x}" y="\${i.y - 15}" font-size="11" text-anchor="middle" font-weight="700" fill="#4a4436">\${i.year}年</text>\`).join('') : '');`);
// はめた名前: 右はしの列は左側に出す
rep(`      return \`<g class="lab" data-x="\${i.x}" data-y="\${i.y}"><text class="label" x="19" y="5" font-size="14">\${esc(t)}</text></g>\`;`,
  `      const left = i.x > W * 0.62;
      return \`<g class="lab" data-x="\${i.x}" data-y="\${i.y}"><text class="label" x="\${left ? -19 : 19}" y="5" font-size="14" text-anchor="\${left ? 'end' : 'start'}">\${esc(t)}</text></g>\`;`);
rep("const minSpan = cat === 'muscle' ? 90 : 130;", 'const minSpan = 240;');
rep("const R = cat === 'muscle' ? 20 : 34;", 'const R = 46;');
rep(`  function targetFor(card) { // 同じ気候区が2つ以上あるときは、まだ空いている近い方
    if (card.cat !== 'climate') return card;`, `  function targetFor(card) { // 近い年のなかま(同じ key)が2つ以上あるときは、まだ空いている方
    if (S.placed.has(card.id) === false && !items.some(i => i.key === card.key && i.id !== card.id)) return card;`);
rep("${stage.no ? 'ステージ' + stage.no : 'ぜんぶ'} ・ ${LEVELS", "${stage.no ? 'ステージ' + stage.no : 'ぜんぶ'} ・ ${MODE_CATS.includes(cat) ? (MODE === 'easy' ? 'かんたん ・ ' : 'むずかしい ・ ') : ''}${LEVELS");
rep("DATA.body = await fetch('data/body.json').then(r => { if (!r.ok) throw new Error('body'); return r.json(); });", "DATA.r = await fetch('data/rekishi.json').then(r => { if (!r.ok) throw new Error('rekishi'); return r.json(); });");
fs.writeFileSync(jsP, js);

css = css.replace('<title>からだパズル</title>', '<title>れきしパズル</title>').replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="時代・人物・出来事のカードを、年表の正しい場所にはめる日本の歴史パズル。小学生・中学生・高校生の3レベル。">');
css = css.replace('.cats { margin-bottom: 4px; }', '.cats { margin-bottom: 4px; }\n.levels.modes button small { display: block; font-size: 11px; font-weight: 700; opacity: .8; }');
fs.writeFileSync(cssP, css);
console.log('ok');
