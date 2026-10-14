import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, buildAudioPrompt, PROMPT_VERSION } from '../../src/main/providers/prompt'

describe('prompt builder', () => {
  it('system prompt forbids answering and requires plain output', () => {
    const sys = buildSystemPrompt()
    expect(sys).toContain('不回答问题')
    expect(sys).toContain('不要任何前缀')
    expect(sys).toContain('中英混排')
  })

  it('user prompt includes context blocks in order and the transcript', () => {
    const p = buildUserPrompt('今天开会', {
      appName: '备忘录',
      windowTitle: '购物清单',
      selectedText: '买牛奶',
      focusedText: '',
      localeHint: 'zh'
    })
    const idxScene = p.indexOf('[场景]')
    const idxSel = p.indexOf('[用户选中的文本]')
    const idxTr = p.indexOf('[语音转写]')
    expect(idxScene).toBeGreaterThan(-1)
    expect(idxSel).toBeGreaterThan(idxScene)
    expect(idxTr).toBeGreaterThan(idxSel)
    expect(p).toContain('今天开会')
    expect(p).toContain('备忘录')
    expect(p).toContain('买牛奶')
  })

  it('omits absent context blocks entirely', () => {
    const p = buildUserPrompt('hello', { localeHint: 'en' })
    expect(p).not.toContain('[场景]')
    expect(p).not.toContain('[用户选中的文本]')
    expect(p).toContain('hello')
  })

  it('truncates over-long context values', () => {
    const p = buildUserPrompt('x', {
      selectedText: 'a'.repeat(600),
      localeHint: 'auto'
    })
    expect(p).toContain('…')
    expect(p.length).toBeLessThan(900)
  })

  it('audio prompt embeds the system prompt for one-shot providers', () => {
    const p = buildAudioPrompt({ localeHint: 'auto' })
    expect(p).toContain(buildSystemPrompt())
    expect(p).toContain('（语音见附件）')
    expect(PROMPT_VERSION).toBe(1)
  })
})
