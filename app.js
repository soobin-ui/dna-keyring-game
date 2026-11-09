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

// 실험실 색 (SVG 그림용 — style.css :root 와 같은 값)
const C = { white: '#FAFCFC', ink: '#16252C', steel: '#C9D3D7', steel2: '#9AA8AE', tile: '#DCE4E7', screen: '#0F1C21', lcd: '#3FE3D2',
  teal: '#0B8F8C', water: '#BFE3F0', A: '#2BB673', T: '#E5484D', G: '#F2A51A', C: '#3B7BF6' };
// 색 면 위에 윤곽선을 한 번 더 그림
const layered = (shapes, top = '') => `<g class="fills">${shapes}</g><g class="lines">${shapes}</g>${top}`;

const GAMES = [
  { id: 'spot', code: 'EXP-01', cap: C.A, title: '틀린그림찾기', desc: '실험실 그림 두 장에서 다른 곳 7개 찾기', time: '5–7분' },
  { id: 'pattern', code: 'EXP-02', cap: C.T, title: '같은 DNA 패턴 찾기', desc: '견본과 같은 색깔 순서의 DNA 고르기', time: '4–5분' },
  { id: 'ox', code: 'EXP-03', cap: C.C, title: 'DNA 상식 OX 퀴즈', desc: '5문제를 풀고 짧은 해설 확인하기', time: '3–5분' },
];

function bar(title, count = '') {
  return `<nav class="bar"><button class="bk" data-go="#/">← 실험 목록</button><span class="bar-t">${title}</span><span class="bar-c" id="bc">${count}</span></nav>`;
}
function sheet(html) {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.innerHTML = html;
  app.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  return d;
}
function report({ code, head, rows, note, again }) {
  return sheet(`<div class="slip" role="dialog" aria-modal="true">
    <div class="slip-top"><span>분석 리포트 · ${code}</span><span>No.${Math.floor(Math.random() * 9000) + 1000}</span></div>
    <h3 class="slip-h">${head}</h3>
    <ul class="slip-rows">${rows.map(([k, v]) => `<li><span>${k}</span><i></i><b>${v}</b></li>`).join('')}</ul>
    <div class="slip-note"><span>결과 해석</span><p>${note}</p></div>
    <div class="slip-btns"><button class="btn line" data-go="${again}">다시 하기</button><button class="btn" data-go="#/">다른 실험</button></div>
  </div>`);
}

