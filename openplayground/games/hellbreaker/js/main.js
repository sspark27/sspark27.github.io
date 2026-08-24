'use strict';
// ============================================================
// 메인 — 게임 오케스트레이터 / 입력 / 상태 머신 / 루프
// 전역: KEY, MOUSE, SENS, DIFF, P (entities.js가 참조)
// ============================================================
const KEY = {};
const MOUSE = { dx: 0, dy: 0, down: false };
let SENS = 0.0023;
const DIFFS = [
  { name: '훈련생', dmgTaken: 0.65, atkRate: 1.35, enemyAcc: 0.72 },
  { name: '해병',   dmgTaken: 1.0,  atkRate: 1.0,  enemyAcc: 1.0 },
  { name: '지옥불', dmgTaken: 1.55, atkRate: 0.78, enemyAcc: 1.22 }
];
let DIFF = DIFFS[1];
var P = null;
let GAME = null;

const DEATH_QUOTES = [
  '지옥은 네가 올 줄 알고 있었다.',
  '다음 사람은 더 잘하겠지.',
  '아레스-7의 침묵을 기억하라.',
  '총구는 들었는데, 방패는 없었다.'
];

const TOTALS = { kills: 0, kTot: 0, items: 0, iTot: 0, secrets: 0, sTot: 0, time: 0 };

// ============================================================
// Game
// ============================================================
class Game {
  constructor() {
    this.state = 'boot';
    this.mapOn = false;
    this.deathShown = false;
  }

  loadLevel(idx) {
    this.lvIndex = idx;
    const def = LEVELS[idx];
    const lv = def.build();
    this.levelDef = def;
    this.mw = lv.w; this.mh = lv.h; this.grid = lv.grid;
    this.floorId = def.floor; this.ceilId = def.ceil;
    this.seen = new Uint8Array(lv.w * lv.h);

    this.animMap = {};
    for (const k in lv.doors) {
      const d = lv.doors[k];
      this.animMap[k] = { x: d.x, y: d.y, open: 0, st: 0, timer: 0,
        kind: d.type === 21 ? 'red' : 'door', noClose: false, found: false };
    }
    this.secretGroups = lv.secretGroups;
    for (const grp of lv.secretGroups) {
      for (const c of grp.cells)
        this.animMap[c.x + ',' + c.y] = {
          x: c.x, y: c.y, open: 0, st: 0, timer: 0,
          kind: 'secret', mimic: c.mimic, noClose: true, group: grp, found: false
        };
    }

    this.monsters = lv.monsters.map(s => new Monster(s.type, s.x, s.y));
    this.barrels = []; this.pickups = []; this.decor = [];
    for (const it of lv.items) {
      if (it.kind === 'barrel') this.barrels.push(new Barrel(it.x, it.y));
      else if (it.kind === 'lamp')
        this.decor.push({ img: SPR.items.lamp, x: it.x, y: it.y, scale: 0.62 });
      else this.pickups.push({ kind: it.kind, x: it.x, y: it.y, taken: false, ph: Math.random() * TAU });
    }
    this.projectiles = []; this.particles = []; this.renderList = [];
    this.stats = { kills: 0, items: 0, secrets: 0 };
    this.levelTotals = lv.totals;
    this.time = 0; this.exitT = -1;
    this.shakeT = 0; this.shakeAmp = 0;

    P = new Player(lv.start.x, lv.start.y, lv.start.a);
    this.player = P;
    this.mapOn = false; this.deathShown = false;
    HUD.el.msgs.innerHTML = ''; HUD.msgs.length = 0;
    this.renderList = [];
  }

  beginPlay() {
    this.state = 'play';
    HUD.noScreen(); HUD.showBar(true);
    HUD.banner(this.levelDef.name);
    this.levelDef.intro.split('\n').forEach(l => HUD.msg(l));
    HUD.msg('목표: 출구 스위치를 작동시켜라');
    SND.startMusic('game');
  }

