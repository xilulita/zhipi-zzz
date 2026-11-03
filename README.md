# 智批作文 · AI 作文智能批改

一个可直接双击运行的前端应用（纯 HTML/CSS/JS，无需安装任何依赖）。
打开 `index.html` 即可使用，建议用 Chrome / Edge 全屏（1280×800 以上分辨率体验最佳）。

---

## 一、界面结构

| 区域 | 宽度 | 作用 |
|---|---|---|
| 左栏 · 功能栏 | 固定 240px | 备注、体裁、年级、上传、四维评分量表、一键批改 |
| 中间 · 白色画板 | 自适应 | 作文图片居中对齐，左右各留白区放批注痕迹 |
| 右栏 · 结果区 | 固定 360px | 总分 + 雷达图 + 亮点 / 问题 / 建议 / 技巧 + 四个 Tab |

---

## 二、左栏功能

1. **① 学生姓名**
   单行小输入框，填写学生姓名（如"张小雨"），**仅用于标识和记忆/区分多份作文**，不参与批改内容。
   - 上传图片时，若已填写姓名，会直接作为该份作文的标题
   - 切换作文标签时，姓名框自动显示对应学生
   - 未填写则按图片文件名命名，报告卡中的姓名区不显示

2. **② 作文体裁**
   记叙文 / 写景状物 / 议论文 / 读后感 / 书信 / 想象作文，共 6 类。
   每类内置不同的**结构骨架**与**写作技巧**，会体现在报告的"写作小技巧"和升格建议中。

3. **③ 选择年级**（下拉选择，7 档）

   > 点击下拉框展开年级列表；**鼠标悬停在某个年级上，右侧会浮出该年级的写作要求**（4 条 + 满分 + 建议字数）。
   > 选中后下拉自动收起，年级名称与字数显示在框内。

   | 年级 | 字数要求 | 满分 |
   |---|---|---|
   | 三年级 | 300~400 字 | 30 |
   | 四年级 | 400~450 字 | 30 |
   | 五年级 | **450~550 字** | 30 |
   | 六年级 | **550~650 字** | 30 |
   | 七年级 | 600~700 字 | 40 |
   | 八年级 | 700~800 字 | 40 |
   | 九年级 | 800~900 字 | 40 |

   选择年级后，下方自动代入该年级的**写作要求**（4 条），并联动字数量表、满分与范文生成区间。
   已用脚本抽样验证：7 个年级各生成 40 篇，字数 **100% 落在要求区间内**。

4. **④ 添加作文图片**
   - 点击选择，或**直接拖拽**到上传区（整页任意位置拖入也能识别）
   - 自动压缩：最长边限制 1500px，JPEG 质量 0.82，实测 3000×4000 / 361KB → 1125×1500 / 25KB
   - 支持多张，缩略图两列排布，右上角悬浮出现删除按钮
   - 可一次上传多份，**并行批改**

5. **⑤ 四维评分量表（可收缩）**

   | 维度 | 评估要点 |
   |---|---|
   | 内容立意 | 主题是否明确、立意是否深刻、素材是否贴合题意 |
   | 结构逻辑 | 段落安排是否合理、层次是否清晰、详略是否得当 |
   | 语言表达 | 用词是否准确生动、句式是否流畅、修辞运用水平 |
   | 规范书写 | 错别字、病句、标点与书写规范 |

   - 四个滑块可左右拖动，**总权重始终锁定 100 分**
   - 拖动任一维度时，其余维度按比例自动压缩，绝不会出现总和超过 100
   - 提供"恢复默认（30/25/25/20）"与"平均分配（25×4）"
   - 权重直接参与计分：某维度得分 = 年级满分 × 权重 ÷ 100 × 达成率

7. **添加下一份**
   一键进入"下一份作文"：自动把当前已批改的作文存入历史，清空姓名框并唤起文件选择。
   适合连续批改一个班的作文。

8. **历史记录**
   每份批改完成的作文**自动存入本地历史**（localStorage，最多 80 条），包含：姓名、年级、体裁、字数、得分、批改时间、作文缩略图。
   - 点击任意记录可重新载入该作文（未批改态），再次批改
   - 支持"清空记录"
   - 数据只保存在本机浏览器，不上传

6. **一键批改**（或按 `Ctrl / ⌘ + Enter`）
   弹出进度窗，逐份显示"识别 → 内容 → 结构 → 语言 → 生成报告"五步；可点"后台运行"。

