'use strict';
// ============================================================
// 레벨 빌더 + 미션 3개 디자인 (모든 맵은 오리지널)
// 격자 코드: 0 바닥 | 1~10 벽 텍스처 | 20 문 | 21 붉은 열쇠 문
//            23 시크릿 벽 | 24 출구 스위치
// ============================================================
function LB(w, h, baseWall) {
  this.w = w; this.h = h;
  this.grid = new Uint8Array(w * h).fill(baseWall);
  this.doors = {};        // "x,y" -> {x,y,type}
  this.secretCells = [];  // {x,y,mimic}
  this.monsters = [];     // {type,x,y}
  this.items = [];        // {kind,x,y}
  this.start = { x: 2.5, y: 2.5, a: 0 };
}
LB.prototype.set = function (x, y, v) {
  if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.grid[y * this.w + x] = v;
  return this;
};
LB.prototype.room = function (x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, 0);
  return this;
};
LB.prototype.wallRect = function (x, y, w, h, tex) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, tex);
  return this;
};
LB.prototype.door = function (x, y, red) {
  const t = red ? 21 : 20;
  this.set(x, y, t);
  this.doors[x + ',' + y] = { x, y, type: t };
  return this;
};
LB.prototype.secret = function (x, y, mimic) {
  this.set(x, y, 23);
  this.secretCells.push({ x, y, mimic });
  return this;
};
LB.prototype.mon = function (type, x, y) { this.monsters.push({ type, x: x + 0.5, y: y + 0.5 }); return this; };
LB.prototype.item = function (kind, x, y) { this.items.push({ kind, x: x + 0.5, y: y + 0.5 }); return this; };
LB.prototype.player = function (x, y, deg) { this.start = { x: x + 0.5, y: y + 0.5, a: (deg || 0) * Math.PI / 180 }; return this; };

LB.prototype.finalize = function () {
  // 인접한 시크릿 셀들을 하나의 그룹으로 묶는다(발견 1회 카운트)
  const seen = new Set(), groups = [];
  for (const c of this.secretCells) {
    const k0 = c.x + ',' + c.y;
    if (seen.has(k0)) continue;
    const q = [c], g = [];
    seen.add(k0);
    while (q.length) {
      const cur = q.pop(); g.push(cur);
      for (const dxy of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur.x + dxy[0], ny = cur.y + dxy[1];
        const k = nx + ',' + ny;
        if (!seen.has(k)) {
          for (const o of this.secretCells)
            if (o.x === nx && o.y === ny) { seen.add(k); q.push(o); }
        }
      }
    }
    groups.push(g);
  }
  return {
    w: this.w, h: this.h, grid: this.grid, doors: this.doors,
    secretGroups: groups.map(g => ({ cells: g, found: false })),
    monsters: this.monsters, items: this.items, start: this.start,
    totals: { kills: this.monsters.length, items: this.items.length, secrets: groups.length }
  };
};

// ============================================================
// 미션 1 — 착륙장
// ============================================================
function buildLevel1() {
  const b = new LB(46, 38, 2);
  b.player(6, 30, 0);
  b.room(3, 27, 8, 7);                    // 시작 방
  b.room(11, 29, 9, 2);                   // 동복도
  b.room(20, 22, 14, 12);                 // 중앙 홀
  b.set(24, 26, 2); b.set(29, 26, 2); b.set(24, 30, 2); b.set(29, 30, 2);
  b.room(25, 13, 2, 9);                   // 북복도
  b.room(18, 4, 16, 9);                   // 저장고
  b.room(5, 16, 2, 11);                   // 서복도
  b.room(3, 7, 10, 9);                    // 의무실
  b.room(5, 2, 7, 4);                     // 시크릿 옷방
  b.secret(7, 6, 3); b.secret(8, 6, 3);
  b.room(34, 27, 4, 2);                   // 동복도2
  b.room(38, 20, 6, 11);                  // 열쇠실
  b.room(20, 35, 12, 2);                  // 출구 방
  b.door(25, 34, true);                   // 붉은 열쇠 문
  b.set(32, 35, 24);                      // 출구 스위치
  // 몬스터
  b.mon('grunt', 23, 24); b.mon('grunt', 31, 25); b.mon('grunt', 27, 31);
  b.mon('grunt', 21, 7); b.mon('grunt', 30, 10); b.mon('fiend', 27, 6);
  b.mon('grunt', 11, 14); b.mon('warlock', 40, 22);
  b.mon('grunt', 39, 25); b.mon('grunt', 42, 28);
  b.mon('fiend', 22, 36); b.mon('fiend', 29, 36);
  // 아이템
  b.item('shells', 32, 23); b.item('shard', 21, 23); b.item('lamp', 26, 27);
  b.item('barrel', 22, 32); b.item('barrel', 23, 32); b.item('barrel', 22, 31);
  b.item('shotgun', 25, 8); b.item('clip', 19, 5); b.item('clip', 32, 5);
  b.item('medkit', 19, 11); b.item('barrel', 31, 11); b.item('barrel', 32, 11);
  b.item('lamp', 20, 4);
  b.item('medkit', 4, 8); b.item('stim', 6, 13); b.item('stim', 10, 8); b.item('lamp', 4, 13);
  b.item('armor', 7, 3); b.item('clip', 9, 3); b.item('stim', 10, 4);
  b.item('key_red', 42, 21); b.item('shard', 38, 30);
  b.item('barrel', 39, 29); b.item('barrel', 40, 29);
  b.item('medkit', 30, 35); b.item('lamp', 21, 35);
  return b.finalize();
}

