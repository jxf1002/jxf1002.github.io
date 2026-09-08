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
- `/college/2023/`、`/college/2024/`：大学排行榜
- `/dcf.html`：DCF 企业估值计算器
- `/rent.html`：房产租金计算器
