# OpenTypeless

开源 AI 语音听写（macOS，Electron + React + TS，BYO API key）。

## 架构铁律（任何改动不得违反）

1. `src/main/native/` 是全项目**唯一**允许 `koffi` / `osascript` / 原生调用的模块。renderer 零原生依赖；数据库、密钥、网络请求全部在 main 进程。
2. API key 明文只存在于 main 进程内存与 safeStorage 密文中：不回传 renderer、不写日志、不进历史库。
3. `intel/` 目录（逆向研究资料）**永不入库**（.gitignore + CI guard 双保险），代码中不得引用其任何内容。

## 约定

- Git：conventional commits（feat/fix/chore/docs/refactor），里程碑打 tag（v0.0.x → v0.1.0）
- electron / koffi / better-sqlite3 版本精确 pin，不用 `^`（原生模块 ABI 敏感）
- 依赖白名单：electron、react、koffi、better-sqlite3、drizzle-orm、drizzle-kit、vitest、tailwindcss——其余能力手写（fetch/i18n/打包脚本），不引厂商 SDK，无遥测
- 模型 ID 可配置，默认值以官方 models 文档为准（注释标明核实日期）
- 单测：`npm run test`（vitest，纯逻辑单测；native 层由手测矩阵覆盖，不进 CI）

## 结构速览

```
src/main/        主进程：windows/ native/ providers/ settings/ db/ + orchestrator 状态机
src/preload/     contextBridge 类型化 IPC（channel 常量与两窗口共享类型）
src/renderer/    settings.html（React 设置/历史）+ capture.html（隐藏录音窗）
tests/unit/      vitest 单测
```
