# DeepSeek Harness Desktop

[![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/Language-中文-red.svg)](README.zh-CN.md)
[![Download](https://img.shields.io/badge/下载-安装包-brightgreen.svg)](https://github.com/JovanYoung/dsh-desktop2/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

把本地运行的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）Web 界面封装成 Windows 原生桌面应用的轻量 **Electron 壳**。

## 功能特性

- **一键启动**：双击即用，自动拉起本地 dsh 服务并弹出应用窗口
- **端口自适应**：启动时先探测 3080 端口，已有 dsh 服务则直接复用，不冲突
- **单实例**：重复启动只聚焦已有窗口，不会开多个实例
- **托盘常驻**：关闭窗口最小化到系统托盘，托盘右键「退出」才真正停止服务
- **API Key 复用**：自动读取 dsh 应用目录下 `dsh-start.bat` 中配置的 `DEEPSEEK_API_KEY`
- **自定义图标**：打包时通过 `afterPack.js` 自动注入应用图标与版本信息

## 环境要求

- Windows 10/11 x64
- Node.js 22.19+（开发构建用）
- 已安装 DeepSeek Harness 应用（目录可在 `config.json` 中配置）
- DeepSeek API Key（在 dsh 应用的 `dsh-start.bat` 中配置 `DEEPSEEK_API_KEY=sk-xxx`）

## 下载安装

前往 [Releases 页面](https://github.com/JovanYoung/dsh-desktop2/releases/latest) 下载最新安装包，运行安装后，从桌面快捷方式「DeepSeek Harness」启动即可。

## 新电脑首次使用

安装包只是**壳**——dsh 运行环境和你的 API Key 都不在里面。新电脑上：

1. **安装 Node.js**：https://nodejs.org 下载 LTS 版，一路下一步
2. 打开 **PowerShell** 执行：
   ```powershell
   cd D:\
   mkdir dsh-app
   cd dsh-app
   npm init -y
   npm install @deepseek-ai/dsh --registry=https://registry.npmmirror.com
   ```
3. 启动「DeepSeek Harness」——检测到缺少运行环境时，会弹出**应用内引导页**（同样的步骤 + 一键复制命令 + API Key 填写框）
4. 在 https://platform.deepseek.com →「API Keys」→「创建新密钥」复制 Key，粘贴保存后点**重新检测**

不需要手动改配置文件——壳默认读取 `D:\dsh-app`、`D:\dsh-data`，开箱即用。

## 安全性

你的 API Key 使用 **Windows 系统级加密（DPAPI / safeStorage）** 加密存储在你的用户目录，只通过环境变量注入**本地** dsh 进程：

- 🔒 无网络调用、无云同步、不写日志
- 🔒 存储代码完全开源——见 `main.js`（`writeSettings` / `readSettings`），引导页「安全」区块直接展示这段后端代码
- 🔒 开启 `contextIsolation`，引导页只能调用三个白名单 IPC（保存 Key / 读取状态 / 重启）

## 源码构建

```powershell
npm install          # 安装依赖
npx electron .       # 开发预览
npm run dist         # 打包 Windows 安装版（NSIS）
```

产物：
- 安装包：`dist\DeepSeek Harness Setup 1.0.0.exe`
- 免安装版：`dist\win-unpacked\DeepSeek Harness.exe`

> 说明：`build.win.signAndEditExecutable: false` 用于跳过代码签名，规避无管理员权限下 winCodeSign 的符号链接问题。

## 自定义配置

本地路径不写死在代码里（公开仓库不会泄露个人信息）。复制 `config.example.json` 为 `config.json`（已被 .gitignore 排除，不会提交），按需修改：

```json
{
  "dshApp": "D:\\dsh-app",
  "dshHome": "D:\\dsh-data",
  "nodeDir": "",
  "port": 3080
}
```

| 字段 | 默认值 | 说明 |
|---|---|---|
| `dshApp` | `D:\dsh-app` | dsh 应用目录 |
| `dshHome` | `D:\dsh-data` | dsh 数据目录 |
| `nodeDir` | `''`（走 PATH） | 运行 dsh 服务的 Node.js 目录 |
| `port` | `3080` | 本地服务端口 |

所有字段也可用环境变量覆盖（`DSH_APP` / `DSH_HOME` / `DSH_NODE_DIR`）。

## 文件结构

```
dsh-desktop/
├── main.js              # Electron 主进程（服务拉起 / 窗口 / 托盘 / 单实例）
├── package.json         # 项目配置与 electron-builder 打包配置
├── afterPack.js         # 打包后钩子：注入图标与版本信息（rcedit）
├── make_icon.py         # 图标生成脚本（Pillow 绘制蓝鲸鱼图标）
├── config.example.json  # 配置模板（复制为 config.json 使用，后者不入库）
├── icon.png / icon.ico
└── tools/               # rcedit-x64.exe（从 electron-builder 缓存提取，不入库）
```

## 常见问题

**Q: 报错「dsh 服务已停止，本地服务意外退出（退出码 1）」？**
端口 3080 已被其他 dsh 实例占用时，本壳会自动复用现有服务（已做端口探测），此报错仅在服务真正无法启动时出现。检查是否已有 dsh 服务运行、或端口被其他程序占用。

**Q: 重新打包时报 `d3dcompiler_47.dll: Access is denied`？**
运行中的桌面版会锁定 `win-unpacked` 目录。重新打包前先退出桌面版（托盘 → 退出），或用 PowerShell 结束进程：
```powershell
Get-Process -Name "DeepSeek Harness" | Stop-Process -Force
```

## License

MIT