/* ================= 첫 화면 ================= */
function bathSVG() {
  const tubes = [C.A, C.T, C.G, C.C].map((c, i) => { const x = 54 + i * 40;
    return `<rect x="${x}" y="26" width="16" height="44" rx="8" fill="${C.white}"/><rect x="${x - 2}" y="18" width="20" height="10" rx="2" fill="${c}"/>`; }).join('');
  const S = `
    ${tubes}
    <rect x="22" y="58" width="208" height="14" rx="3" fill="${C.water}"/>
    <rect x="10" y="64" width="320" height="104" rx="10" fill="${C.tile}"/>
    <rect x="236" y="80" width="80" height="38" rx="4" fill="${C.screen}"/>
    <circle cx="256" cy="144" r="10" fill="${C.white}"/>
    <circle cx="296" cy="144" r="10" fill="${C.white}"/>
    <rect x="34" y="166" width="22" height="8" rx="2" fill="${C.steel2}"/><rect x="284" y="166" width="22" height="8" rx="2" fill="${C.steel2}"/>`;
  const top = `
    <path d="M22 64h208" stroke="${C.ink}" stroke-width="1.8"/>
    <g fill="none" stroke="${C.steel2}" stroke-width="2.2" stroke-linecap="round">
      <path class="steam" d="M78 52q-5-7 0-13t0-13"/><path class="steam" d="M138 52q-5-7 0-13t0-13"/><path class="steam" d="M198 52q-5-7 0-13t0-13"/>
    </g>
    <text x="28" y="96" font-family="IBM Plex Mono,monospace" font-size="10" font-weight="700" fill="${C.ink}" letter-spacing="1.5">WATER BATH</text>
    <text x="28" y="110" font-family="IBM Plex Sans KR,sans-serif" font-size="9.5" fill="#4A5B63">항온 수조</text>
    <g stroke="${C.steel2}" stroke-width="2" stroke-linecap="round"><path d="M30 132h150M30 140h150M30 148h150"/></g>
    <text x="244" y="97" font-family="Orbit,monospace" font-size="10.5" fill="${C.lcd}">온수 처리 중</text>
    <circle class="blink" cx="244" cy="108" r="2.5" fill="${C.lcd}"/>
    <text x="252" y="111" font-family="Orbit,monospace" font-size="8.5" fill="#2A7F78">DNA KEYRING</text>
    <path d="M256 144v-6M296 144l4-4" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    <circle class="blink" cx="318" cy="76" r="3" fill="${C.T}"/>`;
  return `<svg class="bath" viewBox="0 0 340 180" aria-hidden="true">${layered(S, top)}</svg>`;
}
function home() {
  app.innerHTML = `
  <div class="lab-head"><span><i class="dot"></i>BIO PRECISION LAB</span><span>바이오 정밀검진센터</span></div>
  <header class="intro-h">
    <h1>DNA 키링 완성까지<br><span>약 20분</span></h1>
    <p>키링은 지금 온수조에서 처리 중이에요. 기다리는 동안 아래 실험 중 하나를 골라 해 보세요.</p>
  </header>
  ${bathSVG()}
  <section class="pick">
    <div class="pick-h"><h2>실험 하나 고르기</h2><span>SELECT 1 OF 3</span></div>
    ${GAMES.map(g => `<button class="label" data-go="#/${g.id}">
      <span class="label-top"><span class="cap" style="background:${g.cap}"></span>${g.code}<span class="barcode" aria-hidden="true"></span></span>
      <span class="label-main">
        <span><span class="label-t">${g.title}</span><span class="label-d">${g.desc}</span></span>
        <span class="label-go">${g.time}<i>→</i></span>
      </span>
    </button>`).join('')}
  </section>
  <p class="foot">CO-SHOW 2026 · 바이오헬스 혁신융합대학</p>`;
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
  const tubeCols = [C.A, C.T, C.G, C.C];
  const tubes = [150, 170, 190, 210].map((x, i) => (B && i === 2) ? '' :
    `<rect x="${x - 5.5}" y="124" width="11" height="58" rx="5.5" fill="${C.white}"/><rect x="${x - 5.5}" y="146" width="11" height="36" rx="5.5" fill="${tubeCols[i]}"/>`).join('');
  const S = `
    <rect x="18" y="18" width="92" height="72" rx="2" fill="${C.white}"/>
    <rect x="25" y="25" width="78" height="58" fill="${C.water}"/>
    ${B ? '' : `<circle cx="88" cy="40" r="10" fill="${C.G}"/>`}
    <path d="M33 74q0-8 9-7q3-8 12-5q8-2 9 6q7 0 6 6z" fill="${C.white}"/>
    <rect x="132" y="12" width="78" height="102" rx="2" fill="${B ? C.T : C.teal}"/>
    <rect x="139" y="19" width="64" height="88" fill="${C.white}"/>
    <circle cx="240" cy="44" r="22" fill="${C.white}"/>
    <rect x="282" y="96" width="108" height="7" rx="1" fill="${C.steel}"/>
    <path d="M296 56h8v14.5a13 13 0 1 1-8 0z" fill="${C.white}"/>
    <path d="M287.2 84a12.8 12.8 0 0 0 25.6 0z" fill="${C.T}"/>
    <path d="M331 58h8v13l10 25h-28l10-25z" fill="${C.white}"/>
    <path d="M326.5 82h17l5.5 14h-28z" fill="${B ? C.G : C.A}"/>
    <rect x="360" y="66" width="17" height="30" rx="2" fill="${C.C}" fill-opacity=".75"/>
    <rect x="363" y="59" width="11" height="7" fill="${C.ink}"/>
    <rect x="362" y="76" width="13" height="9" fill="${C.white}"/>
    <rect x="-5" y="192" width="410" height="11" fill="${C.steel2}"/>
    <rect x="-5" y="203" width="410" height="102" fill="${C.tile}"/>
    <rect x="18" y="216" width="172" height="74" rx="3" fill="${C.white}"/>
    <rect x="210" y="216" width="172" height="74" rx="3" fill="${C.white}"/>
    <rect x="173" y="240" width="6" height="24" rx="3" fill="${C.steel2}"/><rect x="221" y="240" width="6" height="24" rx="3" fill="${C.steel2}"/>
    <rect x="38" y="182" width="64" height="10" rx="2" fill="${C.white}"/>
    <path d="M82 182V150q0-22-17-29l4-9q23 9 23 38v32z" fill="${C.white}"/>
    <rect x="44" y="146" width="50" height="6" fill="${C.ink}"/>
    <g transform="rotate(-22 60 122)"><rect x="52" y="104" width="17" height="34" fill="${C.white}"/><rect x="50" y="95" width="21" height="10" fill="${C.ink}"/><rect x="56" y="137" width="9" height="9" fill="${C.steel2}"/></g>
    <circle cx="90" cy="163" r="6" fill="${C.teal}"/>
    <ellipse cx="122" cy="189" rx="15" ry="4.5" fill="${C.white}"/>
    ${tubes}
    <rect x="136" y="162" width="90" height="8" fill="${C.steel}"/>
    <rect x="136" y="170" width="90" height="22" fill="${C.white}"/>
    <rect x="247" y="${B ? 177 : 151}" width="38" height="${B ? 12 : 38}" fill="${C.water}"/>
    <path d="M244 134h44v52a6 6 0 0 1-6 6h-32a6 6 0 0 1-6-6z" fill="none"/>
    <ellipse cx="345" cy="150" rx="11" ry="5" transform="rotate(-28 345 150)" fill="${C.A}"/>
    <ellipse cx="367" cy="146" rx="11" ry="5" transform="rotate(28 367 146)" fill="${C.A}"/>
    <ellipse cx="347" cy="134" rx="9" ry="4.5" transform="rotate(-35 347 134)" fill="${C.A}"/>
    <ellipse cx="365" cy="132" rx="9" ry="4.5" transform="rotate(35 365 132)" fill="${C.A}"/>
    ${B ? `<circle cx="356" cy="116" r="5.5" fill="${C.T}"/><circle cx="363" cy="122" r="5.5" fill="${C.T}"/><circle cx="349" cy="122" r="5.5" fill="${C.T}"/><circle cx="356" cy="128" r="5.5" fill="${C.T}"/>` : ''}
    <path d="M340 168h32l-4 24h-24z" fill="${C.white}"/>
    <rect x="336" y="162" width="40" height="8" fill="${C.steel}"/>`;
  // 벽 타일 줄눈
  let grout = '';
  for (let y = 24; y < 192; y += 24) grout += `M0 ${y}H400`;
  for (let x = 24; x < 400; x += 24) grout += `M${x} 0V192`;
  let hp1 = '', hp2 = '', rungs = '';
  for (let i = 0; i <= 24; i++) { const y = 28 + i * 2.6, a = Math.sin(i / 24 * Math.PI * 2.2); hp1 += (i ? 'L' : 'M') + (171 + 16 * a).toFixed(1) + ',' + y.toFixed(1); hp2 += (i ? 'L' : 'M') + (171 - 16 * a).toFixed(1) + ',' + y.toFixed(1); }
  [C.A, C.T, C.G, C.C, C.A, C.G, C.T].forEach((c, k) => { const i = 1.6 + k * 3.3, y = 28 + i * 2.6, a = Math.sin(i / 24 * Math.PI * 2.2); rungs += `<line x1="${(171 + 16 * a).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(171 - 16 * a).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`; });
  const top = `
    <path d="M64 25V83M25 54H103" stroke="${C.ink}" stroke-width="1.8"/>
    ${rungs}
    <path d="${hp1}" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${hp2}" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <text x="171" y="103" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.ink}" font-family="IBM Plex Mono,monospace">DNA</text>
    <g fill="${C.ink}"><circle cx="240" cy="27.5" r="1.8"/><circle cx="256.5" cy="44" r="1.8"/><circle cx="240" cy="60.5" r="1.8"/><circle cx="223.5" cy="44" r="1.8"/></g>
    <path d="M240 44V30" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${B ? 'M240 44H228' : 'M240 44H252'}" stroke="${C.T}" stroke-width="3.8" stroke-linecap="round"/>
    <circle cx="240" cy="44" r="2.6" fill="${C.ink}"/>
    <path d="M296 103v9h8M376 103v9h-8" stroke="${C.steel2}" stroke-width="2" fill="none"/>
    <path d="M249 150h7M249 162h7M249 174h7" stroke="${C.ink}" stroke-width="1.6"/>
    <g fill="${C.T}"><circle cx="116" cy="188.5" r="1.7"/><circle cx="124" cy="190" r="1.7"/><circle cx="128" cy="188" r="1.4"/></g>
    <path d="M356 162V127" stroke="${C.ink}" stroke-width="2"/>
    ${B ? `<circle cx="356" cy="122" r="3.6" fill="${C.G}" stroke="${C.ink}" stroke-width="1.6"/>` : ''}`;
  return `<svg class="lab" viewBox="0 0 400 300" role="img" aria-label="실험실 그림 ${B ? 'B' : 'A'}">
    <rect width="400" height="300" fill="${C.white}"/><path d="${grout}" stroke="${C.tile}" stroke-width="1.5"/>${layered(S, top)}<g class="marks"></g></svg>`;
}
function spot() {
  const found = new Set();
  let hints = 0, done = false;
  const t0 = performance.now();
  app.innerHTML = bar('틀린그림찾기', '0/7') + `
  <main class="g">
    <p class="ins"><span>두 그림에서 <b>다른 곳</b>을 눌러요</span><span class="clock" id="tm">0:00</span></p>
    <figure class="pic"><figcaption>관찰 A</figcaption>${labSVG(false)}</figure>
    <figure class="pic"><figcaption>관찰 B</figcaption>${labSVG(true)}</figure>
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
    const d = DIFFS[hit], k = d.r + 7;
    svgs.forEach(s => {
      s.querySelectorAll(`.hint-${hit}`).forEach(n => n.parentNode.remove());
      add(s, `<g class="found"><circle cx="${d.x}" cy="${d.y}" r="${d.r}"/><path d="M${d.x} ${d.y - k}v8M${d.x} ${d.y + k}v-8M${d.x - k} ${d.y}h8M${d.x + k} ${d.y}h-8"/></g>`);
    });
    document.getElementById('bc').textContent = `${found.size}/7`;
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
    const best = store.spot ? Math.min(store.spot.best, sec) : sec;
    store.spot = { best }; save();
    setTimeout(() => report({
      code: 'EXP-01', again: '#/spot',
      head: `다른 곳 7개를 <span>모두</span> 찾았어요!`,
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
  app.innerHTML = bar('같은 DNA 패턴 찾기', `01/${pad(ROUNDS.length)}`) + `<main class="g" id="pg"></main>`;
  const pg = document.getElementById('pg');
  const next = () => {
    window.scrollTo(0, 0);
    if (r >= ROUNDS.length) return finish();
    if (ROUNDS[r].t === 'pair' && !introShown) { introShown = true; return pairIntro(); }
    play(ROUNDS[r]);
  };
  function pairIntro() {
    pg.innerHTML = `<div class="intro">
      <span class="tag">6번 문제부터 바뀌어요</span>
      <h2 class="big">이번엔 짝꿍 찾기</h2>
      <p>DNA는 두 줄이 사다리처럼 마주 보고 붙어 있어요. 마주 보는 글자는 늘 정해진 짝끼리 만나요.</p>
      <div class="pairs"><span><i class="t t-A">A</i>–<i class="t t-T">T</i></span><span><i class="t t-G">G</i>–<i class="t t-C">C</i></span></div>
      <div class="screen"><div class="screen-l"><span>예시</span><span>EXAMPLE</span></div>${strand('GATC')}<div class="rungs"><i></i><i></i><i></i><i></i></div>${strand('CTAG')}</div>
      <button class="btn" id="go">짝꿍 찾기 시작</button></div>`;
    document.getElementById('go').onclick = next;
  }
  function play(R) {
    document.getElementById('bc').textContent = `${pad(r + 1)}/${pad(ROUNDS.length)}`;
    const target = randSeq(R.n), answer = R.t === 'same' ? target : comp(target);
    const opts = makeOptions(answer, R.t === 'pair' ? [target] : []);
    let locked = false;
    pg.innerHTML = `
      <span class="tag">${R.t === 'same' ? '똑같은 줄 찾기' : '짝꿍 줄 찾기'}</span>
      <h2 class="q">${R.t === 'same' ? '견본과 <u>똑같은</u> DNA를 골라요' : '견본과 <u>짝이 맞는</u> 줄을 골라요'}</h2>
      ${R.t === 'pair' ? '<span class="pair-rule"><span>A–T</span><span>G–C</span></span>' : ''}
      <div class="screen"><div class="screen-l"><span>견본</span><span>SAMPLE-${pad(r + 1)}</span></div>${strand(target)}${R.t === 'pair' ? `<div class="rungs">${'<i></i>'.repeat(R.n)}</div>${strand('?'.repeat(R.n))}` : ''}</div>
      <ol class="choices">${opts.map((o, i) => `<li><button class="ch" data-i="${i}"><span class="cn">${pad(i + 1)}</span>${strand(o)}</button></li>`).join('')}</ol>
      <div id="fb"></div>`;
    pg.querySelectorAll('.ch').forEach(btn => btn.addEventListener('click', () => {
      if (locked) return; locked = true;
      const pick = opts[+btn.dataset.i], ok = pick === answer;
      pg.querySelectorAll('.ch').forEach((b, i) => {
        const cls = opts[i] === answer ? 'right' : b === btn ? 'wrong' : 'dim';
        b.classList.add(cls);
        if (cls !== 'dim') b.insertAdjacentHTML('beforeend', `<span class="verdict">${cls === 'right' ? '일치' : '불일치'}</span>`);
      });
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      if (R.t === 'pair') pg.querySelectorAll('.screen .strand')[1].outerHTML = strand(answer);
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
    store.pattern = { best, total }; save();
    report({
      code: 'EXP-02', again: '#/pattern',
      head: score === total ? `<span>${total}문제</span> 모두 정답!` : `${total}문제 중 <span>${score}개</span> 정답`,
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
const O_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="26" fill="none" stroke="${C.teal}" stroke-width="11"/></svg>`;
const X_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M18 18 62 62M62 18 18 62" stroke="${C.T}" stroke-width="12" stroke-linecap="round"/></svg>`;
function ox() {
  const qs = shuffle(POOL).slice(0, 5);
  let i = 0, score = 0;
  app.innerHTML = bar('DNA 상식 OX 퀴즈', `Q1/5`) + `<main class="g" id="og"></main>`;
  const og = document.getElementById('og');
  function show() {
    window.scrollTo(0, 0);
    const q = qs[i];
    let answered = false;
    document.getElementById('bc').textContent = `Q${i + 1}/${qs.length}`;
    og.innerHTML = `<div class="ox-q"><span class="tag">QUESTION ${pad(i + 1)}</span><h2 class="q">${q.q}</h2></div>
      <div class="oxrow"><button class="oxk" data-v="1" aria-label="O, 맞아요">${O_SVG}<span>맞아요</span></button><button class="oxk" data-v="0" aria-label="X, 아니에요">${X_SVG}<span>아니에요</span></button></div>
      <div id="fb"></div>`;
    og.querySelectorAll('.oxk').forEach(btn => btn.addEventListener('click', () => {
      if (answered) return; answered = true;
      const v = btn.dataset.v === '1', ok = v === q.a;
      og.querySelectorAll('.oxk').forEach(b => b.classList.add((b.dataset.v === '1') === q.a ? 'right' : b === btn ? 'wrong' : 'dim'));
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      const fb = document.getElementById('fb');
      fb.innerHTML = `<div class="explain"><p class="res ${ok ? 'ok' : 'no'}">${ok ? '정답!' : '아쉬워요.'} 답은 ${q.a ? 'O' : 'X'}</p>
        <p><span class="lbl">해설</span>${q.e}</p></div>
        <button class="btn" id="nx">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { i++; i < qs.length ? show() : finish(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const total = qs.length, best = store.ox ? Math.max(store.ox.best, score) : score;
    store.ox = { best, total }; save();
    report({
      code: 'EXP-03', again: '#/ox',
      head: score === total ? `<span>만점!</span> 5문제를 다 맞혔어요` : `${total}문제 중 <span>${score}개</span> 정답`,
      rows: [['맞힌 문제', `${score} / ${total}`], ['내 최고 점수', `${best} / ${total}`]],
      note: '문제는 할 때마다 섞여서 나와요. 다시 하면 처음 보는 문제를 만날 수 있어요.',
    });
  }
  show();
}

/* ================= 화면 전환 ================= */
function route() {
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, '');
  ({ spot, pattern, ox }[h] || home)();
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
