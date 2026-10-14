import { useEffect, useState } from 'react'
import type {
  DictationResultEvent,
  HistoryRowView,
  SettingsView
} from '../../preload/index.d'
import { makeT, type Locale } from './i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type TestState = { running: boolean; ok?: boolean; message?: string }
type Tab = 'settings' | 'history'

export default function App(): React.ReactElement {
  const [view, setView] = useState<SettingsView | null>(null)
  const [tab, setTab] = useState<Tab>('settings')
  const [apiKey, setApiKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [test, setTest] = useState<TestState>({ running: false })
  const [lastResult, setLastResult] = useState<DictationResultEvent | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const t = makeT((view?.locale as Locale) ?? 'zh-CN')

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

  if (!view) return <main className="loading">…</main>

  const providerId = view.providerId
  const conf = view.providerConfig[providerId] ?? {}
  const setConf = (patch: Record<string, string>): void => {
    setView({
      ...view,
      providerConfig: { ...view.providerConfig, [providerId]: { ...conf, ...patch } }
    })
    setSaveState('idle')
  }

  const save = async (extra: Record<string, unknown> = {}): Promise<void> => {
    setSaveState('saving')
    try {
      const next = await window.api.settings.set({
        providerId,
        providerConfig: { [providerId]: { ...conf } },
        ...(apiKey ? { apiKey } : {}),
        ...extra
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

  const errMsg = (key?: string): string => t(`err.${key ?? ''}`) === `err.${key ?? ''}` ? (key ?? '') : t(`err.${key ?? ''}`)

  return (
    <main className="page">
      <header>
        <h1>OpenTypeless</h1>
        <p className="subtitle">{t('app.subtitle', { shortcut: view.shortcut })}</p>
      </header>

      <nav className="tabs">
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
          {t('tab.settings')}
        </button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          {t('tab.history')}
        </button>
      </nav>

      {tab === 'settings' ? (
        <>
          <section className="card">
            <h2>{t('perm.title')}</h2>
            <div className="result-meta">
              <span className={view.axTrusted ? 'ok' : 'err'}>
                {view.axTrusted ? t('perm.ok') : t('perm.no')}
              </span>
              {!view.axTrusted && (
                <button onClick={() => window.api.settings.openAccessibilitySettings()}>
                  {t('perm.go')}
                </button>
              )}
            </div>
          </section>

          <section className="card">
            <h2>{t('ai.title')}</h2>
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
                  <small>{t(`stages.${p.stages}`)}</small>
                </label>
              ))}
            </div>

            {providerId === 'relay' && (
              <Field label={t('ai.relayUrl')} hint={t('ai.relayHint')}>
                <input
                  value={conf.baseUrl ?? ''}
                  placeholder="https://api.example.com/v1"
                  onChange={(e) => setConf({ baseUrl: e.target.value })}
                />
              </Field>
            )}

            {providerId === 'openai' ? (
              <>
                <Field label={t('ai.sttModel')}>
                  <input value={conf.sttModel ?? ''} onChange={(e) => setConf({ sttModel: e.target.value })} />
                </Field>
                <Field label={t('ai.refineModel')}>
                  <input
                    value={conf.refineModel ?? ''}
                    onChange={(e) => setConf({ refineModel: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <Field label={t('ai.model')}>
                <input
                  value={conf.model ?? ''}
                  placeholder={providerId === 'gemini' ? 'gemini-flash-latest' : 'gemini-3.8-flash-high'}
                  onChange={(e) => setConf({ model: e.target.value })}
                />
              </Field>
            )}

            <Field label={t('ai.key')} hint={conf.keyConfigured ? t('ai.keySaved') : undefined}>
              <input
                type="password"
                value={apiKey}
                placeholder={conf.keyConfigured ? t('ai.keySavedPlaceholder') : t('ai.keyPlaceholder')}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </Field>

            <div className="actions">
              <button className="primary" onClick={() => void save()} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? t('ai.saving') : t('ai.save')}
              </button>
              <button onClick={() => void runTest()} disabled={test.running || saveState !== 'saved'}>
                {test.running ? t('ai.testing') : t('ai.test')}
              </button>
              {saveState === 'saved' && <span className="ok">{t('ai.saved')}</span>}
              {saveState === 'error' && <span className="err">{t('ai.saveFailed')}</span>}
              {test.ok === true && <span className="ok">{t('ai.testOk')}</span>}
              {test.ok === false && <span className="err">{errMsg(test.message)}</span>}
            </div>
          </section>

          <section className="card">
            <h2>{t('tab.settings')}</h2>
            <Field label={t('settings.language')}>
              <select
                value={view.locale}
                onChange={(e) => {
                  const locale = e.target.value as Locale
                  setView({ ...view, locale })
                  void save({ locale })
                }}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={t('settings.shortcut')} hint={t('settings.shortcutHint')}>
              <input
                defaultValue={view.shortcut}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== view.shortcut) void save({ shortcut: v })
                }}
              />
            </Field>
          </section>

          <section className="card">
            <h2>{t('result.title')}</h2>
            {lastError && <p className="err">{t('result.failed', { msg: errMsg(lastError) })}</p>}
            {lastResult ? (
              <div className="result">
                <p className="refined">{lastResult.refinedText}</p>
                {lastResult.rawTranscript && (
                  <p className="raw">{t('result.raw', { text: lastResult.rawTranscript })}</p>
                )}
                <div className="result-meta">
                  <span>{lastResult.modelsUsed.join(' + ')}</span>
                  <button onClick={() => void navigator.clipboard.writeText(lastResult.refinedText)}>
                    {t('result.copy')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty">{t('result.empty', { shortcut: view.shortcut })}</p>
            )}
          </section>
        </>
      ) : (
        <HistoryPanel t={t} />
      )}
    </main>
  )
}

function HistoryPanel(props: { t: (k: string, v?: Record<string, string>) => string }): React.ReactElement {
  const { t } = props
  const [rows, setRows] = useState<HistoryRowView[] | null>(null)
  const [q, setQ] = useState('')

  const refresh = (query: string): void => {
    void window.api.settings.history.list({ q: query || undefined, limit: 100 }).then(setRows)
  }
  useEffect(() => refresh(''), [])

  return (
    <section className="card">
      <div className="history-toolbar">
        <input
          className="search"
          placeholder={t('history.search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            refresh(e.target.value)
          }}
        />
        <button
          onClick={() => {
            void window.api.settings.history.clear().then(() => refresh(''))
          }}
        >
          {t('history.clear')}
        </button>
      </div>
      {rows === null ? (
        <p className="empty">…</p>
      ) : rows.length === 0 ? (
        <p className="empty">{t('history.empty')}</p>
      ) : (
        <ul className="history-list">
          {rows.map((r) => (
            <li key={r.id} className={r.status === 'error' ? 'err-row' : ''}>
              <div className="history-main">
                {r.status === 'error' ? (
                  <span className="err">
                    {t('history.error')}: {r.error_msg}
                  </span>
                ) : (
                  <span className="refined">{r.refined_text}</span>
                )}
              </div>
              <div className="history-meta">
                <span>
                  {r.created_at} · {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ''} ·{' '}
                  {r.focused_app_name ?? ''}
                </span>
                <span className="history-actions">
                  {r.refined_text && (
                    <button onClick={() => void navigator.clipboard.writeText(r.refined_text!)}>
                      {t('history.copy')}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      void window.api.settings.history.remove(r.id).then(() => refresh(q))
                    }}
                  >
                    {t('history.delete')}
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
