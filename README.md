# HARDWALL

第一人称低多边形迷宫。WASD 移动，鼠标控制视角，走廊里收集色块，找到出口。

**在线游玩：** [https://ddxyl404.github.io/hardwall/](https://ddxyl404.github.io/hardwall/)

- WASD / 摇杆移动，鼠标锁定视角
- 小地图随探索点亮
- 计时 + 最短通关记录（保存在本机）
- 三档难度：SOFT / HARD / BRUTAL
- 新野兽派配色：黄、青、粉、纸色、墨线
- 迷宫里还有：成对传送环、贴章开门的粉闸、走廊加速箭头、2×2 雕塑庭院、可撞破的气球

## 本地运行

```bash
npm install
npm run dev
```

## GitHub Pages

```bash
npm run build:pages
```

静态产物在 `.output/public`。推送到 `main` 后，GitHub Actions 会自动构建并发布。
