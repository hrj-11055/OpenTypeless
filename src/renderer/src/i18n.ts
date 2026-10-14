// Minimal i18n: locale string + flat dictionary. zh-CN default.
export type Locale = 'zh-CN' | 'en'

type Dict = Record<string, string>

const zh: Dict = {
  'app.subtitle': '按 Fn 或 {shortcut} 开始',
  'tab.settings': '设置',
  'tab.history': '历史',
  'perm.title': '权限',
  'perm.ok': '辅助功能 ✓（上下文感知与文字注入已启用）',
  'perm.no': '辅助功能未授权：仅纯听写，无上下文感知，结果只复制到剪贴板',
  'perm.go': '去授权',
  'ai.title': 'AI 服务',
  'ai.relayUrl': '中转地址 Base URL',
  'ai.relayHint': 'OpenAI 兼容接口，如 https://api.example.com/v1',
  'ai.sttModel': '转写模型',
  'ai.refineModel': '润色模型',
  'ai.model': '模型',
  'ai.key': 'API Key',
  'ai.keySaved': '已加密保存（输入框留空则保持不变）',
  'ai.keyPlaceholder': 'sk-…',
  'ai.keySavedPlaceholder': '••••••••（已保存）',
  'ai.save': '保存',
  'ai.saving': '保存中…',
  'ai.test': '测试连接',
  'ai.testing': '测试中…',
  'ai.saved': '已保存 ✓',
  'ai.saveFailed': '保存失败',
  'ai.testOk': '连接正常 ✓',
  'stages.1': '一段式',
  'stages.2': '两段式',
  'result.title': '最近一次听写',
  'result.empty': '还没有听写记录。按 Fn 或 {shortcut} 开始你的第一次听写。',
  'result.raw': '原始：{text}',
  'result.copy': '复制',
  'result.failed': '听写失败：{msg}',
  'history.empty': '暂无历史记录',
  'history.search': '搜索听写内容…',
  'history.clear': '清空',
  'history.delete': '删除',
  'history.error': '失败',
  'history.copy': '复制',
  'settings.language': '界面语言',
  'settings.shortcut': '备用快捷键',
  'settings.shortcutHint': 'Electron 快捷键格式，如 Control+Command+V',
  'err.settings.err.noKey': '请先填写 API Key 并保存',
  'err.settings.err.noBaseUrl': '请填写中转地址',
  'err.settings.err.noModel': '请填写模型名',
  'err.err.apiKeyRejected': 'Key 被拒绝（401/403）',
  'err.err.rateLimited': '请求过于频繁（429）',
  'err.err.network': '网络错误',
  'err.err.emptyResult': '模型返回为空',
  'err.err.badResponse': '响应格式异常',
  'err.settings.err.noProvider': '未找到 AI 服务配置'
}

const en: Dict = {
  'app.subtitle': 'Press Fn or {shortcut} to start',
  'tab.settings': 'Settings',
  'tab.history': 'History',
  'perm.title': 'Permissions',
  'perm.ok': 'Accessibility ✓ (context awareness & injection enabled)',
  'perm.no': 'Accessibility not granted: plain dictation only, results copied to clipboard',
  'perm.go': 'Open Settings',
  'ai.title': 'AI Provider',
  'ai.relayUrl': 'Base URL',
  'ai.relayHint': 'OpenAI-compatible endpoint, e.g. https://api.example.com/v1',
  'ai.sttModel': 'Transcription model',
  'ai.refineModel': 'Refine model',
  'ai.model': 'Model',
  'ai.key': 'API Key',
  'ai.keySaved': 'Encrypted (leave empty to keep)',
  'ai.keyPlaceholder': 'sk-…',
  'ai.keySavedPlaceholder': '•••••••• (saved)',
  'ai.save': 'Save',
  'ai.saving': 'Saving…',
  'ai.test': 'Test',
  'ai.testing': 'Testing…',
  'ai.saved': 'Saved ✓',
  'ai.saveFailed': 'Save failed',
  'ai.testOk': 'Connection OK ✓',
  'stages.1': 'one-shot',
  'stages.2': 'two-stage',
  'result.title': 'Last dictation',
  'result.empty': 'No dictation yet. Press Fn or {shortcut} to start.',
  'result.raw': 'Raw: {text}',
  'result.copy': 'Copy',
  'result.failed': 'Dictation failed: {msg}',
  'history.empty': 'No history yet',
  'history.search': 'Search dictations…',
  'history.clear': 'Clear',
  'history.delete': 'Delete',
  'history.error': 'failed',
  'history.copy': 'Copy',
  'settings.language': 'Language',
  'settings.shortcut': 'Fallback shortcut',
  'settings.shortcutHint': 'Electron accelerator, e.g. Control+Command+V',
  'err.settings.err.noKey': 'Enter your API key and save first',
  'err.settings.err.noBaseUrl': 'Base URL is required',
  'err.settings.err.noModel': 'Model name is required',
  'err.err.apiKeyRejected': 'Key rejected (401/403)',
  'err.err.rateLimited': 'Rate limited (429)',
  'err.err.network': 'Network error',
  'err.err.emptyResult': 'Empty model response',
  'err.err.badResponse': 'Malformed response',
  'err.settings.err.noProvider': 'No provider configured'
}

const dicts: Record<Locale, Dict> = { 'zh-CN': zh, en }

export function makeT(locale: Locale) {
  return (key: string, vars?: Record<string, string>): string => {
    let s = dicts[locale][key] ?? dicts['zh-CN'][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
    }
    return s
  }
}
