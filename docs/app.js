// れきしパズル: 時代・人物・出来事のカードを、たての年表の正しい番号にはめるパズル。
// データは tools/build-data.js が作った data/rekishi.json。
'use strict';

// 「もどる」「やめる」を押したら、本当にもどるか確かめる(スマホの「戻る」操作も)。
// 画面のボタンは id="back" / id="quit"。もともと確認があるボタンは data-noconfirm をつけて除く
(() => {
  let bypass = false, ignorePop = false;
  const pass = fn => { bypass = true; fn(); setTimeout(() => { bypass = false; }, 500); };
  const ask = onYes => {
    if (document.getElementById('leave-confirm')) return;
    const d = document.createElement('div');
    d.id = 'leave-confirm'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:16px';
    d.innerHTML = '<div style="background:#fff;color:#222;border-radius:16px;padding:20px 18px;max-width:320px;width:100%;display:grid;gap:14px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25)">'
      + '<b style="font-size:18px">本当にもどりますか？</b><span style="font-size:14px;color:#555">いまの続きは消えることがあります。</span>'
      + '<div style="display:flex;gap:10px"><button type="button" data-a="no" style="flex:1;padding:12px;border-radius:12px;border:1px solid #ccc;background:#fff;color:#222;font:inherit;font-weight:700">つづける</button>'
      + '<button type="button" data-a="yes" style="flex:1;padding:12px;border-radius:12px;border:0;background:#2f6fd0;color:#fff;font:inherit;font-weight:700">もどる</button></div></div>';
    d.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (!a && e.target !== d) return;
      d.remove();
      if (a && a.dataset.a === 'yes') onYes();
    });
    document.body.appendChild(d);
    d.querySelector('[data-a="no"]').focus();
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('#back, #quit');
    if (!b || bypass || b.hasAttribute('data-noconfirm')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ask(() => pass(() => b.click()));
  }, true);
  // ROUTED: このアプリが画面ごとに履歴を積むか。積まないアプリは、戻る操作を受け止める「しおり」を1つ積んでおく
  const ROUTED = true;
  const guard = () => history.pushState({ leaveGuard: 1 }, '');
  if (!ROUTED) guard();
  window.addEventListener('popstate', e => {
    if (ignorePop) { ignorePop = false; e.stopImmediatePropagation(); return; }
    if (bypass) return;
    e.stopImmediatePropagation();
    if (!ROUTED) {
      const b = document.querySelector('#back, #quit');
      if (!b) { history.back(); return; }                 // メニュー画面ではそのままアプリを閉じる
      guard();
      if (b.hasAttribute('data-noconfirm')) { b.click(); return; }
      ask(() => pass(() => b.click()));
      return;
    }
    ignorePop = true; history.go(1); // いったん元の画面にとどまる
    ask(() => pass(() => history.back()));
  }, true);
})();

const app = document.getElementById('app');
const DATA = {};