// ============================================================
// 미션 2 — 정제 공장 (링 복도 + 중앙 아레나)
// ============================================================
function buildLevel2() {
  const b = new LB(50, 42, 4);
  b.player(4, 36, 0);
  b.room(3, 4, 42, 34);                   // 외곽 링 카빙
  b.wallRect(7, 8, 34, 26, 4);            // 내부 블록 복원
  b.room(14, 15, 20, 12);                 // 중앙 아레나
  b.set(17, 18, 5); b.set(27, 18, 5); b.set(17, 23, 5); b.set(27, 23, 5);
  b.room(7, 20, 7, 2);                    // 서 갭
  b.room(34, 20, 7, 2);                   // 동 갭
  b.room(22, 8, 4, 7);                    // 북 갭
  b.room(22, 27, 4, 7);                   // 남 갭
  b.room(9, 9, 10, 5); b.door(12, 8);     // 북서 저장고
  b.room(29, 9, 10, 5); b.door(34, 8);    // 북동 무기고
  b.room(9, 29, 10, 5); b.door(12, 34);   // 남서 의무실
  b.room(29, 29, 10, 5); b.door(34, 34, true); // 남동 금고(열쇠)
  b.set(39, 31, 24);                      // 출구 스위치(금고 안)
  b.room(14, 39, 6, 1);                   // 시크릿1 포켓
  b.secret(15, 38, 4); b.secret(16, 38, 4); b.secret(17, 38, 4);
  b.room(46, 20, 2, 3);                   // 시크릿2 포켓
  b.secret(45, 21, 4);
  b.set(24, 36, 0);                        // (안전: 시작 복도 확보)
  // 몬스터
  b.mon('grunt', 10, 5); b.mon('grunt', 30, 5); b.mon('grunt', 43, 15);
  b.mon('grunt', 4, 20); b.mon('grunt', 20, 36); b.mon('grunt', 36, 36);
  b.mon('fiend', 19, 18); b.mon('fiend', 28, 23);
  b.mon('warlock', 24, 20); b.mon('warlock', 34, 12);
  b.mon('grunt', 36, 33);
  // 아이템
  b.item('barrel', 16, 16); b.item('barrel', 30, 16); b.item('barrel', 16, 25); b.item('barrel', 30, 25);
  b.item('shard', 15, 21); b.item('shard', 32, 22); b.item('lamp', 24, 15);
  b.item('clip', 5, 5); b.item('stim', 43, 30); b.item('stim', 5, 30);
  b.item('shells', 31, 11); b.item('clip', 36, 11); b.item('key_red', 33, 11);
  b.item('medkit', 38, 13); b.item('barrel', 30, 9); b.item('lamp', 29, 9);
  b.item('chaingun', 33, 31); b.item('armor', 37, 31); b.item('shells', 30, 33); b.item('medkit', 36, 29);
  b.item('medkit', 11, 31); b.item('stim', 17, 33); b.item('lamp', 10, 29);
  b.item('mega', 16, 39);
  b.item('shells', 46, 21); b.item('shard', 47, 22);
  b.item('barrel', 24, 36); b.item('barrel', 25, 36);
  b.item('clip', 22, 21); b.item('shells', 25, 22);
  return b.finalize();
}

