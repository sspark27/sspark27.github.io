'use strict';
// ============================================================
// 렌더러 — 클래식 레이캐스팅 엔진
// 내부 해상도 384x240 버퍼에 직접 픽셀을 기록한 뒤 확대 출력.
// 벽 DDA + 문(중간 평면 슬라이딩) + 시크릿 벽 +
// 행별 바닥/천장 텍스처 캐스팅 + z-buffer 빌보드 스프라이트.
// ============================================================
const PLANE = 0.66;

const REN = {
  disp: null, dctx: null,
  buf: null, bctx: null, img: null, px: null,
  zbuf: null, yTop: null, yBot: null,
  W: 384, H: 240,
  dW: 0, dH: 0,

  init(canvas) {
    this.disp = canvas;
    this.dctx = canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = this.W; this.buf.height = this.H;
    this.bctx = this.buf.getContext('2d');
    this.img = this.bctx.createImageData(this.W, this.H);
    this.px = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(this.W);
    this.yTop = new Int16Array(this.W);
    this.yBot = new Int16Array(this.W);
  },

  resizeTo(winW, winH) {
    const ar = this.W / this.H;
    let w = winW, h = Math.round(w / ar);
    if (h > winH) { h = winH; w = Math.round(h * ar); }
    this.dW = w; this.dH = h;
    this.disp.width = w; this.disp.height = h;
    this.disp.style.width = w + 'px';
    this.disp.style.height = h + 'px';
    this.dctx.imageSmoothingEnabled = false;
    return { w, h };
  },

  // ----------------------------------------------------------
  frame(game, camX, camY, ang, pitchPx, bobPx, shakeX, shakeY, flashBoost) {
    const W = this.W, H = this.H, px = this.px, zb = this.zbuf;
    const g = game.grid, mw = game.mw, mh = game.mh, seen = game.seen;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const plX = -dirY * PLANE, plY = dirX * PLANE;
    const horizon = clamp(
      Math.round(H / 2 + pitchPx + bobPx + shakeY), 40, H - 40);

    // ---------- 벽 ----------
    for (let x = 0; x < W; x++) {
      const camXn = 2 * x / W - 1;
      const rdX = dirX + plX * camXn;
      const rdY = dirY + plY * camXn;
      let mx = Math.floor(camX), my = Math.floor(camY);
      const ddx = Math.abs(1 / (rdX || 1e-9)), ddy = Math.abs(1 / (rdY || 1e-9));
      let sx, sy, sdx, sdy;
      if (rdX < 0) { sx = -1; sdx = (camX - mx) * ddx; }
      else { sx = 1; sdx = (mx + 1 - camX) * ddx; }
      if (rdY < 0) { sy = -1; sdy = (camY - my) * ddy; }
      else { sy = 1; sdy = (my + 1 - camY) * ddy; }

      let side = 0, dist = 0, texId = -1, texU = 0, hit = false;
      for (let iter = 0; iter < 90; iter++) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; }
        else { sdy += ddy; my += sy; side = 1; }
        if (mx < 0 || my < 0 || mx >= mw || my >= mh) break;
        const ci = my * mw + mx;
        seen[ci] = 1;
        const c = g[ci];
        if (c === 0) continue;

        if (c === 20 || c === 21 || c === 23) {
          // 중간 평면 슬라이딩 문/시크릿
          const aw = game.animMap[mx + ',' + my];
          const open = aw ? aw.open : 0;
          const pm = side === 0 ? (sdx - ddx) + ddx * 0.5 : (sdy - ddy) + ddy * 0.5;
          const hc = side === 0 ? camY + pm * rdY : camX + pm * rdX;
          const cellC = side === 0 ? my : mx;
          const frac = hc - cellC;
          if (frac >= 0 && frac <= 1 && frac >= open) {
            dist = pm; texId = c === 23 ? (aw ? aw.mimic : 3) : c;
            texU = clamp(((frac - open) * TW) | 0, 0, TW - 1);
            hit = true; break;
          }
          continue;
        }

        dist = side === 0 ? sdx - ddx : sdy - ddy;
        const wc = side === 0 ? camY + dist * rdY : camX + dist * rdX;
        let fr = wc - Math.floor(wc);
        texU = (fr * TW) | 0;
        if ((side === 0 && rdX > 0) || (side === 1 && rdY < 0))
          texU = TW - 1 - texU;
        texId = c; hit = true; break;
      }

      if (!hit || dist < 0.01) {
        zb[x] = 1e9; this.yTop[x] = H; this.yBot[x] = -1;
        continue;
      }
      zb[x] = dist;

      let lvl = clamp(Math.round(15 - dist * 1.02) + flashBoost, 0, 15);
      if (side === 1) lvl = Math.max(0, lvl - 2);
      const tex = WALLSH[texId][lvl];

      const lineH = H / dist;
      const y0 = Math.max(0, Math.ceil(horizon - lineH / 2));
      const y1 = Math.min(H - 1, Math.floor(horizon + lineH / 2));
      const tStep = TW / lineH;
      let tPos = (y0 - (horizon - lineH / 2)) * tStep;
      const colBase = texU << 6;
      for (let y = y0; y <= y1; y++) {
        let ty = tPos | 0; if (ty > TW - 1) ty = TW - 1;
        tPos += tStep;
        px[y * W + x] = tex[colBase | ty];
      }
      this.yTop[x] = y0; this.yBot[x] = y1;
    }

    // ---------- 바닥 / 천장 (행 단위 캐스팅) ----------
    const fsh = FLOORSH[game.floorId], csh = CEILSH[game.ceilId];
    const rdX0 = dirX - plX, rdY0 = dirY - plY;
    const rdX1 = dirX + plX, rdY1 = dirY + plY;
    const posZ = H * 0.5;

    for (let y = horizon; y < H; y++) {
      const rowD = posZ / (y - horizon);
      if (rowD > 40) continue;
      const stepX = rowD * (rdX1 - rdX0) / W;
      const stepY = rowD * (rdY1 - rdY0) / W;
      let fx = camX + rowD * rdX0, fy = camY + rowD * rdY0;
      const lvl = clamp(Math.round(15 - rowD * 1.02) + flashBoost, 0, 15);
      const tex = fsh[lvl];
      const rowBase = y * W;
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        if (y <= this.yBot[x]) continue;
        const tx = ((fx - Math.floor(fx)) * TW) | 0;
        const ty = ((fy - Math.floor(fy)) * TW) | 0;
        px[rowBase + x] = tex[(tx << 6) | ty];
      }
    }
    for (let y = horizon - 1; y >= 0; y--) {
      const rowD = posZ / (horizon - y);
      if (rowD > 40) continue;
      const stepX = rowD * (rdX1 - rdX0) / W;
      const stepY = rowD * (rdY1 - rdY0) / W;
      let fx = camX + rowD * rdX0, fy = camY + rowD * rdY0;
      const lvl = clamp(Math.round(13 - rowD * 1.02) + flashBoost, 0, 15);
      const tex = csh[lvl];
      const rowBase = y * W;
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        if (y >= this.yTop[x]) continue;
        const tx = ((fx - Math.floor(fx)) * TW) | 0;
        const ty = ((fy - Math.floor(fy)) * TW) | 0;
        px[rowBase + x] = tex[(tx << 6) | ty];
      }
    }

    // ---------- 스프라이트 ----------
    const list = game.renderList;
    for (const s of list) {
      const rx = s.x - camX, ry = s.y - camY;
      s._d2 = rx * rx + ry * ry;
    }
    list.sort((a, b) => b._d2 - a._d2);

    const invDet = 1 / (plX * dirY - dirX * plY);
    for (const s of list) {
      const rx = s.x - camX, ry = s.y - camY;
      const tx = invDet * (dirY * rx - dirX * ry);
      const ty = invDet * (-plY * rx + plX * ry);
      if (ty < 0.12) continue;
      const img = s.img;
      const lineH = H / ty;
      const hpx = lineH * s.scale;
      const wpx = hpx * (img.w / img.h);
      const cx = W / 2 * (1 + tx / ty) + shakeX;
      const bottom = horizon + lineH * 0.5 - lineH * (s.hover || 0) - lineH * (s.z || 0);
      const top = bottom - hpx;
      const x0 = Math.max(0, Math.ceil(cx - wpx / 2));
      const x1 = Math.min(W - 1, Math.floor(cx + wpx / 2));
      if (x1 < x0) continue;
      const y0 = Math.max(0, Math.ceil(top));
      const y1 = Math.min(H - 1, Math.floor(bottom));

      let f = clamp(1.18 - ty * 0.09, 0.16, 1);
      if (flashBoost > 0) f = Math.min(1, f + 0.28);
      const fi = (f * 255) | 0;
      const iw = img.w, ih = img.h, u = img.u;

      for (let x = x0; x <= x1; x++) {
        if (zb[x] <= ty) continue;
        const txx = clamp(((x - (cx - wpx / 2)) / wpx * iw) | 0, 0, iw - 1);
        for (let y = y0; y <= y1; y++) {
          const tyy = clamp(((y - top) / hpx * ih) | 0, 0, ih - 1);
          const c = u[tyy * iw + txx];
          if ((c >>> 24) < 128) continue;
          let r = (c & 255) * fi >> 8;
          let gg = (c >>> 8 & 255) * fi >> 8;
          let b = (c >>> 16 & 255) * fi >> 8;
          if (s.tint === 1) { // 통곡 플래시
            r = r + 190 >> 1; gg = gg + 120 >> 1; b = b + 110 >> 1;
          }
          px[y * W + x] = 0xFF000000 | (b << 16) | (gg << 8) | r;
        }
      }
    }

    this.bctx.putImageData(this.img, 0, 0);

    // ---------- 1인칭 무기 ----------
    this.drawGun();

    // ---------- 화면 출력 ----------
    this.dctx.imageSmoothingEnabled = false;
    this.dctx.drawImage(this.buf, 0, 0, W, H, 0, 0, this.dW, this.dH);
  },

  drawGun() {
    if (!GAME || !GAME.player || GAME.player.dead) return;
    if (STATE !== 'play' && STATE !== 'pause') return;
    const p = GAME.player;
    const w = WEAPONS[p.cur];
    let cvs;
    if (w.key === 'pistol') cvs = SPR.guns.pistol[p.flash > 0 ? 1 : (p.cool < w.rate * 0.45 ? 2 : 0)];
    else if (w.key === 'shotgun') {
      const pumpPh = !p.pumpDone && p.cool < w.rate - 0.25 && p.cool > w.rate - 0.6;
      cvs = SPR.guns.shotgun[p.flash > 0 ? 1 : (pumpPh ? 2 : 0)];
    } else cvs = SPR.guns.chaingun[p.spinFrame];

    const sc = this.H / 165;
    const gw = cvs.width * sc, gh = cvs.height * sc;
    const swx = Math.sin(p.bob) * 8 * p.moveAmt;
    const swy = Math.abs(Math.cos(p.bob)) * 6 * p.moveAmt + p.kick * 16;
    let dip = 0;
    if (p.switchT > 0) {
      const prog = 1 - p.switchT / 0.36;
      dip = Math.sin(prog * Math.PI) * gh * 0.55;
    }
    this.bctx.imageSmoothingEnabled = false;
    this.bctx.drawImage(cvs,
      (this.W - gw) / 2 + swx,
      this.H - gh + 26 * sc + swy + dip,
      gw, gh);
  },

  // 화면 공간 오버레이(데미지 플래시 등) — 메인에서 호출
  overlay(color) {
    this.dctx.fillStyle = color;
    this.dctx.fillRect(0, 0, this.dW, this.dH);
  },
  crosshair() {
    const c = this.dctx, cx = this.dW / 2, cy = this.dH / 2;
    c.fillStyle = 'rgba(255,230,160,.85)';
    c.fillRect(cx - 1, cy - 1, 2, 2);
    c.fillStyle = 'rgba(255,230,160,.35)';
    c.fillRect(cx - 6, cy, 3, 1); c.fillRect(cx + 4, cy, 3, 1);
    c.fillRect(cx, cy - 6, 1, 3); c.fillRect(cx, cy + 4, 1, 3);
  }
};
