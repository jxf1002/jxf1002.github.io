# 贾师傅的小站

Next.js App Router 静态站点，用 `output: 'export'` 导出纯静态 HTML，部署在 GitHub Pages。
每个路由一个独立 HTML，SEO 元信息集中在 `lib/site.ts`。源码为 TypeScript（strict）。

## 本地开发

```bash
./start.sh       # 等价于 npm install + npm run dev，http://localhost:3000/
```

或手动：

```bash
npm install
npm run dev
```

构建与预览：

```bash
npm run build    # 产物在 out/
npm run preview  # 用静态服务器预览 out/
npm test         # 单测 + 游戏 UI 冒烟测试
npm run verify   # 构建 + 产物自检
```

## 页面

- `/`：首页

数据

- `/college/`：大学排行榜（`?year=2023..2026`）
- `/tourism/`：5A 级旅游景区
- `/comfort/`：全国体感温度，地级市天气与 24 小时温度范围地图

工具

- `/photo/`：图片格式转换，批量转 JPG / PNG / WebP，可打包成 ZIP 下载
- `/dcf/`：DCF 企业估值计算器

游戏

- `/mahjong/`：麻将小游戏（引擎 `lib/mahjong/`，界面 `components/mahjong/`）
- `/mir2/`：传奇挂机小游戏（引擎 `lib/mir2/`，界面 `components/mir2/`）
- `/sport/`：赛博运动，生成跑步报告
- `/guess/`：猜数字小游戏，10 次机会 + 提示 + 本地战绩（逻辑 `lib/guess.ts`，界面 `components/guess/`）
- `/five-cards/`：五张牌魔术，读懂四张明牌的排列猜扣牌，刷新保留本局（逻辑 `lib/five-cards.ts`，界面 `components/five-cards/`）

数据 JSON 与站点样式在 `public/assets/` 下，页面运行时按需加载。

## 反馈

有问题或建议，欢迎到 [Issues](https://github.com/jxf1002/jxf1002.github.io/issues) 提出；如果觉得还不错，给个 [Star](https://github.com/jxf1002/jxf1002.github.io) 支持一下。