// ---------- 保存(保存できない環境でも遊べる)
const store = {
  get(k, d) { try { const v = localStorage.getItem('rekishi:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rekishi:' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- ふりがな(iPhone対策)
// <ruby>漢字<rt>よみ</rt></ruby> を <span class="rb">漢字<span class="rt">よみ</span></span> に置きかえる。
// 画面に入った直後(描画の前)に置きかえるので、ちらつかない
function fixRuby(root) {
  root.querySelectorAll('ruby').forEach(r => {
    const rt = r.querySelector('rt'), yomi = rt ? rt.textContent : '';
    if (rt) rt.remove();
    const s = document.createElement('span'); s.className = 'rb'; s.innerHTML = r.innerHTML;
    const t = document.createElement('span'); t.className = 'rt'; t.textContent = yomi; s.appendChild(t);
    r.replaceWith(s);
  });
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fixRuby(n.tagName === 'RUBY' ? n.parentNode : n); })
  .observe(document.documentElement, { childList: true, subtree: true });

// ---------- 効果音(Web Audio で合成。音声ファイルは使わない)
const SE = {
  ctx: null,
  muted: store.get('muted', false),
  ac() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; this.ctx = new C(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, at, dur, type = 'sine', vol = 0.18, slideTo = null) {
    const c = this.ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  play(name) {
    if (this.muted) return;
    try {
      if (name === 'start') { this.tone(523, 0, 0.09, 'triangle'); this.tone(784, 0.08, 0.14, 'triangle'); }
      if (name === 'select') this.tone(660, 0, 0.06, 'triangle', 0.12);
      if (name === 'ok') { this.tone(784, 0, 0.1, 'triangle', 0.2); this.tone(1175, 0.08, 0.22, 'sine', 0.2); }
      if (name === 'ng') this.tone(220, 0, 0.3, 'square', 0.06, 150);
      if (name === 'hint') { this.tone(988, 0, 0.08, 'sine', 0.12); this.tone(1319, 0.07, 0.16, 'sine', 0.1); }
      if (name === 'clear') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.16, 'triangle')); [1047, 1319, 1568].forEach(f => this.tone(f, 0.42, 0.6, 'sine', 0.09)); }
    } catch (e) { /* 音が出せない環境でも遊べる */ }
  },
  toggle() { this.muted = !this.muted; store.set('muted', this.muted); if (!this.muted) this.play('select'); },
};

// ---------- 文字まわり
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let LEVEL = store.get('level', 1);
// 名前: 小学生レベルはむずかしい漢字に、どのレベルでも難読の名前(橈骨など)に、ふりがな
const nameHTML = segs => segs.map(s => s.r && (LEVEL === 1 || s.hard) ? `<ruby>${esc(s.t)}<rt>${esc(s.r)}</rt></ruby>` : esc(s.t)).join('');
const plainName = segs => segs.map(s => s.t).join('');
// ヒント文の {漢字|よみ}
const textHTML = t => esc(t || '').replace(/\{([^|}]+)\|([^}]+)\}/g, (_, a, b) => LEVEL === 1 ? `<ruby>${a}<rt>${b}</rt></ruby>` : a);
const LEVELS = [
  { n: 1, html: '<ruby>小学生<rt>しょうがくせい</rt></ruby>', note: '6年生の社会でならう時代と人物(42人)。名前はふりがなつき。' },
  { n: 2, html: '中学生', note: '時代・人物に、中学校でならう主な出来事と年号が加わるよ。' },
  { n: 3, html: '高校生', note: 'もっとくわしい出来事まで。' },
];
// 図は1つ(たての年表)。上が昔、下が今
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
const MODES = [{ k: 'easy', html: 'かんたん<small>時代名あり</small>' }, { k: 'hard', html: 'むずかしい<small>時代名なし</small>' }];
const catHTML = (area, cat) => CATS[cat].html;
const ruby = html => LEVEL === 1 ? html : html.replace(/<rt>.*?<\/rt>/g, '').replace(/<\/?ruby>/g, '');

// ---------- ステージ分け(上のレベルは下のレベルの問題もふくむ)
function itemsFor(area, cat, L) { return DATA.r.items.filter(i => i.cat === cat && i.lv <= L); }
const mapOf = cat => DATA.r.board;
function stagesFor(area, cat, L) {
  const items = itemsFor(area, cat, L).slice();
  // 昔から今へ並べ、近い時代どうしを同じステージにする
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  const n = items.length, k = Math.ceil(n / 7), out = [];
  for (let s = 0, at = 0; s < k; s++) { const size = Math.round((n - at) / (k - s)); out.push(items.slice(at, at + size)); at += size; }
  const st = out.map((its, i) => ({ key: `${area}:${L}:${cat}:${i}${modeKey(cat)}`, no: i + 1, items: its }));
  if (n > 7) st.push({ key: `${area}:${L}:${cat}:all${modeKey(cat)}`, no: 0, items });
  return st;
}
const regionsOf = items => [...new Set(items.flatMap(i => (i.region || '').split('・')).filter(Boolean))];
const best = key => store.get('best:' + key, 0);
const starsHTML = n => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;

// ---------- 画面の移動(スマホの「戻る」でも1つ前へ)
const nav = [];
function go(screen, push = true) {
  if (push) { nav.push(screen); history.pushState({ d: nav.length }, ''); }
  render(screen);
}
function back() { if (nav.length > 1) history.back(); else go({ s: 'home' }, false); }
window.addEventListener('popstate', () => { if (nav.length > 1) nav.pop(); closeSheet(); render(nav[nav.length - 1] || { s: 'home' }); });
function render(sc) {
  if (sc.s === 'home') return home();
  if (sc.s === 'cat') return catPage(sc.area, sc.cat);
  if (sc.s === 'play') return play(sc.area, sc.cat, sc.key);
}
const soundBtn = () => `<button class="link" id="sound" aria-label="効果音">${SE.muted ? '🔇 音なし' : '🔊 音あり'}</button>`;
function bindSound() { const b = app.querySelector('#sound'); if (b) b.onclick = () => { SE.toggle(); b.outerHTML = soundBtn(); bindSound(); }; }
function levelsHTML() {
  return `<div class="levels" role="group" aria-label="レベル">${LEVELS.map(l => `<button data-lv="${l.n}" aria-pressed="${LEVEL === l.n}">${l.html}</button>`).join('')}</div>
  <p class="levelnote">${LEVELS[LEVEL - 1].note}</p>`;
}
function bindLevels(rerender) {
  app.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { LEVEL = +b.dataset.lv; store.set('level', LEVEL); SE.play('select'); rerender(); });
}

