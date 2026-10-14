import { useEffect, useState } from 'react'
import type { DictationResultEvent, SettingsView } from '../../preload/index.d'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type TestState = { running: boolean; ok?: boolean; message?: string }

export default function App(): React.ReactElement {
  const [view, setView] = useState<SettingsView | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [test, setTest] = useState<TestState>({ running: false })
  const [lastResult, setLastResult] = useState<DictationResultEvent | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.settings.get().then(setView)
    const offResult = window.api.settings.onDictationResult((r) => {
      setLastResult(r)
      setLastError(null)
    })
    const offError = window.api.settings.onDictationError((e) => setLastError(e.message))
    return () => {
      offResult()
      offError()
    }
  }, [])

  if (!view) return <main className="loading">加载中…</main>

  const providerId = view.providerId
  const conf = view.providerConfig[providerId] ?? {}
  const setConf = (patch: Record<string, string>): void => {
    setView({
      ...view,
      providerConfig: {
        ...view.providerConfig,
        [providerId]: { ...conf, ...patch }
      }
    })
    setSaveState('idle')
  }

  const save = async (): Promise<void> => {
    setSaveState('saving')
    try {
      const next = await window.api.settings.set({
        providerId,
        providerConfig: { [providerId]: { ...conf } },
        ...(apiKey ? { apiKey } : {})
      })
      setView(next)
      setApiKey('')
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  const runTest = async (): Promise<void> => {
    setTest({ running: true })
    const r = await window.api.settings.testProvider()
    setTest({ running: false, ...r })
  }

  return (
    <main className="page">
      <header>
        <h1>OpenTypeless</h1>
        <p className="subtitle">开源 AI 语音听写 · 按 Fn 或 {view.shortcut} 开始</p>
      </header>

      <section className="card">
        <h2>AI 服务</h2>
        <div className="providers">
          {view.providers.map((p) => (
            <label key={p.id} className={`provider ${providerId === p.id ? 'active' : ''}`}>
              <input
                type="radio"
                name="provider"
                checked={providerId === p.id}
                onChange={() => {
                  setView({ ...view, providerId: p.id })
                  setSaveState('idle')
                  setTest({ running: false })
                }}
              />
              <span>{p.label}</span>
              <small>{p.stages === 1 ? '一段式' : '两段式'}</small>
            </label>
          ))}
        </div>

        {providerId === 'relay' && (
          <Field label="中转地址 Base URL" hint="OpenAI 兼容接口，如 https://api.example.com/v1">
            <input
              value={conf.baseUrl ?? ''}
              placeholder="https://api.example.com/v1"
              onChange={(e) => setConf({ baseUrl: e.target.value })}
            />
          </Field>
        )}

        {providerId === 'openai' ? (
          <>
            <Field label="转写模型">
              <input value={conf.sttModel ?? ''} onChange={(e) => setConf({ sttModel: e.target.value })} />
            </Field>
            <Field label="润色模型">
              <input
                value={conf.refineModel ?? ''}
                onChange={(e) => setConf({ refineModel: e.target.value })}
              />
            </Field>
          </>
        ) : (
          <Field label="模型">
            <input
              value={conf.model ?? ''}
              placeholder={providerId === 'gemini' ? 'gemini-2.5-flash' : 'gemini-3.8-flash-high'}
              onChange={(e) => setConf({ model: e.target.value })}
            />
          </Field>
        )}

        <Field
          label="API Key"
          hint={conf.keyConfigured ? '已加密保存（输入框留空则保持不变）' : undefined}
        >
          <input
            type="password"
            value={apiKey}
            placeholder={conf.keyConfigured ? '••••••••（已保存）' : 'sk-…'}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>

        <div className="actions">
          <button className="primary" onClick={() => void save()} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? '保存中…' : '保存'}
          </button>
          <button onClick={() => void runTest()} disabled={test.running || saveState !== 'saved'}>
            {test.running ? '测试中…' : '测试连接'}
          </button>
          {saveState === 'saved' && <span className="ok">已保存 ✓</span>}
          {saveState === 'error' && <span className="err">保存失败</span>}
          {test.ok === true && <span className="ok">连接正常 ✓</span>}
          {test.ok === false && <span className="err">{testMessage(test.message)}</span>}
        </div>
      </section>

      <section className="card">
        <h2>最近一次听写</h2>
        {lastError && <p className="err">听写失败：{testMessage(lastError)}</p>}
        {lastResult ? (
          <div className="result">
            <p className="refined">{lastResult.refinedText}</p>
            {lastResult.rawTranscript && <p className="raw">原始：{lastResult.rawTranscript}</p>}
            <div className="result-meta">
              <span>{lastResult.modelsUsed.join(' + ')}</span>
              <button onClick={() => void navigator.clipboard.writeText(lastResult.refinedText)}>
                复制
              </button>
            </div>
          </div>
        ) : (
          <p className="empty">还没有听写记录。按 Fn 或 {view.shortcut} 开始你的第一次听写。</p>
        )}
      </section>
    </main>
  )
}

function Field(props: {
  label: string
  hint?: string
  children: React.ReactElement
}): React.ReactElement {
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      {props.children}
      {props.hint && <small className="hint">{props.hint}</small>}
    </label>
  )
}

function testMessage(key?: string): string {
  const map: Record<string, string> = {
    'settings.err.noKey': '请先填写 API Key 并保存',
    'settings.err.noBaseUrl': '请填写中转地址',
    'settings.err.noModel': '请填写模型名',
    'err.apiKeyRejected': 'Key 被拒绝（401/403）',
    'err.rateLimited': '请求过于频繁（429）',
    'err.network': '网络错误',
    'err.emptyResult': '模型返回为空',
    'err.badResponse': '响应格式异常',
    'settings.err.noProvider': '未找到 AI 服务配置'
  }
  if (key && map[key]) return map[key]
  return key?.replace(/^err\.http\./, 'HTTP ') ?? '未知错误'
}
