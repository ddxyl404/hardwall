/** 3D + sim palette — keep hex in sync with `@theme` in src/styles.css */
export const PALETTE = {
  paper: 0xfff8e7,
  ink: 0x111111,
  sun: 0xffe500,
  cyan: 0x00d4e8,
  pink: 0xff5a8a,
  lime: 0xc6f000,
  sky: 0x7ed9ff,
  floor: 0xf3e4b8,
  cream: 0xffefc2,
  white: 0xfffdf5,
  grout: 0x111111,
} as const;

export const WALL_FILLS = [
  PALETTE.paper,
  PALETTE.paper,
  PALETTE.cream,
  PALETTE.cream,
  PALETTE.sun,
  PALETTE.cyan,
  PALETTE.pink,
  PALETTE.lime,
] as const;

export const CELL = 3.6;
export const WALL_H = 3.35;
export const WALL_T = 0.28;
export const PLAYER_R = 0.36;
export const EYE = 1.62;
export const WALK_SPEED = 5.15;
export const SPRINT_SPEED = 8.05;
export const ACCEL = 32;
export const FRICTION = 11;
export const MOUSE_SENS = 0.00215;
export const TOUCH_LOOK_SENS = 0.0034;
export const GAMEPAD_LOOK = 2.35;
export const FIXED_DT = 1 / 60;
export const LOOK_KEY = "hardwall-best-v2";
export const LOOK_KEY_LEGACY = "hardwall-best-v1";
export const SETTINGS_KEY = "hardwall-settings-v1";
