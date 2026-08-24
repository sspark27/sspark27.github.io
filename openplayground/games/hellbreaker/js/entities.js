'use strict';
// ============================================================
// 엔티티: 플레이어 / 몬스터 AI / 드럼통 / 투사체 / 파티클 / 픽업 규칙
// ============================================================

// ---------- 몬스터 정의 ----------
const MDEF = {
  grunt: {
    label: '병사', hp: 24, speed: 1.75, radius: 0.28, scale: 0.62, sight: 14,
    atk: 'hitscan', dmgLo: 3, dmgHi: 9, windup: 0.35, cdLo: 0.9, cdHi: 1.7,
    painCh: 0.55, drop: 'clip', keepMin: 2, keepMax: 9
  },
  fiend: {
    label: '마수', hp: 58, speed: 3.15, radius: 0.33, scale: 0.70, sight: 13,
    atk: 'melee', dmgLo: 8, dmgHi: 17, windup: 0.26, cdLo: 0.55, cdHi: 1.0,
    painCh: 0.42, drop: null
  },
  warlock: {
    label: '흑술사', hp: 42, speed: 1.35, radius: 0.30, scale: 0.74, hover: 0.12,
    sight: 16, atk: 'fireball', dmgLo: 12, dmgHi: 18, windup: 0.5, cdLo: 1.4,
    cdHi: 2.3, painCh: 0.5, drop: null, keepMin: 3, keepMax: 8
  },
  brute: {
    label: '거수', hp: 200, speed: 2.05, radius: 0.40, scale: 0.98, sight: 18,
    atk: 'shotgun', pellets: 3, spread: 0.17, dmgLo: 3, dmgHi: 9,
    windup: 0.46, cdLo: 1.2, cdHi: 2.0, painCh: 0.28, drop: 'shells',
    keepMin: 2, keepMax: 7
  }
};

// ---------- 픽업 정의 ----------
const IDEF = {
  medkit:  { spr: 'medkit', msg: '구급함 (+25)' },
  stim:    { spr: 'stim',   msg: '각성제 (+10)' },
  shard:   { spr: 'shard',  msg: '방어 파편 (+10)' },
  armor:   { spr: 'armor',  msg: '방어복 (+50)' },
  mega:    { spr: 'mega',   msg: '영혼의 구슬 (+100!)' },
  clip:    { spr: 'clip',   msg: '탄약 권총탄 (+12)' },
  shells:  { spr: 'shells', msg: '산탄총 탄약 (+8)' },
  shotgun: { spr: 'shotgun', msg: '산탄총 획득!' },
  chaingun:{ spr: 'chaingun', msg: '연발포 획득!' },
  key_red: { spr: 'key_red', msg: '붉은 열쇠카드 획득!' }
};

function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

// ============================================================
// 플레이어
// ============================================================
class Player {
  constructor(x, y, a) {
    this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0;
    this.pitch = 0;
    this.hp = 100; this.armor = 0;
    this.weapons = [true, false, false];
    this.cur = 0; this.nextW = -1;
    this.ammo = { bullets: 50, shells: 0 };
    this.keys = { red: false };
    this.cool = 0; this.switchT = 0;
    this.kick = 0; this.flash = 0; this.pumpDone = true;
    this.bob = 0; this.moveAmt = 0;
    this.dmgFlash = 0; this.pickFlash = 0;
    this.dead = false; this.deadT = 0;
    this.r = 0.26;
    this.spinFrame = 0;
  }

