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

const C = { teal: '#0E9F8E', coral: '#EF5350' };
const V = '?v=19';
const GAMES = [
  { id: 'spot', code: 'EXP-01', icon: 'icon_spot', bg: '#E2F1FF', title: '틀린그림찾기', desc: '실험실 그림 두 장에서 다른 곳 7개 찾기', time: '약 5–7분' },
  { id: 'pattern', code: 'EXP-02', icon: 'icon_pattern', bg: '#FFF1DC', title: '같은 DNA 패턴 찾기', desc: '견본과 같은 색깔 순서의 DNA 고르기', time: '약 4–5분' },
  { id: 'ox', code: 'EXP-03', icon: 'icon_ox', bg: '#FFE6E5', title: 'DNA 상식 OX 퀴즈', desc: '5문제를 풀고 짧은 해설 확인하기', time: '약 3–5분' },
];

// 순서대로 3개 진행: 끝낸 실험의 결과를 이 휴대폰에만 저장
const RUN_KEY = 'dna-run-v1';
let run = (() => { try { return JSON.parse(localStorage.getItem(RUN_KEY)) || {}; } catch (e) { return {}; } })();
const saveRun = () => { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) {} };
const nextIdx = () => GAMES.findIndex(g => !run[g.id]);
const markDone = (id, v) => { run[id] = v; saveRun(); };

function bar(title, count = '') {
  const i = GAMES.findIndex(g => g.title === title);
  return `<nav class="bar"><button class="bk" data-go="#/">← 처음</button><span class="bar-t"><em>실험 ${i + 1}/3</em>${title}</span><span class="bar-c" id="bc">${count}</span></nav>`;
}
function sheet(html) {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.innerHTML = html;
  app.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  return d;
}
function report({ id, code, icon, head, rows, note, again }) {
  const i = GAMES.findIndex(g => g.id === id), nx = GAMES[i + 1];
  return sheet(`<div class="slip" role="dialog" aria-modal="true">
    <img class="slip-art" src="img/${icon}.png${V}" alt="">
    <div class="slip-top"><span>분석 리포트 · ${code}</span><span>No.${Math.floor(Math.random() * 9000) + 1000}</span></div>
    <h3 class="slip-h">${head}</h3>
    <ul class="slip-rows">${rows.map(([k, v]) => `<li><span>${k}</span><i></i><b>${v}</b></li>`).join('')}</ul>
    <div class="slip-note"><span>결과 해석</span><p>${note}</p></div>
    <div class="slip-btns"><button class="btn line" data-go="${again}">다시 하기</button><button class="btn" data-go="${nx ? '#/' + nx.id : '#/done'}">${nx ? '다음 실험 →' : '최종 결과 보기'}</button></div>
  </div>`);
}

// 키링 진행: 실험 하나 끝날 때마다 아래부터 1/3씩 채워짐. 새로 채워진 단계만 움직임으로 보여 줌
const KR_SHOWN = 'dna-kr-shown';
function keyring() {
  const fill = document.getElementById('krFill'), lbl = document.getElementById('krLbl'), box = document.getElementById('kr');
  if (!fill) return;
  const stage = GAMES.filter(g => run[g.id]).length;
  let shown = 0;
  try { shown = +sessionStorage.getItem(KR_SHOWN) || 0; } catch (e) {}
  if (shown > stage) shown = stage;
  const clip = k => `inset(${(100 - k * 100 / 3).toFixed(2)}% 0 0 0)`;
  const label = k => k >= 3 ? '키링 완성!' : `${k} / 3`;
  fill.style.clipPath = fill.style.webkitClipPath = clip(shown);
  lbl.textContent = label(shown);
  box.classList.toggle('full', shown >= 3);
  if (stage > shown) {
    setTimeout(() => {
      fill.style.clipPath = fill.style.webkitClipPath = clip(stage);
      box.classList.add('bump');
      setTimeout(() => { lbl.textContent = label(stage); box.classList.toggle('full', stage >= 3); }, 700);
    }, 450);
  }
  try { sessionStorage.setItem(KR_SHOWN, stage); } catch (e) {}
}

