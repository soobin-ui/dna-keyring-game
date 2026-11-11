(() => {
'use strict';

/* ================= 공통 ================= */
const app = document.getElementById('app');
const KEY = 'dna-playground-v1';
const asObj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
let store = (() => { try { return asObj(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pad = n => String(n).padStart(2, '0');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
let cleanups = [];
const onCleanup = f => cleanups.push(f);
// 화면이 바뀌면 이전 화면에서 예약해 둔 일은 실행하지 않음
let gen = 0;
const later = (fn, ms) => { const g = gen; return setTimeout(() => { if (g === gen) fn(); }, ms); };
// 다른 앱을 보고 오는 동안은 남은 시간이 줄지 않게: 숨겨진 시간만큼 시작 시각을 뒤로 미룸
function pauseWhenHidden(getT0, setT0, running) {
  let hidAt = 0;
  const onVis = () => {
    if (document.hidden) { if (running()) hidAt = performance.now(); }
    else if (hidAt) { if (getT0()) setT0(getT0() + (performance.now() - hidAt)); hidAt = 0; }
  };
  document.addEventListener('visibilitychange', onVis);
  onCleanup(() => document.removeEventListener('visibilitychange', onVis));
}

const C = { teal: '#0E9F8E', coral: '#EF5350' };
const V = '?v=47';
const GAMES = [
  { id: 'spot', code: 'EXP-01', icon: 'icon_spot', bg: '#E2F1FF', title: '틀린그림찾기', desc: '실험실 그림 두 장에서 다른 곳 찾기 (쉬움·어려움)', time: '약 5–7분' },
  { id: 'cards', code: 'EXP-02', icon: 'icon_cards', bg: '#FFF1DC', title: '실험실 카드 뒤집기', desc: '단계마다 늘어나는 카드에서 같은 그림 짝 맞추기', time: '약 5–8분' },
  { id: 'ox', code: 'EXP-03', icon: 'icon_ox', bg: '#FFE6E5', title: 'DNA 상식 OX 퀴즈', desc: '5문제를 풀고 짧은 해설 확인하기', time: '약 3–5분' },
];

// 순서대로 3개 진행: 끝낸 실험의 결과를 이 휴대폰에만 저장
const RUN_KEY = 'dna-run-v1';
let run = (() => { try { return asObj(JSON.parse(localStorage.getItem(RUN_KEY))); } catch (e) { return {}; } })();
const saveRun = () => { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) {} };
const nextIdx = () => GAMES.findIndex(g => !run[g.id]);
const markDone = (id, v) => { run[id] = v; saveRun(); };

function bar(title, count = '') {
  const i = GAMES.findIndex(g => g.title === title);
  return `<nav class="bar"><button class="bk" data-go="#/">← 처음</button><span class="bar-t">${i >= 0 ? `<em>실험 ${i + 1}/3</em>` : "<em>미리보기</em>"}${title}</span><span class="bar-c" id="bc">${count}</span></nav>`;
}
function sheet(html) {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.innerHTML = html;
  app.appendChild(d);
  fit();
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  return d;
}
function report({ id, code, icon, head, sub, rows, note, noteTitle = '결과 해석', again, extra = '' }) {
  const i = GAMES.findIndex(g => g.id === id), nx = GAMES[i + 1];
  return sheet(`<div class="slip" role="dialog" aria-modal="true">
    <img class="slip-art" src="img/${icon}.png${V}" alt="">
    <div class="slip-top"><span>분석 리포트 · ${code}</span><span>No.${Math.floor(Math.random() * 9000) + 1000}</span></div>
    <h3 class="slip-h">${head}</h3>${sub ? `<p class="slip-sub">${sub}</p>` : ''}
    <ul class="slip-rows">${rows.map(([k, v]) => `<li><span>${k}</span><i></i><b>${v}</b></li>`).join('')}</ul>
    <div class="slip-note"><span>${noteTitle}</span>${note.split('|').map(t => `<p>${t}</p>`).join('')}</div>
    ${extra}<div class="slip-btns"><button class="btn line" data-go="${again}">다시 하기</button><button class="btn" data-go="${nx ? '#/' + nx.id : '#/done'}">${nx ? '다음 실험 →' : '최종 결과 보기'}</button></div>
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
  // 키링 몸통(그림 세로 35.7%~97.2%)을 3등분해서 아래부터 채움, 3단계면 고리까지 전부
  const clip = k => k >= 3 ? 'inset(0 0 0 0)' : `inset(${(97.2 - k * 61.5 / 3).toFixed(2)}% 0 0 0)`;
  const liq = document.getElementById('krLiq');
  const level = k => { liq.style.height = (k * 59 / 3).toFixed(2) + '%'; liq.classList.toggle('on', k > 0); };
  const label = k => k >= 3 ? '키링 완성!' : `${k} / 3`;
  fill.style.clipPath = fill.style.webkitClipPath = clip(shown);
  level(shown);
  lbl.textContent = label(shown);
  box.classList.toggle('full', shown >= 3);
  if (stage > shown) {
    later(() => {
      fill.style.clipPath = fill.style.webkitClipPath = clip(stage);
      level(stage);
      box.classList.add('bump');
      later(() => { lbl.textContent = label(stage); box.classList.toggle('full', stage >= 3); }, 700);
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
        <span class="kr-liquid" id="krLiq"></span>
      </div>
      <span class="kr-lbl" id="krLbl"></span>
    </div>
  </header>
  <ol class="pick steps">
    ${GAMES.map((g, k) => {
      const st = run[g.id] ? 'ok' : k === n ? 'now' : 'lock';
      const v = run[g.id];
      const note = st === 'ok' ? (g.id === 'spot' && String(v).includes(':') ? '✓ 완료' : (g.id === 'cards' ? (String(v).endsWith('/5') ? `✓ 완료 · ${v}단계` : '✓ 완료') : `✓ 완료 · ${g.id === 'ox' ? `${v} 정답` : `${v} 찾음`}`)) : st === 'now' ? '지금 바로 시작해볼까요?' : `${k}번을 마치면 할 수 있어요`;
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
// 최종 결과 표기: 5/7 → '7곳 중 5곳'
function scoreText(id, v) {
  const [a, b] = String(v).split('/');
  if (!b) return '완료';
  const u = { spot: '곳', cards: '단계', ox: '문제' }[id] || '';
  return `${b}${u} 중 ${a}${u}`;
}
function done() {
  if (nextIdx() >= 0) { location.hash = '#/'; return; }
  app.innerHTML = `<nav class="bar"><button class="bk" data-go="#/">← 처음</button><span class="bar-t">최종 결과</span><span class="bar-c">3/3</span></nav>
  <main class="g done" data-fit>
    <span class="tag">ANALYSIS COMPLETE</span>
    <h2 class="done-h">실험 3개를<br><span>모두 마쳤어요!</span></h2>
    <ul class="done-list">
      ${GAMES.map((g, k) => `<li><img src="img/${g.icon}.png${V}" alt="" width="56" height="56"><span><small>실험 ${k + 1}</small>${g.title}</span><b>${scoreText(g.id, run[g.id])}</b></li>`).join('')}
    </ul>
    <p class="done-p">키링이 완성될 때까지 조금만 기다려 주세요.</p>
    <button class="btn line" id="again">처음부터 다시 하기</button>
  </main>`;
  document.getElementById('again').onclick = () => { run = {}; saveRun(); try { sessionStorage.removeItem(KR_SHOWN); } catch (e) {} location.hash = '#/'; };
}

/* ================= 게임 1: 틀린그림찾기 ================= */
// 좌표는 400×300 기준 (그림 1200×900)
// 쉬움: 지금까지 쓰던 실험실 그림 7곳 / 어려움: 물건이 많은 실험실 그림 12곳, 힌트 없음, 틀리게 누르면 3초 감소
const SPOT_LV = {
  easy: { label: '쉬움', img: 'spot', time: 120, hints: Infinity, diffs: [
    { x: 46, y: 97, r: 16, name: '시계 7시 눈금' },
    { x: 366, y: 45, r: 16, name: '오른쪽 병 코르크' },
    { x: 275, y: 126, r: 15, name: '선반 왼쪽 받침대' },
    { x: 172, y: 216, r: 17, name: '파란 시험관 물 높이' },
    { x: 234, y: 224, r: 24, name: '비커 물 높이' },
    { x: 363, y: 163, r: 20, name: '화분 맨 위 잎' },
    { x: 201, y: 284, r: 22, name: '가운데 서랍 손잡이' },
  ] },
  hard: { label: '어려움', img: 'spot2', time: 120, hints: 0, penalty: 3, diffs: [
    { x: 43, y: 77, r: 12, name: '창밖 단풍잎 하나 색(빨강→노랑)' },
    { x: 250, y: 29, r: 11, name: '공구판 오른쪽 위 나사' },
    { x: 229, y: 55, r: 17, name: '스포이트 보라·분홍 색' },
    { x: 333, y: 68, r: 13, name: '선반 파란 병 물 높이' },
    { x: 218, y: 154, r: 11, name: '보라 시험관 물 높이' },
    { x: 109, y: 151, r: 13, name: '초록 펜 → 파란 펜' },
    { x: 65, y: 186, r: 22, name: '공책 파랑·초록 순서' },
    { x: 272, y: 163, r: 13, name: '공구함 잠금쇠' },
    { x: 249, y: 253, r: 15, name: '세 번째 서랍 손잡이' },
    { x: 53, y: 136, r: 18, name: '스탠드 불 꺼짐' },
    { x: 186, y: 145, r: 11, name: '노란 시험관 뚜껑 색' },
    { x: 224, y: 95, r: 9, name: '공구판 구멍 하나' },
  ] },
};
const shotSVG = B => `<svg class="shot" viewBox="0 0 400 300" role="img" aria-label="실험실 그림 ${B ? 'B' : 'A'}">
  <image href="img/spot_${B ? 'b' : 'a'}.jpg${V}" width="400" height="300"/><g class="marks"></g></svg>`;
function spot() { playSpot(); }
function playSpot() {
  const found = new Set();
  let hints = 0, done = false, t0 = 0, LV = null, DIFFS = [], TIME = 120;
  // 두 난이도 그림을 미리 받아 둠 (고르자마자 바로 보이게)
  ['spot', 'spot2'].forEach(n => ['a', 'b'].forEach(k => { const im = new Image(); im.src = `img/${n}_${k}.jpg${V}`; }));
  app.innerHTML = bar('틀린그림찾기') + `
  <main class="g sp" data-fit>
    <div class="sp-status" id="spStatus">
      <div class="sp-found"><span>찾은 곳</span><b id="spN">0</b><i id="spT">/ 7</i></div>
      <div class="sp-time"><span>남은 시간</span><b id="tm">2:00</b></div>
      <button class="sp-hint" id="hint" aria-label="힌트 보기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg><span id="hintL">힌트</span></button>
      <div class="sp-bar"><i id="spBar"></i></div>
    </div>
    <figure class="pic"><figcaption>그림 A</figcaption>${shotSVG(false)}</figure>
    <figure class="pic"><figcaption>그림 B</figcaption>${shotSVG(true)}</figure>
  </main>
  <div class="sp-ov" id="spOv"><div class="sp-card" role="dialog" aria-modal="true" aria-label="틀린그림찾기" id="spCard"></div></div>`;
  const svgs = [...app.querySelectorAll('svg.shot')];
  const tm = document.getElementById('tm'), barEl = document.getElementById('spBar'), st = document.getElementById('spStatus');
  const hintBtn = document.getElementById('hint'), hintL = document.getElementById('hintL');
  const left = () => t0 ? Math.max(0, TIME - (performance.now() - t0) / 1000) : TIME;
  const tick = () => {
    if (done) return;
    const L = left();
    tm.textContent = fmt(Math.ceil(L));
    barEl.style.width = (L / TIME * 100).toFixed(2) + '%';
    if (L <= 30 && !st.classList.contains('low')) buzz([60, 60, 60]);
    st.classList.toggle('low', L <= 30);
    st.classList.toggle('last', L <= 10);
    if (L <= 0) finish(false);
  };
  let iv = 0;
  onCleanup(() => clearInterval(iv));
  pauseWhenHidden(() => t0, v => { t0 = v; }, () => t0 && !done);
  const hintText = () => { hintBtn.hidden = LV.hints === 0; hintL.textContent = LV.hints === Infinity ? '힌트' : `힌트 ${LV.hints - hints}`; hintBtn.classList.toggle('off', hints >= LV.hints); };
  // 1단계: 쉬워요·어려워요 카드 → 2단계: 고른 난이도의 방법 안내 → 시작하기
  const card = document.getElementById('spCard');
  const HOW = (n, extra) => `<ol class="sp-how">
        <li><svg viewBox="0 0 56 40"><rect x="2" y="4" width="22" height="32" rx="5" fill="#E2F1FF" stroke="#17323A" stroke-width="2.4"/><rect x="32" y="4" width="22" height="32" rx="5" fill="#E2F1FF" stroke="#17323A" stroke-width="2.4"/><circle cx="13" cy="15" r="4" fill="#EF5350"/><rect x="8" y="24" width="10" height="5" rx="2" fill="#34B36B"/><rect x="38" y="24" width="10" height="5" rx="2" fill="#34B36B"/></svg><span>두 그림<br>비교</span></li>
        <li><svg viewBox="0 0 56 40"><circle cx="28" cy="20" r="12" fill="none" stroke="#EF5350" stroke-width="3.2"/><path d="M28 2v7M28 31v7M10 20h7M39 20h7" stroke="#EF5350" stroke-width="3.2" stroke-linecap="round"/></svg><span>다른 곳<br>터치</span></li>
        <li><svg viewBox="0 0 56 40"><circle cx="28" cy="22" r="14" fill="#fff" stroke="#17323A" stroke-width="2.6"/><path d="M28 22V13M28 22l6 4" stroke="#0E9F8E" stroke-width="3" stroke-linecap="round"/><path d="M24 4h8M28 4v4" stroke="#17323A" stroke-width="2.6" stroke-linecap="round"/></svg><span><b>2분</b><br>안에</span></li>
      </ol>${extra}`;
  const setLevel = key => {
    LV = SPOT_LV[key]; DIFFS = LV.diffs; TIME = LV.time;
    svgs.forEach((s, i) => s.querySelector('image').setAttribute('href', `img/${LV.img}_${i ? 'b' : 'a'}.jpg${V}`));
    document.getElementById('spT').textContent = `/ ${DIFFS.length}`;
    tm.textContent = fmt(TIME); hintText();
  };
  const showPick = () => {
    card.className = 'sp-card sp-card-pick';
    card.innerHTML = `<img src="img/icon_spot.png${V}" alt="" width="72" height="72">
      <h2>난이도를 <em>골라</em> 주세요</h2>
      <div class="sp-lv">
        <button class="sp-lvc" data-lv="easy"><span class="sp-lvc-pic" style="background-image:url(img/spot_a.jpg${V})"></span><b>쉬워요</b><small>다른 곳 7개<br>힌트 있어요</small></button>
        <button class="sp-lvc hard" data-lv="hard"><span class="sp-lvc-pic" style="background-image:url(img/spot2_a.jpg${V})"></span><b>어려워요</b><small>다른 곳 12개<br>힌트 없어요</small></button>
      </div>`;
    card.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => showHow(b.dataset.lv); });
    fit();
  };
  const showHow = key => {
    setLevel(key);
    const hard = key === 'hard';
    card.className = 'sp-card';
    card.innerHTML = `<span class="sp-lv-tag${hard ? ' hard' : ''}">${hard ? '어려워요' : '쉬워요'}</span>
      <h2>다른 곳 <em>${DIFFS.length}개</em> 찾기</h2>
      ${HOW(DIFFS.length, hard ? '<p class="sp-rule"><b>힌트 없음</b> · 틀리게 누르면 <b>3초</b>씩 줄어요</p>' : '<p class="sp-rule">막히면 <b>힌트</b>를 눌러 보세요</p>')}
      <button class="btn sp-go" id="spGo">시작하기</button>
      <button class="sp-back" id="spBack">← 난이도 다시 고르기</button>`;
    document.getElementById('spGo').onclick = start;
    document.getElementById('spBack').onclick = showPick;
    fit();
  };
  const start = () => {
    document.getElementById('spOv').remove();
    t0 = performance.now();
    iv = setInterval(tick, 200);
  };
  setLevel('easy'); showPick();
  const add = (svg, html, ms) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = html; svg.querySelector('.marks').appendChild(g);
    if (ms) setTimeout(() => g.remove(), ms);
  };
  svgs.forEach(svg => svg.addEventListener('click', e => {
    if (done || !t0) return;
    const r = svg.getBoundingClientRect(), f = rectScale();
    const x = (e.clientX / f - r.left) / r.width * 400, y = (e.clientY / f - r.top) / r.height * 300;
    let hit = -1, best = 1e9;
    DIFFS.forEach((d, i) => { const dist = Math.hypot(d.x - x, d.y - y); if (dist <= d.r + 8 && dist < best) { best = dist; hit = i; } });
    if (hit < 0) {
      add(svg, `<g class="miss"><path d="M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}"/></g>`, 700); buzz(12);
      if (LV.penalty) {   // 어려움: 틀리게 누르면 남은 시간 3초 감소
        t0 -= LV.penalty * 1000;
        add(svg, `<text class="pen" x="${Math.min(372, Math.max(28, x))}" y="${Math.max(22, y - 14)}" text-anchor="middle">-${LV.penalty}초</text>`, 900);
        tick();
      }
      return;
    }
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
  hintBtn.addEventListener('click', () => {
    const i = DIFFS.findIndex((d, k) => !found.has(k));
    if (i < 0 || done || !t0 || hints >= LV.hints) return;
    hints++; hintText();
    const d = DIFFS[i];
    svgs.forEach(s => add(s, `<circle class="hintc hint-${i}" cx="${d.x}" cy="${d.y}" r="${d.r + 2}"/>`, 2600));
  });
  function finish(all) {
    if (done) return;
    done = true;
    const L = left(), n = found.size, total = DIFFS.length, hard = LV === SPOT_LV.hard;
    tm.textContent = fmt(Math.ceil(L));
    // 못 찾은 곳은 노란 점선으로 알려 줌
    DIFFS.forEach((d, i) => { if (!found.has(i)) svgs.forEach(s => add(s, `<circle class="missed" cx="${d.x}" cy="${d.y}" r="${d.r + 2}"/>`)); });
    const key = hard ? 'spotHard' : 'spot';
    const prev = store[key] && typeof store[key].best === 'number' && store[key].best <= total ? store[key].best : 0;
    const best = Math.max(prev, n);
    store[key] = { best }; save(); markDone('spot', `${n}/${total}`);
    later(() => { const sh = report({
      id: 'spot', code: 'EXP-01', icon: 'icon_spot', again: '#/spot',
      extra: all ? '' : `<button class="slip-peek" id="peekAns">못 찾은 곳 ${total - n}개 보기</button>`,
      head: all ? `다른 곳 ${total}개를 <span>모두</span> 찾았어요!` : `시간 종료! <span>${n}개</span> 찾았어요`,
      rows: [['난이도', LV.label], ['찾은 곳', `${n} / ${total}`], all ? ['남은 시간', fmt(Math.ceil(L))] : ['제한 시간', fmt(TIME)], ['힌트', `${hints}회`], [`내 최고 기록(${LV.label})`, `${best} / ${total}`]],
      sub: all ? '' : '못 찾은 곳은 아래 버튼을 눌러 그림에서 확인해 보세요.',
      noteTitle: '게임 속 DNA 이야기',
      note: '비슷해 보이는 두 그림에서 작은 차이를 찾아보았나요?|과학자들도 DNA를 이루는 글자들의 순서인 ‘염기서열’을 비교해 차이를 찾아요. 사람들의 DNA는 대부분 비슷하지만 조금씩 다른 부분이 있고, 그중 일부는 눈동자 색 같은 우리 몸의 특징에 영향을 줄 수 있어요.',
    });
    // 못 찾은 곳 보기: 결과 창을 내리고 그림의 노란 동그라미를 보여 줌 → 아래 막대로 결과 창 다시 열기
    const pk = sh.querySelector('#peekAns');
    if (pk) pk.onclick = () => {
      sh.classList.add('peek'); app.classList.add('peeking'); fit();
      const barEl2 = document.createElement('div');
      barEl2.className = 'ans-bar';
      barEl2.innerHTML = `<span><i></i>노란 동그라미가 못 찾은 곳이에요</span><button class="btn">결과 다시 보기</button>`;
      app.appendChild(barEl2);
      barEl2.querySelector('button').onclick = () => { barEl2.remove(); sh.classList.remove('peek'); app.classList.remove('peeking'); fit(); };
    };
    }, all ? 700 : 1600);
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
  app.innerHTML = bar('DNA 상식 OX 퀴즈', `Q1/5`) + `<main class="g ox" id="og" data-fit></main>`;
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
      fb.innerHTML = `<div class="explain"><p class="res ${ok ? 'ok' : 'no'}">${ok ? '정답!' : '땡!'} 답은 ${q.a ? 'O' : 'X'}</p>
        <p><span class="lbl">해설</span>${q.e}</p></div>
        <button class="btn" id="nx">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`;
      document.getElementById('nx').onclick = () => { i++; i < qs.length ? show() : finish(); };
      setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    }));
  }
  function finish() {
    const total = qs.length, best = store.ox && typeof store.ox.best === 'number' ? Math.max(store.ox.best, score) : score;
    store.ox = { best, total }; save(); markDone('ox', `${score}/${total}`);
    report({
      id: 'ox', code: 'EXP-03', icon: 'icon_ox', again: '#/ox',
      head: score === total ? `<span>만점!</span> 5문제를 다 맞혔어요` : `${total}문제 중 <span>${score}개</span> 정답`,
      sub: score === total ? 'DNA 박사님이 따로 없네요!'
        : score >= 3 ? 'DNA와 꽤 친해졌어요. 틀린 문제도 해설을 한 번 더 보면 금방 기억나요.'
        : '처음 듣는 이야기가 많았죠? 오늘 알게 된 것만으로도 충분해요.',
      rows: [['맞힌 문제', `${score} / ${total}`], ['내 최고 점수', `${best} / ${total}`]],
      noteTitle: '게임 속 DNA 이야기',
      note: '오늘 푼 문제는 모두 진짜 과학 이야기예요.|사람의 DNA는 약 30억 개의 글자로 되어 있고, 사람끼리는 99.9%가 같아요. 남은 0.1%의 작은 차이가 나를 나답게 만들어요.',
    });
  }
  show();
}



/* ================= 시안: DNA 설명서 해독 (캐릭터 만들기) — #/decode 로만 열림 ================= */
const DC = [
  { key: 'body', title: '몸 색', opts: [
    { n: '초록 몸', code: 'GCA', c: '#7ED9B5' }, { n: '분홍 몸', code: 'AGT', c: '#FFA8C0' },
    { n: '보라 몸', code: 'TTC', c: '#B9A2FF' }, { n: '하늘 몸', code: 'CAG', c: '#8CC8FF' }] },
  { key: 'ears', title: '귀', opts: [
    { n: '고양이 귀', code: 'ATG', k: 'cat' }, { n: '토끼 귀', code: 'GGA', k: 'rabbit' },
    { n: '곰 귀', code: 'CTT', k: 'bear' }, { n: '더듬이', code: 'TAC', k: 'ant' }] },
  { key: 'eyes', title: '눈 색', opts: [
    { n: '파란 눈', code: 'CCG', c: '#3D8BF2' }, { n: '노란 눈', code: 'TGA', c: '#F4A62A' },
    { n: '초록 눈', code: 'AAC', c: '#2BB673' }, { n: '갈색 눈', code: 'GTT', c: '#8B5A2B' }] },
  { key: 'pat', title: '무늬', opts: [
    { n: '줄무늬', code: 'TCG', k: 'stripe' }, { n: '점무늬', code: 'CAT', k: 'dot' },
    { n: '하트', code: 'GAC', k: 'heart' }, { n: '볼터치', code: 'ACC', k: 'blush' }] },
];
const tileS = (c, cls = '') => `<span class="dt dt-${c} ${cls}">${c}</span>`;
function charInner(tr, pop = '') {
  const body = tr.body ? tr.body.c : '#D5DEDB';
  const shade = 'rgba(23,50,58,.14)';
  let ears = '';
  const ek = tr.ears && tr.ears.k;
  if (ek === 'cat') ears = `<path d="M30 40 L24 10 L50 30Z M90 40 L96 10 L70 30Z" fill="${body}" stroke="${shade}" stroke-width="2"/><path d="M33 34 L30 18 L44 30Z M87 34 L90 18 L76 30Z" fill="#FFB3C7"/>`;
  if (ek === 'rabbit') ears = `<ellipse cx="44" cy="20" rx="9" ry="22" fill="${body}" stroke="${shade}" stroke-width="2"/><ellipse cx="76" cy="20" rx="9" ry="22" fill="${body}" stroke="${shade}" stroke-width="2"/><ellipse cx="44" cy="22" rx="4" ry="14" fill="#FFB3C7"/><ellipse cx="76" cy="22" rx="4" ry="14" fill="#FFB3C7"/>`;
  if (ek === 'bear') ears = `<circle cx="32" cy="34" r="13" fill="${body}" stroke="${shade}" stroke-width="2"/><circle cx="88" cy="34" r="13" fill="${body}" stroke="${shade}" stroke-width="2"/><circle cx="32" cy="34" r="6" fill="#FFB3C7"/><circle cx="88" cy="34" r="6" fill="#FFB3C7"/>`;
  if (ek === 'ant') ears = `<path d="M48 34 Q42 16 34 8 M72 34 Q78 16 86 8" fill="none" stroke="#17323A" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="8" r="6" fill="#FFC93B"/><circle cx="86" cy="8" r="6" fill="#FFC93B"/>`;
  let pat = '';
  const pk = tr.pat && tr.pat.k;
  if (pk === 'stripe') pat = `<path d="M26 80 Q60 70 94 80 M24 94 Q60 84 96 94 M32 106 Q60 98 88 106" fill="none" stroke="${shade}" stroke-width="6" stroke-linecap="round"/>`;
  if (pk === 'dot') pat = `<g fill="${shade}"><circle cx="34" cy="86" r="5"/><circle cx="52" cy="96" r="4"/><circle cx="72" cy="94" r="5"/><circle cx="88" cy="84" r="4"/><circle cx="60" cy="108" r="4"/><circle cx="40" cy="104" r="3"/><circle cx="82" cy="104" r="3"/></g>`;
  if (pk === 'heart') pat = `<path d="M60 108 C40 96 44 82 54 84 C58 85 60 89 60 89 C60 89 62 85 66 84 C76 82 80 96 60 108Z" fill="#FF6B8A"/>`;
  if (pk === 'blush') pat = `<ellipse cx="36" cy="80" rx="8" ry="5" fill="#FF8FA8" opacity=".8"/><ellipse cx="84" cy="80" rx="8" ry="5" fill="#FF8FA8" opacity=".8"/>`;
  const iris = tr.eyes ? tr.eyes.c : '#17323A';
  const r = tr.eyes ? 7 : 5;
  const q = !tr.body ? '<text x="60" y="104" text-anchor="middle" font-size="22" font-weight="800" fill="#9AAAA6" font-family="sans-serif">?</text>' : '';
  const P = k => pop === 'p-' + k ? 'pop' : '';
  return `<g class="${P('ears')}">${ears}</g>
    <ellipse class="${P('body')}" cx="60" cy="76" rx="42" ry="40" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <g class="${P('pat')}">${pat}</g>
    <g class="${P('eyes')}"><circle cx="46" cy="64" r="11" fill="#fff"/><circle cx="74" cy="64" r="11" fill="#fff"/>
    <circle cx="47" cy="65" r="${r}" fill="${iris}"/><circle cx="75" cy="65" r="${r}" fill="${iris}"/>
    <circle cx="49" cy="62" r="2.2" fill="#fff"/><circle cx="77" cy="62" r="2.2" fill="#fff"/></g>
    <path d="M52 82 Q60 89 68 82" fill="none" stroke="#17323A" stroke-width="3" stroke-linecap="round"/>${q}`;
}
const charSVG = (tr, pop = '') => `<svg class="dc-char" viewBox="0 0 120 124" aria-hidden="true">${charInner(tr, pop)}</svg>`;
function decode() {
  const pick = DC.map(cat => cat.opts[Math.floor(Math.random() * cat.opts.length)]);
  const tr = {};
  let step = 0, firstTry = 0, wrongNow = 0;
  const sample = { body: DC[0].opts[0], ears: DC[1].opts[0], eyes: DC[2].opts[0], pat: DC[3].opts[3] };
  app.innerHTML = bar('DNA 설명서 해독') + `<main class="g dc" data-fit>
    <div class="dc-top">
      <div class="dc-char-box" id="dcChar">${charSVG(tr)}</div>
      <div class="dc-prog"><span>내 DNA 캐릭터</span><b id="dcStep">0</b><i>/ 4 완성</i>
        <p class="dc-got" id="dcGot">아직 아무것도 없어요</p></div>
    </div>
    <div class="dc-dna">
      <div class="dc-dna-h"><span>내 DNA (짝꿍 줄)</span><span class="dc-rule">A↔T · G↔C</span></div>
      <div class="dc-codons" id="dcCodons"></div>
      <p class="dc-hint" id="dcHint"></p>
    </div>
    <div class="dc-table-h" id="dcTH"></div>
    <div class="dc-table" id="dcTable"></div>
  </main>
  <div class="sp-ov" id="dcOv"><div class="sp-card" role="dialog" aria-modal="true">
    <svg class="dc-char" viewBox="0 0 120 124" style="width:88px;height:90px;margin:0 auto 2px;display:block">${charInner(sample)}</svg>
    <h2>DNA로 <em>캐릭터</em> 만들기</h2>
    <ol class="sp-how">
      <li><span class="dc-mini">${tileS('C')}${tileS('G')}${tileS('T')}</span><span>3글자를<br>읽고</span></li>
      <li><span class="dc-mini">${tileS('C')}<b>→</b>${tileS('G')}</span><span>짝꿍으로<br>바꿔서</span></li>
      <li><span class="dc-mini"><svg viewBox="0 0 40 32" width="40" height="32"><rect x="3" y="3" width="34" height="26" rx="4" fill="#fff" stroke="#17323A" stroke-width="2.4"/><path d="M9 11h12M9 17h18M9 23h10" stroke="#0E9F8E" stroke-width="3" stroke-linecap="round"/></svg></span><span>암호표에서<br>찾기</span></li>
    </ol>
    <button class="btn sp-go" id="dcGo">시작하기</button></div></div>`;
  document.getElementById('dcGo').onclick = () => document.getElementById('dcOv').remove();
  const render = () => {
    document.getElementById('dcCodons').innerHTML = pick.map((o, i) => {
      const shown = comp(o.code);
      return `<div class="dc-codon ${i < step ? 'done' : i === step ? 'now' : ''}">${[...shown].map(c => tileS(c)).join('')}${i < step ? '<em>✓</em>' : ''}</div>`;
    }).join('');
    if (step >= DC.length) return;
    const cat = DC[step];
    document.getElementById('dcTH').innerHTML = `<b>${cat.title}</b> 암호표 <span>· 짝꿍으로 바꾼 3글자를 찾아 누르세요</span>`;
    document.getElementById('dcTable').innerHTML = cat.opts.map((o, i) => `<button class="dc-opt" data-i="${i}">
      <span class="dc-code">${[...o.code].map(c => tileS(c, 'sm')).join('')}</span><span class="dc-n">${o.c ? `<i style="background:${o.c}"></i>` : ''}${o.n}</span></button>`).join('');
    document.getElementById('dcHint').textContent = '';
    wrongNow = 0;
    document.querySelectorAll('.dc-opt').forEach(btn => { btn.onclick = () => choose(+btn.dataset.i, btn); });
  };
  const choose = (i, btn) => {
    const cat = DC[step], o = cat.opts[i];
    if (o === pick[step]) {
      if (!wrongNow) firstTry++;
      tr[cat.key] = o; buzz(30);
      btn.classList.add('right');
      document.getElementById('dcChar').innerHTML = charSVG(tr, 'p-' + cat.key);
      step++;
      document.getElementById('dcStep').textContent = step;
      document.getElementById('dcGot').textContent = DC.filter(c => tr[c.key]).map(c => tr[c.key].n).join(' · ');
      setTimeout(() => (step < DC.length ? render() : finish()), 650);
    } else {
      wrongNow++; buzz([20, 60, 20]);
      btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
      const shown = comp(pick[step].code);
      document.getElementById('dcHint').innerHTML = wrongNow >= 2
        ? `힌트: ${shown} 의 짝꿍은 <b>${pick[step].code}</b>`
        : `앗! 짝꿍으로 바꿨나요? (예: ${shown[0]} → ${PAIR[shown[0]]})`;
    }
  };
  const finish = () => {
    render();
    const codeStr = pick.map(o => o.code).join('-');
    sheet(`<div class="slip" role="dialog" aria-modal="true">
      <div class="dc-final">${charSVG(tr)}</div>
      <h3 class="slip-h">내 DNA <span>캐릭터</span> 완성!</h3>
      <p class="slip-sub">${pick.map(o => o.n).join(' · ')}</p>
      <ul class="slip-rows"><li><span>내 DNA 암호</span><i></i><b>${codeStr}</b></li><li><span>한 번에 맞힌 것</span><i></i><b>${firstTry} / 4</b></li></ul>
      <div class="slip-note"><span>게임 속 DNA 이야기</span><p>세포는 DNA 글자를 세 개씩 묶어서 읽어요. 이 세 글자 묶음을 ‘코돈’이라고 해요.</p><p>코돈을 순서대로 읽어 단백질을 만들고, 이 단백질들이 모여 눈동자 색 같은 우리 몸의 특징을 만들어요.</p></div>
      <div class="slip-btns"><button class="btn line" data-go="#/decode">다시 만들기</button><button class="btn" data-go="#/">처음으로</button></div></div>`);
  };
  render();
}


/* ================= 시안: DNA 순서 기억하기 — #/memo ================= */
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
function memo() {
  const L = ['A', 'T', 'G', 'C'];
  const rndL = () => L[Math.floor(Math.random() * 4)];
  let seq = [], input = 0, lives = 2, best = 0, busy = true, alive = true;
  onCleanup(() => { alive = false; });
  app.innerHTML = bar('DNA 순서 기억하기') + `<main class="g mm" data-fit>
    <div class="sp-status mm-status">
      <div class="sp-found"><span>기억한 글자</span><b id="mmBest">0</b><i>글자</i></div>
      <div class="sp-time"><span>남은 기회</span><b id="mmLives" class="mm-lives"></b></div>
    </div>
    <div class="mm-screen">
      <p class="mm-msg" id="mmMsg">준비!</p>
      <div class="mm-big" id="mmBig"></div>
      <div class="mm-slots" id="mmSlots"></div>
    </div>
    <div class="mm-pad">${L.map(c => `<button class="mm-b mm-${c}" data-c="${c}" aria-label="${c}">${c}</button>`).join('')}</div>
  </main>
  <div class="sp-ov" id="mmOv"><div class="sp-card" role="dialog" aria-modal="true">
    <div class="mm-demo">${['G', 'A', 'T'].map((c, i) => `<span class="dt dt-${c}" style="animation-delay:${i * 0.5}s">${c}</span>`).join('')}</div>
    <h2>DNA <em>순서</em> 기억하기</h2>
    <ol class="sp-how">
      <li><span class="dc-mini"><svg viewBox="0 0 40 32" width="40" height="32"><circle cx="20" cy="16" r="10" fill="#FFC93B"/><circle cx="20" cy="16" r="15" fill="none" stroke="#FFC93B" stroke-width="2" opacity=".5"/></svg></span><span>켜지는<br>순서 보기</span></li>
      <li><span class="dc-mini">${['G', 'A', 'T'].map(c => `<span class="dt dt-${c}">${c}</span>`).join('')}</span><span>똑같이<br>누르기</span></li>
      <li><span class="dc-mini"><b style="font-size:20px;color:#EF5350">♥♥</b></span><span>기회는<br>2번</span></li>
    </ol>
    <button class="btn sp-go" id="mmGo">시작하기</button></div></div>`;
  const $ = id => document.getElementById(id);
  const btns = [...app.querySelectorAll('.mm-b')];
  const setLives = () => { $('mmLives').innerHTML = '<span>♥</span>'.repeat(lives) + '<span class="off">♥</span>'.repeat(2 - lives); };
  const slots = (filled, all = false) => {
    $('mmSlots').innerHTML = seq.map((c, i) => (all || i < filled) ? `<span class="dt dt-${c} sm">${c}</span>` : '<span class="mm-dot"></span>').join('');
  };
  const light = async (c, ms) => {
    const b = btns.find(x => x.dataset.c === c);
    b.classList.add('lit'); $('mmBig').innerHTML = `<span class="dt dt-${c} xl">${c}</span>`;
    await sleepMs(ms);
    b.classList.remove('lit'); $('mmBig').innerHTML = '';
  };
  const play = async () => {
    busy = true; input = 0;
    $('mmMsg').textContent = '잘 보세요!';
    slots(0);
    await sleepMs(600);
    const on = Math.max(330, 620 - seq.length * 30);
    for (const c of seq) { if (!alive) return; await light(c, on); await sleepMs(170); }
    if (!alive) return;
    $('mmMsg').textContent = '똑같은 순서로 누르세요';
    busy = false;
  };
  const press = async c => {
    if (busy) return;
    const b = btns.find(x => x.dataset.c === c);
    b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 180);
    if (c === seq[input]) {
      input++; slots(input); buzz(15);
      if (input === seq.length) {
        busy = true; best = Math.max(best, seq.length); $('mmBest').textContent = best;
        $('mmMsg').textContent = '정답! 한 글자 더 늘어나요';
        await sleepMs(900); if (!alive) return;
        seq.push(rndL()); play();
      }
    } else {
      busy = true; lives--; setLives(); buzz([30, 60, 30]);
      b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 400);
      slots(seq.length, true);
      $('mmMsg').textContent = lives > 0 ? '앗! 정답은 이 순서예요. 한 번 더!' : '앗! 정답은 이 순서였어요';
      await sleepMs(1800); if (!alive) return;
      if (lives > 0) play(); else finish();
    }
  };
  btns.forEach(b => b.addEventListener('click', () => press(b.dataset.c)));
  const finish = () => {
    store.memo = { best: Math.max((store.memo && store.memo.best) || 0, best) }; save();
    sheet(`<div class="slip" role="dialog" aria-modal="true">
      <div class="slip-top"><span>분석 리포트 · 기억력</span><span>No.${Math.floor(Math.random() * 9000) + 1000}</span></div>
      <h3 class="slip-h"><span>${best}글자</span>까지 기억했어요!</h3>
      <ul class="slip-rows"><li><span>이번 기록</span><i></i><b>${best}글자</b></li><li><span>내 최고 기록</span><i></i><b>${store.memo.best}글자</b></li></ul>
      <div class="slip-note"><span>게임 속 DNA 이야기</span><p>DNA는 A·T·G·C 네 글자의 순서로 정보를 담아요.</p><p>글자 하나만 바뀌어도 내용이 달라질 수 있어서, 세포는 DNA를 복사할 때 순서를 아주 정확하게 지켜요.</p></div>
      <div class="slip-btns"><button class="btn line" data-go="#/memo">다시 하기</button><button class="btn" data-go="#/">처음으로</button></div></div>`);
  };
  setLives();
  $('mmGo').onclick = () => { $('mmOv').remove(); seq = [rndL(), rndL(), rndL()]; play(); };
}

/* ================= 시안: 실험실 카드 뒤집기 — #/cards ================= */
const CARD_ITEMS = [
  { k: 'dna', n: 'DNA', f: '우리 몸을 만드는 설명서예요.' },
  { k: 'scope', n: '현미경', f: '눈에 안 보이는 세포를 크게 보여줘요.' },
  { k: 'petri', n: '페트리 접시', f: '세포나 세균을 키울 때 쓰는 납작한 유리 접시예요.' },
  { k: 'tube', n: '시험관', f: '실험할 때 액체를 담는 가는 유리관이에요.' },
  { k: 'beaker', n: '비커', f: '액체를 담고 섞을 때 쓰는 컵이에요.' },
  { k: 'key', n: 'DNA 키링', f: '지금 온수조에서 만들어지고 있는 바로 그 키링!' },
  { k: 'loupe', n: '돋보기', f: '작은 것을 크게 보여 주는 볼록한 유리예요.' },
  { k: 'dropper', n: '스포이트', f: '액체를 한 방울씩 옮길 때 써요.' },
  { k: 'goggles', n: '보안경', f: '실험할 때 눈을 지켜 주는 안경이에요.' },
  { k: 'flask', n: '플라스크', f: '흔들어 섞어도 잘 넘치지 않는 세모 모양 유리병이에요.' },
  { k: 'thermo', n: '온도계', f: '얼마나 따뜻한지 재는 도구예요.' },
  { k: 'coat', n: '실험 가운', f: '실험할 때 옷을 지켜 주는 하얀 겉옷이에요.' },
];
function cardIcon(k) {
  const src = k === 'key' ? 'keyring' : 'card_' + k;
  return `<img src="img/${src}.png${V}" alt="" style="height:${k === 'key' ? 64 : 66}%;width:auto;max-width:86%;object-fit:contain" draggable="false">`;
}
// 단계마다 카드가 2장씩 늘어나요: 8 → 10 → 12 → 14 → 16장
const CARD_LV = [
  { pairs: 4, cols: 4, time: 30, peek: 2000 },
  { pairs: 5, cols: 4, time: 38, peek: 1800 },
  { pairs: 6, cols: 4, time: 46, peek: 1600 },
  { pairs: 7, cols: 4, time: 55, peek: 1400 },
  { pairs: 8, cols: 4, time: 65, peek: 1200 },  // peek: 카드가 다 놓인 뒤 앞면을 보여 주는 시간(ms), 단계가 오를수록 짧게
];
const CD_BOARD_W = 358, CD_BOARD_H = 352, CD_GAP = 7;
const cdBack = `<svg viewBox="0 0 40 40"><path d="M14 6c0 9 12 9 12 14s-12 5-12 14M26 6c0 9-12 9-12 14s12 5 12 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`;
// 같은 그림 두 장이 붙어 나오지 않게 섞어요.
// 위아래·양옆은 절대 안 붙게, 가능하면 대각선도 안 붙게(안 되면 위아래·양옆만 지킴).
function spreadDeal(cards, cols) {
  const n = cards.length, rows = Math.ceil(n / cols), lastN = n - (rows - 1) * cols;
  const pos = i => { const r = Math.floor(i / cols); return [r, (i % cols) + (r === rows - 1 ? (cols - lastN) / 2 : 0)]; };
  const near = (i, j, diag) => {
    const [r1, c1] = pos(i), [r2, c2] = pos(j), dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    if (dr === 0) return dc <= 1;
    if (dr === 1) return diag ? dc <= 1 : dc < 1;
    return false;
  };
  const ok = (d, diag) => d.every((c, i) => d.every((e, j) => j <= i || c.k !== e.k || !near(i, j, diag)));
  // 같은 줄에 놓인 짝이 많으면 '한 칸 건너 같은 그림' 규칙이 보여서, 같은 줄 짝은 1~2쌍까지만
  const mixed = d => {
    let same = 0;
    d.forEach((c, i) => d.forEach((e, j) => { if (j > i && c.k === e.k && pos(i)[0] === pos(j)[0]) same++; }));
    return same <= (n <= 10 ? 2 : Math.max(1, Math.floor(n / 8)));
  };
  // 8·10장은 대각선까지 막으면 배치가 몇 가지로만 반복돼서, 대각선은 12장부터 막아요
  for (const [diag, mix] of [[n > 10, true], [false, true], [false, false]]) {
    for (let t = 0; t < 3000; t++) { const d = shuffle([...cards]); if (ok(d, diag) && (!mix || mixed(d))) return d; }
  }
  return shuffle([...cards]);
}
function cards() {
  let lv = 0, cleared = 0, moves = 0, pairsTotal = 0;
  let deck = [], open = [], matched = new Set(), t0 = 0, playing = false, lock = false, iv = 0, peekT = 0;
  onCleanup(() => { clearInterval(iv); clearTimeout(peekT); });
  pauseWhenHidden(() => t0, v => { t0 = v; }, () => playing);
  const N = CARD_LV.length;
  app.innerHTML = bar('실험실 카드 뒤집기') + `<main class="g cd" data-fit>
    <div class="sp-status" id="cdStatus">
      <div class="sp-found cd-lv"><span>단계</span><b id="cdLv">1</b><i>/ ${N}</i></div>
      <div class="sp-found cd-pr"><span>찾은 짝</span><b id="cdN">0</b><i id="cdNt">/ 4</i></div>
      <div class="sp-time"><span>남은 시간</span><b id="cdT">${fmt(CARD_LV[0].time)}</b></div>
      <div class="sp-bar"><i id="cdBar"></i></div>
    </div>
    <div class="cd-grid" id="cdGrid"></div>
    <p class="cd-fact" id="cdFact">같은 그림 2장을 찾아보세요</p>
  </main>
  <div class="sp-ov" id="cdOv"><div class="sp-card" role="dialog" aria-modal="true">
    <div class="cd-demo"><span class="cd-mini back"></span><span class="cd-mini">${cardIcon('dna')}</span><span class="cd-mini">${cardIcon('dna')}</span></div>
    <h2>실험실 <em>카드</em> 뒤집기</h2>
    <ol class="sp-how">
      <li><span class="dc-mini"><span class="cd-mini back sm"></span><span class="cd-mini back sm"></span></span><span>카드 2장<br>뒤집기</span></li>
      <li><span class="dc-mini"><span class="cd-mini sm">${cardIcon('petri')}</span><span class="cd-mini sm">${cardIcon('petri')}</span></span><span>같은 그림<br>찾기</span></li>
      <li><span class="dc-mini cd-grow"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>갈수록<br><b style="color:#EF5350">카드가 늘어요</b></span></li>
    </ol>
    <button class="btn sp-go" id="cdGo">1단계 시작하기</button></div></div>`;
  const $ = id => document.getElementById(id);
  const L = () => CARD_LV[lv];
  const left = () => t0 ? Math.max(0, L().time - (performance.now() - t0) / 1000) : L().time;
  const tick = () => {
    if (!playing) return;
    const r = left();
    $('cdT').textContent = fmt(Math.ceil(r));
    $('cdBar').style.width = (r / L().time * 100).toFixed(2) + '%';
    const st = $('cdStatus');
    if (r <= 10 && !st.classList.contains('low')) buzz([60, 60, 60]);
    st.classList.toggle('low', r <= 10); st.classList.toggle('last', r <= 5);
    if (r <= 0) fail();
  };
  const deal = () => {
    const { pairs, cols } = L();
    const items = shuffle([...CARD_ITEMS]).slice(0, pairs);
    deck = spreadDeal([...items, ...items], cols).map((it, i) => ({ ...it, id: i }));
    open = []; matched = new Set(); lock = true; playing = false; t0 = 0;
    const rows = Math.ceil(deck.length / cols);
    const w = Math.floor(Math.min(112, (CD_BOARD_W - CD_GAP * (cols - 1)) / cols, (CD_BOARD_H - CD_GAP * (rows - 1)) / rows / 1.05));
    $('cdLv').textContent = lv + 1; $('cdN').textContent = 0; $('cdNt').textContent = `/ ${pairs}`;
    $('cdT').textContent = fmt(L().time); $('cdBar').style.width = '100%';
    $('cdStatus').classList.remove('low', 'last');
    const g = $('cdGrid');
    g.style.setProperty('--cw', w + 'px'); g.style.width = (cols * w + CD_GAP * (cols - 1)) + 'px';
    g.innerHTML = deck.map((c, i) => `<button class="cd-card up deal" style="animation-delay:${i * 45}ms" data-i="${i}" aria-label="카드 ${i + 1}">
      <span class="cd-in"><span class="cd-back">${cdBack}</span>
      <span class="cd-front">${cardIcon(c.k)}<em>${c.n}</em></span></span></button>`).join('');
    $('cdFact').innerHTML = `<b>${lv + 1}단계</b> 카드 ${deck.length}장! 잘 봐 두세요`;
    const els = [...g.querySelectorAll('.cd-card')];
    els.forEach(el => el.addEventListener('click', () => flip(el, els)));
    // 처음에 잠깐 앞면을 보여주고 뒤집어요
    peekT = setTimeout(() => {
      els.forEach(el => el.classList.remove('up'));
      $('cdFact').textContent = '같은 그림 2장을 찾아보세요';
      peekT = setTimeout(() => { lock = false; playing = true; t0 = performance.now(); }, 350);
    }, (deck.length - 1) * 45 + 320 + L().peek);
  };
  const flip = (el, els) => {
    if (!playing || lock) return;
    const i = +el.dataset.i;
    if (matched.has(i) || open.includes(i)) return;
    el.classList.add('up'); open.push(i);
    if (open.length < 2) return;
    moves++;
    const [a, b] = open;
    if (deck[a].k === deck[b].k) {
      matched.add(a); matched.add(b); open = []; buzz(30); pairsTotal++;
      later(() => { els[a].classList.add('ok'); els[b].classList.add('ok'); }, 250);
      const nb = $('cdN'); nb.textContent = matched.size / 2; nb.classList.remove('bump'); void nb.offsetWidth; nb.classList.add('bump');
      $('cdFact').innerHTML = `<b>${deck[a].n}</b> ${deck[a].f}`;
      if (matched.size === deck.length) win();
    } else {
      lock = true;
      later(() => { if (!playing) return; els[a].classList.remove('up'); els[b].classList.remove('up'); open = []; lock = false; }, 800);
    }
  };
  const popup = html => {
    const ov = document.createElement('div');
    ov.className = 'sp-ov cd-pop'; ov.innerHTML = `<div class="sp-card" role="dialog" aria-modal="true">${html}</div>`;
    app.appendChild(ov); return ov;
  };
  const minis = n => `<span class="cd-next">${Array.from({ length: n }, () => '<i></i>').join('')}</span>`;
  const win = () => {
    playing = false; clearInterval(iv); cleared = lv + 1;
    if (cleared === N) { later(finish, 900); return; }
    const nx = CARD_LV[lv + 1];
    later(() => {
      const ov = popup(`<p class="cd-pop-k">${lv + 1}단계 성공!</p>
        <h2>다음은 카드 <em>${nx.pairs * 2}장</em></h2>${minis(nx.pairs * 2)}
        <button class="btn sp-go" id="cdNext">${lv + 2}단계 시작하기</button>`);
      ov.querySelector('#cdNext').onclick = () => { ov.remove(); lv++; deal(); iv = setInterval(tick, 200); };
    }, 800);
  };
  const fail = () => {
    playing = false; lock = true; clearInterval(iv);
    deck.forEach((_, i) => { if (!matched.has(i)) app.querySelector(`.cd-card[data-i="${i}"]`).classList.add('up', 'miss'); });
    later(() => {
      const ov = popup(`<p class="cd-pop-k cd-pop-no">시간이 끝났어요</p>
        <h2>${lv + 1}단계 <em>다시 도전</em>해 볼까요?</h2>
        <button class="btn sp-go" id="cdRetry">다시 도전하기</button>
        <button class="cd-stop" id="cdStop">여기까지 하고 결과 보기</button>`);
      ov.querySelector('#cdRetry').onclick = () => { ov.remove(); deal(); iv = setInterval(tick, 200); };
      ov.querySelector('#cdStop').onclick = () => { ov.remove(); finish(); };
    }, 1200);
  };
  const finish = () => {
    playing = false; clearInterval(iv);
    const all = cleared === N;
    store.cards2 = { best: Math.max((store.cards2 && store.cards2.best) || 0, cleared) }; save(); markDone('cards', `${cleared}/${N}`);
    report({
      id: 'cards', code: 'EXP-02', icon: 'icon_cards', again: '#/cards',
      head: all ? `${N}단계를 <span>모두</span> 성공했어요!` : cleared ? `<span>${cleared}단계</span>까지 성공했어요` : '다음엔 <span>1단계</span>부터 다시 도전!',
      rows: [['성공한 단계', `${cleared} / ${N}`], ['맞춘 짝', `${pairsTotal}쌍`], ['뒤집은 횟수', `${moves}번`], ['내 최고 기록', `${store.cards2.best} / ${N}단계`]],
      noteTitle: '게임 속 DNA 이야기',
      note: 'DNA는 우리 몸의 세포 하나하나에 들어 있어요.|한 가닥은 너무 가늘어 눈에 안 보이지만, 아주 많이 모이면 하얀 실처럼 보여요. 키링 속 하얀 가닥이 바로 그 모습이에요.',
    });
  };
  $('cdGo').onclick = () => { $('cdOv').remove(); deal(); iv = setInterval(tick, 200); };
}

/* ================= 휴대폰 크기에 맞춰 통째로 확대·축소 ================= */
const BASE_W = 390, MAX_Z = 1.7;
function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const home = app.querySelector('.home');
  // 원래 크기(배율 1)에서 내용 높이를 잰 뒤 배율을 정함
  app.style.zoom = 1; app.style.minHeight = '0px';
  if (home) home.style.minHeight = '0px';
  let z = w / BASE_W;
  // offsetHeight는 소수점을 버려서 1px 넘칠 수 있음 → 실제 높이 + 1px 여유로 계산
  const hOf = el => el.getBoundingClientRect().height + 1;
  if (home) z = Math.min(z, h / hOf(home.querySelector('.home-inner')));
  else if (app.querySelector('[data-fit]')) z = Math.min(z, h / hOf(app));
  // 결과 창이 떠 있으면 창 전체(아래 버튼까지)가 한 화면에 들어오게
  const slip = app.querySelector('.overlay:not(.peek) .slip');
  if (slip) { slip.style.maxHeight = 'none'; z = Math.min(z, h * 0.96 / hOf(slip)); }
  z = Math.min(z, MAX_Z);
  app.style.zoom = z;
  // 사파리는 배율에 따라 글자 폭이 조금씩 달라져 줄바꿈이 늘 수 있음 → 실제로 넘치면 그만큼 더 줄임
  if (home || app.querySelector('[data-fit]')) {
    for (let k = 0; k < 4; k++) {
      const sh = document.documentElement.scrollHeight;
      if (sh <= h) break;
      z = z * h / sh * 0.995;
      app.style.zoom = z;
    }
  }
  // 확대·축소한 뒤 높이가 화면과 딱 맞게 (소수점 때문에 1~3px 스크롤이 생기지 않도록 내림)
  const minH = Math.floor(h / z) + 'px';
  app.style.minHeight = minH;
  if (home) home.style.minHeight = minH;
  if (slip) {
    slip.style.maxHeight = minH;
    // 결과 창도 실제로 넘치면(창 안에 스크롤이 생기면) 그만큼 더 줄임
    for (let k = 0; k < 4 && slip.scrollHeight > slip.clientHeight + 1; k++) {
      z = z * slip.clientHeight / slip.scrollHeight * 0.995;
      app.style.zoom = z;
      const m = Math.floor(h / z) + 'px';
      app.style.minHeight = m; if (home) home.style.minHeight = m; slip.style.maxHeight = m;
    }
  }
}
window.addEventListener('resize', fit);
// 사파리(그리고 옛 크롬)는 zoom 안의 요소 위치를 '줄이기 전' 값으로 알려 주고, 터치 위치는 '줄인 뒤' 값으로 알려 줌.
// 이 휴대폰이 어느 쪽인지 그때그때 재서 터치 좌표를 맞춰 줌 (크롬 최신: 1, 사파리: zoom 배율)
function rectScale() {
  const z = parseFloat(app.style.zoom) || 1, w = app.getBoundingClientRect().width;
  return w ? z * BASE_W / w : 1;
}
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fit);
document.addEventListener('touchstart', () => {}, { passive: true }); // iOS에서 :active(눌림) 효과가 보이게
window.addEventListener('orientationchange', () => setTimeout(fit, 200));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

/* ================= 화면 전환 ================= */
function route() {
  gen++;
  app.classList.remove('peeking');
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, '');
  const fn = { spot, pattern, ox, done, decode, memo, cards }[h] || home;
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
