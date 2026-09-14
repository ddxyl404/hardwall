import { PALETTE } from "./constants";
import type { PickupKind } from "./maze";

export type ToastTone = "sun" | "cyan" | "pink" | "lime" | "paper";

export const PICKUP_INFO: Record<
  PickupKind,
  {
    label: string;
    zh: string;
    blurb: string;
    color: number;
    hex: string;
    css: ToastTone;
  }
> = {
  block: {
    label: "BLOCK",
    zh: "色块",
    blurb: "收集计分",
    color: PALETTE.sun,
    hex: "#FFE500",
    css: "sun",
  },
  dash: {
    label: "DASH",
    zh: "疾跑",
    blurb: "加速冲刺",
    color: PALETTE.cyan,
    hex: "#00D4E8",
    css: "cyan",
  },
  reveal: {
    label: "MAP",
    zh: "全图",
    blurb: "小地图全开，雾气散开",
    color: PALETTE.pink,
    hex: "#FF5A8A",
    css: "pink",
  },
  compass: {
    label: "EXIT",
    zh: "指南",
    blurb: "箭头指向出口",
    color: PALETTE.lime,
    hex: "#C6F000",
    css: "lime",
  },
  stamp: {
    label: "STAMP",
    zh: "贴章",
    blurb: "贴满就开闸",
    color: PALETTE.cream,
    hex: "#FFEFC2",
    css: "paper",
  },
};
