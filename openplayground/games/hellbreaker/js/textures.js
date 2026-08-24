'use strict';
// ============================================================
// 절차적 텍스처 생성기 — 64x64, 컬럼-메이저 배치(레이캐스터 캐시 친화적)
// + 거리 음영 LUT(16단계) 사전 베이크
// ============================================================
const TW = 64;

function _newTex() { return new Uint8ClampedArray(TW * TW * 4); }
function _px(d, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= TW || y >= TW) return;
  const i = (y * TW + x) * 4;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
}
function _rect(d, x, y, w, h, r, g, b) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) _px(d, i, j, r, g, b);
}
function _fill(d, r, g, b) { _rect(d, 0, 0, TW, TW, r, g, b); }
function _nz(d, amt) {
  for (let i = 0; i < TW * TW; i++) {
    const n = (srand() * 2 - 1) * amt;
    d[i * 4] += n; d[i * 4 + 1] += n; d[i * 4 + 2] += n;
  }
}
function _toColMajor(d) {
  const o = new Uint32Array(TW * TW);
  for (let x = 0; x < TW; x++) for (let y = 0; y < TW; y++) {
    const si = (y * TW + x) * 4;
    o[x * TW + y] = 0xFF000000 | (d[si + 2] << 16) | (d[si + 1] << 8) | d[si];
  }
  return o;
}
function _bake(u32) {
  const levels = [];
  for (let l = 0; l < 16; l++) {
    const f = 0.07 + 0.93 * (l / 15);
    const o = new Uint32Array(TW * TW);
    for (let i = 0; i < u32.length; i++) {
      const c = u32[i];
      o[i] = 0xFF000000 |
        (((c >>> 16 & 255) * f & 255) << 16) |
        (((c >>> 8 & 255) * f & 255) << 8) |
        ((c & 255) * f & 255);
    }
    levels.push(o);
  }
  return levels;
}

// 3x5 미니 폰트 (EXIT 사인용)
const _FONT3 = {
  E: ['111', '100', '111', '100', '111'],
  X: ['101', '101', '010', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  T: ['111', '010', '010', '010', '010']
};
function _letter(d, ch, ox, oy, sc, r, g, b) {
  const bm = _FONT3[ch];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++)
    if (bm[y][x] === '1') _rect(d, ox + x * sc, oy + y * sc, sc, sc, r, g, b);
}

// ---------- 개별 텍스처 ----------
function texTech() {
  const d = _newTex();
  _fill(d, 72, 82, 94);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const v = Math.sin(x * 0.31) * 4 + Math.sin(y * 0.17) * 3;
    _px(d, x, y, 72 + v, 82 + v, 94 + v);
  }
  for (const sx of [0, 21, 42]) { // 세로 패널 이음새
    for (let y = 0; y < TW; y++) { _px(d, sx, y, 40, 46, 54); _px(d, sx + 1, y, 96, 106, 118); }
  }
  for (let x = 0; x < TW; x++) { _px(d, x, 32, 40, 46, 54); _px(d, x, 33, 96, 106, 118); } // 가로 이음새
  for (const [rx, ry] of [[4, 5], [17, 5], [25, 5], [38, 5], [46, 5], [59, 5],
                           [4, 27], [17, 27], [25, 27], [38, 27], [46, 27], [59, 27],
                           [10, 38], [30, 38], [53, 38]]) {
    _rect(d, rx, ry, 2, 2, 140, 148, 158); _px(d, rx, ry + 2, 30, 34, 40);
  }
  for (let x = 6; x < 58; x += 3) for (let y = 46; y < 56; y++) _px(d, x, y, 30, 34, 40); // 환기 슬릿
  _rect(d, 6, 43, 52, 2, 52, 60, 70);
  _nz(d, 6);
  return _toColMajor(d);
}

function texBrick() {
  const d = _newTex();
  _fill(d, 36, 28, 24);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = -1; col < 5; col++) {
      const bx = col * 16 + off, by = row * 8;
      const sh = (srand() * 2 - 1) * 14;
      for (let y = by + 1; y < by + 8 && y < TW; y++) for (let x = bx + 1; x < bx + 16 && x < TW; x++) {
        const v = (srand() * 2 - 1) * 6;
        _px(d, x, y, 138 + sh + v, 58 + sh * 0.5 + v, 44 + sh * 0.4 + v);
      }
      if (srand() < 0.25) { const cx = bx + 3 + (srand() * 10 | 0); _px(d, cx, by + 3, 30, 20, 16); _px(d, cx + 1, by + 4, 30, 20, 16); }
    }
  }
  _nz(d, 7);
  return _toColMajor(d);
}

function texStone() {
  const d = _newTex();
  _fill(d, 104, 104, 100);
  for (let by = 0; by < 5; by++) for (let bx = 0; bx < 3; bx++) {
    const sh = (srand() * 2 - 1) * 16;
    for (let y = by * 13 + 1; y < by * 13 + 13; y++) for (let x = bx * 21 + 1; x < bx * 21 + 21; x++) {
      const v = (srand() * 2 - 1) * 8;
      _px(d, x, y, 104 + sh + v, 104 + sh + v, 98 + sh + v);
    }
  }
  for (let i = 0; i < 40; i++) _px(d, srand() * TW | 0, srand() * TW | 0, 66, 66, 62);
  _nz(d, 6);
  return _toColMajor(d);
}