> **启动行为**：打开软件时默认只展示一篇演示作文《那一刻，我长大了》（**未批改状态**），
> 中间显示原稿、右栏提示"待批改"。点击「一键批改」才会开始批改流程，方便直接演示。
> 想恢复初始演示，点底部「恢复演示作文」，或直接拖新图片进来覆盖当前画面。

---

## 三、中间画板

- 作文图片**自动居中**，左右两侧各留出一片白色区域专门放批注
- 图片宽度自适应：同时受可用宽度与**可用高度**约束，竖长照片不会被裁切
- 图片内用 4 种颜色的半透明框标出被点评的原句位置
- 图片外左右两侧悬浮批注卡，**虚线引线精确连到对应色框**，hover 时双向高亮
- 四种批注配色：

  | 颜色 | 类型 | 用途 |
  |---|---|---|
  | 🔴 红 | 错别字 / 病句 | 直接指出错误 |
  | 🟡 黄 | 润色建议 | 给出改写后的表达 |
  | 🟢 绿 | 优秀好句 | 标注亮点 |
  | 🟣 紫 | 删改 | 建议删除或调整 |

- 顶部：多份作文标签（点击切换，绿点=已批改）、缩放 60%~140%、打印
- 底部：四色图例

---

## 四、右栏批改报告

**1. 总分卡**
- 姓名：只有填写了名字才显示（未填则不出现）
- 得分 `37 / 50` 形式 + 等级（一类文 / 二类文 / 三类文）
- 字数 / 要求字数 / 段落数 + 进度条

**2. 三轴雷达图**：内容 · 结构 · 立意（Canvas 绘制，含四维分值图例）

**3. ✨ 文章亮点**：固定 3 条，每条带原文引用

**4. ⚠️ 存在问题清单**：3 项，含严重度标记（重要 / 中等 / 轻微）+ 原句与修改对照

**5. 📝 修改指导建议**：4 条编号步骤

**6. 💡 写作小技巧**：随体裁变化的 3 条

**7. 四个 Tab**

| Tab | 内容 |
|---|---|
| **总评** | 300~400 字总评（含表扬、具体问题、可执行建议） |
| **分项** | 四维逐项得分条 + 权重 + 评语 |
| **批注** | 全文 4 处批注清单，点击可跳转定位 |
| **升格** | 原文 / 升格对照，标注可提升的分值 |

---

## 五、AI 批改接入（必读）

**「一键批改」不再使用本地模板生成报告**，必须配置 AI 接口后才能使用。未配置时点击会：
1. 不生成任何报告
2. 自动展开左下「AI 部署」面板
3. 提示「请先配置 AI 批改接口」

### 方案一：云端 AI 接口（推荐）
1. 在左侧「AI 部署」→「AI 接口」中填写：
   - **服务商**：OpenAI 兼容 / 通义千问 / 智谱 GLM / DeepSeek / 自定义
   - **接口地址**：以 `/v1` 结尾，例如
     - OpenAI：`https://api.openai.com/v1`
     - 通义：`https://dashscope.aliyuncs.com/compatible-mode/v1`
     - 智谱：`https://open.bigmodel.cn/api/paas/v4`
   - **API Key**：控制台生成的密钥
   - **模型**：必须**支持图片输入（视觉模型）**，如 `gpt-4o`、`qwen-vl-max`、`glm-4v`
2. 点「测试连接」→ 成功后「保存配置」
3. 上传作文图片 → 选年级 → 点「一键批改」

> ⚠️ 必须用视觉模型。纯文本模型无法识别图片中的作文。

### 方案二：本地部署（数据不出本机）
1. 安装 Ollama，拉取视觉模型：`ollama pull qwen2.5vl:7b`
2. 启动服务：`ollama serve`（默认 11434 端口）
3. 浏览器跨域被拦时，启动前设置环境变量 `OLLAMA_ORIGINS=*`
4. 在「AI 部署」→「本地部署」填写地址与模型名，保存

### 调试工具
`mock-ai.js` 是一个本地 mock 接口，用于在不消耗真实额度的情况下验证链路：
```bash
node mock-ai.js          # 启动 http://127.0.0.1:8787/v1
```
然后在「AI 接口」里填该地址、任意 Key、模型 `mock-vision` 即可。

### 数据流
```
作文图片 → base64 → AI 视觉模型（识别 + 评分 + 批注）
        → JSON → 归一化 → 右栏报告 + 四色批注
```
AI 返回值会经过校验（分数钳制、批注数限制 4 条、亮点 3 条、问题 3 条），异常 JSON 会自动尝试修复，仍失败则在该份显示「失败」而不是伪造数据。