  // ---------- 격자 조회 ----------
  solidCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh) return true;
    const c = this.grid[cy * this.mw + cx];
    if (c === 0) return false;
    if (c === 20 || c === 21 || c === 23) {
      const a = this.animMap[cx + ',' + cy];
      return !(a && a.open >= 0.7);
    }
    return true;
  }
  pointSolid(x, y) { return this.solidCell(Math.floor(x), Math.floor(y)); }

  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy);
    const n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const cx = Math.floor(x0 + dx * t), cy = Math.floor(y0 + dy * t);
      const c = this.grid[cy * this.mw + cx];
      if (c === 0) continue;
      if (c === 20 || c === 21 || c === 23) {
        const a = this.animMap[cx + ',' + cy];
        if (a && a.open >= 0.5) continue;
        return false;
      }
      return false;
    }
    return true;
  }

  circleBlocked(x, y, r, self) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        if (this.solidCell(cx, cy)) return true;
    for (const m of this.monsters) {
      if (m === self || m.state === 'dead' || m.state === 'dying') continue;
      const rr = r + m.r - 0.03;
      if (dist2(x, y, m.x, m.y) < rr * rr) return true;
    }
    for (const b of this.barrels) {
      if (b.dead) continue;
      const rr = r + b.r - 0.03;
      if (dist2(x, y, b.x, b.y) < rr * rr) return true;
    }
    if (self !== P && P && !P.dead) {
      if (dist2(x, y, P.x, P.y) < (r + P.r - 0.03) ** 2) return true;
    }
    return false;
  }

  // ---------- 사운드 전파 ----------
  noise(x, y, r) {
    for (const m of this.monsters)
      if (m.state === 'idle' && dist2(x, y, m.x, m.y) < r * r) m.alert(this);
  }
  monsterTryDoor(m) {
    const fx = m.x + Math.cos(m.a0 || 0) * 0.75;
    const fy = m.y + Math.sin(m.a0 || 0) * 0.75;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    if (cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh) return;
    if (this.grid[cy * this.mw + cx] === 20) {
      const a = this.animMap[cx + ',' + cy];
      if (a.st === 0) { a.st = 1; SND.doorOpen(); }
    }
  }

  // ---------- 사용(E): 넉넉한 주변 탐색 — 약간 비껴봐도 문이 열린다 ----------
  findNearestInteractable() {
    const pxf = Math.floor(P.x), pyf = Math.floor(P.y);
    let best = null, bestD2 = 1e9, bestCode = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = pxf + dx, cy = pyf + dy;
      if (cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh) continue;
      const c = this.grid[cy * this.mw + cx];
      if (c !== 20 && c !== 21 && c !== 23 && c !== 24) continue;
      const d2 = (cx + 0.5 - P.x) ** 2 + (cy + 0.5 - P.y) ** 2;
      if (d2 > 3.24) continue;
      if (d2 < bestD2) { best = [cx, cy]; bestD2 = d2; bestCode = c; }
    }
    return best ? { cx: best[0], cy: best[1], code: bestCode, d2: bestD2 } : null;
  }
  useAction() {
    const hit = this.findNearestInteractable();
    if (!hit) return;
    if (hit.code === 20 || hit.code === 21) this.toggleDoor(hit.cx, hit.cy, true);
    else if (hit.code === 23) this.openSecret(hit.cx, hit.cy);
    else if (hit.code === 24) this.doExit();
  }
  toggleDoor(cx, cy, byPlayer) {
    const a = this.animMap[cx + ',' + cy];
    if (!a) return;
    if (a.kind === 'red' && byPlayer && !P.keys.red) {
      SND.buzz(); HUD.msg('붉은 열쇠카드가 필요하다');
      return;
    }
    if (a.st === 0) { a.st = 1; SND.doorOpen(); }
    else if (a.st === 3) { a.st = 1; SND.doorOpen(); }
    else if (a.st === 2 && byPlayer) { a.st = 3; SND.doorClose(); }
  }
  openSecret(cx, cy) {
    const a = this.animMap[cx + ',' + cy];
    if (!a || a.found) return;
    a.found = true; a.group.found = true;
    this.stats.secrets++;
    SND.secret();
    HUD.msg('숨겨진 통로를 발견했다!');
    for (const c of a.group.cells) {
      const e = this.animMap[c.x + ',' + c.y];
      if (e.st === 0) { e.st = 1; e.found = true; }
    }
  }
  doExit() {
    if (this.exitT >= 0) return;
    SND.switchHit();
    this.exitT = 0.8;
  }

  updateDoors(dt) {
    for (const k in this.animMap) {
      const a = this.animMap[k];
      if (a.st === 1) {
        a.open += dt * 1.6;
        if (a.open >= 1) { a.open = 1; if (a.noClose) a.st = 4; else { a.st = 2; a.timer = 3.5; } }
      } else if (a.st === 2) {
        a.timer -= dt;
        if (a.timer <= 0 && !this.doorOccupied(a.x, a.y)) { a.st = 3; SND.doorClose(); }
      } else if (a.st === 3) {
        a.open -= dt * 1.6;
        if (a.open <= 0) { a.open = 0; a.st = 0; }
      }
    }
  }
  doorOccupied(x, y) {
    const cx = x + 0.5, cy = y + 0.5;
    if (dist2(P.x, P.y, cx, cy) < 1.15 * 1.15) return true;
    for (const m of this.monsters)
      if (m.state !== 'dead' && dist2(m.x, m.y, cx, cy) < 1.15 * 1.15) return true;
    return false;
  }

  // ---------- 전투 ----------
  castRay(x, y, dx, dy, maxD) {
    let mx = Math.floor(x), my = Math.floor(y);
    const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
    let sx, sy, sdx, sdy;
    if (dx < 0) { sx = -1; sdx = (x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - x) * ddx; }
    if (dy < 0) { sy = -1; sdy = (y - my) * ddy; } else { sy = 1; sdy = (my + 1 - y) * ddy; }
    for (let i = 0; i < 120; i++) {
      let side;
      if (sdx < sdy) { mx += sx; side = 0; var t = sdx; sdx += ddx; }
      else { my += sy; side = 1; t = sdy; sdy += ddy; }
      if (t > maxD) break;
      if (mx < 0 || my < 0 || mx >= this.mw || my >= this.mh) break;
      const c = this.grid[my * this.mw + mx];
      if (c === 0) continue;
      if (c === 20 || c === 21 || c === 23) {
        const a = this.animMap[mx + ',' + my];
        if (!(a && a.open >= 0.7)) return { d: t, hx: x + dx * t, hy: y + dy * t };
        continue;
      }
      return { d: t, hx: x + dx * t, hy: y + dy * t };
    }
    return { d: maxD, hx: x + dx * maxD, hy: y + dy * maxD };
  }

  playerShot(ang, dmg) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const wall = this.castRay(P.x, P.y, dx, dy, 32);
    let bt = wall.d, hitM = null, hitB = null;
    const test = (ex, ey, er) => {
      const rx = ex - P.x, ry = ey - P.y;
      const t = rx * dx + ry * dy;
      if (t <= 0.1 || t >= bt) return -1;
      const px = rx - dx * t, py = ry - dy * t;
      return (px * px + py * py < er * er) ? t : -1;
    };
    for (const m of this.monsters) {
      if (m.state === 'dead' || m.state === 'dying') continue;
      const t = test(m.x, m.y, m.r + 0.03);
      if (t > 0) { bt = t; hitM = m; hitB = null; }
    }
    for (const b of this.barrels) {
      if (b.dead) continue;
      const t = test(b.x, b.y, b.r + 0.04);
      if (t > 0) { bt = t; hitB = b; hitM = null; }
    }
    const ix = P.x + dx * bt, iy = P.y + dy * bt;
    if (hitM) {
      hitM.damage(dmg, this);
    } else if (hitB) {
      hitB.damage(dmg, this);
      this.burst(ix, iy, 'puff', 2, 0.3);
    } else if (bt < 31.9) {
      this.burst(wall.hx - dx * 0.06, wall.hy - dy * 0.06, 'puff', 1, 0.35);
    }
  }

  nearMiss(x, y, ang, len) {
    this.burst(x + Math.cos(ang) * len, y + Math.sin(ang) * len, 'puff', 1, 0.3);
  }

  explode(x, y) {
    const dp = Math.hypot(P.x - x, P.y - y);
    SND.explosion(dp < 5);
    this.shakeT = 0.45;
    this.shakeAmp = clamp(1.6 - dp * 0.16, 0.25, 1.4);
    this.particles.push(new Particle('boom', x, y, 0.42, 0, 0, 0.15, 0.5, 1.15));
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * TAU, sp = rnd(1, 4.5);
      this.particles.push(new Particle('puff',
        x, y, rnd(0.2, 0.7),
        Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 1.8),
        rnd(0.3, 0.6), rnd(0.14, 0.26)));
    }
    const R = 2.4, base = 92;
    if (!P.dead && dp < R) P.damage(base * (1 - dp / R) + 12, this);
    for (const m of this.monsters) {
      if (m.state === 'dead' || m.state === 'dying') continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < R) m.damage(base * (1 - d / R) + 12, this, true);
    }
    for (const b of this.barrels) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d > 0.01 && d < R) b.damage(60, this);
    }
    this.noise(x, y, 10);
  }

  bloodBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rnd(0.5, 2.6);
      this.particles.push(new Particle('blood', x, y, rnd(0.3, 0.65),
        Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.6, 2.2),
        rnd(0.3, 0.6), rnd(0.06, 0.13)));
    }
  }
  burst(x, y, kind, n, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rnd(0.2, 1.2);
      this.particles.push(new Particle(kind, x, y, rnd(0.25, 0.6),
        Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.2, 0.9),
        rnd(0.22, 0.4), size * rnd(0.7, 1.3)));
    }
  }

  spawnPickup(kind, x, y) {
    this.pickups.push({ kind, x, y, taken: false, ph: 0, noCount: true });
  }

  checkPickups() {
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const rad = (pk.kind === 'shotgun' || pk.kind === 'chaingun') ? 0.62 : 0.52;
      if (dist2(pk.x, pk.y, P.x, P.y) > rad * rad) continue;
      if (P.take(pk.kind, this)) {
        pk.taken = true;
        if (!pk.noCount) this.stats.items++;
        if (pk.kind !== 'shotgun' && pk.kind !== 'chaingun' && pk.kind !== 'key_red')
          SND.pickup();
        HUD.msg(IDEF[pk.kind].msg);
        HUD.grin();
        P.pickFlash = 1;
      }
    }
  }

  // ---------- 업데이트 ----------
  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);

    if (this.exitT >= 0) {
      this.exitT -= dt;
      if (this.exitT <= 0) { this.completeLevel(); return; }
    }

    P.update(dt, this);
    if (P.dead && P.deadT > 1.3 && !this.deathShown) {
      this.deathShown = true;
      document.getElementById('dead-quote').textContent =
        DEATH_QUOTES[randi(0, DEATH_QUOTES.length - 1)];
      HUD.screen('dead');
      if (document.exitPointerLock) document.exitPointerLock();
    }

    for (const m of this.monsters) m.update(dt, this);
    // 몬스터 간 분리
    for (let i = 0; i < this.monsters.length; i++) {
      const a = this.monsters[i];
      if (a.state === 'dead' || a.state === 'dying') continue;
      for (let j = i + 1; j < this.monsters.length; j++) {
        const b = this.monsters[j];
        if (b.state === 'dead' || b.state === 'dying') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy), min = a.r + b.r;
        if (dd > 0.001 && dd < min) {
          const push = (min - dd) * 0.5;
          const ux = dx / dd, uy = dy / dd;
          if (!this.circleBlocked(a.x - ux * push, a.y - uy * push, a.r, a)) {
            a.x -= ux * push; a.y -= uy * push;
          }
          if (!this.circleBlocked(b.x + ux * push, b.y + uy * push, b.r, b)) {
            b.x += ux * push; b.y += uy * push;
          }
        }
      }
    }

    for (const b of this.barrels) b.update(dt, this);
    this.barrels = this.barrels.filter(b => !b.dead);

    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    for (const pa of this.particles) pa.update(dt);
    this.particles = this.particles.filter(p => !p.dead);

    this.updateDoors(dt);
    this.checkPickups();
    HUD.update(this);
  }

  completeLevel() {
    const st = this.stats, tot = this.levelTotals;
    TOTALS.kills += st.kills; TOTALS.kTot += tot.kills;
    TOTALS.items += st.items; TOTALS.iTot += tot.items;
    TOTALS.secrets += st.secrets; TOTALS.sTot += tot.secrets;
    TOTALS.time += this.time;
    SND.stopMusic();
    SND.levelDone();
    this.state = 'inter';
    HUD.setInter(st, tot, this.time, this.levelDef.par, this.lvIndex >= LEVELS.length - 1);
    HUD.showBar(false);
    HUD.screen('inter');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  onPlayerDeath() {
    SND.stopMusic();
  }

  // ---------- 렌더 리스트 ----------
  buildRenderList() {
    const L = this.renderList;
    L.length = 0;
    for (const m of this.monsters) {
      const fr = m.frame();
      L.push({ img: fr.img, x: m.x, y: m.y, scale: m.def.scale,
        hover: fr.hover, z: 0, tint: m.state === 'pain' ? 1 : 0 });
    }
    for (const b of this.barrels)
      L.push({ img: SPR.items.barrel, x: b.x, y: b.y, scale: 0.55, hover: 0, z: 0, tint: 0 });
    for (const d of this.decor)
      L.push({ img: d.img, x: d.x, y: d.y, scale: d.scale, hover: 0, z: 0, tint: 0 });
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const kind = pk.kind;
      const sprKey = IDEF[kind].spr;
      let sc = 0.3, hover = 0;
      if (kind === 'shotgun' || kind === 'chaingun') sc = 0.44;
      else if (kind === 'mega') { sc = 0.36; hover = 0.07 + Math.sin(GAME_TIME * 3 + pk.ph) * 0.045; }
      else if (kind === 'key_red') { sc = 0.3; hover = 0.09 + Math.sin(GAME_TIME * 3.4 + pk.ph) * 0.05; }
      else if (kind === 'armor') sc = 0.38;
      else if (kind === 'medkit') sc = 0.33;
      L.push({ img: SPR.items[sprKey], x: pk.x, y: pk.y, scale: sc, hover, z: 0, tint: 0 });
    }
    for (const pr of this.projectiles)
      L.push({ img: pr.frame(), x: pr.x, y: pr.y, scale: 0.24, hover: 0, z: 0.42, tint: 0 });
    for (const pa of this.particles) {
      const fr = pa.frame();
      L.push({ img: fr, x: pa.x, y: pa.y, scale: pa.size, hover: 0, z: pa.z, tint: 0 });
    }
    return L;
  }
}