function texRust() {
  const d = _newTex();
  _fill(d, 96, 72, 52);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const plateEdge = (x % 32 === 0 || y % 32 === 0);
    let v = plateEdge ? -26 : Math.sin(x * 0.09) * 5;
    if (srand() < 0.06) v -= 22; // 녹 얼룩
    _px(d, x, y, 108 + v, 76 + v * 0.7, 50 + v * 0.5);
  }
  for (const [bx, by] of [[5, 5], [26, 5], [5, 26], [26, 26], [37, 37], [58, 37], [37, 58], [58, 58]])
    _rect(d, bx, by, 2, 2, 160, 130, 90);
  for (let i = 0; i < 6; i++) { // 녹물 줄무늬
    const sx = srand() * TW | 0, len = 10 + srand() * 30 | 0, sy = srand() * TW | 0;
    for (let y = sy; y < sy + len; y++) _px(d, sx, y % TW, 78, 46, 26);
  }
  _nz(d, 7);
  return _toColMajor(d);
}

function texComp() {
  const d = _newTex();
  _fill(d, 36, 40, 47);
  for (let py = 0; py < 4; py++) {
    for (let y = py * 16; y < py * 16 + 15; y++) for (let x = 0; x < TW; x++)
      _px(d, x, y, 36 + (py % 2) * 5, 40 + (py % 2) * 5, 47 + (py % 2) * 6);
    for (let x = 0; x < TW; x++) _px(d, x, py * 16 + 15, 20, 22, 26);
  }
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { // 상태 램프
    const lx = 7 + i * 9, ly = 6 + row * 16;
    const on = srand() < 0.55;
    const col = on ? [80, 230, 90] : [24, 60, 28];
    _rect(d, lx, ly, 4, 3, col[0], col[1], col[2]);
    if (on) _rect(d, lx + 1, ly - 1, 2, 1, 180, 255, 180);
  }
  for (let x = 0; x < TW; x++) { _px(d, x, 12, 40, 190, 210); _px(d, x, 13, 24, 120, 140); } // 청색 라인
  _nz(d, 5);
  return _toColMajor(d);
}

function texHell() {
  const d = _newTex();
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const n = Math.sin(x * 0.21 + Math.sin(y * 0.13) * 2.2) + Math.sin(y * 0.31 + x * 0.07);
    const vein = Math.sin((x + n * 6) * 0.42);
    let r = 66 + n * 12, g = 22 + n * 6, b = 18 + n * 4;
    if (vein > 0.86) { r = 20; g = 8; b = 6; }           // 균열
    else if (vein < -0.93 && srand() < 0.3) { r = 200; g = 70; b = 20; } // 잔불 불씨
    _px(d, x, y, r, g, b);
  }
  _nz(d, 9);
  return _toColMajor(d);
}

function texDoor(red) {
  const d = _newTex();
  _fill(d, 88, 92, 98);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const edge = (x < 5 || x > 58 || y < 3 || y > 60);
    const v = edge ? 26 : Math.sin(Math.abs(x - 32) * 0.22) * -8;
    _px(d, x, y, 88 + v, 92 + v, 98 + v);
  }
  for (let y = 0; y < TW; y++) { _px(d, 31, y, 30, 32, 36); _px(d, 32, y, 30, 32, 36); } // 중앙 분리선
  for (const [wx, wy] of [[10, 10], [46, 10]]) { // 작은 창
    _rect(d, wx, wy, 8, 10, 16, 22, 30);
    _rect(d, wx - 1, wy - 1, 10, 1, 130, 136, 144); _rect(d, wx - 1, wy + 10, 10, 1, 130, 136, 144);
    _rect(d, wx + 2, wy + 2, 2, 3, 70, 90, 120);
  }
  for (let x = 0; x < TW; x++) for (let y = 50; y < 58; y++) { // 하단 해저드 스트라이프
    const hz = (((x + y) >> 2) % 2) === 0;
    _px(d, x, y, hz ? 200 : 30, hz ? 170 : 26, hz ? 30 : 22);
  }
  if (red) {
    for (let y = 8; y < 44; y++) for (let x = 55; x < 59; x++) _px(d, x, y, 220, 30, 20);
    for (let y = 8; y < 44; y += 6) _rect(d, 55, y, 4, 1, 255, 120, 100);
    _rect(d, 24, 30, 16, 8, 40, 16, 14);
    _rect(d, 27, 32, 10, 4, 235, 60, 40); // 카드 슬롯 발광
  }
  _nz(d, 5);
  return _toColMajor(d);
}