// ---------- ホーム(レベルと、時代・人物・出来事)
function home() {
  const area = 'rekishi';
  const cats = CAT_ORDER.rekishi.filter(c => itemsFor(area, c, LEVEL).length);
  const eras = DATA.r.board.eras;
  const COL = ['#f6e7c8', '#e9f0dc', '#e2ecf6', '#f4e2ea'];
  app.innerHTML = `<div class="page">
    <div class="top"><h1>れきしパズル</h1><span class="grow"></span>${soundBtn()}</div>
    <div class="hero"><svg viewBox="0 0 ${eras.length * 40} ${eras.length * 20}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${eras.map((e, i) => `<rect x="${i * 40}" y="0" width="40" height="${eras.length * 20}" fill="${COL[i % 4]}"/><text x="${i * 40 + 20}" y="${eras.length * 10 - 30}" font-size="17" text-anchor="middle" font-weight="800" fill="#4a4436" writing-mode="tb">${e.name}</text>`).join('')}</svg></div>
    <p class="lead">カードを1まいえらんで、年表の正しい番号にはめていこう。上が昔、下が今だよ。ヒントは何回でもつかえるよ。</p>
    ${levelsHTML()}
    <div class="cats">${cats.map(c => {
      const st = stagesFor(area, c, LEVEL), got = st.reduce((a, s) => a + best(s.key), 0);
      return `<button class="cat" data-cat="${c}"><span class="ic" style="background:${CATS[c].bg}">${CATS[c].ic}</span>
        <span><b>${ruby(catHTML(area, c))}</b><small>${itemsFor(area, c, LEVEL).length}こ ・ ${st.length}ステージ</small></span>
        <span class="prog">★ ${got}/${st.length * 3}</span></button>`;
    }).join('')}</div>
    <div class="howto"><b>あそびかた</b><ol>
      <li>下のカードを、年表の番号までドラッグする</li>
      <li>カードをタップしてから、番号をタップしても、はめられる</li>
      <li>こまったら、ヒント。<b>何回つかっても、星はへらない</b>よ</li>
      <li>年が近いもの(数年ちがい)は、どちらの番号に入れても正解になるよ</li></ol></div>
    <p class="foot">人物は、小学校学習指導要領(平成29年告示)の社会 第6学年で例にあげられている42人。よみも同じ資料のふりがなに合わせています。年表の時代の長さは、見やすいように同じ高さにしています(実際の長さとはちがいます)。レベル分けは目安です。</p>
  </div>`;
  bindSound();
  bindLevels(home);
  app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { SE.play('select'); go({ s: 'cat', area, cat: b.dataset.cat }); });
}

// ---------- ステージ一覧
function catPage(area, cat) {
  const st = stagesFor(area, cat, LEVEL);
  app.innerHTML = `<div class="page">
    <div class="top"><button class="back" id="back" aria-label="もどる">←</button><h2>${ruby(catHTML(area, cat))}</h2></div>
    <p class="lead">${LEVELS[LEVEL - 1].html.replace(/<rt>.*?<\/rt>|<\/?ruby>/g, '')}レベル ・ ${itemsFor(area, cat, LEVEL).length}こ</p>
    ${MODE_CATS.includes(cat) ? `<div class="levels modes" role="group" aria-label="モード">${MODES.map(m => `<button data-mode="${m.k}" aria-pressed="${MODE === m.k}">${m.html}</button>`).join('')}</div>
    <p class="levelnote">${MODE === 'easy' ? (cat === 'event' ? '年表に、時代名と年が出るよ。' : '年表に、時代名が出るよ。') : '時代名も年も出ないよ。位置だけで考えよう。'}</p>` : ''}
    <div class="stages">${st.map(s => `<button class="stage" data-key="${s.key}">
      <b>${s.no ? 'ステージ' + s.no : 'ぜんぶ'}</b>
      <small>${s.no ? esc(regionsOf(s.items).slice(0, 3).join('・')) + (regionsOf(s.items).length > 3 ? 'など' : '') : '全部まとめて'} ・ ${s.items.length}こ</small>
      ${starsHTML(best(s.key))}</button>`).join('')}</div>
  </div>`;
  app.querySelector('#back').onclick = back;
  app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => go({ s: 'play', area, cat, key: b.dataset.key }));
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { MODE = b.dataset.mode; store.set('mode', MODE); SE.play('select'); catPage(area, cat); });
}