/* ================= 첫 화면 ================= */
function home() {
  const n = nextIdx(), all = n < 0;
  app.innerHTML = `<div class="home"><div class="home-inner">
  <div class="top"><span class="live">BIOHEALTH PRECISION LAB</span><span>바이오헬스 정밀검진센터</span></div>
  <header class="intro-h">
    <div class="intro-t">
      <span class="status"><i></i>온수조 처리 중</span>
      <h1>내 <em>DNA 키링</em>이<br>만들어지는 중!</h1>
      <p>실험을 하나 끝낼 때마다 키링이 조금씩 완성돼요.</p>
    </div>
    <div class="kr" id="kr" role="img" aria-label="키링 진행 ${GAMES.filter(g => run[g.id]).length}/3">
      <div class="kr-sway">
        <img class="kr-base" src="img/keyring.png${V}" alt="" width="200" height="300">
        <img class="kr-fill" id="krFill" src="img/keyring.png${V}" alt="" width="200" height="300">
      </div>
      <span class="kr-lbl" id="krLbl"></span>
    </div>
  </header>
  <ol class="pick steps">
    ${GAMES.map((g, k) => {
      const st = run[g.id] ? 'ok' : k === n ? 'now' : 'lock';
      const v = run[g.id];
      const note = st === 'ok' ? (g.id === 'spot' && String(v).includes(':') ? '✓ 완료' : `✓ 완료 · ${g.id === 'spot' ? `${v} 찾음` : `${v} 정답`}`) : st === 'now' ? '지금 바로 시작해볼까요?' : `${k}번을 마치면 할 수 있어요`;
      return `<li><button class="game ${st}" ${st === 'lock' ? 'disabled' : `data-go="#/${g.id}"`}>
        <span class="ic" style="background:${g.bg}"><img src="img/${g.icon}.png${V}" alt="" width="76" height="76"><b class="no">${st === 'ok' ? '✓' : k + 1}</b></span>
        <span class="tx"><span class="tt">${g.title}</span><span class="dd">${g.desc}</span><span class="tm">${note}</span></span>
      </button></li>`;
    }).join('')}
  </ol>
  <div class="cta">${all
    ? `<button class="btn" data-go="#/done">최종 결과 보기</button><button class="reset" id="reset">처음부터 다시 하기</button>`
    : `<button class="btn" data-go="#/${GAMES[n].id}">${n === 0 ? '1번 실험 시작하기' : `${n + 1}번 실험 이어서 하기`}</button>`}</div>
  <p class="foot">CO-SHOW 2026 · 바이오헬스 혁신융합대학</p>
  </div></div>`;
  keyring();
  const rs = document.getElementById('reset');
  if (rs) rs.onclick = () => { run = {}; saveRun(); try { sessionStorage.removeItem(KR_SHOWN); } catch (e) {} home(); };
}

/* ================= 최종 결과 ================= */
function done() {
  if (nextIdx() >= 0) { location.hash = '#/'; return; }
  app.innerHTML = `<nav class="bar"><button class="bk" data-go="#/">← 처음</button><span class="bar-t">최종 결과</span><span class="bar-c">3/3</span></nav>
  <main class="g done">
    <span class="tag">ANALYSIS COMPLETE</span>
    <h2 class="done-h">실험 3개를<br><span>모두 마쳤어요!</span></h2>
    <ul class="done-list">
      ${GAMES.map((g, k) => `<li><img src="img/${g.icon}.png${V}" alt="" width="56" height="56"><span><small>실험 ${k + 1}</small>${g.title}</span><b>${run[g.id]}</b></li>`).join('')}
    </ul>
    <p class="done-p">키링이 완성될 때까지 조금만 기다려 주세요.</p>
    <button class="btn line" id="again">처음부터 다시 하기</button>
  </main>`;
  document.getElementById('again').onclick = () => { run = {}; saveRun(); try { sessionStorage.removeItem(KR_SHOWN); } catch (e) {} location.hash = '#/'; };
}