// ============================================================
// 미션 3 — 차원의 심장 (종반: 거수 보스전)
// ============================================================
function buildLevel3() {
  const b = new LB(44, 44, 10);
  b.player(5, 39, 0);
  b.room(3, 37, 10, 5);                    // 입구 동굴
  b.room(13, 37, 1, 2);                    // 연결통로
  b.room(14, 33, 12, 8);                   // 동굴 1
  b.room(26, 31, 2, 3);                    // 연결통로
  b.room(28, 25, 12, 10);                  // 동굴 2
  b.room(16, 22, 4, 11);                   // 북부 스퍼
  b.door(17, 21, true);                    // 붉은 문(성소 앞)
  b.set(18, 21, 10);
  b.room(12, 14, 16, 7);                   // 성소
  b.room(19, 21, 1, 1);
  b.room(6, 3, 32, 9);                     // 최종 아레나
  b.room(19, 12, 4, 2);                    // 아레나 진입
  // 아레나 기둥 링
  b.set(12, 5, 10); b.set(18, 5, 10); b.set(26, 5, 10); b.set(32, 5, 10);
  b.set(12, 9, 10); b.set(18, 9, 10); b.set(26, 9, 10); b.set(32, 9, 10);
  b.set(22, 2, 24);                        // 출구 스위치
  // 시크릿
  b.room(41, 28, 2, 3); b.secret(40, 29, 10);
  b.room(8, 16, 3, 3);  b.secret(11, 17, 3);
  // 몬스터
  b.mon('grunt', 20, 38); b.mon('grunt', 23, 35); b.mon('fiend', 17, 36);
  b.mon('grunt', 30, 27); b.mon('fiend', 34, 31); b.mon('warlock', 37, 27);
  b.mon('grunt', 33, 33);
  b.mon('grunt', 17, 28);
  b.mon('warlock', 15, 16); b.mon('warlock', 24, 16); b.mon('grunt', 20, 18);
  b.mon('brute', 22, 6);
  b.mon('fiend', 10, 5); b.mon('fiend', 34, 5);
  b.mon('warlock', 14, 8); b.mon('warlock', 30, 8);
  b.mon('grunt', 22, 10); b.mon('grunt', 8, 4);
  // 아이템
  b.item('stim', 4, 41); b.item('clip', 11, 41);
  b.item('medkit', 15, 39); b.item('shells', 24, 39); b.item('lamp', 14, 34);
  b.item('clip', 29, 33); b.item('key_red', 30, 26); b.item('medkit', 38, 34);
  b.item('barrel', 31, 29); b.item('barrel', 32, 29);
  b.item('stim', 16, 31); b.item('armor', 19, 22);
  b.item('chaingun', 19, 17); b.item('shells', 25, 17); b.item('medkit', 13, 19);
  b.item('lamp', 13, 15); b.item('lamp', 26, 15);
  b.item('mega', 41, 29); b.item('shells', 42, 29);
  b.item('armor', 9, 17); b.item('stim', 10, 18);
  b.item('barrel', 9, 10); b.item('barrel', 35, 10); b.item('barrel', 15, 4);
  b.item('shells', 7, 11); b.item('shells', 36, 11); b.item('medkit', 22, 4);
  return b.finalize();
}

const LEVELS = [
  {
    name: '미션 1 — 착륙장',
    intro: '비상 착륙에 성공했다. 통신 두절.\n기지 안에서 무언가 비명을 질렀다.',
    par: 90, floor: 1, ceil: 1,
    build: buildLevel1
  },
  {
    name: '미션 2 — 정제 공장',
    intro: '정제 코어가 차원 균열의 반응로로 쓰이고 있다.\n링 복도 어딘가에 붉은 열쇠가 있다.',
    par: 120, floor: 2, ceil: 1,
    build: buildLevel2
  },
  {
    name: '미션 3 — 차원의 심장',
    intro: '균열의 심장이 여기서 뛴다.\n거수를 쓰러뜨리고 출구 스위치를 작동시켜라.',
    par: 150, floor: 3, ceil: 2,
    build: buildLevel3
  }
];