// ---------- パズル
let S = null;
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const cardSegs = (area, item) => item.segs;
const match = (card, slot) => card.key === slot.key;

function play(area, cat, key) {
  const stage = stagesFor(area, cat, LEVEL).find(s => s.key === key);
  if (!stage) return back();
  const D = mapOf(cat);
  const items = stage.items;
  const order = items.slice().sort((a, b) => hash(a.id + 'c') - hash(b.id + 'c')); // カードの並び(毎回同じ)
  S = { area, cat, key, stage, items, cards: order.map(i => i.id), placed: new Map(), sel: null, miss: 0, cand: null, ring: null, done: false };
  const W = D.w, H = D.h;
  // 番号は図の上から順に(筋肉は前の図→後ろの図)
  const numbered = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  S.num = new Map(numbered.map((i, n) => [i.id, n + 1]));
  const isWorld = false;
  const showEra = cat !== 'era' && (MODE === 'easy' || !MODE_CATS.includes(cat)), showYear = cat === 'event' && MODE === 'easy';
  const COL = ['#f6e7c8', '#e9f0dc', '#e2ecf6', '#f4e2ea'];
  const base = `<rect x="-2000" y="-2000" width="${W + 4000}" height="${H + 4000}" fill="#f7f3ea"/>`
    + D.eras.map((e, i) => `<rect x="0" y="${e.y0}" width="${W}" height="${e.y1 - e.y0}" fill="${COL[i % 4]}"/><line x1="0" x2="${W}" y1="${e.y0}" y2="${e.y0}" stroke="#c9b994" stroke-width="1" vector-effect="non-scaling-stroke"/>`
      + (showEra ? `<text x="52" y="${(e.y0 + e.y1) / 2 + 6}" font-size="17" font-weight="800" text-anchor="middle" fill="#4a4436" font-family="var(--display)">${esc(e.name)}</text>` : '')).join('')
    + `<line x1="104" x2="104" y1="${D.eras[0].y0}" y2="${D.eras[D.eras.length - 1].y1}" stroke="#8a7a5c" stroke-width="2" vector-effect="non-scaling-stroke"/>`
    + `<text x="${W - 6}" y="${D.eras[0].y0 + 14}" font-size="11" text-anchor="end" fill="#8a7a5c">↑ むかし</text><text x="${W - 6}" y="${D.eras[D.eras.length - 1].y1 - 6}" font-size="11" text-anchor="end" fill="#8a7a5c">↓ いま</text>`
    + (showYear ? items.map(i => `<text class="yr" x="${i.x}" y="${i.y - 15}" font-size="11" text-anchor="middle" font-weight="700" fill="#4a4436">${i.year}年</text>`).join('') : '');
  const geo = '';

  app.innerHTML = `<div class="play">
    <div class="bar"><button class="back" id="back" aria-label="もどる">←</button>
      <div class="ttl">${ruby(catHTML(area, cat))}<small>${stage.no ? 'ステージ' + stage.no : 'ぜんぶ'} ・ ${MODE_CATS.includes(cat) ? (MODE === 'easy' ? 'かんたん ・ ' : 'むずかしい ・ ') : ''}${LEVELS[LEVEL - 1].html.replace(/<rt>.*?<\/rt>|<\/?ruby>/g, '')}レベル</small></div>
      <span class="count" id="count"></span></div>
    <div class="mapbox" id="mapbox">
      <svg id="map"><g id="vp">${base}<g id="geo">${geo}</g><g id="rings"></g><g id="labels"></g><g id="slots"></g></g></svg>
      <div class="zoom"><button id="zin" aria-label="拡大">+</button><button id="zout" aria-label="縮小">−</button><button id="zfit" aria-label="ステージ全体を表示" style="font-size:15px">⤢</button></div>
      <div class="toast" id="toast" style="opacity:0"></div>
    </div>
    <div class="hints" id="hints">
      <button id="h-area">🗺️ ちいき</button><button id="h-feat">💡 とくちょう</button><button id="h-two">✌️ 2つにしぼる</button>
    </div>
    <div class="tray" id="tray"></div>
  </div>`;
  app.querySelector('#back').onclick = back;
  SE.play('start');

  // --- 地図の拡大縮小
  const box = app.querySelector('#mapbox'), svgEl = app.querySelector('#map');
  const svg = d3.select(svgEl), vp = svg.select('#vp');
  let k = 1;
  const size = () => { const r = box.getBoundingClientRect(); svgEl.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); return r; };
  let rect = size();
  // 右上の拡大ボタンに番号が隠れないよう、右側を広めにあける
  const fit = (x0, y0, x1, y1, pad = 28) => {
    const pl = pad, pr = pad + 52, pt = pad, pb = pad;
    const kk = Math.min((rect.width - pl - pr) / Math.max(x1 - x0, 1), (rect.height - pt - pb) / Math.max(y1 - y0, 1));
    return d3.zoomIdentity.translate(pl + (rect.width - pl - pr) / 2 - kk * (x0 + x1) / 2, pt + (rect.height - pt - pb) / 2 - kk * (y0 + y1) / 2).scale(kk);
  };
  const stageBox = () => {
    const xs = [], ys = [];
    items.forEach(i => { xs.push(i.x); ys.push(i.y); });
    // 川や範囲の形も枠に入れる
    app.querySelectorAll('#geo path').forEach(p => { const b = p.getBBox(); xs.push(b.x, b.x + b.width); ys.push(b.y, b.y + b.height); });
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const minSpan = 240;
    if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
    if (y1 - y0 < minSpan * 0.7) { const c = (y0 + y1) / 2; y0 = c - minSpan * 0.35; y1 = c + minSpan * 0.35; }
    return [x0, y0, x1, y1];
  };
  const whole = () => fit(0, 0, W, H, 8);
  const zoom = d3.zoom().scaleExtent([whole().k * 0.8, whole().k * 40])
    .on('zoom', ev => { k = ev.transform.k; vp.attr('transform', ev.transform); sizeMarks(); });
  svg.call(zoom).on('dblclick.zoom', null);
  const home = () => fit(...stageBox());
  svg.call(zoom.transform, home());
  app.querySelector('#zin').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.8);
  app.querySelector('#zout').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.8);
  app.querySelector('#zfit').onclick = () => svg.transition().duration(400).call(zoom.transform, home());
  // 地図の枠の大きさが変わったら(カードの段数が変わったときなど)測り直す。まだ触っていなければ、全体が入るよう合わせ直す
  let touched = false;
  svg.on('pointerdown.t wheel.t', () => { touched = true; });
  if (window.ResizeObserver) new ResizeObserver(() => { if (!document.body.contains(box)) return; rect = size(); if (!touched) svg.call(zoom.transform, home()); }).observe(box);
  S.zoomTo = (x0, y0, x1, y1) => svg.transition().duration(600).call(zoom.transform, fit(x0, y0, x1, y1, 40));

  // --- 番号と、はめた名前
  function drawSlots() {
    const g = app.querySelector('#slots');
    g.innerHTML = numbered.map(i => {
      const done = S.placed.has(i.id);
      let cls = done ? 'done' : 'open';
      if (!done && S.cand) cls += S.cand.includes(i.id) ? ' cand' : ' dim';
      return `<g class="slot ${cls}" data-id="${i.id}" data-x="${i.x}" data-y="${i.y}"><circle class="hit" r="22"/><circle class="dot" r="13"/><text dy="5" text-anchor="middle" font-size="15">${done ? '✓' : S.num.get(i.id)}</text></g>`;
    }).join('');
    app.querySelector('#labels').innerHTML = [...S.placed.keys()].map(id => {
      const i = items.find(x => x.id === id), c = items.find(x => x.id === S.placed.get(id));
      const t = plainName(c.segs);
      const left = i.x > W * 0.62;
      return `<g class="lab" data-x="${i.x}" data-y="${i.y}"><text class="label" x="${left ? -19 : 19}" y="5" font-size="14" text-anchor="${left ? 'end' : 'start'}">${esc(t)}</text></g>`;
    }).join('');
    sizeMarks();
    g.querySelectorAll('.slot').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); tapSlot(el.dataset.id); }));
  }
  // 拡大しても番号の大きさは画面上で同じにする
  function sizeMarks() {
    const s = 1 / k;
    app.querySelectorAll('#slots .slot, #labels .lab').forEach(el => el.setAttribute('transform', `translate(${el.dataset.x},${el.dataset.y}) scale(${s})`));
  }
  S.drawSlots = drawSlots;

  // --- カードを番号までドラッグしてはめる(カードをタップ→番号をタップ、でもはめられる)
  let drag = null, dragJustEnded = false;
  // 指の下、なければ指から36px以内でいちばん近い、まだ空いている番号
  function slotNear(x, y) {
    let best = null, bd = 36;
    app.querySelectorAll('#slots .slot:not(.done)').forEach(el => {
      const r = el.querySelector('.dot').getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) { bd = d; best = el; }
    });
    return best;
  }
  function startDrag(ev, b) {
    if (ev.button > 0 || S.done) return;
    drag = { id: b.dataset.card, b, x0: ev.clientX, y0: ev.clientY, ghost: null, over: null };
    try { b.setPointerCapture(ev.pointerId); } catch (e) { /* 取れなくても動く */ }
    b.onpointermove = moveDrag; b.onpointerup = endDrag; b.onpointercancel = () => stopDrag();
  }
  function moveDrag(ev) {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 8) return; // 少し動くまではタップあつかい
      if (S.sel !== drag.id) { S.sel = drag.id; S.cand = null; clearRing(); SE.play('select'); updHints(); drawSlots(); }
      const g = drag.b.cloneNode(true);
      g.classList.add('ghost'); g.setAttribute('aria-pressed', 'true'); g.removeAttribute('data-card');
      document.body.appendChild(g); drag.ghost = g;
      drag.b.classList.add('lifted');
    }
    drag.ghost.style.left = ev.clientX + 'px'; drag.ghost.style.top = ev.clientY + 'px';
    const over = slotNear(ev.clientX, ev.clientY);
    if (over !== drag.over) { if (drag.over) drag.over.classList.remove('hover'); if (over) over.classList.add('hover'); drag.over = over; }
  }
  function stopDrag() {
    if (!drag) return null;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.over) d.over.classList.remove('hover');
    d.b.classList.remove('lifted');
    d.b.onpointermove = d.b.onpointerup = d.b.onpointercancel = null;
    return d;
  }
  function endDrag() {
    const d = stopDrag();
    if (!d || !d.ghost) return; // 動かしていない = ふつうのタップ(onclick に任せる)
    dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 400);
    if (d.over) tapSlot(d.over.dataset.id);
    else { toast('番号の上で、指をはなしてね'); drawTray(); }
  }

  // --- カード
  function drawTray() {
    const left = S.cards.filter(id => !S.used || !S.used.has(id));
    const tray = app.querySelector('#tray');
    tray.innerHTML = left.length
      ? `<div class="lab">${S.sel ? 'えらんだカードの場所を、図の番号からさがそう' : 'カードを1まいえらんで、番号までドラッグしよう(タップでもOK)'}</div>` + left.map(id => {
        const it = items.find(i => i.id === id);
        return `<button class="piece" data-card="${id}" aria-pressed="${S.sel === id}">${nameHTML(cardSegs(area, it))}</button>`;
      }).join('')
      : `<div class="lab">ぜんぶ、はまったよ!</div>`;
    tray.querySelectorAll('[data-card]').forEach(b => {
      b.onclick = () => {
        if (dragJustEnded) { dragJustEnded = false; return; } // ドラッグの直後に来る click は無視
        S.sel = S.sel === b.dataset.card ? null : b.dataset.card; S.cand = null; clearRing(); SE.play('select'); drawTray(); drawSlots(); updHints();
      };
      b.addEventListener('pointerdown', ev => startDrag(ev, b));
    });
    app.querySelector('#count').textContent = `${S.placed.size} / ${items.length}`;
  }
  S.used = new Set();
  function updHints() {
    const on = !!S.sel && !S.done;
    ['#h-area', '#h-feat', '#h-two'].forEach(q => app.querySelector(q).disabled = !on);
  }

  // --- 番号をタップ
  function tapSlot(id) {
    const slot = items.find(i => i.id === id);
    if (S.placed.has(id)) return showInfo(items.find(x => x.id === S.placed.get(id)));
    if (!S.sel) {
      if (slot.cat === 'climate') return showClimate(slot);
      return toast('先に、下のカードを1まいえらんでね');
    }
    const card = items.find(i => i.id === S.sel);
    if (match(card, slot)) {
      SE.play('ok');
      S.placed.set(id, card.id); S.used.add(card.id); S.sel = null; S.cand = null; clearRing();
      const geoEl = app.querySelector(`[data-geo="${CSS.escape(id)}"]`); if (geoEl) geoEl.classList.add('done');
      drawSlots(); drawTray(); updHints();
      toast('せいかい! ' + plainName(card.segs) + (card.year ? '(' + card.year + '年)' : ''));
      if (S.placed.size === items.length) setTimeout(finish, 700);
    } else {
      SE.play('ng'); S.miss++;
      const el = app.querySelector(`.slot[data-id="${CSS.escape(id)}"]`);
      if (el) { el.classList.add('miss'); setTimeout(() => el.classList.remove('miss'), 400); }
      const pc = app.querySelector(`[data-card="${CSS.escape(S.sel)}"]`); if (pc) { pc.classList.remove('shake'); void pc.offsetWidth; pc.classList.add('shake'); }
      toast('ちがうみたい。ヒントもつかってみよう');
    }
  }

  // --- ヒント
  const R = 46;
  function targetFor(card) { // 近い年のなかま(同じ key)が2つ以上あるときは、まだ空いている方
    if (S.placed.has(card.id) === false && !items.some(i => i.key === card.key && i.id !== card.id)) return card;
    const open = items.filter(i => !S.placed.has(i.id) && i.key === card.key);
    return open.find(i => i.id === card.id) || open[0];
  }
  function clearRing() { app.querySelector('#rings').innerHTML = ''; }
  app.querySelector('#h-area').onclick = () => {
    const card = items.find(i => i.id === S.sel), t = targetFor(card);
    const a = hash(t.id) * Math.PI * 2, off = R * 0.45;
    const cx = t.x + Math.cos(a) * off, cy = t.y + Math.sin(a) * off;
    app.querySelector('#rings').innerHTML = `<circle class="ring" cx="${cx}" cy="${cy}" r="${R}"/>`;
    S.zoomTo(cx - R * 1.6, cy - R * 1.6, cx + R * 1.6, cy + R * 1.6);
    SE.play('hint');
    toast((t.region ? t.region + ' の' : '') + 'このまるの中にあるよ');
  };
  app.querySelector('#h-feat').onclick = () => {
    const card = items.find(i => i.id === S.sel);
    SE.play('hint');
    if (card.cat === 'climate') {
      const ty = typeOf(area, card);
      return sheet(`<span class="tag">💡 とくちょう</span><h3>${nameHTML(cardSegs(area, card))}</h3><p>${textHTML(ty.hint)}</p>
        <p class="src" style="font-size:13px">地図の番号を、カードをえらばずにタップすると、その町の${ruby('<ruby>雨温図<rt>うおんず</rt></ruby>')}(気温と雨の量のグラフ)が見られるよ。くらべてみよう。</p>`);
    }
    sheet(`<span class="tag">💡 とくちょう${card.region ? ' ・ ' + esc(card.region) : ''}</span><h3>${nameHTML(card.segs)}</h3><p>${textHTML(card.hint)}</p>`);
  };
  app.querySelector('#h-two').onclick = () => {
    const card = items.find(i => i.id === S.sel), t = targetFor(card);
    const others = items.filter(i => !S.placed.has(i.id) && !match(card, i));
    const pick = others.length ? others[Math.floor(hash(card.id + S.miss) * others.length)] : null;
    S.cand = pick ? [t.id, pick.id] : [t.id];
    SE.play('hint'); clearRing(); drawSlots();
    const xs = S.cand.map(id => items.find(i => i.id === id));
    S.zoomTo(Math.min(...xs.map(i => i.x)) - R, Math.min(...xs.map(i => i.y)) - R, Math.max(...xs.map(i => i.x)) + R, Math.max(...xs.map(i => i.y)) + R);
    toast(pick ? 'オレンジの2つのうち、どちらかだよ' : 'オレンジの番号だよ');
  };

  function showInfo(slot, cardId) {
    if (slot.cat === 'climate') return showClimate(slot, true);
    sheet(`<span class="tag">${esc(slot.region || '')}${slot.year ? ' ・ ' + slot.year + '年' : ''}</span><h3>${nameHTML(slot.segs)}</h3><p>${textHTML(slot.hint)}</p>`);
  }
  function showClimate(slot, solved) {
    const ty = typeOf(area, slot);
    sheet(`<span class="tag">${esc(slot.region || '')}</span><h3>${nameHTML(slot.segs)}の${ruby('<ruby>雨温図<rt>うおんず</rt></ruby>')}</h3>
      ${chart(slot)}
      ${solved ? `<p><b>${esc(ty.name)}</b>: ${textHTML(ty.hint)}</p>` : `<p style="font-size:14px;color:var(--sub)">ぼうグラフが雨の量(右のめもり)、赤い線が気温(左のめもり)。どの気候のカードがあてはまるかな?</p>`}
      <p class="src">${esc(slot.src)}</p>`);
  }
  drawSlots(); drawTray(); updHints();
}

