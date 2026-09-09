# 贾师傅的小站

这是一个无需构建的原生静态 HTML 项目，页面使用 CSS 和浏览器原生 JavaScript 实现。

## 本地预览

```bash
python3 -m http.server 3000
```

然后访问 `http://localhost:3000/`。旅游景区和大学排行榜会从 `assets/data/` 加载 JSON 数据。

## 页面

- `/`：首页
- `/tourism/`：5A级旅游景区
- `/college/`：大学排行榜，支持 `?year=2023`、`?year=2024`、`?year=2025`、`?year=2026`，不传参数时默认显示 2026 年最新数据
- `/dcf`：DCF 企业估值计算器
- `/rent`：房产租金计算器
