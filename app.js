(() => {
'use strict';

/* ================= 공통 ================= */
const app = document.getElementById('app');
const KEY = 'dna-playground-v1';
let store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanups = [];
const onCleanup = f => cleanups.push(f);

const ICON = {
  spot: `<svg viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"><circle cx="17" cy="17" r="10"/><path d="M24.5 24.5 33 33"/><path d="M13 17h8M17 13v8" stroke-width="2.6"/></svg>`,
  pattern: `<svg viewBox="0 0 40 40"><rect x="4" y="9" width="7" height="22" rx="2.5" fill="#FFD3D6"/><rect x="13" y="9" width="7" height="22" rx="2.5" fill="#FFE7B0"/><rect x="22" y="9" width="7" height="22" rx="2.5" fill="#fff"/><rect x="31" y="9" width="5" height="22" rx="2.5" fill="#BFE9D6"/></svg>`,
  ox: `<svg viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"><circle cx="12.5" cy="20" r="7.5"/><path d="M24 13l11 14M35 13 24 27"/></svg>`,
};
const GAMES = [
  { id: 'spot', no: '01', title: '바이오헬스 틀린그림찾기', desc: '실험실 그림 2장에서 달라진 곳 7개를 찾아요', time: '약 5~7분', color: '#2F6BFF' },
  { id: 'pattern', no: '02', title: '같은 DNA 패턴 찾기', desc: '색깔 배열이 같은 DNA를 보기에서 골라요', time: '약 4~5분', color: '#13A26B' },
  { id: 'ox', no: '03', title: 'DNA 상식 OX 퀴즈', desc: '5문제를 풀고 정답과 짧은 해설을 확인해요', time: '약 3~5분', color: '#F29F05' },
];

function topbar(title, right = '') {
  return `<div class="topbar"><button class="back" data-go="#/" aria-label="처음 화면으로">‹</button><div class="tb-title">${title}</div>${right}</div>`;
}
function sheet(html) {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  app.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  return d;
}
const trophy = `<svg class="big" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#FFF3D6"/><path d="M27 20h26v10c0 9-6 16-13 16s-13-7-13-16z" fill="#F7B500"/><path d="M27 24h-6c0 7 3 11 8 12M53 24h6c0 7-3 11-8 12" fill="none" stroke="#F7B500" stroke-width="3.5" stroke-linecap="round"/><rect x="36" y="45" width="8" height="9" fill="#E09A00"/><rect x="28" y="54" width="24" height="7" rx="2.5" fill="#0B1F4B"/></svg>`;

/* ================= 첫 화면 ================= */
function home() {
  const doneN = GAMES.filter(g => store[g.id] && store[g.id].done).length;
  app.innerHTML = `
  <header class="hero">
    <span class="pill">바이오 정밀검진센터 · DNA 키링</span>
    <h1>DNA 키링이<br>완성되는 동안</h1>
    <p>키링은 따뜻한 물에서 약 20분!<br>기다리는 동안 DNA 게임 한 판 어때요?</p>
    <svg class="helix" id="helix" viewBox="0 0 104 216" aria-hidden="true"></svg>
  </header>
  <main class="menu">
    <div class="menu-head"><h2>게임을 골라요</h2>
      <span class="prog">${GAMES.map(g => `<i class="${store[g.id] && store[g.id].done ? 'on' : ''}"></i>`).join('')}&nbsp;${doneN}/3 완료</span></div>
    ${GAMES.map(card).join('')}
    ${doneN === 3 ? `<button class="cert-btn" data-go="#/cert">3개 모두 완료! 인증서 보기</button>` : ''}
  </main>
  <p class="foot">2026 CO-SHOW 바이오헬스 혁신융합대학</p>`;
  onCleanup(helix(document.getElementById('helix')));
}
function card(g) {
  const r = store[g.id];
  const rec = !r ? '' : g.id === 'spot' ? `최고 ${fmt(r.best)}` : `최고 ${r.best}/${r.total}`;
  return `<button class="card" data-go="#/${g.id}">
    <span class="ico" style="background:${g.color}">${ICON[g.id]}</span>
    <span class="txt"><span class="no">GAME ${g.no}</span><span class="ttl">${g.title}</span><span class="dsc">${g.desc}</span>
      <span class="meta"><span class="chip">${g.time}</span>${r ? `<span class="chip done">✓ 완료 · ${rec}</span>` : ''}</span></span>
    <span class="go">›</span></button>`;
}
function helix(el) {
  const cols = ['#EF4E5A', '#F29F05', '#13A26B', '#2F6BFF'];
  const N = 11, H = 200, cx = 52, amp = 34;
  let raf, t0 = performance.now();
  const draw = now => {
    const t = (now - t0) / 1000;
    const ph = y => (y / H) * Math.PI * 2.4 + t * 1.1;
    let s = '', p1 = '', p2 = '';
    for (let j = 0; j < N; j++) {
      const y = 12 + j * (H - 8) / (N - 1), a = Math.sin(ph(y)), d = Math.cos(ph(y));
      const x1 = cx + amp * a, x2 = cx - amp * a, op = (0.55 + 0.45 * Math.abs(d)).toFixed(2);
      s += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${cx}" y2="${y.toFixed(1)}" stroke="${cols[j % 4]}" stroke-width="5" stroke-linecap="round" opacity="${op}"/>`;
      s += `<line x1="${cx}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${cols[[1, 0, 3, 2][j % 4]]}" stroke-width="5" stroke-linecap="round" opacity="${op}"/>`;
    }
    for (let i = 0; i <= 50; i++) {
      const y = 6 + i * (H + 4) / 50, a = Math.sin(ph(y));
      p1 += (i ? 'L' : 'M') + (cx + amp * a).toFixed(1) + ',' + y.toFixed(1);
      p2 += (i ? 'L' : 'M') + (cx - amp * a).toFixed(1) + ',' + y.toFixed(1);
    }
    el.innerHTML = s + `<path d="${p1}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/><path d="${p2}" fill="none" stroke="#9DB8FF" stroke-width="4" stroke-linecap="round" opacity=".9"/>`;
    if (!reduced) raf = requestAnimationFrame(draw);
  };
  draw(performance.now());
  return () => cancelAnimationFrame(raf);
}

/* ================= 게임 1: 틀린그림찾기 ================= */
const DIFFS = [
  { x: 88, y: 40, r: 20, name: '창밖의 해' },
  { x: 171, y: 62, r: 34, name: '포스터 테두리 색' },
  { x: 240, y: 44, r: 23, name: '시계 바늘' },
  { x: 335, y: 80, r: 21, name: '삼각 플라스크 색' },
  { x: 190, y: 152, r: 21, name: '시험관 1개' },
  { x: 266, y: 166, r: 27, name: '비커 물 높이' },
  { x: 356, y: 134, r: 23, name: '화분의 꽃' },
];
function labSVG(B) {
  const tubeCols = ['#FF6B6B', '#FFC93C', '#3CCB8B', '#4D8BFF'];
  const tubes = [150, 170, 190, 210].map((x, i) => (B && i === 2) ? '' :
    `<rect x="${x - 5.5}" y="126" width="11" height="56" rx="5.5" fill="#fff" stroke="#9FB4D6" stroke-width="1.6"/><rect x="${x - 3.6}" y="148" width="7.2" height="32" rx="3.6" fill="${tubeCols[i]}"/>`).join('');
  // 포스터 속 이중나선
  let hp1 = '', hp2 = '', rungs = '';
  for (let i = 0; i <= 24; i++) { const y = 28 + i * 2.7, a = Math.sin(i / 24 * Math.PI * 2.2); hp1 += (i ? 'L' : 'M') + (171 + 17 * a).toFixed(1) + ',' + y.toFixed(1); hp2 += (i ? 'L' : 'M') + (171 - 17 * a).toFixed(1) + ',' + y.toFixed(1); }
  ['#EF4E5A', '#F29F05', '#13A26B', '#2F6BFF', '#EF4E5A', '#13A26B', '#F29F05'].forEach((c, k) => { const i = 1.6 + k * 3.3, y = 28 + i * 2.7, a = Math.sin(i / 24 * Math.PI * 2.2); rungs += `<line x1="${(171 + 17 * a).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(171 - 17 * a).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`; });
  const hour = B ? 'M240 44 L228 44' : 'M240 44 L252 44';
  return `<svg class="lab" viewBox="0 0 400 300" role="img" aria-label="실험실 그림${B ? ' 2' : ' 1'}">
  <rect width="400" height="196" fill="#EAF2FF"/>
  <rect y="186" width="400" height="10" fill="#DCE8FA"/>
  <!-- 창문 -->
  <rect x="18" y="18" width="92" height="72" rx="7" fill="#fff"/>
  <rect x="24" y="24" width="80" height="60" rx="3" fill="#BFE3FF"/>
  ${B ? '' : '<circle cx="88" cy="40" r="10" fill="#FFC93C"/>'}
  <g fill="#fff"><ellipse cx="46" cy="68" rx="15" ry="7"/><ellipse cx="55" cy="63" rx="10" ry="7"/><ellipse cx="38" cy="65" rx="7" ry="5"/></g>
  <path d="M64 24V84M24 54H104" stroke="#fff" stroke-width="5"/>
  <!-- 포스터 -->
  <rect x="134" y="14" width="74" height="98" rx="5" fill="#fff" stroke="${B ? '#FF8A3D' : '#2F6BFF'}" stroke-width="4.5"/>
  ${rungs}
  <path d="${hp1}" fill="none" stroke="#0B1F4B" stroke-width="3" stroke-linecap="round"/>
  <path d="${hp2}" fill="none" stroke="#6F8FD8" stroke-width="3" stroke-linecap="round"/>
  <text x="171" y="105" text-anchor="middle" font-size="11" font-weight="800" fill="#0B1F4B" font-family="sans-serif">DNA</text>
  <!-- 시계 -->
  <circle cx="240" cy="44" r="22" fill="#fff" stroke="#0B1F4B" stroke-width="3.5"/>
  <g fill="#0B1F4B"><circle cx="240" cy="27" r="1.8"/><circle cx="257" cy="44" r="1.8"/><circle cx="240" cy="61" r="1.8"/><circle cx="223" cy="44" r="1.8"/></g>
  <path d="M240 44 L240 29" stroke="#0B1F4B" stroke-width="2.6" stroke-linecap="round"/>
  <path d="${hour}" stroke="#EF4E5A" stroke-width="3.6" stroke-linecap="round"/>
  <circle cx="240" cy="44" r="2.6" fill="#0B1F4B"/>
  <!-- 선반 -->
  <rect x="282" y="96" width="108" height="7" rx="2" fill="#8FA9D6"/>
  <path d="M296 103v9h8M376 103v9h-8" stroke="#8FA9D6" stroke-width="3" fill="none"/>
  <rect x="296" y="56" width="8" height="16" rx="2" fill="#fff" stroke="#9FB4D6" stroke-width="1.5"/>
  <circle cx="300" cy="82" r="13" fill="#fff" stroke="#9FB4D6" stroke-width="1.5"/>
  <path d="M288 84a12 12 0 0 0 24 0z" fill="#FF8FB8"/>
  <path d="M331 58h8v13l10 25h-28l10-25z" fill="#fff" stroke="#9FB4D6" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M326.5 82h17l5.5 13.5h-28z" fill="${B ? '#9B5CFF' : '#3CCB8B'}"/>
  <rect x="360" y="66" width="17" height="30" rx="3" fill="#C98A4B"/><rect x="363" y="60" width="11" height="7" rx="1.5" fill="#0B1F4B"/>
  <rect x="362" y="76" width="13" height="9" rx="1.5" fill="#FFF3DE"/>
  <!-- 테이블 -->
  <rect y="192" width="400" height="11" fill="#7FA3D8"/>
  <rect y="203" width="400" height="97" fill="#D7E4F6"/>
  <rect x="18" y="216" width="172" height="74" rx="6" fill="#E6EEFA" stroke="#B8CBE8" stroke-width="2"/>
  <rect x="210" y="216" width="172" height="74" rx="6" fill="#E6EEFA" stroke="#B8CBE8" stroke-width="2"/>
  <rect x="174" y="242" width="6" height="20" rx="3" fill="#8FA9D6"/><rect x="220" y="242" width="6" height="20" rx="3" fill="#8FA9D6"/>
  <!-- 현미경 -->
  <rect x="38" y="182" width="64" height="10" rx="4" fill="#0B1F4B"/>
  <path d="M88 182V148q0-26-22-34" stroke="#0B1F4B" stroke-width="10" fill="none" stroke-linecap="round"/>
  <rect x="44" y="148" width="48" height="6" rx="2" fill="#2F6BFF"/>
  <g transform="rotate(-22 60 122)"><rect x="52" y="104" width="17" height="34" rx="4" fill="#2F6BFF"/><rect x="50" y="96" width="21" height="10" rx="3" fill="#0B1F4B"/><rect x="56" y="137" width="9" height="9" rx="1.5" fill="#8FA9D6"/></g>
  <circle cx="88" cy="160" r="6" fill="#FFC93C"/>
  <ellipse cx="122" cy="189" rx="15" ry="4.5" fill="#EAF7FF" stroke="#9FB4D6" stroke-width="1.5"/>
  <g fill="#FF8FB8"><circle cx="116" cy="188.5" r="1.6"/><circle cx="124" cy="190" r="1.6"/><circle cx="128" cy="188" r="1.3"/></g>
  <!-- 시험관 꽂이 -->
  ${tubes}
  <rect x="138" y="162" width="86" height="7" rx="2" fill="#E89F3C"/>
  <rect x="138" y="170" width="86" height="22" rx="4" fill="#F4B860"/>
  <!-- 비커 -->
  <rect x="247" y="${B ? 176 : 150}" width="38" height="${B ? 13 : 39}" rx="3" fill="#7FD3FF"/>
  <path d="M244 134h44v52a6 6 0 0 1-6 6h-32a6 6 0 0 1-6-6z" fill="rgba(255,255,255,.35)" stroke="#9FB4D6" stroke-width="2"/>
  <path d="M249 150h7M249 162h7M249 174h7" stroke="#9FB4D6" stroke-width="1.6"/>
  <!-- 화분 -->
  <path d="M356 164V128" stroke="#2E9E62" stroke-width="3"/>
  <g fill="#3CCB8B"><ellipse cx="345" cy="150" rx="11" ry="5" transform="rotate(-28 345 150)"/><ellipse cx="367" cy="146" rx="11" ry="5" transform="rotate(28 367 146)"/><ellipse cx="347" cy="134" rx="9" ry="4.5" transform="rotate(-35 347 134)"/><ellipse cx="365" cy="132" rx="9" ry="4.5" transform="rotate(35 365 132)"/></g>
  ${B ? '<g fill="#FF7EB6"><circle cx="356" cy="117" r="5.5"/><circle cx="363" cy="123" r="5.5"/><circle cx="349" cy="123" r="5.5"/><circle cx="356" cy="129" r="5.5"/></g><circle cx="356" cy="123" r="4" fill="#FFC93C"/>' : ''}
  <path d="M340 168h32l-4 24h-24z" fill="#E07B53"/>
  <rect x="336" y="162" width="40" height="8" rx="2.5" fill="#C9653F"/>
  <g class="marks"></g>
</svg>`;
}
function spot() {
  const found = new Set();
  let hints = 0, done = false;
  const t0 = performance.now();
  app.innerHTML = topbar('틀린그림찾기', `<span class="counter">찾은 곳 <b id="cnt">0</b>/7</span>`) + `
  <main class="game">
    <div class="guide"><span>두 그림에서 <b>다른 곳</b>을 눌러요</span><span class="timer" id="tm">0:00</span></div>
    <div class="lab-wrap"><span class="lab-tag">그림 1</span>${labSVG(false)}</div>
    <div class="lab-wrap"><span class="lab-tag">그림 2</span>${labSVG(true)}</div>
    <div class="dots" id="dots">${DIFFS.map(() => '<i></i>').join('')}</div>
    <button class="btn ghost" id="hint">잘 안 보이면? 힌트 보기</button>
  </main>`;
  const svgs = [...app.querySelectorAll('svg.lab')];
  const tm = document.getElementById('tm');
  const iv = setInterval(() => { if (!done) tm.textContent = fmt((performance.now() - t0) / 1000); }, 250);
  onCleanup(() => clearInterval(iv));
  const add = (svg, html, ms) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = html; svg.querySelector('.marks').appendChild(g);
    if (ms) setTimeout(() => g.remove(), ms);
    return g;
  };
  svgs.forEach(svg => svg.addEventListener('click', e => {
    if (done) return;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 400, y = (e.clientY - r.top) / r.height * 300;
    let hit = -1, best = 1e9;
    DIFFS.forEach((d, i) => { const dist = Math.hypot(d.x - x, d.y - y); if (dist <= d.r + 8 && dist < best) { best = dist; hit = i; } });
    if (hit < 0) { add(svg, `<g class="miss"><path d="M${x - 9} ${y - 9}L${x + 9} ${y + 9}M${x + 9} ${y - 9}L${x - 9} ${y + 9}"/></g>`, 700); buzz(12); return; }
    if (found.has(hit)) return;
    found.add(hit); buzz(30);
    const d = DIFFS[hit];
    svgs.forEach(s => { s.querySelectorAll(`.hint-${hit}`).forEach(n => n.remove()); add(s, `<circle class="found" cx="${d.x}" cy="${d.y}" r="${d.r}"/>`); });
    document.getElementById('cnt').textContent = found.size;
    document.querySelectorAll('#dots i').forEach((el, i) => el.classList.toggle('on', i < found.size));
    if (found.size === DIFFS.length) finish();
  }));
  document.getElementById('hint').addEventListener('click', () => {
    const i = DIFFS.findIndex((d, k) => !found.has(k));
    if (i < 0 || done) return;
    hints++;
    const d = DIFFS[i];
    svgs.forEach(s => add(s, `<circle class="hintc hint-${i}" cx="${d.x}" cy="${d.y}" r="${d.r + 4}"/>`, 2600));
    svgs[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function finish() {
    done = true;
    const sec = (performance.now() - t0) / 1000;
    tm.textContent = fmt(sec);
    const best = store.spot ? Math.min(store.spot.best, sec) : sec;
    const isBest = !store.spot || sec <= store.spot.best;
    store.spot = { done: true, best }; save();
    setTimeout(() => sheet(`${trophy}
      <h3>7곳을 모두 찾았어요!</h3>
      <p class="sub">${isBest ? '내 최고 기록이에요' : `내 최고 기록은 ${fmt(best)}`}</p>
      <div class="stats"><div><span>걸린 시간</span><b>${fmt(sec)}</b></div><div><span>힌트</span><b>${hints}번</b></div></div>
      <p class="fact"><b>알고 있나요?</b>사람과 사람의 DNA는 99.9%가 같아요. 나머지 0.1%의 작은 차이가 생김새와 체질을 다르게 만들어요. 과학자들도 틀린그림찾기처럼 이 작은 차이를 찾아내요.</p>
      <div class="row"><button class="btn ghost" data-go="#/spot">다시 하기</button><button class="btn" data-go="#/">다른 게임</button></div>`), 750);
  }
}

/* ================= 게임 2: 같은 DNA 패턴 찾기 ================= */
const BASES = ['A', 'T', 'G', 'C'];
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const comp = s => [...s].map(c => PAIR[c]).join('');
const strand = s => `<div class="strand">${[...s].map(c => c === '?' ? `<span class="b b-q">?</span>` : `<span class="b b-${c}">${c}</span>`).join('')}</div>`;
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
  app.innerHTML = topbar('같은 DNA 패턴 찾기', `<span class="counter"><b id="rn">1</b>/${ROUNDS.length}</span>`) + `<main class="game" id="pg"></main>`;
  const pg = document.getElementById('pg');
  const next = () => {
    window.scrollTo(0, 0);
    if (r >= ROUNDS.length) return finish();
    if (ROUNDS[r].t === 'pair' && !introShown) { introShown = true; return pairIntro(); }
    play(ROUNDS[r]);
  };
  function pairIntro() {
    pg.innerHTML = `<div class="intro">
      <span class="tag pair">새로운 문제</span>
      <h2>이번엔 짝꿍 찾기!</h2>
      <p>DNA는 두 줄이 사다리처럼 짝을 지어요.<br>짝꿍은 정해져 있어요.</p>
      <div class="pairs"><span><i class="b b-A">A</i>↔<i class="b b-T">T</i></span><span><i class="b b-G">G</i>↔<i class="b b-C">C</i></span></div>
      <div class="ladder">${strand('GATC')}<div class="rungs"><i></i><i></i><i></i><i></i></div>${strand('CTAG')}</div>
      <button class="btn" id="go">짝꿍 찾기 시작</button></div>`;
    document.getElementById('go').onclick = next;
  }
  function play(R) {
    document.getElementById('rn').textContent = r + 1;
    const target = randSeq(R.n), answer = R.t === 'same' ? target : comp(target);
    const opts = makeOptions(answer, R.t === 'pair' ? [target] : []);
    let locked = false;
    pg.innerHTML = `
      <div class="q-head"><span class="tag ${R.t}">${R.t === 'same' ? '똑같은 패턴' : '짝꿍 패턴'}</span>
        <h2>${R.t === 'same' ? '위 DNA와 <b>똑같은</b> 것을 골라요' : '위 DNA와 <b>짝이 맞는</b> 줄을 골라요'}</h2>
        ${R.t === 'pair' ? '<span class="rule"><span>A ↔ T</span><span>G ↔ C</span></span>' : ''}</div>
      <div class="target">${strand(target)}${R.t === 'pair' ? `<div class="rungs">${'<i></i>'.repeat(R.n)}</div>${strand('?'.repeat(R.n))}` : ''}</div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-no">${i + 1}</span>${strand(o)}</button>`).join('')}</div>
      <div class="feedback" id="fb"></div>`;
    pg.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      if (locked) return; locked = true;
      const pick = opts[+btn.dataset.i], ok = pick === answer;
      pg.querySelectorAll('.opt').forEach((b, i) => b.classList.add(opts[i] === answer ? 'right' : b === btn ? 'wrong' : 'dim'));
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      if (R.t === 'pair') { const rows = pg.querySelectorAll('.target .strand'); rows[1].outerHTML = strand(answer); }
      let msg;
      if (ok) msg = R.t === 'same' ? '정답! 색깔과 순서가 똑같아요.' : '정답! A는 T와, G는 C와 짝이에요.';
      else if (R.t === 'pair' && pick === target) msg = '아쉬워요! 그건 위와 똑같은 줄이에요. 짝꿍은 A↔T, G↔C로 바꿔야 해요.';
      else { const k = [...pick].findIndex((c, j) => c !== answer[j]); msg = `아쉬워요! 앞에서 ${k + 1}번째 칸이 달라요.`; }
      const fb = document.getElementById('fb');
      fb.innerHTML = `<p class="msg ${ok ? 'ok' : 'no'}">${msg}</p><button class="btn" id="nx">${r + 1 < ROUNDS.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { r++; next(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const sec = (performance.now() - t0) / 1000, total = ROUNDS.length;
    const best = store.pattern ? Math.max(store.pattern.best, score) : score;
    store.pattern = { done: true, best, total }; save();
    sheet(`${trophy}
      <h3>${total}문제 중 ${score}개 정답!</h3>
      <p class="sub">${score === total ? '완벽해요! DNA 읽기 선수네요' : score >= 6 ? '훌륭해요! 눈이 아주 좋아요' : '다시 하면 더 잘할 수 있어요'}</p>
      <div class="stats"><div><span>정답</span><b>${score}/${total}</b></div><div><span>걸린 시간</span><b>${fmt(sec)}</b></div></div>
      <p class="fact"><b>알고 있나요?</b>DNA의 두 줄은 항상 A-T, G-C로 짝을 지어요. 그래서 세포가 둘로 나뉠 때 한 줄만 보고도 나머지 한 줄을 똑같이 만들어 낼 수 있어요.</p>
      <div class="row"><button class="btn ghost" data-go="#/pattern">다시 하기</button><button class="btn" data-go="#/">다른 게임</button></div>`);
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
const O_SVG = `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="27" fill="none" stroke="#2F6BFF" stroke-width="11"/></svg>`;
const X_SVG = `<svg viewBox="0 0 80 80"><path d="M17 17 63 63M63 17 17 63" stroke="#EF4E5A" stroke-width="12" stroke-linecap="round"/></svg>`;
function ox() {
  const qs = shuffle(POOL).slice(0, 5);
  let i = 0, score = 0;
  app.innerHTML = topbar('DNA 상식 OX 퀴즈', `<span class="counter"><b id="qn">1</b>/${qs.length}</span>`) + `<main class="game" id="og"></main>`;
  const og = document.getElementById('og');
  function show() {
    window.scrollTo(0, 0);
    const q = qs[i];
    let answered = false;
    document.getElementById('qn').textContent = i + 1;
    og.innerHTML = `<div class="qcard"><span class="qno">Q${i + 1}.</span><p class="qtext">${q.q}</p></div>
      <div class="ox-btns"><button class="oxb" data-v="1" aria-label="O, 맞아요">${O_SVG}<span>맞아요</span></button><button class="oxb" data-v="0" aria-label="X, 아니에요">${X_SVG}<span>아니에요</span></button></div>
      <div class="feedback" id="fb"></div>`;
    og.querySelectorAll('.oxb').forEach(btn => btn.addEventListener('click', () => {
      if (answered) return; answered = true;
      const v = btn.dataset.v === '1', ok = v === q.a;
      og.querySelectorAll('.oxb').forEach(b => b.classList.add((b.dataset.v === '1') === q.a ? 'right' : b === btn ? 'wrong' : 'dim'));
      if (ok) { score++; buzz(30); } else buzz([20, 60, 20]);
      const fb = document.getElementById('fb');
      fb.innerHTML = `<div class="exp ${ok ? 'ok' : 'no'}"><span class="res">${ok ? '정답!' : '아쉬워요!'} 정답은 ${q.a ? 'O' : 'X'}</span><p>${q.e}</p></div>
        <button class="btn" id="nx">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { i++; i < qs.length ? show() : finish(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const total = qs.length, best = store.ox ? Math.max(store.ox.best, score) : score;
    store.ox = { done: true, best, total }; save();
    sheet(`${trophy}
      <h3>${total}문제 중 ${score}개 정답!</h3>
      <p class="sub">${score === total ? '만점! DNA 박사님이에요' : score >= 3 ? '잘했어요! DNA와 꽤 친해졌어요' : '새로 알게 된 게 많아졌어요'}</p>
      <div class="stats"><div><span>정답</span><b>${score}/${total}</b></div><div><span>최고 점수</span><b>${best}/${total}</b></div></div>
      <p class="fact"><b>한 번 더 해 볼까요?</b>문제는 매번 섞여서 나와요. 다시 하면 새로운 문제를 만날 수 있어요.</p>
      <div class="row"><button class="btn ghost" data-go="#/ox">다시 하기</button><button class="btn" data-go="#/">다른 게임</button></div>`);
  }
  show();
}

/* ================= 인증서 ================= */
function badgeHelix() {
  const cx = 60, y0 = 30, h = 60, amp = 15, f = y => Math.sin((y - y0) / h * Math.PI * 2 + Math.PI / 2 * 0);
  let p1 = '', p2 = '', rungs = '';
  for (let i = 0; i <= 30; i++) { const y = y0 + i * h / 30, a = f(y); p1 += (i ? 'L' : 'M') + (cx + amp * a).toFixed(1) + ',' + y.toFixed(1); p2 += (i ? 'L' : 'M') + (cx - amp * a).toFixed(1) + ',' + y.toFixed(1); }
  [0.12, 0.38, 0.62, 0.88].forEach((k, j) => { const y = y0 + k * h, a = f(y); rungs += `<line x1="${(cx + amp * a).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cx - amp * a).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${['#EF4E5A', '#2F6BFF', '#13A26B', '#0B1F4B'][j]}" stroke-width="4" stroke-linecap="round"/>`; });
  return rungs + `<path d="${p1}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="${p2}" fill="none" stroke="#0B1F4B" stroke-width="5" stroke-linecap="round"/>`;
}
function cert() {
  if (!GAMES.every(g => store[g.id] && store[g.id].done)) { location.hash = '#/'; return; }
  const d = new Date();
  app.innerHTML = `<main class="cert"><div class="cert-card">
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#FFF3D6"/><circle cx="60" cy="60" r="44" fill="#F7B500"/><circle cx="60" cy="60" r="44" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 5"/>
      ${badgeHelix()}</svg>
    <span class="cert-sub">2026 CO-SHOW 바이오헬스</span>
    <h1>DNA 탐험가</h1>
    <p>DNA 게임 3개를 모두 마쳤어요!</p>
    <ul class="cert-rec">
      <li><span>틀린그림찾기</span><b>${fmt(store.spot.best)}</b></li>
      <li><span>같은 DNA 패턴 찾기</span><b>${store.pattern.best}/${store.pattern.total}</b></li>
      <li><span>DNA 상식 OX 퀴즈</span><b>${store.ox.best}/${store.ox.total}</b></li>
    </ul>
    <span class="cert-date">${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.</span>
  </div><button class="btn" data-go="#/">처음 화면으로</button></main>`;
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
