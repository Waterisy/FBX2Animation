# FBX2Animation

一个基于 **Three.js** 的网页版 FBX 动画播放器，支持导入 FBX 文件并实时播放骨骼动画，配备完整的 GUI 控制面板。

![Three.js](https://img.shields.io/badge/Three.js-r161-blue) ![License](https://img.shields.io/badge/license-ISC-green)

---

## ✨ 功能特性

### 🎬 动画播放
- 导入 FBX 文件后自动解析所有内嵌动画
- 支持多动画切换（下拉菜单选择）
- 播放 / 暂停 / 重置控制
- 动画速度调节（0.1x ~ 3.0x）
- 动画进度条拖拽定位
- 循环播放开关

### 📦 模型导入
- 点击按钮选择文件
- 拖拽 FBX 文件到页面直接导入
- 自动缩放模型至合适大小
- 自动居中并贴地放置
- 支持替换（重新导入即可）

### 🌍 场景控制
- 鼠标左键旋转 / 右键平移 / 滚轮缩放
- 显示 / 隐藏地面
- 显示 / 隐藏网格
- 线框模式
- 显示 / 隐藏骨骼结构
- 一键重置视角
- 背景颜色自定义

### 💡 灯光控制
- 环境光强度调节
- 主方向光强度调节

### 📊 模型信息
- 网格数量
- 多边形面数
- 动画数量
- 骨骼数量

---

## 🚀 快速使用

### 方式一：直接使用（推荐，无需安装）

下载 [`dist/standalone.html`](./dist/standalone.html)，**双击打开**即可使用。

> 所有依赖已内联，完全离线可用，无需服务器、无需 Node.js。

### 方式二：本地开发

```bash
# 克隆仓库
git clone https://github.com/Waterisy/FBX2Animation.git
cd FBX2Animation

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---

## 🛠 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Three.js](https://threejs.org/) | r161 | 3D 渲染引擎 |
| [Vite](https://vitejs.dev/) | 7.x | 构建工具 |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.x | FBX 压缩格式解析 |

---

## 📁 项目结构

```
FBX2Animation/
├── dist/
│   ├── standalone.html   # 📌 单文件离线版（推荐下载此文件）
│   ├── index.html        # 构建产物
│   └── assets/
├── src/
│   └── main.js           # 核心逻辑
├── index.html            # 入口页面
├── vite.config.js        # 构建配置
└── package.json
```

---

## 📝 使用说明

1. 打开 `standalone.html`
2. 点击 **「📂 导入FBX」** 按钮，或将 `.fbx` 文件拖拽到页面
3. 模型加载完成后自动开始播放第一个动画
4. 通过右侧 **GUI 面板** 控制动画和场景

---

## ⚠️ 注意事项

- 仅支持 `.fbx` 格式文件
- FBX 内嵌贴图可能因路径问题无法显示，但动画播放不受影响
- 建议使用 Chrome / Edge 等现代浏览器
