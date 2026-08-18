# DeepSeek Harness Desktop

[![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/Language-中文-red.svg)](README.zh-CN.md)
[![Download](https://img.shields.io/badge/Download-Setup%20exe-brightgreen.svg)](https://github.com/JovanYoung/dsh-desktop2/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A lightweight **Electron shell** that wraps the local [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web interface into a native Windows desktop app.

## Features

- **One-click launch**: double-click to open — boots the local dsh service and pops up the app window automatically
- **Port adaptive**: probes port 3080 first; reuses an already-running dsh service instead of conflicting
- **Single instance**: launching again just focuses the existing window, never spawns duplicates
- **Tray resident**: closing the window minimizes to system tray; only "Exit" in the tray stops the service
- **API key reuse**: reads `DEEPSEEK_API_KEY` from `dsh-start.bat` in the dsh app directory
- **Custom icon**: `afterPack.js` hook injects the app icon and version info at build time

## Requirements

- Windows 10/11 x64
- Node.js 22.19+ (for building)
- A DeepSeek Harness install (path configurable in `config.json`)
- A DeepSeek API key (configure `DEEPSEEK_API_KEY=sk-xxx` in the dsh app's `dsh-start.bat`)

## Download & Install

Download the latest installer from the [Releases page](https://github.com/JovanYoung/dsh-desktop2/releases/latest), run it, and launch "DeepSeek Harness" from your desktop shortcut.

## Build from source

```powershell
npm install          # install dependencies
npx electron .       # dev preview
npm run dist         # package Windows installer (NSIS)
```

Artifacts:
- Installer: `dist\DeepSeek Harness Setup 1.0.0.exe`
- Portable: `dist\win-unpacked\DeepSeek Harness.exe`

> Note: `build.win.signAndEditExecutable: false` is used to skip code signing, avoiding the winCodeSign symlink issue on non-admin Windows.

## Configuration

Local paths are **not hardcoded** in the source (so the public repo never leaks personal info). Copy `config.example.json` to `config.json` (git-ignored) and adjust:

```json
{
  "dshApp": "D:\\dsh-app",
  "dshHome": "D:\\dsh-data",
  "nodeDir": "",
  "port": 3080
}
```

| Field | Default | Description |
|---|---|---|
| `dshApp` | `D:\dsh-app` | dsh app directory |
| `dshHome` | `D:\dsh-data` | dsh data directory |
| `nodeDir` | `''` (use PATH) | Node.js directory for running dsh |
| `port` | `3080` | local service port |

Every field can also be overridden by environment variables (`DSH_APP` / `DSH_HOME` / `DSH_NODE_DIR`).

## Project structure

```
dsh-desktop/
├── main.js              # Electron main process (server boot / window / tray / single instance)
├── package.json         # project config & electron-builder settings
├── afterPack.js         # post-pack hook: inject icon & version info (rcedit)
├── make_icon.py         # icon generation script (Pillow)
├── config.example.json  # config template (copy to config.json; the latter is git-ignored)
├── icon.png / icon.ico
└── tools/               # rcedit-x64.exe (extracted from electron-builder cache, not committed)
```

## FAQ

**Q: Error "dsh service stopped, local service exited unexpectedly (exit code 1)"?**
If port 3080 is already served by another dsh instance, this shell reuses it automatically (port probe built in). This error only appears when the service truly fails to start — check for other dsh instances or port conflicts.

**Q: `d3dcompiler_47.dll: Access is denied` when rebuilding?**
A running desktop app locks the `win-unpacked` directory. Exit the app (tray → Exit) or kill it before rebuilding:
```powershell
Get-Process -Name "DeepSeek Harness" | Stop-Process -Force
```

## License

MIT
