# OpenTypeless

**开源 AI 语音听写** — 按下快捷键，说话，AI 润色后的文字直接出现在光标处。macOS 优先，自带 API Key（BYO），隐私本地优先。

> 中文用户优先：中英混合听写是我们的第一场景。

## ✨ 特性（v0.1 目标）

- 🎙️ 全局快捷键触发听写（默认 `Ctrl+Cmd+V`，toggle 模式）
- 🧠 上下文感知润色：感知当前 App、窗口标题、选中文本，把口语转成得体的书面文字
- 🔑 BYO API Key：Gemini（一段式）或 OpenAI（转写+润色两段式），密钥 safeStorage 加密存储
- 📜 本地历史记录（SQLite，不上传）
- 🌐 中/英界面

## 📦 安装（macOS Apple Silicon）

> v0.1 尚未发布，以下为发布后路径占位。

1. 从 [Releases](../../releases) 下载 `OpenTypeless-x.x.x-arm64.dmg`
2. 未签名应用：**右键 → 打开**（或 `xattr -cr /Applications/OpenTypeless.app`）
3. 首次运行按引导完成两项授权：麦克风、辅助功能（Accessibility）

## 🔑 获取 API Key

- **Gemini**（推荐）：[Google AI Studio](https://aistudio.google.com/apikey) 免费额度即可用
- **OpenAI**：[Platform](https://platform.openai.com/api-keys)

密钥仅用 macOS Keychain 派生密钥加密后存于本地，任何请求都直接从你的电脑发往所选厂商。

## ⚠️ 已知限制（v0.1）

- 注入依赖「剪贴板 + 模拟 ⌘V」，会覆盖当前剪贴板内容
- 密码框、部分提权应用中注入无效
- Chromium 系浏览器网页内的文本上下文降级为窗口标题

## 🧾 免责声明

OpenTypeless 是独立开源项目，与 Typeless（typeless.com）**无任何关联、赞助或认可**。本项目未使用其任何代码、素材或数据，功能行为均为独立实现（clean-room）。"Typeless" 名称权利归其所有者所有。

## License

MIT