// ============================================================
// 상태 전환 / 메뉴 / 입력
// ============================================================
let STATE = 'boot';
let GAME_TIME = 0;

function setState(s) { STATE = s; }

function startGame() {
  SND.init();
  TOTALS.kills = 0; TOTALS.kTot = 0; TOTALS.items = 0; TOTALS.iTot = 0;
  TOTALS.secrets = 0; TOTALS.sTot = 0; TOTALS.time = 0;
  GAME = new Game();
  GAME.loadLevel(0);
  GAME.beginPlay();
  setState('play');
  tryLock();
}
function pauseGame() {
  if (STATE !== 'play') return;
  setState('pause');
  HUD.screen('pause');
  HUD.sensLabel(SENS / 0.0023);
}
function resumeGame() {
  if (STATE !== 'pause') return;
  setState('play');
  HUD.noScreen();
  SND.startMusic('game');
  tryLock();
}
function retryLevel() {
  SND.init();
  GAME.loadLevel(GAME.lvIndex);
  GAME.beginPlay();
  setState('play');
  tryLock();
}
function quitToTitle() {
  SND.stopMusic();
  SND.startMusic('title');
  GAME.loadLevel(0);
  setState('title');
  HUD.screen('title');
  HUD.showBar(false);
  if (document.exitPointerLock) document.exitPointerLock();
}
function nextLevel() {
  if (GAME.lvIndex >= LEVELS.length - 1) {
    setState('victory');
    HUD.setVictory(TOTALS);
    HUD.showBar(false);
    HUD.screen('victory');
    SND.stopMusic();
    return;
  }
  GAME.loadLevel(GAME.lvIndex + 1);
  GAME.beginPlay();
  setState('play');
  tryLock();
}

