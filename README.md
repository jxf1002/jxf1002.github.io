# 贾师傅的小站

这是一个无需构建的原生静态 HTML 项目，页面使用 CSS 和浏览器原生 JavaScript 实现。

## 本地预览

```bash
python3 -m http.server 3000
```

然后访问 `http://localhost:3000/`。旅游景区和大学排行榜会从 `assets/data/` 加载 JSON 数据。

## 页面

- `/`：首页

数据

- `/college/`：大学排行榜
- `/tourism/`：5A 级旅游景区
- `/comfort/`：全国体感温度，地级市天气与 24 小时温度范围地图

工具

- `/photo/`：图片格式转换，批量转 JPG / PNG / WebP，可打包成 ZIP 下载
- `/dcf/`：DCF 企业估值计算器

游戏

- `/mahjong/`：麻将小游戏
- `/mir2/`：传奇挂机小游戏
- `/sport/`：赛博运动，生成跑步报告

## 反馈

有问题或建议，欢迎到 [Issues](https://github.com/jxf1002/jxf1002.github.io/issues) 提出；如果觉得还不错，给个 [Star](https://github.com/jxf1002/jxf1002.github.io) 支持一下。