  update(dt, game) {
    if (this.dead) { this.deadT += dt; return; }

    // ---- 회전(키보드 보조) ----
    const rotSpd = 2.7;
    if (KEY['ArrowLeft']) this.a -= rotSpd * dt;
    if (KEY['ArrowRight']) this.a += rotSpd * dt;
    if (KEY['ArrowUp']) this.pitch = clamp(this.pitch + 1.4 * dt, -0.32, 0.32);
    if (KEY['ArrowDown']) this.pitch = clamp(this.pitch - 1.4 * dt, -0.32, 0.32);
    this.a = angNorm(this.a + MOUSE.dx * SENS);
    this.pitch = clamp(this.pitch - MOUSE.dy * SENS * 0.65, -0.32, 0.32);

    // ---- 이동 ----
    const run = KEY['ShiftLeft'] || KEY['ShiftRight'];
    const spd = run ? 5.7 : 3.5;
    let mf = (KEY['KeyW'] ? 1 : 0) - (KEY['KeyS'] ? 1 : 0);
    let ms = (KEY['KeyD'] ? 1 : 0) - (KEY['KeyA'] ? 1 : 0);
    if (mf || ms) {
      const inv = 1 / Math.hypot(mf, ms); mf *= inv; ms *= inv;
    }
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const tx = (ca * mf - sa * ms) * spd;
    const ty = (sa * mf + ca * ms) * spd;
    const k = 1 - Math.exp(-13 * dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;

    const ox = this.x, oy = this.y;
    if (!game.circleBlocked(this.x + this.vx * dt, this.y, this.r, this))
      this.x += this.vx * dt;
    if (!game.circleBlocked(this.x, this.y + this.vy * dt, this.r, this))
      this.y += this.vy * dt;

    const moved = Math.hypot(this.x - ox, this.y - oy);
    this.moveAmt = lerp(this.moveAmt, clamp(moved / dt / 3.5, 0, 1.4), 0.2);
    this.bob += moved * 5.4;

    // ---- 무기 전환 ----
    if (this.switchT > 0) {
      this.switchT -= dt;
      if (this.nextW >= 0 && this.switchT <= 0.18) { // 절반 지점에서 교체
        this.cur = this.nextW; this.nextW = -1; this.pumpDone = true;
      }
      if (this.switchT < 0) this.switchT = 0;
    }
    for (let i = 0; i < 3; i++) {
      const want = KEY['Digit' + (i + 1)];
      if (want && this.weapons[i] && i !== this.cur && this.switchT <= 0) {
        this.nextW = i; this.switchT = 0.36; SND.menuSel();
      }
    }

    // ---- 발사 ----
    this.cool -= dt;
    const w = WEAPONS[this.cur];
    const trig = MOUSE.down || KEY['ControlLeft'] || KEY['ControlRight'];
    const wantFire = w.auto ? trig : trig && !this._trigHeld;
    this._trigHeld = trig;
    if (this.switchT <= 0 && wantFire && this.cool <= 0) {
      if (this.ammo[w.ammo] > 0) this.fire(game, w);
      else {
        SND.dryfire(); this.cool = 0.3;
        // 탄약 없으면 다른 무기로 자동 전환
        for (let i = 2; i >= 0; i--)
          if (this.weapons[i] && this.ammo[WEAPONS[i].ammo] > 0) { this.nextW = i; this.switchT = 0.3; break; }
      }
    }
    // 산탄총 펌프 사운드
    if (w.pumpAt && !this.pumpDone && this.cool < w.rate - w.pumpAt) {
      this.pumpDone = true; SND.pump();
    }

    // ---- 타이머 감쇠 ----
    this.kick = Math.max(0, this.kick - dt * 6);
    this.flash = Math.max(0, this.flash - dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.6);
    this.pickFlash = Math.max(0, this.pickFlash - dt * 2.5);
  }

  fire(game, w) {
    this.ammo[w.ammo]--;
    this.cool = w.rate;
    this.flash = 0.07; this.kick = 1;
    if (w.key === 'shotgun') this.pumpDone = false;
    if (w.key === 'chain') this.spinFrame ^= 1;
    SND[w.snd]();
    for (let p = 0; p < w.pellets; p++) {
      const jitter = w.pellets > 1 ? w.spread : w.spread * 0.55;
      const ang = this.a + (Math.random() * 2 - 1) * jitter;
      game.playerShot(ang, randi(w.dmgLo, w.dmgHi));
    }
    game.noise(this.x, this.y, 13);
  }

  giveHealth(n, cap) {
    cap = cap || 100;
    if (this.hp >= cap) return false;
    this.hp = Math.min(cap, this.hp + n);
    return true;
  }
  giveArmor(n) {
    if (this.armor >= 100) return false;
    this.armor = Math.min(100, this.armor + n);
    return true;
  }

  damage(n, game) {
    if (this.dead) return;
    n *= DIFF.dmgTaken;
    if (this.armor > 0) {
      const abs = Math.min(this.armor, Math.ceil(n / 3));
      this.armor -= abs; n -= abs;
    }
    this.hp -= n;
    this.dmgFlash = Math.min(0.75, this.dmgFlash + 0.25 + n * 0.012);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deadT = 0;
      SND.playerDie(); game.onPlayerDeath();
    } else SND.playerPain();
  }

