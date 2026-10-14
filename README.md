# OpenTypeless

**开源 AI 语音听写** — 按 Fn，说话，润色后的文字直接出现在光标处。macOS（Apple Silicon）优先，自带 API Key（BYO），无遥测，无账号。

> 中文用户优先：中英混合听写与润色是第一场景。

```
按 Fn → 说话 → 再按 Fn → 几秒后，文字已注入你的光标位置
```

## ✨ 特性

- 🎙️ **Fn 键触发**（微信输入法同款体感），toggle 模式，零权限实现；`Ctrl+Cmd+V` 作为备用快捷键
- 🧠 **上下文感知**（辅助功能权限）：感知当前 App、窗口标题、**你选中的文字**、输入框内容
- 🪄 **指令模式**：选中一段文字说「翻译成英文」「改写得更礼貌」，直接执行并注入结果
- 🔑 **BYO API Key**，三通道任选：
  - **自定义中转**（一段式）：任意 OpenAI 兼容中转站（one-api/new-api 系），Gemini 等多模态模型直传音频
  - **Gemini 官方**（一段式）：AI Studio key，音频直出润色文本
  - **OpenAI 官方**（两段式）：whisper 转写 → GPT 润色
- 🔒 密钥用 macOS Keychain 派生密钥加密存储（safeStorage），永不出现在日志与历史库
- 📜 **本地历史**（SQLite），支持搜索/复制/删除，音频不上传不保存
- 🌐 中 / 英界面

## 📦 安装（macOS Apple Silicon，未签名）

1. 从 [Releases](../../releases) 下载 `OpenTypeless-0.1.0-arm64.dmg`
2. 拖入 Applications 后**右键 → 打开**（未签名应用首次需这样绕过 Gatekeeper；或终端执行 `xattr -cr /Applications/OpenTypeless.app`）
3. 首次使用需授权 **麦克风** 与 **辅助功能**（见下）

## 🔑 获取 API Key

| 通道 | 入口 | 说明 |
|------|------|------|
| 自定义中转 | 你自己的 one-api / new-api | 国内推荐；模型需支持音频输入（如 Gemini 系）|
| Gemini 官方 | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 注意部分区域为预付费制 |
| OpenAI 官方 | [platform.openai.com](https://platform.openai.com/api-keys) | 两段式，whisper + chat |

在设置页填入即可，「测试连接」会真实调用一次验证。

## ⚙️ 权限说明（一次性）

| 权限 | 用途 | 不授权的后果 |
|------|------|-------------|
| 麦克风 | 录音 | 无法使用 |
| 辅助功能 | 读选中文字/上下文 + 模拟 ⌘V 注入 | 退化为纯听写：结果复制到剪贴板并弹通知 |
| 输入监控 | （Fn 轮询方案不需要）| — |

系统设置路径：`系统设置 → 隐私与安全性 → 辅助功能/麦克风`。开发模式（npm run dev）下身份显示为 **Electron**，与打包版分别授权。

## ⚠️ 已知限制（v0.1）

- **延迟**：整段上传架构，停止后约 5-9 秒出结果（取决于服务商固定开销）；流式分块在 v0.2
- **Fn 键竞争**：如果你的 Gemini 客户端等应用也注册了 Fn 唤醒，会同时触发（v0.1 无法独占；可在对方应用里关闭其 Fn 快捷键）
- 注入依赖「剪贴板 + 模拟 ⌘V」，会覆盖剪贴板内容；密码框/提权应用中无效
- **隐私**：上下文（含选中文本）会发送给你配置的 AI 服务商——这正是润色的原理。文档含密码时请留意（打码功能规划在 v0.2）
- Chromium 系浏览器网页内的文本上下文降级为窗口标题

## 🛠️ 开发

```bash
npm install
npm run dev        # 开发模式（userData 带 -dev 后缀隔离）
npm test           # vitest 单测
npm run build:mac  # dmg 打包（arm64，未签名）
```

技术栈：Electron + electron-vite + React + TypeScript；原生能力（Fn 轮询 / AX 上下文 / CGEvent 注入）全部通过 koffi FFI 直调系统框架，零自编译原生库。架构约束见 [CLAUDE.md](CLAUDE.md)。

## 🗺️ Roadmap

- v0.2：流式分块上传（低延迟）、本地 whisper.cpp 转写、密码打码、press-to-talk、剪贴板恢复、悬浮条
- v0.3+：翻译/Ask 模式、词典、Windows/Linux

## 🧾 免责声明

OpenTypeless 是独立开源项目，与 Typeless（typeless.com）**无任何关联、赞助或认可**。本项目未使用其任何代码、素材或数据，所有功能为独立实现（clean-room）。"Typeless" 名称权利归其所有者所有。

## License

MIT