function tryLock() {
  const c = document.getElementById('view');
  if (c.requestPointerLock) { try { c.requestPointerLock(); } catch (e) {} }
}

// ---------- 메뉴 바인더 ----------
function makeMenu(containerId, onPick) {
  const el = document.getElementById(containerId);
  const items = [...el.querySelectorAll('.mi')];
  let idx = 0;
  const refresh = () => items.forEach((n, i) => n.classList.toggle('sel', i === idx));
  refresh();
  el.addEventListener('mousemove', e => {
    const t = e.target.closest('.mi');
    if (t && items.indexOf(t) !== idx) { idx = items.indexOf(t); refresh(); }
  });
  el.addEventListener('click', e => {
    const t = e.target.closest('.mi');
    if (t) { SND.init(); SND.menuSel(); onPick(items.indexOf(t)); }
  });
  return {
    nav(d) { idx = (idx + d + items.length) % items.length; SND.menuMove(); refresh(); },
    sel() { SND.menuSel(); onPick(idx); },
    reset() { idx = 0; refresh(); }
  };
}

// ---------- 입력 ----------
function bindInput() {
  const titleMenu = makeMenu('title-menu', i => {
    if (i === 0) startGame();
    else if (i === 1) {
      DIFF = DIFFS[(DIFFS.indexOf(DIFF) + 1) % DIFFS.length];
      document.getElementById('diff-name').textContent = DIFF.name;
    } else { setState('help'); HUD.screen('help'); }
  });
  const pauseMenu = makeMenu('pause-menu', i => {
    if (i === 0) resumeGame();
    else if (i === 1) retryLevel();
    else quitToTitle();
  });

  window.addEventListener('keydown', e => {
    if (!SND.ctx) { SND.init(); if (STATE === 'title' || STATE === 'help') SND.startMusic('title'); }
    SND.resume();
    KEY[e.code] = true;

    switch (STATE) {
      case 'title':
        if (e.code === 'ArrowUp') titleMenu.nav(-1);
        else if (e.code === 'ArrowDown') titleMenu.nav(1);
        else if (e.code === 'Enter' || e.code === 'Space') titleMenu.sel();
        break;
      case 'help':
        setState('title'); HUD.screen('title');
        break;
      case 'play':
        if (e.code === 'Tab') { e.preventDefault(); GAME.mapOn = !GAME.mapOn; }
        else if (e.code === 'KeyE' || e.code === 'Space') {
          if (!e.repeat && P && !P.dead) GAME.useAction();
        }
        else if (e.code === 'KeyM') {
          SND.muted = !SND.muted;
          HUD.msg(SND.muted ? '음악/효과음 off' : '음악/효과음 on');
        }
        else if (e.code === 'Escape') pauseGame();
        break;
      case 'pause':
        if (e.code === 'ArrowUp') pauseMenu.nav(-1);
        else if (e.code === 'ArrowDown') pauseMenu.nav(1);
        else if (e.code === 'Enter') pauseMenu.sel();
        else if (e.code === 'Escape') resumeGame();
        break;
      case 'inter':
        if (e.code === 'Enter' || e.code === 'Space') nextLevel();
        break;
      case 'dead':
        if (e.code === 'Space') retryLevel();
        else if (e.code === 'Escape') quitToTitle();
        break;
      case 'victory':
        if (e.code === 'Enter' || e.code === 'Space') quitToTitle();
        break;
    }

    if (e.code === 'Minus' || e.code === 'Equal') {
      SENS = clamp(SENS * (e.code === 'Equal' ? 1.13 : 1 / 1.13), 0.0008, 0.006);
      HUD.sensLabel(SENS / 0.0023);
    }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
  });

  window.addEventListener('keyup', e => { KEY[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in KEY) KEY[k] = false; MOUSE.down = false; });

  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.getElementById('view')) {
      MOUSE.dx += e.movementX; MOUSE.dy += e.movementY;
    }
  });
  document.addEventListener('mousedown', e => {
    if (!SND.ctx) { SND.init(); if (STATE === 'title' || STATE === 'help') SND.startMusic('title'); }
    SND.resume();
    if (e.button === 0) {
      MOUSE.down = true;
      if (STATE === 'play' && document.pointerLockElement !== document.getElementById('view'))
        tryLock();
    }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) MOUSE.down = false; });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === document.getElementById('view');
    if (!locked && STATE === 'play' && P && !P.dead) pauseGame();
  });
}