  // 픽업 처리 — 소비되면 true
  take(kind, game) {
    switch (kind) {
      case 'stim': if (!this.giveHealth(10)) return false; break;
      case 'medkit': if (!this.giveHealth(25)) return false; break;
      case 'mega': this.giveHealth(100, 200); break;
      case 'shard': if (!this.giveArmor(10)) return false; break;
      case 'armor': if (!this.giveArmor(50)) return false; break;
      case 'clip':
        if (this.ammo.bullets >= AMMO_MAX.bullets) return false;
        this.ammo.bullets = Math.min(AMMO_MAX.bullets, this.ammo.bullets + AMMO_GIVE.clip);
        break;
      case 'shells':
        if (this.ammo.shells >= AMMO_MAX.shells) return false;
        this.ammo.shells = Math.min(AMMO_MAX.shells, this.ammo.shells + AMMO_GIVE.shells);
        break;
      case 'shotgun':
        this.weapons[1] = true;
        this.ammo.shells = Math.min(AMMO_MAX.shells, this.ammo.shells + 8);
        if (this.cur === 0 && this.nextW < 0) { this.nextW = 1; this.switchT = 0.36; }
        SND.weaponUp(); break;
      case 'chaingun':
        this.weapons[2] = true;
        this.ammo.bullets = Math.min(AMMO_MAX.bullets, this.ammo.bullets + 20);
        if (this.cur < 2 && this.nextW < 0) { this.nextW = 2; this.switchT = 0.36; }
        SND.weaponUp(); break;
      case 'key_red':
        this.keys.red = true; SND.keyGet(); break;
    }
    return true;
  }
}

// ============================================================
// 몬스터
// ============================================================
class Monster {
  constructor(type, x, y) {
    const d = MDEF[type];
    this.type = type; this.def = d;
    this.x = x; this.y = y;
    this.hp = d.hp; this.r = d.radius;
    this.state = 'idle';
    this.animT = Math.random() * 10;
    this.cdT = rnd(0.3, 0.9);
    this.windT = 0; this.recoverT = 0; this.fired = false;
    this.painT = 0; this.dieT = 0;
    this.senseT = Math.random() * 0.2;
    this.los = false;
    this.strafePh = Math.random() * TAU;
    this.dodgeT = 0; this.dodgeDir = 1;
    this.blockedT = 0;
    this.a0 = 0;
    this.alerted = false;
    this.hover = 0;
  }

  alert(game) {
    if (this.alerted || this.state === 'dying' || this.state === 'dead') return;
    this.alerted = true;
    if (this.state === 'idle') { this.state = 'chase'; SND.alert(this.type); }
  }

  damage(n, game, silentDie) {
    if (this.state === 'dying' || this.state === 'dead') return;
    this.hp -= n;
    this.alert(game);
    if (this.hp <= 0) {
      this.state = 'dying'; this.dieT = 0;
      game.stats.kills++;
      SND.mdie(this.type);
      if (this.def.drop && Math.random() < 0.62)
        game.spawnPickup(this.def.drop, this.x, this.y);
      game.bloodBurst(this.x, this.y, 10);
    } else {
      game.bloodBurst(this.x, this.y, 4);
      if (Math.random() < this.def.painCh) {
        this.state = 'pain'; this.painT = 0.22;
        if (!silentDie) SND.mpain(this.type);
      }
    }
  }