// 雨温図(月ごとの降水量=ぼう、平均気温=線)
function chart(c) {
  const W = 340, H = 222, L = 34, Rr = 36, T = 24, B = 26, w = W - L - Rr, h = H - T - B;
  const tmin = Math.min(-10, Math.floor(Math.min(...c.temp) / 10) * 10), tmax = Math.max(30, Math.ceil(Math.max(...c.temp) / 10) * 10);
  const pmax = Math.max(300, Math.ceil(Math.max(...c.prec) / 100) * 100);
  const x = i => L + (i + 0.5) * w / 12, yt = v => T + h - (v - tmin) / (tmax - tmin) * h, yp = v => T + h - v / pmax * h;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="雨温図">`;
  for (let v = tmin; v <= tmax; v += 10) s += `<line x1="${L}" x2="${L + w}" y1="${yt(v)}" y2="${yt(v)}" stroke="#eee6d3"/><text x="${L - 4}" y="${yt(v) + 3}" text-anchor="end">${v}</text>`;
  for (let v = 0; v <= pmax; v += pmax > 400 ? 200 : 100) s += `<text x="${L + w + 4}" y="${yp(v) + 3}">${v}</text>`;
  c.prec.forEach((p, i) => s += `<rect x="${x(i) - w / 30}" y="${yp(p)}" width="${w / 15}" height="${T + h - yp(p)}" fill="#7db6e8"/>`);
  s += `<polyline fill="none" stroke="#d6455a" stroke-width="2.5" points="${c.temp.map((t, i) => x(i) + ',' + yt(t)).join(' ')}"/>`;
  c.temp.forEach((t, i) => s += `<circle cx="${x(i)}" cy="${yt(t)}" r="2.6" fill="#d6455a"/>`);
  for (let i = 0; i < 12; i++) s += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${i + 1}</text>`;
  if (tmin < 0) s += `<line x1="${L}" x2="${L + w}" y1="${yt(0)}" y2="${yt(0)}" stroke="#c9b994"/>`;
  s += `<text x="${L - 4}" y="${T - 12}" text-anchor="end">℃</text><text x="${L + w + 4}" y="${T - 12}">mm</text><text x="${L + w / 2}" y="${H - 0}" text-anchor="middle">月</text></svg>`;
  const ann = c.prec.reduce((a, b) => a + b, 0), avg = c.temp.reduce((a, b) => a + b, 0) / 12;
  return s + `<p class="src" style="text-align:center;margin:0">年平均気温 ${avg.toFixed(1)}℃ ・ 年降水量 ${Math.round(ann).toLocaleString()}mm</p>`;
}

