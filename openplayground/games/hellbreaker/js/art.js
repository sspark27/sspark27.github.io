'use strict';
// ============================================================
// 절차적 스프라이트 생성기 — 몬스터 프레임 / 아이템 / 이펙트 / 1인칭 무기
// 저해상도 캔버스에 픽셀로 그려 ImageData(Uint32Array)로 베이크한다.
// ============================================================
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function bake(c) {
  const g = c.getContext('2d');
  const id = g.getImageData(0, 0, c.width, c.height);
  return { u: new Uint32Array(id.data.buffer.slice(0)), w: c.width, h: c.height };
}

const SPR = { mon: {}, items: {}, fx: {}, guns: {} };

// ---------- 공용 페인트 헬퍼 ----------
function painter(ctx) {
  return {
    r(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    e(x, y, rx, ry, col) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    },
    poly(pts, col) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
    }
  };
}
function painTint(c) {
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,70,50,.42)';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------- 인간형 (보병/거수 공용) ----------
function humanoidFrame(cfg, pose) {
  const W = cfg.big ? 58 : 48, H = cfg.big ? 74 : 60;
  const _c = cv(W, H), p = painter(_c.getContext('2d'));
    const s = cfg.big ? 1.22 : 1;
    const cx = W / 2;
    const legA = pose.leg === 0 ? -2.4 * s : 2.4 * s;
    const legB = pose.leg === 0 ? 2.4 * s : -2.4 * s;
    // 다리
    p.r(cx - 7 * s + legA, 36 * s, 6 * s, 16 * s, cfg.suit);
    p.r(cx + 1 * s + legB, 36 * s, 6 * s, 16 * s, cfg.suit);
    p.r(cx - 7 * s + legA, 49 * s, 6 * s, 4 * s, '#191410');
    p.r(cx + 1 * s + legB, 49 * s, 6 * s, 4 * s, '#191410');
    // 몸통
    p.r(cx - 9 * s, 17 * s, 18 * s, 20 * s, cfg.suit);
    p.r(cx - 6 * s, 20 * s, 12 * s, 11 * s, cfg.armor);       // 흉판
    p.r(cx - 9 * s, 34 * s, 18 * s, 2.5 * s, '#141210');      // 벨트
    p.r(cx - 11 * s, 17 * s, 4 * s, 7 * s, cfg.armor);        // 어깨
    p.r(cx + 7 * s, 17 * s, 4 * s, 7 * s, cfg.armor);
    // 머리
    p.e(cx, 9 * s, 7 * s, 7.4 * s, cfg.helmet);
    p.r(cx - 5 * s, 9 * s, 10 * s, 4 * s, '#0c1013');         // 바이저
    p.r(cx - 3.5 * s, 10.5 * s, 3 * s, 1.6 * s, cfg.visorGlow || '#57d8ff');
    p.r(cx - 4 * s, 15 * s, 8 * s, 3 * s, cfg.skin);          // 턱
    // 팔 + 총
    const gunCol = '#22262b', gunHi = '#3a4046';
    if (pose.arm === 'aim' || pose.arm === 'fire') {
      p.r(cx + 5 * s, 22 * s, 5 * s, 12 * s, cfg.suit);       // 어깨→앞 손
      p.e(cx + 7 * s, 34 * s, 3 * s, 3 * s, cfg.skin);
      if (cfg.gun === 'sgun') {
        p.r(cx - 4 * s, 33 * s, 13 * s, 4 * s, '#4a3016');
        p.r(cx - 8 * s, 31 * s, 14 * s, 3.4 * s, gunCol);
        p.r(cx - 8 * s, 31 * s, 14 * s, 1 * s, gunHi);
      } else {
        p.r(cx - 6 * s, 33 * s, 16 * s, 3.2 * s, gunCol);
        p.r(cx - 6 * s, 33 * s, 16 * s, 1 * s, gunHi);
        p.r(cx - 2 * s, 36 * s, 3 * s, 3 * s, '#181b1f');
      }
      if (pose.arm === 'fire') {                               // 총구 화염
        const mx = cx - (cfg.gun === 'sgun' ? 10 : 8) * s, my = 32 * s;
        p.e(mx, my, 5 * s, 4 * s, '#ffd23c');
        p.e(mx, my, 2.6 * s, 2 * s, '#fff8dc');
      }
    } else {
      p.r(cx - 12 * s, 18 * s, 4.5 * s, 15 * s, cfg.suit);     // 좌우 팔 하강
      p.r(cx + 7.5 * s, 18 * s, 4.5 * s, 15 * s, cfg.suit);
      p.e(cx - 10 * s, 34 * s, 2.6 * s, 3 * s, cfg.skin);
      p.e(cx + 10 * s, 34 * s, 2.6 * s, 3 * s, cfg.skin);
      p.r(cx + 8 * s, 30 * s, 4 * s, 12 * s, gunCol);          // 대기 자세 총
    }
  return _c;
}