## 六、技术说明

| 文件 | 说明 |
|---|---|
| `index.html` | 页面结构 |
| `assets/style.css` | 全局样式、左栏、报告区、弹窗 |
| `assets/board.css` | 画板、批注卡、引线、标注框 |
| `assets/data.js` | 年级规则、四维定义、体裁库、范文素材库、生成与评分引擎 |
| `assets/app.js` | 状态管理、上传压缩、批改流程、渲染、交互 |

- **网页版**无构建、无依赖，打开 `index.html` 即可运行
- **桌面版**需 Node.js 安装依赖后构建，详见第七、八节
- 批改内容由本地评分引擎生成，作文图片仅在用户主动触发批改时发送到所配置的 AI 接口

> 说明：本项目为**可运行的产品原型**，批改内容由内置的作文评分引擎（字数、段落、句式、修辞密度、细节密度等指标 + 体裁/年级规则库）生成，用于演示完整交互与报告结构。若要接入真实大模型，只需把 `assets/data.js` 中的 `scoreOf()` 与 `assets/app.js` 中的 `makeResult()` 替换为接口调用即可。

---

## 七、开发环境

### 两种开发方式

| 方式 | 适用 | 启动 |
|---|---|---|
| **网页版** | 调样式、改界面、写报告逻辑，改完刷新即可 | 直接双击 `index.html` |
| **桌面版** | 调 Electron 主进程、窗口、安装包相关 | `npm start` |

日常改 UI 建议用网页版，改动 `assets/` 下的文件后按 `Ctrl+R` 刷新，无需重启。只有动 `electron/` 下的主进程代码时才需要 `npm start`。

### 环境要求

| 项目 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18（推荐 20 LTS） | 仅桌面版打包需要，网页版无需 Node |
| npm | ≥ 9 | 随 Node 附带 |
| 操作系统 | Windows 10 / 11 x64 | 安装包目标平台 |

### 首次安装

```bash
git clone https://github.com/xilulita/zhipi-zzz.git
cd zhipi-zzz
npm ci          # 按 package-lock.json 精确安装，推荐
```

若 `npm ci` 因 lock 文件与 `package.json` 不一致报错，改用 `npm install`。

安装完成后：

```bash
npm start       # 启动桌面版
```

### 目录结构

```
index.html           页面入口（桌面版与网页版共用）
assets/
  style.css          全局样式、左栏、报告区、弹窗
  board.css          画板、批注卡、引线、标注框
  drill.css          小练笔模块样式
  data.js            年级规则、四维定义、体裁库、生成与评分引擎
  app.js             状态管理、上传压缩、批改流程、渲染、交互
  ai.js              AI 接口调用、提示词、返回结果归一化
  export.js          HTML 报告导出
  app-icon.png       应用图标
electron/
  main.js            主进程：窗口、用户数据目录、IPC
  preload.js         预加载桥（仅暴露最小接口）
  splash.html        启动闪屏
build/               打包用图标
mock-ai.js           本地 mock AI 接口，用于调试链路
```

### 改完代码看不到变化？

`index.html` 里的资源引用带了版本号，用于强制刷新浏览器缓存：

```html
<link rel="stylesheet" href="assets/style.css?v=1793661302">
<script src="assets/app.js?v=1793675000"></script>
```

改完 `style.css` / `app.js` / `export.js` / `ai.js` / `data.js` 后，如果页面没有更新，把对应 `?v=` 数字改成新值（任意递增数字即可），或在浏览器里 `Ctrl+Shift+R` 强制刷新。

### 调试

- **网页版**：F12 打开开发者工具，Console 面板查看日志
- **桌面版**：`npm start` 后同样可 F12；主进程日志（如用户数据目录迁移、导出失败）输出在启动它的终端里
- **AI 链路**：用 `mock-ai.js` 起本地假接口，详见第五节「调试工具」

---

## 八、打包发布

### 打包安装包

```bash
npm run dist:win
```

等价于：

```bash
electron-builder --win nsis --x64
```

产物输出到 `dist/`：

| 文件 | 说明 |
|---|---|
| `ZhipiZuowen-Pro-Setup-<版本>.exe` | 安装包，发布用这个 |
| `ZhipiZuowen-Pro-Setup-<版本>.exe.blockmap` | 差分更新用 |
| `latest.yml` | 自动更新元数据 |
| `win-unpacked/` | 解包目录，可直接运行其中的 exe 做冒烟测试 |

