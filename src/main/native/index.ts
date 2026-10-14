// The ONLY module allowed to touch koffi / system frameworks.
// Loads system frameworks by absolute path (asar-proof, zero dylib shipping).
//
// Fn/globe key detection: CGEventTap (listen-only, flagsChanged) — the same
// mechanism input methods use. Requires the Input Monitoring TCC permission;
// without it the tap creates fine but receives nothing (silent macOS
// behavior), which we detect via CGEventTapIsEnabled.
import koffi from 'koffi'
import { Notification } from 'electron'

const kVK_Function = 63 // kVK_Function (fn / globe key)
const kCGEventFlagMaskSecondaryFn = 0x800000n
const kCGEventFlagsChanged = 12
const kCGKeyboardEventKeycode = 9
const kCGSessionEventTap = 1
const kCGHeadInsertEventTap = 0
const kCGEventTapOptionListenOnly = 1
const kCFStringEncodingUTF8 = 0x08000100

export interface NativeCapabilities {
  coreGraphics: boolean
  fnTap: boolean
  fnTapEnabled: boolean
}

let capabilities: NativeCapabilities | null = null

let CGEventGetFlags:
  | ((event: unknown) => number | bigint)
  | null = null
let CGEventGetIntegerValueField: ((event: unknown, field: number) => number | bigint) | null = null

export function initNative(): NativeCapabilities {
  if (capabilities) return capabilities
  capabilities = { coreGraphics: false, fnTap: false, fnTapEnabled: false }
  try {
    const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    koffi.pointer('CGEventRefNat', koffi.opaque('CGEventNat'))
    CGEventGetFlags = CG.func('uint64_t CGEventGetFlags(CGEventRefNat event)') as unknown as (
      event: unknown
    ) => number | bigint
    CGEventGetIntegerValueField = CG.func(
      'int64_t CGEventGetIntegerValueField(CGEventRefNat event, uint32_t field)'
    ) as unknown as (event: unknown, field: number) => number | bigint
    capabilities.coreGraphics = true
  } catch (err) {
    console.error('[native] CoreGraphics init failed:', err)
  }
  console.log(`[native] capabilities: ${JSON.stringify(capabilities)}`)
  return capabilities
}

export interface FnWatcher {
  start(onToggle: () => void): void
  stop(): void
}

/**
 * Toggles dictation on fn press (rising edge of the SecondaryFn flag).
 * Runs on Electron's main runloop; koffi marshals the C callback onto the
 * JS main thread.
 */
export function createFnWatcher(): FnWatcher | null {
  if (!initNative().coreGraphics) return null
  try {
    const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const CF = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

    koffi.pointer('CFStringRefNat', koffi.opaque('CFStringNat'))
    koffi.pointer('CFRunLoopRefNat', koffi.opaque('CFRunLoopNat'))
    koffi.pointer('CFRunLoopSourceRefNat', koffi.opaque('CFRunLoopSourceNat'))
    koffi.pointer('CFMachPortRefNat', koffi.opaque('CFMachPortNat'))

    const CFStringCreateWithCString = CF.func(
      'CFStringRefNat CFStringCreateWithCString(void *allocator, const char *cStr, uint32_t encoding)'
    ) as unknown as (alloc: unknown, s: string, enc: number) => unknown
    const CFRunLoopGetMain = CF.func('CFRunLoopRefNat CFRunLoopGetMain()') as unknown as () => unknown
    const CFMachPortCreateRunLoopSource = CF.func(
      'CFRunLoopSourceRefNat CFMachPortCreateRunLoopSource(void *allocator, CFMachPortRefNat port, int order)'
    ) as unknown as (alloc: unknown, port: unknown, order: number) => unknown
    const CFRunLoopAddSource = CF.func(
      'void CFRunLoopAddSource(CFRunLoopRefNat rl, CFRunLoopSourceRefNat source, CFStringRefNat mode)'
    ) as unknown as (rl: unknown, source: unknown, mode: unknown) => void
    const CGEventTapCreate = CG.func(
      'void *CGEventTapCreate(uint32_t tap, uint32_t place, uint32_t options, uint64_t mask, void *callback, void *userInfo)'
    ) as unknown as (
      tap: number,
      place: number,
      options: number,
      mask: bigint,
      cb: unknown,
      userInfo: unknown
    ) => unknown
    const CGEventTapIsEnabled = CG.func('bool CGEventTapIsEnabled(void *tap)') as unknown as (
      tap: unknown
    ) => boolean
    const CGEventTapEnable = CG.func('void CGEventTapEnable(void *tap, bool enabled)') as unknown as (
      tap: unknown,
      enabled: boolean
    ) => void

    let fnHeld = false
    let lastToggleAt = 0
    let onToggleRef: (() => void) | null = null
    const tapProto = koffi.proto(
      'CGEventRefNat tapCallbackNat(void *proxy, uint32_t type, CGEventRefNat event, void *userInfo)'
    )
    const cb = koffi.register(
      (_proxy: unknown, type: number, event: unknown) => {
        try {
          if (type !== kCGEventFlagsChanged || !event) return null
          const kc = Number(CGEventGetIntegerValueField!(event, kCGKeyboardEventKeycode))
          if (kc !== kVK_Function) return null
          const down = (BigInt(CGEventGetFlags!(event)) & kCGEventFlagMaskSecondaryFn) !== 0n
          if (down !== fnHeld) {
            fnHeld = down
            const now = Date.now()
            if (down && now - lastToggleAt > 200) {
              lastToggleAt = now
              console.log('[fn] pressed — toggling dictation')
              onToggleRef?.()
            }
          }
        } catch (err) {
          console.error('[fn] callback error:', err)
        }
        return null
      },
      koffi.pointer(tapProto)
    )

    const tap = CGEventTapCreate(
      kCGSessionEventTap,
      kCGHeadInsertEventTap,
      kCGEventTapOptionListenOnly,
      BigInt(1) << BigInt(kCGEventFlagsChanged),
      cb,
      null
    )
    if (!tap) {
      console.log('[fn] tap create failed (permission denied?)')
      notifyPermission()
      return null
    }
    CGEventTapEnable(tap, true)
    let enabled = false
    try {
      enabled = CGEventTapIsEnabled(tap)
    } catch {
      enabled = true // probe unsupported; assume on
    }
    console.log(`[fn] tap created, enabled=${enabled}`)
    if (!enabled) notifyPermission()

    const commonModes = CFStringCreateWithCString(null, 'kCFRunLoopCommonModes', kCFStringEncodingUTF8)
    const source = CFMachPortCreateRunLoopSource(null, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, commonModes)

    return {
      start(onToggle: () => void): void {
        onToggleRef = onToggle
      },
      stop(): void {
        onToggleRef = null
      }
    }
  } catch (err) {
    console.error('[fn] watcher init failed:', err)
    return null
  }
}

function notifyPermission(): void {
  new Notification({
    title: 'OpenTypeless 需要「输入监控」权限',
    body: '到 系统设置 → 隐私与安全性 → 输入监控，允许 OpenTypeless（开发模式显示为 Electron），然后重启应用即可用 Fn 键触发听写'
  }).show()
}