/* ================= 게임 1: 틀린그림찾기 ================= */
// 좌표는 400×300 기준 (그림 1200×900)
const DIFFS = [
  { x: 46, y: 97, r: 16, name: '시계 7시 눈금' },
  { x: 366, y: 45, r: 16, name: '오른쪽 병 코르크' },
  { x: 275, y: 126, r: 15, name: '선반 왼쪽 받침대' },
  { x: 172, y: 216, r: 17, name: '파란 시험관 물 높이' },
  { x: 234, y: 224, r: 24, name: '비커 물 높이' },
  { x: 363, y: 163, r: 20, name: '화분 맨 위 잎' },
  { x: 201, y: 284, r: 22, name: '가운데 서랍 손잡이' },
];
const shotSVG = B => `<svg class="shot" viewBox="0 0 400 300" role="img" aria-label="실험실 그림 ${B ? 'B' : 'A'}">
  <image href="img/spot_${B ? 'b' : 'a'}.jpg${V}" width="400" height="300"/><g class="marks"></g></svg>`;
function spot() { playSpot(); }
const SPOT_TIME = 120; // 제한 시간 2분
function playSpot() {
  const found = new Set();
  let hints = 0, done = false;
  let t0 = 0;
  app.innerHTML = bar('틀린그림찾기') + `
  <main class="g sp" data-fit>
    <div class="sp-status" id="spStatus">
      <div class="sp-found"><span>찾은 곳</span><b id="spN">0</b><i>/ 7</i></div>
      <div class="sp-time"><span>남은 시간</span><b id="tm">${fmt(SPOT_TIME)}</b></div>
      <button class="sp-hint" id="hint" aria-label="힌트 보기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>힌트</button>
      <div class="sp-bar"><i id="spBar"></i></div>
    </div>
    <figure class="pic"><figcaption>그림 A</figcaption>${shotSVG(false)}</figure>
    <figure class="pic"><figcaption>그림 B</figcaption>${shotSVG(true)}</figure>
  </main>
  <div class="sp-ov" id="spOv">
    <div class="sp-card" role="dialog" aria-modal="true" aria-label="틀린그림찾기 방법">
      <img src="img/icon_spot.png${V}" alt="" width="72" height="72">
      <h2>다른 곳 <em>7개</em> 찾기</h2>
      <ol class="sp-how">
        <li><svg viewBox="0 0 56 40"><rect x="2" y="4" width="22" height="32" rx="5" fill="#E2F1FF" stroke="#17323A" stroke-width="2.4"/><rect x="32" y="4" width="22" height="32" rx="5" fill="#E2F1FF" stroke="#17323A" stroke-width="2.4"/><circle cx="13" cy="15" r="4" fill="#EF5350"/><rect x="8" y="24" width="10" height="5" rx="2" fill="#34B36B"/><rect x="38" y="24" width="10" height="5" rx="2" fill="#34B36B"/><text x="9" y="13" font-size="0">A</text></svg><span>두 그림<br>비교</span></li>
        <li><svg viewBox="0 0 56 40"><circle cx="28" cy="20" r="12" fill="none" stroke="#EF5350" stroke-width="3.2"/><path d="M28 2v7M28 31v7M10 20h7M39 20h7" stroke="#EF5350" stroke-width="3.2" stroke-linecap="round"/></svg><span>다른 곳<br>터치</span></li>
        <li><svg viewBox="0 0 56 40"><circle cx="28" cy="22" r="14" fill="#fff" stroke="#17323A" stroke-width="2.6"/><path d="M28 22V13M28 22l6 4" stroke="#0E9F8E" stroke-width="3" stroke-linecap="round"/><path d="M24 4h8M28 4v4" stroke="#17323A" stroke-width="2.6" stroke-linecap="round"/></svg><span><b>2분</b><br>안에</span></li>
      </ol>
      <button class="btn sp-go" id="spGo">시작하기</button>
    </div>
  </div>`;
  const svgs = [...app.querySelectorAll('svg.shot')];
  const tm = document.getElementById('tm'), barEl = document.getElementById('spBar'), st = document.getElementById('spStatus');
  const left = () => t0 ? Math.max(0, SPOT_TIME - (performance.now() - t0) / 1000) : SPOT_TIME;
  const tick = () => {
    if (done) return;
    const L = left();
    tm.textContent = fmt(Math.ceil(L));
    barEl.style.width = (L / SPOT_TIME * 100).toFixed(2) + '%';
    st.classList.toggle('low', L <= 30);
    if (L <= 0) finish(false);
  };
  let iv = 0;
  onCleanup(() => clearInterval(iv));
  document.getElementById('spGo').onclick = () => {
    document.getElementById('spOv').remove();
    t0 = performance.now();
    iv = setInterval(tick, 200);
  };
  const add = (svg, html, ms) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = html; svg.querySelector('.marks').appendChild(g);
    if (ms) setTimeout(() => g.remove(), ms);
  };
  svgs.forEach(svg => svg.addEventListener('click', e => {
    if (done || !t0) return;
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
    const n = document.getElementById('spN');
    n.textContent = found.size; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    if (found.size === DIFFS.length) finish(true);
  }));
  document.getElementById('hint').addEventListener('click', () => {
    const i = DIFFS.findIndex((d, k) => !found.has(k));
    if (i < 0 || done || !t0) return;
    hints++;
    const d = DIFFS[i];
    svgs.forEach(s => add(s, `<circle class="hintc hint-${i}" cx="${d.x}" cy="${d.y}" r="${d.r + 2}"/>`, 2600));
  });
  function finish(all) {
    if (done) return;
    done = true;
    const L = left(), n = found.size;
    tm.textContent = fmt(Math.ceil(L));
    // 못 찾은 곳은 노란 점선으로 알려 줌
    DIFFS.forEach((d, i) => { if (!found.has(i)) svgs.forEach(s => add(s, `<circle class="missed" cx="${d.x}" cy="${d.y}" r="${d.r + 2}"/>`)); });
    const best = store.spot && typeof store.spot.best === 'number' && store.spot.best <= 7 ? Math.max(store.spot.best, n) : n;
    store.spot = { best }; save(); markDone('spot', `${n}/7`);
    setTimeout(() => report({
      id: 'spot', code: 'EXP-01', icon: 'icon_spot', again: '#/spot',
      head: all ? `다른 곳 7개를 <span>모두</span> 찾았어요!` : `시간 종료! <span>${n}개</span> 찾았어요`,
      rows: [['찾은 곳', `${n} / 7`], all ? ['남은 시간', fmt(Math.ceil(L))] : ['제한 시간', fmt(SPOT_TIME)], ['힌트', `${hints}회`], ['내 최고 기록', `${best} / 7`]],
      note: (all ? '' : '못 찾은 곳은 그림에 노란 점선으로 표시했어요. ') + '사람과 사람의 DNA는 99.9%가 같아요. 나머지 0.1%의 작은 차이가 생김새와 체질을 다르게 만들어요. 과학자들도 틀린그림찾기처럼 이 작은 차이를 찾아내요.',
    }), all ? 700 : 1600);
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
    store.pattern = { best, total }; save(); markDone('pattern', `${score}/${total}`);
    report({
      id: 'pattern', code: 'EXP-02', icon: 'icon_pattern', again: '#/pattern',
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
const X_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M18 18 62 62M62 18 18 62" stroke="${C.coral}" stroke-width="12" stroke-linecap="round"/></svg>`;
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
    store.ox = { best, total }; save(); markDone('ox', `${score}/${total}`);
    report({
      id: 'ox', code: 'EXP-03', icon: 'icon_ox', again: '#/ox',
      head: score === total ? `<span>만점!</span> 5문제를 다 맞혔어요` : `${total}문제 중 <span>${score}개</span> 정답`,
      rows: [['맞힌 문제', `${score} / ${total}`], ['내 최고 점수', `${best} / ${total}`]],
      note: '문제는 할 때마다 섞여서 나와요. 다시 하면 처음 보는 문제를 만날 수 있어요.',
    });
  }
  show();
}


/* ================= 휴대폰 크기에 맞춰 통째로 확대·축소 ================= */
const BASE_W = 390, MAX_Z = 1.7;
function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const home = app.querySelector('.home');
  app.style.zoom = 1;
  let z = w / BASE_W;
  if (home) {
    home.style.minHeight = '0px';
    const inner = home.querySelector('.home-inner');
    z = Math.min(z, h / inner.offsetHeight);
  } else if (app.querySelector('[data-fit]')) {
    z = Math.min(z, h / app.offsetHeight);
  }
  z = Math.min(z, MAX_Z);
  app.style.zoom = z;
  if (home) home.style.minHeight = (h / z) + 'px';
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

/* ================= 화면 전환 ================= */
function route() {
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, '');
  const fn = { spot, pattern, ox, done }[h] || home;
  document.documentElement.classList.toggle('on-home', fn === home);
  fn();
  fit();
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
