export type DifficultyId = "soft" | "hard" | "brutal";

export type Difficulty = {
  id: DifficultyId;
  name: string;
  nameZh: string;
  blurb: string;
  cols: number;
  rows: number;
  extraOpen: number;
  blocks: number;
  dashes: number;
  reveals: number;
  compasses: number;
  stamps: number;
  pops: number;
  courtyards: number;
  warpPairs: number;
  boosts: number;
  tars: number;
  doors: number;
  doorNeed: number;
  fogNear: number;
  fogFar: number;
  exitNeedsAll: boolean;
  tone: "sun" | "cyan" | "pink";
};

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  soft: {
    id: "soft",
    name: "SOFT",
    nameZh: "软墙",
    blurb: "小迷宫，道具多，出口常开",
    cols: 9,
    rows: 9,
    extraOpen: 0.16,
    blocks: 4,
    dashes: 2,
    reveals: 1,
    compasses: 1,
    stamps: 2,
    pops: 3,
    courtyards: 1,
    warpPairs: 1,
    boosts: 3,
    tars: 2,
    doors: 1,
    doorNeed: 2,
    fogNear: 56,
    fogFar: 110,
    exitNeedsAll: false,
    tone: "sun",
  },
  hard: {
    id: "hard",
    name: "HARD",
    nameZh: "硬墙",
    blurb: "标准迷宫，边走边捡",
    cols: 13,
    rows: 13,
    extraOpen: 0.09,
    blocks: 8,
    dashes: 1,
    reveals: 1,
    compasses: 1,
    stamps: 3,
    pops: 4,
    courtyards: 2,
    warpPairs: 1,
    boosts: 5,
    tars: 4,
    doors: 1,
    doorNeed: 3,
    fogNear: 42,
    fogFar: 88,
    exitNeedsAll: false,
    tone: "cyan",
  },
  brutal: {
    id: "brutal",
    name: "BRUTAL",
    nameZh: "暴墙",
    blurb: "大迷宫，收齐色块才能出门",
    cols: 17,
    rows: 17,
    extraOpen: 0.035,
    blocks: 12,
    dashes: 1,
    reveals: 1,
    compasses: 1,
    stamps: 5,
    pops: 6,
    courtyards: 3,
    warpPairs: 2,
    boosts: 7,
    tars: 8,
    doors: 2,
    doorNeed: 3,
    fogNear: 26,
    fogFar: 58,
    exitNeedsAll: true,
    tone: "pink",
  },
};

export const DIFFICULTY_LIST: DifficultyId[] = ["soft", "hard", "brutal"];

export const DASH_TIME = 8;
export const REVEAL_TIME = 10;
export const COMPASS_TIME = 16;
export const DASH_MULT = 1.58;
export const PAD_BOOST = 12.8;
export const PAD_BOOST_CAP = 16.2;
export const TAR_SLOW = 0.36;
export const POP_LAUNCH = 9.6;
export const TOAST_TIME = 1.55;
