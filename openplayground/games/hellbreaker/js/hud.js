'use strict';
// ============================================================
// HUD — 상태 바 / 표정 / 메시지 / 배너 / 화면 전환 / 오토맵
// ============================================================
const HUD = {
  el: {}, faceG: null, faceState: '', msgs: [], grinT: 0,

  init() {
    const q = id => document.getElementById(id);
    this.el = {
      bar: q('hud'), ammo: q('hud-ammo'), health: q('hud-health'),
      armor: q('hud-armor'), weapon: q('hud-weapon'), keys: q('hud-keys'),
      msgs: q('msgs'), banner: q('lvlbanner'), face: q('face'),
      title: q('scr-title'), help: q('scr-help'), pause: q('scr-pause'),
      dead: q('scr-dead'), inter: q('scr-inter'), victory: q('scr-victory')
    };
    this.faceG = this.el.face.getContext('2d');
  },

  showBar(v) { this.el.bar.classList.toggle('hidden', !v); },

  screen(name) {
    for (const k of ['title', 'help', 'pause', 'dead', 'inter', 'victory'])
      this.el[k].classList.toggle('hidden', k !== name);
  },
  noScreen() { this.screen('__none__'); },

  msg(text) {
    this.msgs.push({ t: performance.now(), text });
    if (this.msgs.length > 4) this.msgs.shift();
  },
  updateMsgs() {
    const now = performance.now();
    while (this.msgs.length && now - this.msgs[0].t > 3200) this.msgs.shift();
    this.el.msgs.innerHTML = this.msgs
      .map(m => `<div style="opacity:${clamp(1 - (now - m.t - 2400) / 800, 0, 1)}">${m.text}</div>`)
      .join('');
  },

  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.style.opacity = '1';
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.style.opacity = '0'; }, 2400);
  },

  grin() { this.grinT = 0.9; },

  update(game) {
    const p = game.player;
    this.el.ammo.textContent = p.ammo[WEAPONS[p.cur].ammo];
    this.el.health.textContent = Math.ceil(p.hp) + '%';
    this.el.armor.textContent = Math.ceil(p.armor) + '%';
    this.el.weapon.textContent = WEAPONS[p.cur].name +
      (p.weapons[1] ? '' : '');
    this.el.keys.innerHTML = p.keys.red ? '<span class="keycard red"></span>' : '';
    this.updateMsgs();
    this.drawFace(game);
  },

  // 절차적 표정 — 상태에 따라 변한다
  drawFace(game) {
    const p = game.player;
    let st;
    if (p.dead) st = 'dead';
    else if (p.pickFlash > 0.4) st = 'grin';
    else if (p.hp > 70) st = 'ok';
    else if (p.hp > 40) st = 'hurt';
    else st = 'bad';
    const key = p.dead ? 'dead'
      : st.slice(0, 4) + (st === 'grin' ? '_g' : '');
    if (key === this.faceState) return;
    this.faceState = key;

    const g = this.faceG, S = 30;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#181410'; g.fillRect(0, 0, S, S);
    // 헬멧
    g.fillStyle = '#3d4436'; g.fillRect(5, 3, 20, 10);
    g.fillRect(3, 8, 24, 6);
    g.fillStyle = '#2a3026'; g.fillRect(5, 11, 20, 2);
    // 얼굴
    g.fillStyle = p.dead ? '#8a7a68' : '#c8927a'; g.fillRect(7, 13, 16, 12);
    // 바이저/눈
    g.fillStyle = '#10141a'; g.fillRect(9, 15, 12, 4);
    if (!p.dead) {
      g.fillStyle = '#57d8ff';
      const look = ((performance.now() / 900 | 0) % 2) ? 2 : 0;
      g.fillRect(11 + look, 16, 2, 2); g.fillRect(17 + look, 16, 2, 2);
    } else {
      g.strokeStyle = '#ff2a1a'; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(10, 15); g.lineTo(14, 19); g.moveTo(14, 15); g.lineTo(10, 19);
      g.moveTo(16, 15); g.lineTo(20, 19); g.moveTo(20, 15); g.lineTo(16, 19);
      g.stroke();
    }
    // 입
    g.fillStyle = '#5e3428';
    if (key.includes('_g')) { g.fillRect(11, 22, 8, 3); g.fillStyle = '#fff'; g.fillRect(12, 22, 6, 1); }
    else if (p.dead) g.fillRect(11, 23, 8, 2);
    else if (st.startsWith('bad')) g.fillRect(12, 23, 6, 2);
    else g.fillRect(11, 22, 8, 1);
    // 피 얼룩
    if (!p.dead && st.startsWith('hurt')) {
      g.fillStyle = '#a01008'; g.fillRect(8, 13, 3, 5); g.fillRect(21, 18, 2, 4);
    }
    if (!p.dead && st.startsWith('bad')) {
      g.fillStyle = '#c01808'; g.fillRect(7, 13, 4, 8); g.fillRect(19, 13, 4, 7); g.fillRect(13, 24, 5, 2);
    }
  },

  setInter(st, tot, timeS, par, isLast) {
    document.getElementById('inter-title').textContent =
      isLast ? '최종 미션 완료' : '미션 완료';
    document.getElementById('st-kills').textContent = pct(st.kills, tot.kills);
    document.getElementById('st-items').textContent = pct(st.items, tot.items);
    document.getElementById('st-secrets').textContent = pct(st.secrets, tot.secrets);
    document.getElementById('st-time').textContent = fmtTime(timeS);
    document.getElementById('st-par').textContent = fmtTime(par) +
      (timeS <= par ? '  (달성!)' : '');
    document.getElementById('inter-next').textContent =
      isLast ? 'Enter → 엔딩' : 'Enter → 다음 미션';
  },

  setVictory(t) {
    document.getElementById('vt-kills').textContent = pct(t.kills, t.kTot);
    document.getElementById('vt-items').textContent = pct(t.items, t.iTot);
    document.getElementById('vt-secrets').textContent = pct(t.secrets, t.sTot);
    document.getElementById('vt-time').textContent = fmtTime(t.time);
  },

  sensLabel(v) {
    document.getElementById('sens-val').textContent = v.toFixed(2);
  },

  drawAutomap(ctx, game, w, h) {
    const p = game.player;
    const sc = 11;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(6,8,6,.82)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2 - p.x * sc + shakeless(), cy = h / 2 - p.y * sc;
    function shakeless() { return 0; }

    for (let y = 0; y < game.mh; y++) {
      for (let x = 0; x < game.mw; x++) {
        if (!game.seen[y * game.mw + x]) continue;
        const c = game.grid[y * game.mw + x];
        let col = null;
        if (c === 20) col = '#c89a2a';
        else if (c === 21) col = '#d02818';
        else if (c === 24) col = '#38d048';
        else if (c === 23) col = game.animMap[x + ',' + y] && game.animMap[x + ',' + y].found ? '#c83cd8' : null;
        else if (c > 0) col = '#8f9098';
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(cx + x * sc, cy + y * sc, sc - 0.6, sc - 0.6);
      }
    }
    // 플레이어 화살표
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(p.a);
    ctx.fillStyle = '#48ff58';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#7a8a70';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillText('[Tab] 지도 닫기', 10, h - 10);
  }
};

function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '100%'; }
function fmtTime(s) {
  s |= 0;
  return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0');
}
