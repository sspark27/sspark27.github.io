'use strict';
// ============================================================
// 무기 정의 — 발사 로직은 entities.js의 Player.fire에서 실행
// ============================================================
const WEAPONS = [
  {
    key: 'pistol', name: '권총', ammo: 'bullets',
    rate: 0.38, pellets: 1, spread: 0.020, dmgLo: 9, dmgHi: 15,
    auto: false, snd: 'pistol'
  },
  {
    key: 'shotgun', name: '산탄총', ammo: 'shells',
    rate: 0.95, pellets: 7, spread: 0.12, dmgLo: 4, dmgHi: 9,
    auto: false, snd: 'shotgun', pumpAt: 0.45, pumpSnd: true
  },
  {
    key: 'chain', name: '연발포', ammo: 'bullets',
    rate: 0.095, pellets: 1, spread: 0.055, dmgLo: 6, dmgHi: 11,
    auto: true, snd: 'chaingun'
  }
];

const AMMO_MAX = { bullets: 200, shells: 50 };

// 픽업 시 지급량
const AMMO_GIVE = { clip: 12, shells: 8 };