// ---------- 結果
function finish() {
  if (!S || S.done) return;
  S.done = true;
  const stars = S.miss === 0 ? 3 : S.miss <= 2 ? 2 : 1;
  const prev = best(S.key); if (stars > prev) store.set('best:' + S.key, stars);
  SE.play('clear');
  const st = stagesFor(S.area, S.cat, LEVEL), i = st.findIndex(s => s.key === S.key), next = st[i + 1];
  sheet(`<div class="result"><div class="big">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
    <h3>クリア!</h3><p>まちがい ${S.miss}回${stars === 3 ? ' ・ パーフェクト!' : ''}${stars > prev && prev ? ' ・ 記録こうしん!' : ''}</p>
    <div class="btns">
      ${next ? `<button class="btn main" id="r-next">つぎへ(${next.no ? 'ステージ' + next.no : 'ぜんぶ'})</button>` : ''}
      <button class="btn" id="r-look">図をながめる</button>
      <button class="btn" id="r-again">もういちど</button>
      <button class="btn" id="r-list">ステージいちらんへ</button></div></div>`, false);
  const a = S.area, c = S.cat;
  document.getElementById('r-look').onclick = closeSheet;
  document.getElementById('r-again').onclick = () => { closeSheet(); play(a, c, S.key); };
  document.getElementById('r-list').onclick = () => { closeSheet(); back(); };
  if (next) document.getElementById('r-next').onclick = () => { closeSheet(); nav[nav.length - 1] = { s: 'play', area: a, cat: c, key: next.key }; play(a, c, next.key); };
}

// ---------- 下から出るシートと、地図の上のお知らせ
function sheet(html, closeBtn = true) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog">${html}${closeBtn ? '<div class="btns"><button class="btn main" data-close>とじる</button></div>' : ''}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.hasAttribute('data-close')) closeSheet(); });
  document.body.appendChild(bg);
}
function closeSheet() { document.querySelectorAll('.sheet-bg').forEach(e => e.remove()); }
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.opacity = 0, 2200);
}

// ---------- はじまり
(async () => {
  app.innerHTML = '<div class="page"><p class="lead">図を読みこんでいます…</p></div>';
  try {
    DATA.r = await fetch('data/rekishi.json').then(r => { if (!r.ok) throw new Error('rekishi'); return r.json(); });
  } catch (e) {
    app.innerHTML = '<div class="page"><p class="lead">図が読みこめませんでした。通信できるところで、もう一度ひらいてください。</p></div>';
    return;
  }
  nav.push({ s: 'home' }); history.replaceState({ d: 1 }, '');
  home();
})();
