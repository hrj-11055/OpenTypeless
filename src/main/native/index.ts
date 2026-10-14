// The ONLY module allowed to touch koffi / system frameworks.
// Loads system frameworks by absolute path (asar-proof, zero dylib shipping).
//
// Fn/globe key detection: poll CGEventSourceFlagsState for the SecondaryFn
// flag (verified working 2026-10-14: the bit tracks the physical key exactly).
// Polling needs NO TCC permission. An event-tap approach (needed to also
// CONSUME the key and beat apps like Gemini's Mac client to it) deadlocks
// with koffi's JS callback marshaling on the main runloop thread — deferred
// to a compiled helper in v0.2.
import koffi from 'koffi'

const kCGEventFlagMaskSecondaryFn = 0x800000n

export interface NativeCapabilities {
  coreGraphics: boolean
  fnPolling: boolean
  axTrusted: boolean
}

let capabilities: NativeCapabilities | null = null
let flagsState: (() => number | bigint) | null = null

export function initNative(): NativeCapabilities {
  if (capabilities) return capabilities
  capabilities = { coreGraphics: false, fnPolling: false, axTrusted: false }
  try {
    const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    flagsState = CG.func('uint64_t CGEventSourceFlagsState(uint32_t stateID)') as unknown as () =>
      | number
      | bigint
    capabilities.coreGraphics = true
    capabilities.fnPolling = true
  } catch (err) {
    console.error('[native] CoreGraphics init failed:', err)
  }
  // AX trust matters for M3 context extraction; log it for diagnostics.
  try {
    const HIS = koffi.load(
      '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
    )
    const axTrusted = HIS.func('bool AXIsProcessTrusted()') as unknown as () => boolean
    capabilities.axTrusted = axTrusted()
  } catch {
    /* non-fatal */
  }
  console.log(`[native] capabilities: ${JSON.stringify(capabilities)}`)
  return capabilities
}

export interface FnWatcher {
  start(onToggle: () => void): void
  stop(): void
}

/**
 * Toggles dictation on fn press. Rising edge of the SecondaryFn flag, held
 * for >= 2 consecutive samples (guards against transient flag flicker from
 * other keyboard activity), and re-armed only after a clean release.
 */
export function createFnWatcher(): FnWatcher | null {
  if (!initNative().fnPolling) return null

  const POLL_MS = 30
  const isFnDown = (): boolean => {
    try {
      return (BigInt(flagsState!(0)) & kCGEventFlagMaskSecondaryFn) !== 0n
    } catch {
      return false
    }
  }

  let timer: NodeJS.Timeout | null = null
  let heldStable = false // key is confidently held
  let consecutiveDown = 0
  let lastToggleAt = 0
  let onToggleRef: (() => void) | null = null

  return {
    start(onToggle: () => void): void {
      if (timer) return
      onToggleRef = onToggle
      heldStable = isFnDown()
      timer = setInterval(() => {
        const down = isFnDown()
        if (down) {
          consecutiveDown++
          if (!heldStable && consecutiveDown >= 2) {
            heldStable = true
            const now = Date.now()
            if (now - lastToggleAt > 200) {
              lastToggleAt = now
              console.log('[fn] pressed — toggling dictation')
              onToggleRef?.()
            }
          }
        } else {
          consecutiveDown = 0
          heldStable = false
        }
      }, POLL_MS)
    },
    stop(): void {
      if (timer) clearInterval(timer)
      timer = null
      onToggleRef = null
    }
  }
}