// ============================================================
// 루프 / 부트
// ============================================================
let lastT = 0;

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  GAME_TIME = t / 1000;

  if (STATE === 'play') GAME.update(dt);

  if (STATE === 'title' || STATE === 'help' || STATE === 'victory') {
    GAME.renderList = GAME.buildRenderList();
    REN.frame(GAME, 26.5, 27.5, t / 1000 * 0.14,
      Math.sin(t / 2900) * 7, 0, 0, 0, 0);
  } else if (GAME && P) {
    GAME.renderList = GAME.buildRenderList();
    const shX = (Math.random() * 2 - 1) * GAME.shakeAmp * GAME.shakeT * 4;
    const shY = (Math.random() * 2 - 1) * GAME.shakeAmp * GAME.shakeT * 5;
    const deathPitch = P.dead ? Math.max(-85, -P.deadT * 75) : 0;
    REN.frame(GAME, P.x, P.y, P.a,
      P.pitch * REN.H * 1.05 + deathPitch + P.kick * 9,
      0, shX, shY, P.flash > 0 ? 3 : 0);

    if (P.dmgFlash > 0) REN.overlay(`rgba(255,18,5,${(P.dmgFlash * 0.55).toFixed(3)})`);
    if (P.pickFlash > 0) REN.overlay(`rgba(255,208,64,${(P.pickFlash * 0.2).toFixed(3)})`);
    if (STATE === 'play' && !P.dead) {
      if (GAME.mapOn) HUD.drawAutomap(REN.dctx, GAME, REN.dW, REN.dH);
      else {
        REN.crosshair();
        const hit = GAME.findNearestInteractable();
        if (hit && hit.d2 < 2.6) {
          const txt = hit.code === 24 ? '[E] 탈출' : hit.code === 23 ? '[E] 비밀벽' : '[E] 문 열기';
          const dctx = REN.dctx;
          dctx.fillStyle = 'rgba(255,230,160,.92)';
          dctx.font = 'bold 13px Malgun Gothic, system-ui';
          dctx.textAlign = 'center';
          dctx.fillText(txt, REN.dW / 2, REN.dH / 2 + 24);
          dctx.textAlign = 'start';
        }
      }
    }
  }
  MOUSE.dx = 0; MOUSE.dy = 0;
}

function fitFrame() {
  const size = REN.resizeTo(window.innerWidth, window.innerHeight);
  const f = document.getElementById('frame');
  f.style.width = size.w + 'px';
  f.style.height = size.h + 'px';
}

window.addEventListener('load', () => {
  try {
    TEXTURES_init();
    ART_init();
    HUD.init();
    REN.init(document.getElementById('view'));
    fitFrame();
    window.addEventListener('resize', fitFrame);
    bindInput();

    GAME = new Game();
    GAME.loadLevel(0);          // 타이틀 배경용 월드

    setState('title');
    HUD.screen('title');
    HUD.showBar(false);

    requestAnimationFrame(ts => { lastT = ts; requestAnimationFrame(frame); });
  } catch (err) {
    document.body.innerHTML = '<pre style="color:#f66;padding:24px">초기화 실패:\n' +
      (err && err.stack || err) + '</pre>';
  }
});
