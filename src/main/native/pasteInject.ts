// Text injection: clipboard + synthetic Cmd+V via CGEvent.
// Requires Accessibility trust (synthetic keyboard events are gated).
import { clipboard } from 'electron'
import koffi from 'koffi'
import { initNative } from './index'

const kVK_ANSI_V = 9
const kCGEventFlagMaskCommand = 0x100000n
const kCGHIDEventTap = 0

let source: unknown = null
let CGEventCreateKeyboardEvent:
  | ((src: unknown, key: number, down: boolean) => unknown)
  | null = null
let CGEventSetFlags: ((ev: unknown, flags: bigint) => void) | null = null
let CGEventPost: ((tap: number, ev: unknown) => void) | null = null
let CFReleaseFn: ((ref: unknown) => void) | null = null

function initInject(): boolean {
  if (source) return true
  if (!initNative().coreGraphics) return false
  try {
    const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const CF = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    koffi.pointer('CGEventSourceRefI', koffi.opaque('CGEventSourceI'))
    koffi.pointer('CGEventRefI', koffi.opaque('CGEventI'))
    koffi.pointer('CFTypeRefI', koffi.opaque('CFTypeI'))
    const CGEventSourceCreate = CG.func(
      'CGEventSourceRefI CGEventSourceCreate(uint32_t stateID)'
    ) as unknown as (stateID: number) => unknown
    CGEventCreateKeyboardEvent = CG.func(
      'CGEventRefI CGEventCreateKeyboardEvent(CGEventSourceRefI source, uint16 virtualKey, bool keyDown)'
    ) as unknown as (src: unknown, key: number, down: boolean) => unknown
    CGEventSetFlags = CG.func('void CGEventSetFlags(CGEventRefI event, uint64_t flags)') as unknown as (
      ev: unknown,
      flags: bigint
    ) => void
    CGEventPost = CG.func('void CGEventPost(uint32_t tap, CGEventRefI event)') as unknown as (
      tap: number,
      ev: unknown
    ) => void
    CFReleaseFn = CF.func('void CFRelease(CFTypeRefI ref)') as unknown as (ref: unknown) => void
    source = CGEventSourceCreate(0) // kCGEventSourceStateCombinedSessionState
    return source !== null
  } catch (err) {
    console.error('[inject] init failed:', err)
    return false
  }
}

function postV(down: boolean): void {
  const ev = CGEventCreateKeyboardEvent!(source, kVK_ANSI_V, down)
  if (!ev) return
  try {
    CGEventSetFlags!(ev, kCGEventFlagMaskCommand) // key-up must carry the flag too
    CGEventPost!(kCGHIDEventTap, ev)
  } finally {
    CFReleaseFn!(ev)
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Write text to clipboard, then synthesize Cmd+V at the current focus. */
export async function injectText(text: string): Promise<boolean> {
  if (!initInject()) return false
  clipboard.writeText(text)
  await sleep(50) // let the pasteboard settle before the event lands
  postV(true)
  await sleep(15)
  postV(false)
  return true
}
