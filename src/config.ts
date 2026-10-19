// 全局常量。调整手感时优先改这里。
export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const ROOM_W = 30;
export const ROOM_H = 17;

export const PHYS = {
  gravity: 2150,
  maxFall: 840,
  run: 250,
  accelGround: 3400,
  accelAir: 2300,
  jumpV: 800,
  jumpCut: 0.42,
  coyote: 0.1,
  jumpBuffer: 0.14,
  dashSpeed: 660,
  dashTime: 0.2,
  dashCd: 0.42,
};

export const PLAYER_BASE = {
  w: 20,
  h: 40,
  maxHp: 5,
  flasks: 2,
  slashDmg: 10,
  throwDmg: 8,
  ripDmg: 14,
  recallDmg: 30,
};

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** 开发用：?debug 开启；?debug&level=3 从第 4 层开始（层数从 0 计），?debug&god 无敌 */
/** 镜头缩放：平时拉近，让角色的细节看得清；Boss 战略拉远，看清整个招式 */
export const CAM_ZOOM = 1.3;
export const CAM_ZOOM_BOSS = 0.95;

export const DEBUG = params.has('debug');
export const DEBUG_LEVEL = DEBUG ? Math.max(0, parseInt(params.get('level') ?? '0', 10) || 0) : 0;
export const DEBUG_GOD = DEBUG && params.has('god');
export const DEBUG_GALLERY = DEBUG && params.has('gallery');
