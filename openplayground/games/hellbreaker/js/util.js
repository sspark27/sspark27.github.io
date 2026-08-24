'use strict';
const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angNorm(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

// 결정론적 난수(텍스처 생성용) — xorshift32
let _tseed = 0x9e3779b9;
function srand() {
  _tseed ^= _tseed << 13; _tseed |= 0;
  _tseed ^= _tseed >>> 17;
  _tseed ^= _tseed << 5; _tseed |= 0;
  return (_tseed >>> 0) / 4294967296;
}
function sreset(seed) { _tseed = seed | 0 || 1; }