### 发版流程

1. 改 `package.json` 里的 `version`（如 `1.3.2` → `1.3.3`）
2. 提交并推送
3. `npm run dist:win`
4. 在 GitHub 建一个 tag 为 `v<版本>` 的 Release，上传 `dist/` 下的 `.exe`

`artifactName` 已配置为 `ZhipiZuowen-Pro-Setup-${version}.${ext}`，文件名会自动带版本号，无需手动改名。

### 打包会被包含的文件

由 `package.json` 的 `build.files` 白名单控制：

```json
"files": [
  "index.html",
  "assets/**/*",
  "electron/**/*",
  "build/icon.ico",
  "build/icon.png",
  "!assets/*.part.*",
  "!assets/.*.artifact.json",
  "!assets/_side_font_bump.css",
  "!assets/export_print.css",
  "!assets/*.part.js",
  "!assets/*.part.html",
  "!assets/vendor/**"
]
```

带 `!` 的是排除项，用来挡掉拆片、构建元数据、临时样式和第三方库残留。新增这类文件时，记得同步加进排除列表，否则会被打进安装包。

想确认某个文件在不在包里：

```bash
npx asar list dist/win-unpacked/resources/app.asar
```

### 用户数据目录

桌面版的用户数据（批改历史、AI 配置）存放在：

```
%APPDATA%\ZhipiZuowenDesktop\
```

这个目录名由 `electron/main.js` 的 `DATA_DIR` 常量固定，**不要随意改动**——改了等于用户丢历史记录。设计上按 `appId` 隔离，因此「智批作文」和「智批作文专业版」可以同时安装、各自保留数据。

### 代码签名

当前构建**未签名**，日志里会出现：

```
• no code signing certificate configured, signing is skipped
```

未签名的安装包在用户首次运行时，Windows SmartScreen 会提示「未知发布者」，需点「更多信息 → 仍要运行」。这是预期行为，不是构建失败。

如需签名，准备好代码签名证书（`.pfx`）后，通过环境变量传给 electron-builder：

```bash
# PowerShell
$env:CSC_LINK="C:\path\to\cert.pfx"
$env:CSC_KEY_PASSWORD="<证书密码>"
npm run dist:win
```

`CSC_LINK` 也可以是证书的 base64 内容。证书文件不要提交进仓库，`.gitignore` 里建议补上 `*.pfx`、`*.p12`。

---

## 九、环境变量与镜像

### 运行时的环境变量：无

应用本身**不读取任何环境变量**。AI 接口地址、Key、模型名都在界面「AI 部署」里配置，保存在浏览器 / Electron 的 `localStorage`（键名 `zhipi.ai.deploy.v1`），不会进仓库，也不从 `.env` 读取。

因此克隆后无需建 `.env` 文件即可运行。

### 构建时的环境变量

| 变量 | 作用 | 何时需要 |
|---|---|---|
| `ELECTRON_MIRROR` | 指定 Electron 二进制下载镜像 | 国内网络下载 Electron 超时/失败时 |
| `ELECTRON_BUILDER_BINARIES_MIRROR` | 指定 electron-builder 辅助工具镜像 | 同上，打包工具下载失败时 |
| `CSC_LINK` | 代码签名证书路径或 base64 | 需要签名安装包时 |
| `CSC_KEY_PASSWORD` | 证书密码 | 需要签名安装包时 |

### 国内网络：使用镜像

`npm install` 和打包时会从 GitHub 下载 Electron 二进制，国内常出现 `ETIMEDOUT`。两种解决办法：

**方式一：临时指定（单次生效）**

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm ci
npm run dist:win
```

```bash
# macOS / Linux / Git Bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

**方式二：写入项目 `.npmrc`（长期生效）**

```
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

`.npmrc` 若不需要入库，可加入 `.gitignore`。

### 常见构建问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `connect ETIMEDOUT ...:443` | 下载 Electron 超时 | 按上节配置镜像后重试 |
| `EBUSY: resource busy or locked ... app.asar` | 旧的 `dist/` 被占用（残留进程或文件句柄） | 输出到别的目录：`npx electron-builder --win nsis --x64 -c.directories.output=dist-build` |
| `EPERM` 重命名 `win-unpacked` 失败 | 杀毒软件或索引服务正在扫该目录 | 换输出目录重试，或把项目目录加入杀软白名单 |
| 安装包体积 99MB 左右 | 包含完整 Electron 运行时，属正常 | — |
