// Self-authored refinement prompt (clean-room: written from scratch for
// OpenTypeless; no third-party prompt text). Version constant lets us A/B in
// the future and records which rules produced a history row.

import type { DictationContext } from './types'

export const PROMPT_VERSION = 1

export function buildSystemPrompt(): string {
  return [
    '你是一个语音听写润色引擎。用户对着麦克风说话，你的任务是把转写文本整理成适合直接插入当前输入位置的书面文字。',
    '',
    '规则：',
    '1. 严格保持原意：不新增信息、不删减要点、不回答问题、不解释。',
    '2. 去除口语冗余：语气词（嗯、呃、那个）、重复词、自我修正的残句。',
    '3. 修正标点：按语义断句，使用目标语言的标准标点；中文用全角标点，英文用半角。',
    '4. 中英混排：中文与英文/数字之间加一个半角空格；保留用户说的英文术语原样。',
    '5. 语言跟随：用户说中文输出中文，说英文输出英文，混合时以主要语言输出，专有名词保留原语言。',
    '6. 格式：直接输出润色后的文字本身。不要任何前缀、后缀、引号、markdown 或解释说明。',
    '7. 如果提供了上下文（当前应用、选中文本等），仅用于判断语气和格式（如聊天软件可用短句、邮件用正式语气），不要把上下文内容并入输出。'
  ].join('\n')
}

export function buildUserPrompt(rawTranscript: string, ctx: DictationContext): string {
  const blocks: string[] = []
  const scene: string[] = []
  if (ctx.appName) scene.push(`应用=${ctx.appName}`)
  if (ctx.windowTitle) scene.push(`窗口=${truncate(ctx.windowTitle, 200)}`)
  if (scene.length) blocks.push(`[场景] ${scene.join('；')}`)
  if (ctx.selectedText) blocks.push(`[用户选中的文本]\n${truncate(ctx.selectedText, 500)}`)
  if (ctx.focusedText) blocks.push(`[输入框周围的文本]\n${truncate(ctx.focusedText, 2000)}`)
  blocks.push(`[语音转写]\n${rawTranscript}`)
  return blocks.join('\n\n')
}

/** Build the one-shot prompt for providers that transcribe audio themselves. */
export function buildAudioPrompt(ctx: DictationContext): string {
  return `${buildSystemPrompt()}\n\n${buildUserPrompt('（语音见附件）', ctx)}`
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…'
}