  update(dt, game) {
    this.animT += dt;
    const d = this.def;
    const pd = Math.hypot(P.x - this.x, P.y - this.y);

    if (this.state === 'dead') return;
    if (this.state === 'dying') {
      this.dieT += dt;
      if (this.dieT > 0.55) this.state = 'dead';
      return;
    }
    if (P.dead) { // 플레이어 사망시 배회 중지
      return;
    }

    // 시야 검사(스로틀)
    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.12 + Math.random() * 0.1;
      this.los = game.los(this.x, this.y, P.x, P.y);
      if (this.state === 'idle' && this.los && pd < d.sight) this.alert(game);
    }

    if (this.state === 'pain') {
      this.painT -= dt;
      if (this.painT <= 0) this.state = 'chase';
      return;
    }

    if (this.state === 'attack') {
      this.windT -= dt;
      if (!this.fired && this.windT <= 0) {
        this.fired = true;
        this.executeAttack(game, pd);
      }
      if (this.fired) {
        this.recoverT -= dt;
        if (this.recoverT <= 0) {
          this.state = 'chase';
          this.cdT = rnd(d.cdLo, d.cdHi) * DIFF.atkRate;
        }
      }
      return;
    }

    // ---- chase ----
    if (this.state !== 'chase') return;
    this.cdT -= dt;

    // 공격 판단
    if (this.cdT <= 0 && this.los) {
      let wantAtk = false;
      if (d.atk === 'melee') wantAtk = pd < 1.25;
      else if (d.atk === 'fireball') wantAtk = pd < 11;
      else wantAtk = pd < 10;
      if (wantAtk) {
        this.state = 'attack';
        this.windT = d.windup; this.fired = false;
        this.recoverT = 0.28;
        return;
      }
    }

    // 이동 목표 결정
    let mx, my;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      mx = Math.cos(this.a0 + Math.PI / 2 * this.dodgeDir) * d.speed;
      my = Math.sin(this.a0 + Math.PI / 2 * this.dodgeDir) * d.speed;
    } else {
      const ang = Math.atan2(P.y - this.y, P.x - this.x);
      this.a0 = ang;
      let fwd = 1;
      if (d.keepMin !== undefined) {
        if (pd < d.keepMin) fwd = -0.7;
        else if (pd < d.keepMax) fwd = 0.15;
      }
      const sway = Math.sin(this.animT * 1.7 + this.strafePh) * (d.atk === 'melee' ? 0.25 : 0.85);
      const ma = ang + sway * 0.6;
      mx = Math.cos(ma) * d.speed * Math.abs(fwd) * Math.sign(fwd || 1);
      my = Math.sin(ma) * d.speed * Math.abs(fwd) * Math.sign(fwd || 1);
    }

    const ox = this.x, oy = this.y;
    const nx = this.x + mx * dt, ny = this.y + my * dt;
    if (!game.circleBlocked(nx, this.y, this.r, this)) this.x = nx;
    if (!game.circleBlocked(this.x, ny, this.r, this)) this.y = ny;
    if (Math.abs(this.x - ox) < 1e-9 && Math.abs(this.y - oy) < 1e-9) {
      this.blockedT += dt;
      if (this.blockedT > 0.35) {
        this.blockedT = 0;
        this.dodgeT = 0.5 + Math.random() * 0.4;
        this.dodgeDir = Math.random() < 0.5 ? 1 : -1;
      }
    } else this.blockedT = 0;

    // 문 자동 개방(일반문만, 가까이서)
    game.monsterTryDoor(this);
  }

  executeAttack(game, pd) {
    const d = this.def;
    if (d.atk === 'melee') {
      if (Math.hypot(P.x - this.x, P.y - this.y) < 1.35)
        P.damage(randi(d.dmgLo, d.dmgHi), game);
      return;
    }
    if (d.atk === 'fireball') {
      SND.fireball();
      const ang = Math.atan2(P.y - this.y, P.x - this.x);
      game.projectiles.push(new Fireball(
        this.x + Math.cos(ang) * 0.4, this.y + Math.sin(ang) * 0.4,
        Math.cos(ang) * 7.2, Math.sin(ang) * 7.2, randi(d.dmgLo, d.dmgHi), this));
      return;
    }
    // hitscan (병사 라이플 / 거수 산탄)
    const pellets = d.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const acc = clamp(1.05 - pd * 0.062, 0.18, 0.85);
      if (Math.random() < acc * DIFF.enemyAcc) {
        P.damage(randi(d.dmgLo, d.dmgHi), game);
      } else {
        // 빗나간 총알 흔적
        const ang = Math.atan2(P.y - this.y, P.x - this.x) + rnd(-0.12, 0.12);
        game.nearMiss(this.x, this.y, ang, 2 + Math.random() * 2);
      }
    }
    game.noise(this.x, this.y, 11);
  }

  // 렌더용 스프라이트 선택
  frame() {
    const s = SPR.mon[this.type];
    switch (this.state) {
      case 'dead': case 'dying': {
        const k = this.state === 'dead' ? 3 : clamp((this.dieT / 0.55 * 4) | 0, 0, 3);
        return { img: s.die[k], hover: 0 };
      }
      case 'pain': return { img: s.pain, hover: 0 };
      case 'attack':
        return this.fired
          ? { img: s.fire, hover: this.def.hover || 0 }
          : { img: s.aim, hover: this.def.hover || 0 };
      default: {
        const f = ((this.animT / 0.24) | 0) % 2;
        return { img: s.walk[f], hover: this.def.hover ? this.def.hover + Math.sin(this.animT * 2.6) * 0.04 : 0 };
      }
    }
  }
}