function texExit() {
  const d = _newTex();
  _fill(d, 60, 66, 74);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) _px(d, x, y, 60 + Math.sin(y * .3) * 4, 66, 74);
  for (let y = 0; y < TW; y += 16) for (let x = 0; x < TW; x++) _px(d, x, y, 40, 44, 50);
  _rect(d, 8, 6, 48, 18, 6, 60, 26);          // 출구 사인 판
  _rect(d, 7, 5, 50, 1, 140, 255, 160); _rect(d, 7, 24, 50, 1, 20, 90, 40);
  _letter(d, 'E', 12, 10, 2, 180, 255, 190);
  _letter(d, 'X', 22, 10, 2, 180, 255, 190);
  _letter(d, 'I', 32, 10, 2, 180, 255, 190);
  _letter(d, 'T', 40, 10, 2, 180, 255, 190);
  _rect(d, 22, 34, 20, 22, 34, 36, 42);        // 스위치 박스
  _rect(d, 23, 35, 18, 20, 52, 56, 64);
  _rect(d, 30, 37, 4, 12, 200, 40, 26);        // 레버(위)
  _rect(d, 28, 46, 8, 5, 150, 150, 155);
  for (const [sx, sy] of [[3, 3], [60, 3], [3, 60], [60, 60]]) _rect(d, sx, sy, 2, 2, 150, 155, 162);
  _nz(d, 4);
  return _toColMajor(d);
}

function texConcrete() {
  const d = _newTex();
  _fill(d, 86, 86, 82);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const grout = (x % 32 === 0 || y % 32 === 0);
    const v = grout ? -24 : (srand() * 2 - 1) * 7;
    _px(d, x, y, 86 + v, 86 + v, 80 + v);
  }
  for (let i = 0; i < 5; i++) { // 얼룩
    const cx = srand() * TW | 0, cy = srand() * TW | 0, rr = 3 + srand() * 6;
    for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++)
      if (x * x + y * y < rr * rr) { const p = ((cy + y + TW) % TW) * TW + ((cx + x + TW) % TW); d[p * 4] *= 0.82; d[p * 4 + 1] *= 0.8; d[p * 4 + 2] *= 0.78; }
  }
  return _toColMajor(d);
}

function texGrate() {
  const d = _newTex();
  _fill(d, 40, 42, 46);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const hx = x % 8, hy = y % 8;
    if (hx >= 2 && hx <= 6 && hy >= 2 && hy <= 6) _px(d, x, y, 12, 12, 14);
    else if (hx === 1 || hy === 1) _px(d, x, y, 70, 74, 80);
    else _px(d, x, y, 46, 48, 52);
  }
  _nz(d, 4);
  return _toColMajor(d);
}

function texHellFloor() {
  const d = _newTex();
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const n = Math.sin(x * .3 + Math.sin(y * .2) * 2) + srand() * 1.4 - 0.7;
    _px(d, x, y, 74 + n * 14, 34 + n * 7, 26 + n * 5);
  }
  for (let i = 0; i < 26; i++) { // 갈라진 균열
    let cx = srand() * TW | 0, cy = srand() * TW | 0;
    for (let s = 0; s < 8; s++) { _px(d, cx, cy, 30, 12, 10); cx = (cx + (srand() * 3 | 0) - 1 + TW) % TW; cy = (cy + 1) % TW; }
  }
  return _toColMajor(d);
}

function texPanelCeil() {
  const d = _newTex();
  _fill(d, 40, 41, 45);
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const edge = (x % 32 === 0 || y % 32 === 0);
    const lightStrip = (Math.floor(x / 32) % 2 === 0) && (y % 32 >= 13) && (y % 32 <= 18);
    if (lightStrip) _px(d, x, y, 235, 225, 190);
    else if (lightStrip === false && (y % 32 === 12 || y % 32 === 19)) _px(d, x, y, 70, 68, 62);
    else _px(d, x, y, edge ? 26 : 40 + (srand() * 4 - 2), edge ? 27 : 41, edge ? 30 : 45);
  }
  return _toColMajor(d);
}

function texRockCeil() {
  const d = _newTex();
  for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) {
    const n = Math.sin(x * .17 + Math.sin(y * .23) * 1.8) + (srand() * 1.6 - .8);
    _px(d, x, y, 44 + n * 9, 36 + n * 8, 32 + n * 7);
  }
  return _toColMajor(d);
}

// ---------- 전역 레지스트리 ----------
const WALLTEX = {}, WALLSH = {};
const FLOORTEX = {}, FLOORSH = {};
const CEILTEX = {}, CEILSH = {};

function TEXTURES_init() {
  sreset(0xC0FFEE);
  const walls = {
    1: texTech(), 2: texBrick(), 3: texStone(), 4: texRust(),
    5: texComp(), 10: texHell(), 20: texDoor(false), 21: texDoor(true), 24: texExit()
  };
  for (const id in walls) { WALLTEX[id] = walls[id]; WALLSH[id] = _bake(walls[id]); }
  const floors = { 1: texConcrete(), 2: texGrate(), 3: texHellFloor() };
  for (const id in floors) { FLOORTEX[id] = floors[id]; FLOORSH[id] = _bake(floors[id]); }
  const ceils = { 1: texPanelCeil(), 2: texRockCeil() };
  for (const id in ceils) { CEILTEX[id] = ceils[id]; CEILSH[id] = _bake(ceils[id]); }
}
