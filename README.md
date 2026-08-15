# Case Record

案件记录项目。

## 目录结构

```
CaseRecord/
├── app/                 # 前端应用（静态网页）
│   ├── index.html       # 入口页面
│   ├── css/style.css    # 样式
│   └── js/main.js       # 脚本
├── .gitignore
└── README.md
```

## 本地预览

直接用浏览器打开 `app/index.html`，或在项目根目录运行任意静态文件服务器：

```bash
# 例如 Python
python -m http.server -d app 8080
```

## 技术栈

- 原生 HTML / CSS / JavaScript（无构建依赖，开箱即用）