// ============================================================
// 화염구 투사체
// ============================================================
class Fireball {
  constructor(x, y, vx, vy, dmg, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dmg = dmg; this.owner = owner; this.t = 0; this.dead = false;
    this.r = 0.18;
  }
  update(dt, game) {
    this.t += dt;
    const steps = Math.ceil(Math.hypot(this.vx, this.vy) * dt / 0.25);
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.x += this.vx * sdt; this.y += this.vy * sdt;
      if (game.pointSolid(this.x, this.y)) {
        this.boom(game); return;
      }
      if (!P.dead && dist2(this.x, this.y, P.x, P.y) < 0.42 * 0.42) {
        P.damage(this.dmg, game); this.boom(game); return;
      }
      for (const m of game.monsters) {
        if (m === this.owner || m.state === 'dead' || m.state === 'dying') continue;
        if (dist2(this.x, this.y, m.x, m.y) < (m.r + 0.15) ** 2) {
          m.damage(this.dmg >> 1, game, true); this.boom(game); return;
        }
      }
    }
  }
  boom(game) {
    this.dead = true;
    game.burst(this.x, this.y, 'puff', 3, 0.5);
    SND.noise({ d: 0.12, v: 0.2, f0: 1800, f1: 300 });
  }
  frame() {
    return SPR.fx.fireball[((this.t / 0.09) | 0) % 3];
  }
}

// ============================================================
// 폭발 드럼통
// ============================================================
class Barrel {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 0.33;
    this.hp = 12; this.fuse = -1; this.dead = false;
  }
  damage(n, game) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0 && this.fuse < 0) this.fuse = 0.06 + Math.random() * 0.06;
  }
  update(dt, game) {
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.dead = true; game.explode(this.x, this.y); }
    }
  }
}

// ============================================================
// 파티클
// ============================================================
class Particle {
  constructor(kind, x, y, z, vx, vy, vz, life, size) {
    this.kind = kind; this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.t = 0; this.life = life; this.size = size;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.life) { this.dead = true; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.kind === 'blood') this.vz -= 3.2 * dt;
    else this.vz += 0.4 * dt;
    this.z += this.vz * dt;
    if (this.kind === 'blood' && this.z < 0.02) { this.z = 0.02; this.vx = this.vy = this.vz = 0; }
  }
  frame() {
    if (this.kind === 'blood') return SPR.fx.blood[(this.t / 0.12 | 0) % 2];
    if (this.kind === 'boom') return SPR.fx.boom[clamp((this.t / this.life * 4) | 0, 0, 3)];
    return SPR.fx.puff[clamp((this.t / this.life * 3) | 0, 0, 2)];
  }
}
