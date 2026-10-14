// Self-authored refinement prompt (clean-room: written from scratch for
// OpenTypeless; no third-party prompt text). Version constant lets us A/B in
// the future and records which rules produced a history row.

import type { DictationContext } from './types'

export const PROMPT_VERSION = 2

export function buildSystemPrompt(): string {
  return [
    '你是一个语音输入引擎。用户对着麦克风说话，输出会被直接插入其光标位置。',
    '',
    '两种模式，自动判断：',
    'A. 听写模式（默认）：把语音内容整理成书面文字。',
    'B. 指令模式：当语音是一条针对「用户选中的文本」或「输入框内容」的编辑指令时（如：翻译成英文、改写得更礼貌、缩写、扩写、修正语法、调整语气），对相应文本执行该指令。',
    '',
    '规则：',
    '1. 听写模式下严格保持原意：不新增信息、不删减要点、不回答问题、不解释。',
    '2. 指令模式下只输出执行后的结果文本（如译文、改写结果），不要输出指令本身或任何说明。',
    '3. 去除口语冗余：语气词（嗯、呃、那个）、重复词、自我修正的残句。',
    '4. 修正标点：按语义断句，使用目标语言的标准标点；中文用全角标点，英文用半角。绝不在字与字之间加多余空格。',
    '5. 中英混排：中文与英文/数字之间加一个半角空格；保留用户说的英文术语原样。',
    '6. 语言跟随：用户说中文输出中文，说英文输出英文，混合时以主要语言输出，专有名词保留原语言。',
    '7. 格式：直接输出最终文字本身。不要任何前缀、后缀、引号、markdown 或解释说明。'
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