// ---------- 사망 프레임: 회전+납작 스케일로 쓰러뜨린 뒤 실제 영역만 크롭 ----------
const COLLAPSE_TIPS = [-0.16, -0.52, -0.98, -1.42];   // 뒤로 넘어지는 각도(rad)
const COLLAPSE_SQ   = [0.88, 0.68, 0.50, 0.36];       // 세로 납작 정도

function collapseFrame(body, k, big) {
  const BW = body.width, BH = body.height;
  const S = Math.ceil(Math.hypot(BW, BH)) * 2 + 8;     // 어떤 각도도 잘리지 않는 큰 캔버스
  const c = cv(S, S), g = c.getContext('2d'), p = painter(g);
  if (k > 0)                                            // 점점 번지는 핏자국
    p.e(S / 2, S - 4, (11 + k * 8) * (big ? 1.25 : 1), 3 + k * 1.5, '#5a0e08');
  g.save();
  g.translate(S / 2, S - 8);                            // 발끝 피벗
  g.rotate(COLLAPSE_TIPS[k]);
  g.scale(1 + k * 0.07, COLLAPSE_SQ[k]);
  g.drawImage(body, -BW / 2, -BH + 6);
  g.restore();
  if (k === 3) {                                        // 최종 시체 톤 다운
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(30,10,8,.45)';
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

function tightBake(c) {
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++)
    if (d[(y * c.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (x1 < x0) return bake(c);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const o = cv(w, h), og = o.getContext('2d');
  og.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return bake(o);
}

function humanoidFrames(cfg) {
  const mk = pose => bake(humanoidFrame(cfg, pose));
  const walk = [mk({ leg: 0 }), mk({ leg: 1 })];
  const aim = mk({ arm: 'aim', leg: 0 });
  const fire = mk({ arm: 'fire', leg: 0 });
  const pain = bake(painTint(humanoidFrame(cfg, { arm: 'aim', leg: 1 })));
  const body = humanoidFrame(cfg, { leg: 0 });
  const die = [];
  for (let k = 0; k < 4; k++)
    die.push(tightBake(collapseFrame(body, k, !!cfg.big)));
  return { walk, aim, fire, pain, die };
}

// ---------- 마수 (근접 돌격형) ----------
function fiendFrame(lunge) {
  const c = cv(56, 50), g = c.getContext('2d'), p = painter(g);
  const f = lunge ? 3 : 0;
  p.e(28 + f, 30, 17, 13, '#6e3325');                 // 몸통
  p.e(28 + f, 30, 12, 8, '#84452f');
  p.e(28 + f, 16 - (lunge ? 3 : 0), 9, 8, '#5c281c'); // 머리
  p.poly([[20 + f, 10], [16 + f, 0], [24 + f, 8]], '#d8cfc0');   // 뿔
  p.poly([[36 + f, 10], [40 + f, 0], [32 + f, 8]], '#d8cfc0');
  p.r(24 + f, 14 - (lunge ? 3 : 0), 8, 2, '#ffd23c'); // 눈빛
  _maw(p, 28 + f, 21 - (lunge ? 3 : 0), lunge ? 9 : 6);
  // 앞발 claws
  const ay = lunge ? 6 : 14;
  p.e(12 + (lunge ? -4 : 0), 26 + ay - 8, 5, 9, '#5c281c');
  p.e(44 + (lunge ? 4 : 0), 26 + ay - 8, 5, 9, '#5c281c');
  for (const [bx, by] of [[8, 34], [13, 35], [48, 34], [43, 35]])
    p.r(bx + (lunge ? (bx < 28 ? -4 : 4) : 0), by - ay + 6, 2, 5, '#efe6d6');
  // 뒷다리
  p.r(16, 41, 6, 8, '#4a2015'); p.r(34, 41, 6, 8, '#4a2015');
  return c;
}
function _maw(p, x, y, w) {
  for (let i = -w; i <= w; i += 2) p.r(x + i, y, 1.6, 2.6, '#efe6d6');
  p.e(x, y + 2, w, 2, '#2a0a06');
}
function fiendFrames() {
  const walk = [bake(fiendFrame(false)), (() => {
    const c = fiendFrame(false), g = c.getContext('2d');
    g.drawImage(c, 0, 0); return c;
  })()];
  walk[1] = bake(fiendFrame(true)); // 보행 프레임2는 살짝 숙인 자세 재활용
  const dieFrames = [];
  for (let k = 0; k < 4; k++) {
    const c = cv(56, 58), g = c.getContext('2d'), p = painter(g);
    if (k > 0) p.e(28, 46, 16 + k * 4, 3 + k, '#5a0e08');
    const squash = [0.85, 0.6, 0.38, 0.22][k];
    g.save(); g.translate(28, 48); g.scale(1 + k * 0.09, squash); g.translate(-28, -48);
    g.drawImage(fiendFrame(false), 0, 0);
    g.restore();
    dieFrames.push(bake(c));
  }
  return { walk, aim: walk[1], fire: walk[1], pain: bake(_tintC(fiendFrame(false), 'rgba(255,70,50,.42)')), die: dieFrames };
}
function _tintC(src, color) {
  const c = cv(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------- 흑술사 (화염구 투척형) ----------
function warlockFrame(stage) { // 0 idle 1 cast 2 fire
  const c = cv(44, 64), g = c.getContext('2d'), p = painter(g);
  const raise = stage === 0 ? 0 : stage === 1 ? -5 : -8;
  // 로브
  p.poly([[22, 12], [8, 58], [36, 58]], '#3d2a52');
  p.poly([[22, 12], [12, 58], [32, 58]], '#4a3463');
  for (let i = 0; i < 5; i++) p.r(9 + i * 6, 56, 3, 4, '#241637'); // 찢어진 자락
  // 후드
  p.e(22, 10, 9, 10, '#3d2a52');
  p.e(22, 11, 6.4, 6.8, '#12081e');
  p.r(19, 9, 2.4, 2, '#ff4de1'); p.r(24.5, 9, 2.4, 2, '#ff4de1');   // 발광 눈
  p.r(22 - .5, 12, 1.6, 3, '#ff4de188');
  // 어깨 망토 장식
  p.r(11, 16, 6, 4, '#8a6a2f'); p.r(27, 16, 6, 4, '#8a6a2f');
  // 팔 + 구슬
  p.e(11, 30 + raise, 3.6, 6, '#4a3463');
  p.e(33, 30 + raise, 3.6, 6, '#4a3463');
  if (stage >= 1) {
    const orbY = 24 + raise;
    const grd = g.createRadialGradient(22, orbY, 1, 22, orbY, stage === 2 ? 9 : 6);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.45, stage === 2 ? '#ffb02a' : '#ff7b2a');
    grd.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(22, orbY, stage === 2 ? 9 : 6, 0, TAU); g.fill();
  }
  return c;
}
function warlockFrames() {
  const idle = bake(warlockFrame(0));
  const dieFrames = [];
  for (let k = 0; k < 4; k++) {
    const c = cv(44, 66), g = c.getContext('2d');
    if (k > 0) p_e(g, 22, 54, 13 + k * 3, 2.5 + k, '#2a0a22');
    const sq = [0.8, 0.55, 0.32, 0.18][k];
    g.save(); g.translate(22, 58); g.scale(1 + k * 0.1, sq); g.translate(-22, -58);
    g.drawImage(warlockFrame(0), 0, 0);
    g.restore();
    g.globalAlpha = 1 - k * 0.12;
    dieFrames.push(bake(c));
  }
  function p_e(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  return { walk: [idle, bake(warlockFrame(1))], aim: idle, fire: bake(warlockFrame(2)), pain: bake(_tintC(warlockFrame(0), 'rgba(255,70,50,.42)')), die: dieFrames };
}

// ---------- 폭발 드럼통 ----------
function barrelSprite() {
  const c = cv(28, 36), g = c.getContext('2d'), p = painter(g);
  for (let x = 0; x < 28; x++) {
    const sh = Math.sin(x / 27 * Math.PI);
    const base = 30 + sh * 40;
    for (let y = 3; y < 34; y++) p.r(x, y, 1, 1, `rgb(${base * 0.5 + 20 | 0},${base + 60 | 0},${base * 0.5 | 0})`);
  }
  p.r(2, 3, 24, 3, '#1d3a1d'); p.r(2, 31, 24, 3, '#16301a');
  p.r(2, 6, 24, 1, '#4a7a4a'); p.r(2, 29, 24, 1, '#4a7a4a');
  for (let x = 0; x < 24; x++) { // 해저드 밴드
    const hz = ((x >> 1) % 2) === 0;
    p.r(2 + x, 15, 1, 6, hz ? '#e8c01e' : '#1c1c1c');
  }
  p.poly([[14, 19], [10, 26], [18, 26]], '#111'); // 경고 삼각형
  p.r(13.4, 21.4, 1.6, 3, '#e8c01e'); p.r(13.4, 25, 1.6, 1.4, '#e8c01e');
  return bake(c);
}

// ---------- 아이템들 ----------
function itemMedkit() {
  const c = cv(24, 17), p = painter(c.getContext('2d'));
  p.r(1, 3, 22, 13, '#e8e4da'); p.r(1, 3, 22, 2, '#fbf8f0'); p.r(1, 14, 22, 2, '#b8b2a4');
  p.r(0, 3, 1, 13, '#777'); p.r(23, 3, 1, 13, '#777');
  p.r(10, 6, 4, 8, '#1fae4a'); p.r(8, 8, 8, 4, '#1fae4a');
  return bake(c);
}
function itemStim() {
  const c = cv(10, 16), p = painter(c.getContext('2d'));
  p.r(2, 4, 6, 10, '#bfe8f2'); p.r(3, 6, 4, 7, '#2ab5e8');
  p.r(2, 1, 6, 3, '#889'); p.r(3, 0, 4, 1, '#aaa');
  return bake(c);
}
function itemClip() {
  const c = cv(16, 11), p = painter(c.getContext('2d'));
  p.r(1, 5, 14, 5, '#3a3a40');
  for (let i = 0; i < 4; i++) { p.r(2 + i * 3.4, 1, 2.4, 5, '#c8a23c'); p.r(2 + i * 3.4, 1, 2.4, 1.4, '#e8cf7a'); }
  return bake(c);
}
function itemShells() {
  const c = cv(18, 13), p = painter(c.getContext('2d'));
  p.r(1, 3, 16, 9, '#a82818'); p.r(1, 3, 16, 2, '#c83a24'); p.r(1, 10, 16, 2, '#70180e');
  for (let i = 0; i < 4; i++) { p.r(2 + i * 3.8, 0, 2.6, 4, '#c8a23c'); p.r(2 + i * 3.8, 0, 2.6, 1.2, '#e8cf7a'); }
  return bake(c);
}
function itemArmor(big) {
  const c = cv(big ? 22 : 15, big ? 19 : 13), p = painter(c.getContext('2d'));
  const w = big ? 22 : 15, h = big ? 19 : 13, m = big ? '#2fae5a' : '#1f7a3e', d2 = big ? '#1c6a38' : '#12522a';
  p.poly([[w * .18, 1], [w * .82, 1], [w - 1, h * .3], [w - 1, h - 1], [1, h - 1], [1, h * .3]], m);
  p.poly([[w * .3, 1], [w * .7, 1], [w * .62, h * .35], [w * .38, h * .35]], d2);
  p.r(w * .38, h * .5, w * .24, h * .3, d2);
  return bake(c);
}
function itemMega() {
  const c = cv(22, 22), g = c.getContext('2d');
  const gr = g.createRadialGradient(11, 10, 1, 11, 11, 11);
  gr.addColorStop(0, '#dff4ff'); gr.addColorStop(0.4, '#3aa0ff');
  gr.addColorStop(0.85, '#1140aa'); gr.addColorStop(1, 'rgba(8,32,85,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(11, 11, 10.4, 0, TAU); g.fill();
  g.fillStyle = '#ffffffcc'; g.beginPath(); g.arc(8, 7.5, 2.4, 0, TAU); g.fill();
  return bake(c);
}
function itemKey() {
  const c = cv(11, 15), p = painter(c.getContext('2d'));
  p.r(1, 1, 9, 13, '#d82010'); p.r(2, 2, 7, 4, '#ff5a44'); p.r(3, 9, 5, 3, '#7a0e06');
  p.r(4, 3.5, 3, 2, '#fff');
  return bake(c);
}
function itemShotgun() {
  const c = cv(36, 12), p = painter(c.getContext('2d'));
  p.r(2, 3, 22, 3, '#23262b'); p.r(2, 6.5, 22, 2.4, '#171a1e');
  p.r(22, 2.5, 7, 7, '#4a3016'); p.r(29, 5, 6, 4, '#5c3d1e'); p.r(33, 4, 3, 6, '#4a3016');
  p.r(2, 2.4, 22, 1, '#3a4046');
  return bake(c);
}
function itemChaingun() {
  const c = cv(32, 18), p = painter(c.getContext('2d'));
  p.e(9, 7, 7, 6, '#2a2e33'); p.e(9, 7, 4.4, 3.8, '#101215');
  p.r(15, 4, 12, 7, '#33383e'); p.r(15, 4, 12, 1.6, '#4a5158');
  p.r(24, 10, 7, 7, '#3d2c14');
  p.r(16, 11, 6, 5, '#22262b');
  return bake(c);
}
function itemLamp() {
  const c = cv(18, 42), g = c.getContext('2d'), p = painter(g);
  p.r(8, 12, 3, 28, '#2a2c30'); p.r(6, 39, 7, 3, '#1c1e22');
  const gr = g.createRadialGradient(9.5, 8, 1, 9.5, 8, 9);
  gr.addColorStop(0, '#ffe9b0'); gr.addColorStop(0.5, '#e8a83caa'); gr.addColorStop(1, '#e8a83c00');
  g.fillStyle = gr; g.beginPath(); g.arc(9.5, 8, 9, 0, TAU); g.fill();
  p.r(7, 6, 5, 5, '#fff3cf');
  return bake(c);
}

// ---------- 이펙트 ----------
function fxPuff(k) {
  const s = 12 + k * 6, c = cv(s, s), g = c.getContext('2d');
  const a = 0.75 - k * 0.22;
  const gr = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `rgba(200,200,195,${a})`);
  gr.addColorStop(1, 'rgba(150,150,148,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  return bake(c);
}
function fxFireball(k) {
  const s = 16, c = cv(s, s), g = c.getContext('2d');
  const r = 5 + k * 1.4;
  const gr = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#ffc93c');
  gr.addColorStop(0.7, '#ff5a10'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, r, 0, TAU); g.fill();
  return bake(c);
}
function fxBlood(k) {
  const c = cv(10, 10), p = painter(c.getContext('2d'));
  const n = k === 0 ? 5 : 3;
  for (let i = 0; i < n; i++) p.e(rand(2, 8), rand(2, 8), rand(.8, 1.8), rand(.8, 1.8), k === 0 ? '#c81e10' : '#7a1008');
  return bake(c);
}
function fxBoom(k) {
  const s = 26 + k * 12, c = cv(s, s), g = c.getContext('2d');
  if (k === 0) {
    const gr = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#ffe89a'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  } else if (k === 1 || k === 2) {
    const inner = k === 1 ? '#ffd23c' : '#ff7a1e';
    const outer = k === 1 ? '#ff7a1e' : 'rgba(90,40,20,.85)';
    const gr = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, inner); gr.addColorStop(0.8, outer); gr.addColorStop(1, 'rgba(40,20,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  } else {
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(70,60,55,.8)'); gr.addColorStop(1, 'rgba(40,35,32,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  }
  return bake(c);
}

// ---------- 1인칭 무기 뷰 (240x170, 하단 중앙 기준) ----------
function gunPistol(frame) { // 0 idle 1 fire 2 recover
  const c = cv(240, 170), g = c.getContext('2d'), p = painter(g);
  const kick = frame === 1 ? 7 : 0;
  g.save(); g.translate(120, 168); g.rotate(frame === 1 ? -0.06 : 0);
  // 양손
  p.e(-14, -18 + kick, 16, 13, '#c8927a'); p.e(14, -18 + kick, 16, 13, '#c8927a');
  p.e(-14, -26 + kick, 12, 9, '#b57f68'); p.e(14, -26 + kick, 12, 9, '#b57f68');
  // 그립
  p.r(-11, -34 + kick, 22, 22, '#1c1e22'); p.r(-11, -34 + kick, 22, 4, '#2e3238');
  // 슬라이드(원근 사다리꼴)
  p.poly([[-16, -36 + kick], [16, -36 + kick], [10, -84 + kick * 1.6], [-10, -84 + kick * 1.6]], '#2a2e34');
  p.poly([[-10, -36 + kick], [10, -36 + kick], [6, -80 + kick * 1.6], [-6, -80 + kick * 1.6]], '#3c424a');
  p.r(-4, -86 + kick * 1.6, 8, 6, '#15171a');            // 총구
  p.r(-2, -70 + kick * 1.6, 4, 3, '#121417');            // 가늠쇠
  if (frame === 1) {                                      // 머즐 플래시
    p.e(0, -92, 17, 15, '#ffd23c'); p.e(0, -92, 9, 8, '#fff8dc');
    p.poly([[0, -112], [5, -96], [-5, -96]], '#ffe89a');
  }
  if (frame === 2) p.r(-3, -60, 6, 10, 'rgba(180,180,175,.25)');
  g.restore();
  return c;
}
function gunShotgun(frame) { // 0 idle 1 fire 2 pump
  const c = cv(240, 170), g = c.getContext('2d'), p = painter(g);
  const kick = frame === 1 ? 9 : 0, pumpD = frame === 2 ? 14 : 0;
  g.save(); g.translate(120, 172);
  p.r(-24, -120 + kick, 48, 130, '#3a2a14');              // 스톡/몸통 목재
  p.r(-24, -120 + kick, 48, 10, '#4a3820');
  p.r(-20, -128 + kick, 40, 14, '#22262b');               // 리시버
  p.r(-13, -132 + kick, 9, 6, '#15171a'); p.r(5, -132 + kick, 9, 6, '#15171a'); // 총구 2열
  p.r(-13, -126 + kick, 9, 2, '#3c424a'); p.r(5, -126 + kick, 9, 2, '#3c424a');
  p.r(-19, -104 + pumpD + kick, 38, 16, '#4a3820');       // 펌프 핸드
  p.e(-26, -96 + pumpD, 12, 10, '#c8927a');               // 왼손
  p.e(0, -30, 26, 18, '#c8927a');                          // 오른손 그립
  if (frame === 1) {
    p.e(-8, -140 + kick, 13, 12, '#ffd23c'); p.e(8, -140 + kick, 13, 12, '#ffd23c');
    p.e(-8, -140 + kick, 7, 6, '#fff8dc'); p.e(8, -140 + kick, 7, 6, '#fff8dc');
  }
  g.restore();
  return c;
}
function gunChaingun(rot) { // rot: 회전 프레임 0/1
  const c = cv(240, 170), g = c.getContext('2d'), p = painter(g);
  g.save(); g.translate(120, 176);
  p.e(-30, -26, 15, 12, '#c8927a'); p.e(30, -26, 15, 12, '#c8927a'); // 양손
  p.r(-34, -52, 68, 34, '#2c3036'); p.r(-34, -52, 68, 6, '#3c424a'); // 하우징
  p.r(-26, -18, 52, 20, '#22262b');
  const R = 15, offs = rot === 0 ? [[-R, 0], [R, 0], [0, -R], [0, R], [-R * .71, -R * .71], [R * .71, R * .71]]
                                  : [[-R * .71, R * .71], [R * .71, -R * .71], [-R, 0], [R, 0], [0, -R], [0, R]];
  for (const [dx, dy] of offs) {                                        // 6연장 회전 총신
    p.e(dx, dy - 62, 6, 6, '#17191c');
    p.e(dx, dy - 62, 3.6, 3.6, '#2e3238');
    p.e(dx * .3, dy * .3 - 62, 1.4, 1.4, '#000');
  }
  p.e(0, -62, 20, 20, '#2a2e33cc');                                     // 스핀 실드
  p.e(0, -62, 8, 8, '#15171acc');
  return c;
}

// ---------- 전체 빌드 ----------
function ART_init() {
  SPR.mon.grunt = humanoidFrames({
    suit: '#3a5a35', armor: '#2e4728', helmet: '#233020', skin: '#c8927a', gun: 'rifle'
  });
  SPR.mon.brute = humanoidFrames({
    big: true, suit: '#5a2020', armor: '#7a2a22', helmet: '#301010',
    skin: '#d0a184', gun: 'sgun', visorGlow: '#ff7a3c'
  });
  SPR.mon.fiend = fiendFrames();
  SPR.mon.warlock = warlockFrames();

  SPR.items.barrel = barrelSprite();
  SPR.items.medkit = itemMedkit(); SPR.items.stim = itemStim();
  SPR.items.clip = itemClip();     SPR.items.shells = itemShells();
  SPR.items.armor = itemArmor(true);  SPR.items.shard = itemArmor(false);
  SPR.items.mega = itemMega();     SPR.items.key_red = itemKey();
  SPR.items.shotgun = itemShotgun(); SPR.items.chaingun = itemChaingun();
  SPR.items.lamp = itemLamp();

  SPR.fx.fireball = [fxFireball(0), fxFireball(1), fxFireball(2)];
  SPR.fx.puff = [fxPuff(0), fxPuff(1), fxPuff(2)];
  SPR.fx.blood = [fxBlood(0), fxBlood(1)];
  SPR.fx.boom = [fxBoom(0), fxBoom(1), fxBoom(2), fxBoom(3)];

  SPR.guns.pistol = [gunPistol(0), gunPistol(1), gunPistol(2)];
  SPR.guns.shotgun = [gunShotgun(0), gunShotgun(1), gunShotgun(2)];
  SPR.guns.chaingun = [gunChaingun(0), gunChaingun(1)];
}
