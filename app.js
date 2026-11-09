(() => {
'use strict';

/* ================= 공통 ================= */
const app = document.getElementById('app');
const KEY = 'dna-playground-v1';
let store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pad = n => String(n).padStart(2, '0');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
let cleanups = [];
const onCleanup = f => cleanups.push(f);

// 리소 잉크 (SVG 그림용 — style.css :root 와 같은 값)
const C = { paper: '#F6F1E4', ink: '#1D2858', pink: '#FF4F8B', yellow: '#FFC93B', green: '#1FA77A', blue: '#2D63E2' };
// 리소 인쇄처럼: 색 면은 살짝 어긋나게, 선은 제자리에
const riso = (shapes, top = '', dx = 2.4, dy = 1.8) =>
  `<g class="fills" transform="translate(${dx} ${dy})">${shapes}</g><g class="lines">${shapes}</g>${top}`;

const GAMES = [
  { id: 'spot', title: '틀린그림찾기', desc: '실험실 그림 두 장에서 다른 곳 7개', time: '5–7분' },
  { id: 'pattern', title: '같은 DNA 패턴 찾기', desc: '색깔 순서가 같은 DNA 고르기', time: '4–5분' },
  { id: 'ox', title: 'DNA 상식 OX 퀴즈', desc: '5문제, 문제마다 짧은 해설', time: '3–5분' },
];
const recText = id => { const r = store[id]; if (!r) return ''; return id === 'spot' ? fmt(r.best) : `${r.best}/${r.total}`; };

function bar(title, count = '') {
  return `<nav class="bar"><button class="bk" data-go="#/">← 목록</button><span class="bar-t">${title}</span><span class="bar-c" id="bc">${count}</span></nav>`;
}
function sheet(html) {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.innerHTML = html;
  app.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  return d;
}
function slip({ item, head, rows, note, again }) {
  return sheet(`<div class="slip" role="dialog" aria-modal="true">
    <div class="slip-top"><span>검사 결과지 · ${item}</span><span>No.${Math.floor(Math.random() * 9000) + 1000}</span></div>
    <h3 class="slip-h">${head}</h3>
    <ul class="slip-rows">${rows.map(([k, v]) => `<li><span>${k}</span><i></i><b>${v}</b></li>`).join('')}</ul>
    <div class="slip-note"><span>소견</span><p>${note}</p></div>
    <div class="slip-btns"><button class="btn line" data-go="${again}">다시 하기</button><button class="btn" data-go="#/">목록으로</button></div>
  </div>`);
}
// 손으로 그린 동그라미
function scribble(cx, cy, r, seed) {
  let s = seed * 7919 + 13;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const start = rand() * Math.PI * 2, n = 16, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + Math.PI * 2.18 * i / n, rr = r * (0.94 + rand() * 0.12) * (1 + 0.06 * i / n);
    pts.push([cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr * 0.9]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  return d;
}

/* ================= 목록 ================= */
function bathSVG() {
  const shapes = `
    <rect x="44" y="30" width="30" height="120" rx="15" fill="${C.paper}"/>
    <path d="M46 98h26v37a13 13 0 0 1-26 0z" fill="${C.pink}" fill-opacity=".6"/>
    <rect x="39" y="22" width="40" height="13" rx="2" fill="${C.yellow}"/>
    <path d="M6 104q13-7 27 0t27 0t27 0t27 0V160a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="${C.blue}" fill-opacity=".42"/>`;
  const top = `
    <path d="M6 88V160a4 4 0 0 0 4 4h100a4 4 0 0 0 4-4V88" fill="none" stroke="${C.ink}" stroke-width="2.4"/>
    <path d="M51 120q4-7 8 0t8 0" fill="none" stroke="${C.paper}" stroke-width="3" stroke-linecap="round"/>
    <path d="M53 130q3-5 6 0t6 0" fill="none" stroke="${C.paper}" stroke-width="2.4" stroke-linecap="round"/>
    <path class="steam" d="M20 82q-6-8 0-15t0-15" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path class="steam" d="M98 82q-6-8 0-15t0-15" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  return `<svg class="bath" viewBox="0 0 120 170" aria-hidden="true">${riso(shapes, top)}</svg>`;
}
function home() {
  const doneN = GAMES.filter(g => store[g.id] && store[g.id].done).length;
  app.innerHTML = `
  <header class="head">
    <div class="slug"><span>바이오 정밀검진센터</span><span>DNA 키링 대기실</span></div>
    <div class="head-main">
      <h1 class="title">키링<br>기다리는<br><em>20분</em></h1>
      ${bathSVG()}
    </div>
    <p class="lede">DNA 키링이 따뜻한 물속에서 완성되는 중이에요. 그동안 아래에서 하고 싶은 게임을 골라 보세요.</p>
  </header>
  <ol class="menu">
    ${GAMES.map((g, i) => `<li><button class="item${store[g.id] && store[g.id].done ? ' is-done' : ''}" data-go="#/${g.id}">
      <span class="n">${i + 1}</span>
      <span><span class="it-t">${g.title}</span><span class="it-d">${g.desc}</span></span>
      ${store[g.id] && store[g.id].done ? `<span class="stamp" aria-label="완료"><b>완료</b><small>${recText(g.id)}</small></span>` : `<span class="time">${g.time}</span>`}
    </button></li>`).join('')}
  </ol>
  ${doneN === 3 ? `<button class="done-all" data-go="#/cert"><span>3개 모두 끝! 판정서 받기</span><i>→</i></button>` : ''}
  <footer class="foot"><span>완료 ${doneN} / 3</span><span>CO-SHOW 2026 · 바이오헬스 혁신융합대학</span></footer>`;
}

/* ================= 게임 1: 틀린그림찾기 ================= */
const DIFFS = [
  { x: 88, y: 40, r: 20, name: '창밖의 해' },
  { x: 171, y: 62, r: 36, name: '포스터 테두리 색' },
  { x: 240, y: 44, r: 23, name: '시계 바늘' },
  { x: 335, y: 80, r: 21, name: '삼각 플라스크 색' },
  { x: 190, y: 152, r: 21, name: '시험관 1개' },
  { x: 266, y: 166, r: 27, name: '비커 물 높이' },
  { x: 356, y: 134, r: 24, name: '화분의 꽃' },
];
function labSVG(B) {
  const tubeCols = [C.pink, C.yellow, C.green, C.blue];
  const tubes = [150, 170, 190, 210].map((x, i) => (B && i === 2) ? '' :
    `<rect x="${x - 5.5}" y="124" width="11" height="58" rx="5.5" fill="${C.paper}"/><rect x="${x - 5.5}" y="146" width="11" height="36" rx="5.5" fill="${tubeCols[i]}"/>`).join('');
  const S = `
    <rect x="-5" y="180" width="410" height="12" fill="${C.yellow}" fill-opacity=".35"/>
    <rect x="18" y="18" width="92" height="72" rx="2" fill="${C.paper}"/>
    <rect x="25" y="25" width="78" height="58" fill="${C.blue}" fill-opacity=".3"/>
    ${B ? '' : `<circle cx="88" cy="40" r="10" fill="${C.yellow}"/>`}
    <path d="M33 74q0-8 9-7q3-8 12-5q8-2 9 6q7 0 6 6z" fill="${C.paper}"/>
    <rect x="132" y="12" width="78" height="102" fill="${B ? C.pink : C.blue}"/>
    <rect x="139" y="19" width="64" height="88" fill="${C.paper}"/>
    <circle cx="240" cy="44" r="22" fill="${C.paper}"/>
    <rect x="282" y="96" width="108" height="7" fill="${C.blue}"/>
    <path d="M296 56h8v14.5a13 13 0 1 1-8 0z" fill="${C.paper}"/>
    <path d="M287.2 84a12.8 12.8 0 0 0 25.6 0z" fill="${C.pink}"/>
    <path d="M331 58h8v13l10 25h-28l10-25z" fill="${C.paper}"/>
    <path d="M326.5 82h17l5.5 14h-28z" fill="${B ? C.yellow : C.green}"/>
    <rect x="360" y="66" width="17" height="30" rx="2" fill="${C.yellow}" fill-opacity=".85"/>
    <rect x="363" y="59" width="11" height="7" fill="${C.ink}"/>
    <rect x="362" y="76" width="13" height="9" fill="${C.paper}"/>
    <rect x="-5" y="192" width="410" height="11" fill="${C.blue}"/>
    <rect x="-5" y="203" width="410" height="102" fill="${C.blue}" fill-opacity=".16"/>
    <rect x="18" y="216" width="172" height="74" rx="2" fill="${C.paper}" fill-opacity=".55"/>
    <rect x="210" y="216" width="172" height="74" rx="2" fill="${C.paper}" fill-opacity=".55"/>
    <rect x="173" y="242" width="7" height="20" rx="2" fill="${C.ink}"/><rect x="220" y="242" width="7" height="20" rx="2" fill="${C.ink}"/>
    <rect x="38" y="182" width="64" height="10" rx="2" fill="${C.ink}"/>
    <path d="M82 182V150q0-22-17-29l4-9q23 9 23 38v32z" fill="${C.ink}"/>
    <rect x="44" y="146" width="50" height="6" fill="${C.pink}"/>
    <g transform="rotate(-22 60 122)"><rect x="52" y="104" width="17" height="34" fill="${C.blue}"/><rect x="50" y="95" width="21" height="10" fill="${C.ink}"/><rect x="56" y="137" width="9" height="9" fill="${C.paper}"/></g>
    <circle cx="90" cy="163" r="6" fill="${C.yellow}"/>
    <ellipse cx="122" cy="189" rx="15" ry="4.5" fill="${C.paper}"/>
    ${tubes}
    <rect x="136" y="162" width="90" height="8" fill="${C.yellow}"/>
    <rect x="136" y="170" width="90" height="22" fill="${C.yellow}" fill-opacity=".75"/>
    <rect x="247" y="${B ? 177 : 151}" width="38" height="${B ? 12 : 38}" fill="${C.blue}" fill-opacity=".45"/>
    <path d="M244 134h44v52a6 6 0 0 1-6 6h-32a6 6 0 0 1-6-6z" fill="none"/>
    <ellipse cx="345" cy="150" rx="11" ry="5" transform="rotate(-28 345 150)" fill="${C.green}"/>
    <ellipse cx="367" cy="146" rx="11" ry="5" transform="rotate(28 367 146)" fill="${C.green}"/>
    <ellipse cx="347" cy="134" rx="9" ry="4.5" transform="rotate(-35 347 134)" fill="${C.green}"/>
    <ellipse cx="365" cy="132" rx="9" ry="4.5" transform="rotate(35 365 132)" fill="${C.green}"/>
    ${B ? `<circle cx="356" cy="116" r="5.5" fill="${C.pink}"/><circle cx="363" cy="122" r="5.5" fill="${C.pink}"/><circle cx="349" cy="122" r="5.5" fill="${C.pink}"/><circle cx="356" cy="128" r="5.5" fill="${C.pink}"/>` : ''}
    <path d="M340 168h32l-4 24h-24z" fill="${C.yellow}"/>
    <rect x="336" y="162" width="40" height="8" fill="${C.yellow}"/>`;
  // 위 레이어: 선과 글자 (어긋나지 않음)
  let hp1 = '', hp2 = '', rungs = '';
  for (let i = 0; i <= 24; i++) { const y = 28 + i * 2.6, a = Math.sin(i / 24 * Math.PI * 2.2); hp1 += (i ? 'L' : 'M') + (171 + 16 * a).toFixed(1) + ',' + y.toFixed(1); hp2 += (i ? 'L' : 'M') + (171 - 16 * a).toFixed(1) + ',' + y.toFixed(1); }
  [C.pink, C.yellow, C.green, C.blue, C.pink, C.green, C.yellow].forEach((c, k) => { const i = 1.6 + k * 3.3, y = 28 + i * 2.6, a = Math.sin(i / 24 * Math.PI * 2.2); rungs += `<line x1="${(171 + 16 * a).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(171 - 16 * a).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`; });
  const top = `
    <path d="M64 25V83M25 54H103" stroke="${C.ink}" stroke-width="2"/>
    ${rungs}
    <path d="${hp1}" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${hp2}" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>
    <text x="171" y="103" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.ink}" font-family="IBM Plex Mono,monospace">DNA</text>
    <g fill="${C.ink}"><circle cx="240" cy="27.5" r="1.8"/><circle cx="256.5" cy="44" r="1.8"/><circle cx="240" cy="60.5" r="1.8"/><circle cx="223.5" cy="44" r="1.8"/></g>
    <path d="M240 44V30" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${B ? 'M240 44H228' : 'M240 44H252'}" stroke="${C.pink}" stroke-width="3.8" stroke-linecap="round"/>
    <circle cx="240" cy="44" r="2.6" fill="${C.ink}"/>
    <path d="M296 103v9h8M376 103v9h-8" stroke="${C.ink}" stroke-width="2" fill="none"/>
    <path d="M249 150h7M249 162h7M249 174h7" stroke="${C.ink}" stroke-width="1.6"/>
    <g fill="${C.pink}"><circle cx="116" cy="188.5" r="1.7"/><circle cx="124" cy="190" r="1.7"/><circle cx="128" cy="188" r="1.4"/></g>
    <path d="M356 162V127" stroke="${C.ink}" stroke-width="2.2"/>
    ${B ? `<circle cx="356" cy="122" r="3.6" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.6"/>` : ''}`;
  return `<svg class="lab" viewBox="0 0 400 300" role="img" aria-label="실험실 그림 ${B ? 'B' : 'A'}">
    <rect width="400" height="300" fill="${C.paper}"/>${riso(S, top)}<g class="marks"></g></svg>`;
}
function spot() {
  const found = new Set();
  let hints = 0, done = false;
  const t0 = performance.now();
  app.innerHTML = bar('틀린그림찾기', `<em>0</em>/7`) + `
  <main class="g">
    <p class="ins"><span>두 그림에서 <b>다른 곳</b>을 눌러요</span><span class="clock" id="tm">0:00</span></p>
    <figure class="pic"><figcaption>그림 A</figcaption>${labSVG(false)}</figure>
    <figure class="pic"><figcaption>그림 B</figcaption>${labSVG(true)}</figure>
    <div class="ticks" id="ticks">${DIFFS.map(() => '<i></i>').join('')}<span id="tk">0 / 7</span></div>
    <button class="btn line" id="hint">잘 모르겠어요 · 힌트</button>
  </main>`;
  const svgs = [...app.querySelectorAll('svg.lab')];
  const tm = document.getElementById('tm');
  const iv = setInterval(() => { if (!done) tm.textContent = fmt((performance.now() - t0) / 1000); }, 250);
  onCleanup(() => clearInterval(iv));
  const add = (svg, html, ms) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = html; svg.querySelector('.marks').appendChild(g);
    if (ms) setTimeout(() => g.remove(), ms);
  };
  svgs.forEach(svg => svg.addEventListener('click', e => {
    if (done) return;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 400, y = (e.clientY - r.top) / r.height * 300;
    let hit = -1, best = 1e9;
    DIFFS.forEach((d, i) => { const dist = Math.hypot(d.x - x, d.y - y); if (dist <= d.r + 8 && dist < best) { best = dist; hit = i; } });
    if (hit < 0) { add(svg, `<g class="miss"><path d="M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}"/></g>`, 700); buzz(12); return; }
    if (found.has(hit)) return;
    found.add(hit); buzz(30);
    const d = DIFFS[hit];
    svgs.forEach((s, k) => { s.querySelectorAll(`.hint-${hit}`).forEach(n => n.parentNode.remove()); add(s, `<path class="found" pathLength="1" d="${scribble(d.x, d.y, d.r, hit * 3 + k + 1)}"/>`); });
    document.getElementById('bc').innerHTML = `<em>${found.size}</em>/7`;
    document.getElementById('tk').textContent = `${found.size} / 7`;
    document.querySelectorAll('#ticks i').forEach((el, i) => el.classList.toggle('on', i < found.size));
    if (found.size === DIFFS.length) finish();
  }));
  document.getElementById('hint').addEventListener('click', () => {
    const i = DIFFS.findIndex((d, k) => !found.has(k));
    if (i < 0 || done) return;
    hints++;
    const d = DIFFS[i];
    svgs.forEach(s => add(s, `<circle class="hintc hint-${i}" cx="${d.x}" cy="${d.y}" r="${d.r + 2}"/>`, 2600));
    svgs[0].closest('.pic').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function finish() {
    done = true;
    const sec = (performance.now() - t0) / 1000;
    tm.textContent = fmt(sec);
    const prev = store.spot, best = prev ? Math.min(prev.best, sec) : sec;
    store.spot = { done: true, best }; save();
    setTimeout(() => slip({
      item: '틀린그림찾기', again: '#/spot',
      head: `7곳 <em>다</em> 찾았어요!`,
      rows: [['찾은 곳', '7 / 7'], ['걸린 시간', fmt(sec)], ['힌트', `${hints}회`], ['내 최고 기록', fmt(best)]],
      note: '사람과 사람의 DNA는 99.9%가 같아요. 나머지 0.1%의 작은 차이가 생김새와 체질을 다르게 만들어요. 과학자들도 틀린그림찾기처럼 이 작은 차이를 찾아내요.',
    }), 700);
  }
}

/* ================= 게임 2: 같은 DNA 패턴 찾기 ================= */
const BASES = ['A', 'T', 'G', 'C'];
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const comp = s => [...s].map(c => PAIR[c]).join('');
const strand = s => `<div class="strand">${[...s].map(c => c === '?' ? `<span class="t t-q">?</span>` : `<span class="t t-${c}">${c}</span>`).join('')}</div>`;
function randSeq(n) {
  let s = '';
  while (s.length < n) { const c = rnd(BASES); if (s.length >= 2 && s[s.length - 1] === c && s[s.length - 2] === c) continue; s += c; }
  return new Set(s).size < 3 ? randSeq(n) : s;
}
function mutate(s) { const i = Math.floor(Math.random() * s.length); return s.slice(0, i) + rnd(BASES.filter(b => b !== s[i])) + s.slice(i + 1); }
function swapAdj(s) {
  const idx = [...s].map((c, i) => i).filter(i => i < s.length - 1 && s[i] !== s[i + 1]);
  if (!idx.length) return mutate(s);
  const i = rnd(idx); return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
}
function makeOptions(answer, extra) {
  const seen = new Set([answer]), list = [];
  extra.forEach(e => { if (!seen.has(e)) { seen.add(e); list.push(e); } });
  let guard = 0;
  while (list.length < 3 && guard++ < 200) { const d = Math.random() < 0.55 ? mutate(answer) : swapAdj(answer); if (!seen.has(d)) { seen.add(d); list.push(d); } }
  return shuffle([answer, ...list]);
}
function pattern() {
  const ROUNDS = [{ t: 'same', n: 4 }, { t: 'same', n: 5 }, { t: 'same', n: 5 }, { t: 'same', n: 6 }, { t: 'same', n: 7 },
                  { t: 'pair', n: 4 }, { t: 'pair', n: 5 }, { t: 'pair', n: 6 }];
  let r = 0, score = 0, introShown = false;
  const t0 = performance.now();
  app.innerHTML = bar('같은 DNA 패턴 찾기', `<em>01</em>/${pad(ROUNDS.length)}`) + `<main class="g" id="pg"></main>`;
  const pg = document.getElementById('pg');
  const next = () => {
    window.scrollTo(0, 0);
    if (r >= ROUNDS.length) return finish();
    if (ROUNDS[r].t === 'pair' && !introShown) { introShown = true; return pairIntro(); }
    play(ROUNDS[r]);
  };
  function pairIntro() {
    pg.innerHTML = `<div class="intro">
      <p class="kind">6번 문제부터 바뀌어요</p>
      <h2 class="big">이번엔<br>짝꿍 찾기</h2>
      <p>DNA는 두 줄이 사다리처럼 마주 보고 붙어 있어요. 마주 보는 글자는 늘 정해진 짝끼리 만나요.</p>
      <div class="pairs"><span><i class="t t-A">A</i>–<i class="t t-T">T</i></span><span><i class="t t-G">G</i>–<i class="t t-C">C</i></span></div>
      <div class="sample"><span class="sample-l">예시</span>${strand('GATC')}<div class="rungs"><i></i><i></i><i></i><i></i></div>${strand('CTAG')}</div>
      <button class="btn" id="go">짝꿍 찾기 시작</button></div>`;
    document.getElementById('go').onclick = next;
  }
  function play(R) {
    document.getElementById('bc').innerHTML = `<em>${pad(r + 1)}</em>/${pad(ROUNDS.length)}`;
    const target = randSeq(R.n), answer = R.t === 'same' ? target : comp(target);
    const opts = makeOptions(answer, R.t === 'pair' ? [target] : []);
    let locked = false;
    pg.innerHTML = `
      <p class="kind">${R.t === 'same' ? '똑같은 줄 찾기' : '짝꿍 줄 찾기'}</p>
      <h2 class="q">${R.t === 'same' ? '견본과 <mark>똑같은</mark> DNA를 골라요' : '견본과 <mark>짝이 맞는</mark> 줄을 골라요'}</h2>
      ${R.t === 'pair' ? '<span class="pair-rule"><span>A–T</span><span>G–C</span></span>' : ''}
      <div class="sample"><span class="sample-l">견본</span>${strand(target)}${R.t === 'pair' ? `<div class="rungs">${'<i></i>'.repeat(R.n)}</div>${strand('?'.repeat(R.n))}` : ''}</div>
      <ol class="choices">${opts.map((o, i) => `<li><button class="ch" data-i="${i}"><span class="cn">${i + 1}</span>${strand(o)}</button></li>`).join('')}</ol>
      <div id="fb"></div>`;
    pg.querySelectorAll('.ch').forEach(btn => btn.addEventListener('click', () => {
      if (locked) return; locked = true;
      const pick = opts[+btn.dataset.i], ok = pick === answer;
      pg.querySelectorAll('.ch').forEach((b, i) => b.classList.add(opts[i] === answer ? 'right' : b === btn ? 'wrong' : 'dim'));
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      if (R.t === 'pair') pg.querySelectorAll('.sample .strand')[1].outerHTML = strand(answer);
      let msg;
      if (ok) msg = R.t === 'same' ? '정답! 색깔도 순서도 똑같아요.' : '정답! A는 T와, G는 C와 짝이에요.';
      else if (R.t === 'pair' && pick === target) msg = '아쉬워요. 그건 견본과 똑같은 줄이에요. 짝꿍은 A–T, G–C로 바꿔야 해요.';
      else { const k = [...pick].findIndex((c, j) => c !== answer[j]); msg = `아쉬워요. 앞에서 ${k + 1}번째 칸이 달라요.`; }
      const fb = document.getElementById('fb');
      fb.innerHTML = `<p class="say ${ok ? 'ok' : 'no'}">${msg}</p><button class="btn" id="nx">${r + 1 < ROUNDS.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { r++; next(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const sec = (performance.now() - t0) / 1000, total = ROUNDS.length;
    const best = store.pattern ? Math.max(store.pattern.best, score) : score;
    store.pattern = { done: true, best, total }; save();
    slip({
      item: '같은 DNA 패턴 찾기', again: '#/pattern',
      head: score === total ? `<em>${total}문제</em> 모두 정답!` : `${total}문제 중 <em>${score}개</em> 정답`,
      rows: [['똑같은 줄', '5문제'], ['짝꿍 줄', '3문제'], ['걸린 시간', fmt(sec)], ['내 최고 점수', `${best} / ${total}`]],
      note: 'DNA의 두 줄은 항상 A–T, G–C로 짝을 지어요. 그래서 세포가 둘로 나뉠 때 한 줄만 보고도 나머지 한 줄을 똑같이 만들어 낼 수 있어요.',
    });
  }
  next();
}

/* ================= 게임 3: DNA 상식 OX 퀴즈 ================= */
const POOL = [
  { q: '딸기에서도 DNA를 뽑아낼 수 있다.', a: true, e: '살아 있는 생물의 세포에는 DNA가 들어 있어요. 딸기는 DNA 추출 실험에 자주 쓰이는 과일이에요.' },
  { q: 'DNA는 너무 작아서 눈으로는 절대 볼 수 없다.', a: false, e: 'DNA 한 가닥은 아주 가늘지만, 수많은 가닥이 모이면 하얀 실 뭉치처럼 눈에 보여요. 오늘 키링에 담기는 것도 바로 그 모습이에요.' },
  { q: 'DNA는 꼬인 사다리 모양이다.', a: true, e: '두 가닥이 나선 모양으로 꼬여 있어서 \'이중나선\'이라고 불러요.' },
  { q: 'DNA를 이루는 염기는 A, T, G, C 네 가지이다.', a: true, e: '이 네 글자가 늘어선 순서가 우리 몸을 만드는 설명서 역할을 해요.' },
  { q: 'DNA에서 A는 G와 짝을 이룬다.', a: false, e: 'A는 T와, G는 C와 짝을 이뤄요. 그래서 한쪽 줄만 알아도 반대쪽 줄을 알 수 있어요.' },
  { q: '세포 하나에 든 DNA를 한 줄로 쭉 펴면 내 키보다 길다.', a: true, e: '사람 세포 하나에 든 DNA를 모두 이으면 약 2m나 돼요. 그만큼 아주 촘촘하게 접혀 들어가 있어요.' },
  { q: '사람과 침팬지의 DNA는 절반 정도만 같다.', a: false, e: '사람과 침팬지는 DNA가 약 98~99% 같아요. 아주 작은 차이가 큰 차이를 만들어요.' },
  { q: '일란성 쌍둥이는 DNA가 거의 똑같다.', a: true, e: '수정란 하나가 둘로 나뉘어 태어났기 때문이에요. 그래도 지문은 서로 달라요.' },
  { q: 'DNA만 보면 그 사람의 성격과 공부 실력을 모두 알 수 있다.', a: false, e: 'DNA는 눈 색이나 혈액형 같은 몸의 특징에 영향을 주지만, 성격과 실력은 환경과 경험, 노력에 따라 크게 달라져요.' },
  { q: 'DNA가 이중나선 모양이라는 사실은 1953년에 밝혀졌다.', a: true, e: '왓슨과 크릭이 발표했고, 로절린드 프랭클린이 찍은 X선 사진이 결정적인 단서가 되었어요.' },
  { q: '사람의 DNA에는 염기쌍이 약 30억 개 들어 있다.', a: true, e: '1초에 한 글자씩 쉬지 않고 읽어도 약 95년이 걸리는 양이에요.' },
  { q: '다 자란 사람의 적혈구에는 DNA가 없다.', a: true, e: '적혈구는 산소를 더 많이 실어 나르려고 자라면서 핵을 버려요. 그래서 DNA가 없어요.' },
  { q: 'DNA는 \'디옥시리보핵산\'의 줄임말이다.', a: true, e: '영어 DeoxyriboNucleic Acid의 앞 글자를 따서 DNA라고 불러요.' },
];
const O_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="42.5" cy="41.8" r="26" fill="none" stroke="${C.blue}" stroke-width="12" opacity=".9"/><circle cx="40" cy="40" r="26" fill="none" stroke="${C.ink}" stroke-width="3"/></svg>`;
const X_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20.5 19.8 64.5 63.8M64.5 19.8 20.5 63.8" stroke="${C.pink}" stroke-width="13" stroke-linecap="square" opacity=".9"/><path d="M18 18 62 62M62 18 18 62" stroke="${C.ink}" stroke-width="3"/></svg>`;
function ox() {
  const qs = shuffle(POOL).slice(0, 5);
  let i = 0, score = 0;
  app.innerHTML = bar('DNA 상식 OX 퀴즈', `<em>Q1</em>/5`) + `<main class="g" id="og"></main>`;
  const og = document.getElementById('og');
  function show() {
    window.scrollTo(0, 0);
    const q = qs[i];
    let answered = false;
    document.getElementById('bc').innerHTML = `<em>Q${i + 1}</em>/${qs.length}`;
    og.innerHTML = `<div class="ox-q"><p class="kind">문제 ${i + 1}</p><h2 class="q">${q.q}</h2></div>
      <div class="oxrow"><button class="oxk" data-v="1" aria-label="O, 맞아요">${O_SVG}<span>맞아요</span></button><button class="oxk" data-v="0" aria-label="X, 아니에요">${X_SVG}<span>아니에요</span></button></div>
      <div id="fb"></div>`;
    og.querySelectorAll('.oxk').forEach(btn => btn.addEventListener('click', () => {
      if (answered) return; answered = true;
      const v = btn.dataset.v === '1', ok = v === q.a;
      og.querySelectorAll('.oxk').forEach(b => b.classList.add((b.dataset.v === '1') === q.a ? 'right' : b === btn ? 'wrong' : 'dim'));
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      const fb = document.getElementById('fb');
      fb.innerHTML = `<div class="explain"><p class="res ${ok ? 'ok' : 'no'}">${ok ? '정답!' : '아쉬워요'} 답은 ${q.a ? 'O' : 'X'}</p>
        <p><span class="lbl">해설</span>${q.e}</p></div>
        <button class="btn" id="nx">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { i++; i < qs.length ? show() : finish(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const total = qs.length, best = store.ox ? Math.max(store.ox.best, score) : score;
    store.ox = { done: true, best, total }; save();
    slip({
      item: 'DNA 상식 OX 퀴즈', again: '#/ox',
      head: score === total ? `<em>만점!</em> ${total}문제 다 맞혔어요` : `${total}문제 중 <em>${score}개</em> 정답`,
      rows: [['맞힌 문제', `${score} / ${total}`], ['내 최고 점수', `${best} / ${total}`], ['문제 수', `${POOL.length}개 중 5개`]],
      note: '문제는 할 때마다 섞여서 나와요. 다시 하면 처음 보는 문제를 만날 수 있어요.',
    });
  }
  show();
}

/* ================= 판정서 ================= */
function cert() {
  if (!GAMES.every(g => store[g.id] && store[g.id].done)) { location.hash = '#/'; return; }
  const d = new Date();
  app.innerHTML = `<main class="cert"><div class="cert-paper">
    <div class="slug"><span>판정서</span><span>바이오 정밀검진센터</span></div>
    <h1>DNA<br>탐험가</h1>
    <p>DNA 게임 3개를 모두 마쳤으므로<br>DNA 탐험가로 판정합니다.</p>
    <ul class="slip-rows">
      <li><span>틀린그림찾기</span><i></i><b>${fmt(store.spot.best)}</b></li>
      <li><span>같은 DNA 패턴 찾기</span><i></i><b>${store.pattern.best}/${store.pattern.total}</b></li>
      <li><span>DNA 상식 OX 퀴즈</span><i></i><b>${store.ox.best}/${store.ox.total}</b></li>
    </ul>
    <span class="cert-date">${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}.  CO-SHOW 2026</span>
    <svg class="seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs><path id="sealc" d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0"/></defs>
      <circle cx="60" cy="60" r="55" fill="none" stroke="${C.pink}" stroke-width="4"/>
      <circle cx="60" cy="60" r="30" fill="none" stroke="${C.pink}" stroke-width="2"/>
      <text font-size="10.5" font-weight="700" fill="${C.pink}" letter-spacing="1.5" font-family="IBM Plex Sans KR,sans-serif"><textPath href="#sealc">바이오 정밀검진센터 · DNA 키링 대기실 ·</textPath></text>
      <text x="60" y="67" text-anchor="middle" font-size="20" fill="${C.pink}" font-family="Gasoek One,sans-serif">인증</text>
    </svg>
  </div><button class="btn" data-go="#/">목록으로</button></main>`;
}

/* ================= 화면 전환 ================= */
function route() {
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, '');
  ({ spot, pattern, ox, cert }[h] || home)();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault();
  const h = t.dataset.go;
  if (location.hash === h || (h === '#/' && !location.hash)) route(); else location.hash = h;
});
window.addEventListener('hashchange', route);
route();
})();
