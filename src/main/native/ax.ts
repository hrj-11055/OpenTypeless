// macOS Accessibility (AX) C API via koffi — context extraction.
// Route B (universal): AXUIElementCreateSystemWide + AXFocusedUIElement
// attribute, because AXUIElementCopySystemFocusedElement is no longer
// exported on this macOS (verified by symbol scan 2026-10-14).
import koffi from 'koffi'

const kCFStringEncodingUTF8 = 0x08000100

let inited = false
let AXUIElementCopyAttributeValue:
  | ((element: unknown, attr: unknown, out: unknown[]) => number)
  | null = null
let AXUIElementGetPid: ((element: unknown, out: unknown[]) => number) | null = null
let systemWide: unknown = null
let CFRelease: ((ref: unknown) => void) | null = null
let CFGetTypeID: ((ref: unknown) => number | bigint) | null = null
let CFStringGetTypeID: (() => number | bigint) | null = null
let CFStringCreateWithCString:
  | ((alloc: unknown, s: string, enc: number) => unknown)
  | null = null
let CFStringGetCStringPtr: ((s: unknown, enc: number) => unknown) | null = null
let CFStringGetCString:
  | ((s: unknown, buf: unknown, size: number, enc: number) => boolean)
  | null = null

const attrCache = new Map<string, unknown>()

export function initAx(): boolean {
  if (inited) return AXUIElementCopyAttributeValue !== null
  inited = true
  try {
    const AS = koffi.load(
      '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
    )
    const CF = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

    koffi.pointer('AXUIElementRefC', koffi.opaque('AXUIElementC'))
    koffi.pointer('CFStringRefC', koffi.opaque('CFStringC'))
    koffi.pointer('CFTypeRefC', koffi.opaque('CFTypeC'))

    const AXUIElementCreateSystemWide = AS.func(
      'AXUIElementRefC AXUIElementCreateSystemWide()'
    ) as unknown as () => unknown
    AXUIElementCopyAttributeValue = AS.func(
      'int32_t AXUIElementCopyAttributeValue(AXUIElementRefC element, CFStringRefC attribute, _Out_ CFTypeRefC *value)'
    ) as unknown as (element: unknown, attr: unknown, out: unknown[]) => number
    AXUIElementGetPid = AS.func(
      'int32_t AXUIElementGetPid(AXUIElementRefC element, _Out_ int32_t *pid)'
    ) as unknown as (element: unknown, out: unknown[]) => number
    CFRelease = CF.func('void CFRelease(CFTypeRefC ref)') as unknown as (ref: unknown) => void
    CFGetTypeID = CF.func('uint64_t CFGetTypeID(CFTypeRefC cf)') as unknown as (
      ref: unknown
    ) => number | bigint
    CFStringGetTypeID = CF.func('uint64_t CFStringGetTypeID()') as unknown as () => number | bigint
    CFStringCreateWithCString = CF.func(
      'CFStringRefC CFStringCreateWithCString(void *allocator, const char *cStr, uint32_t encoding)'
    ) as unknown as (alloc: unknown, s: string, enc: number) => unknown
    CFStringGetCStringPtr = CF.func(
      'const char *CFStringGetCStringPtr(CFStringRefC str, uint32_t encoding)'
    ) as unknown as (s: unknown, enc: number) => unknown
    CFStringGetCString = CF.func(
      'bool CFStringGetCString(CFStringRefC str, _Out_ char *buffer, long bufSize, uint32_t encoding)'
    ) as unknown as (s: unknown, buf: unknown, size: number, enc: number) => boolean

    systemWide = AXUIElementCreateSystemWide()
    console.log(`[ax] init ok, systemWide=${systemWide ? 'yes' : 'NULL'}`)
    return systemWide !== null
  } catch (err) {
    console.error('[ax] init failed:', err)
    return false
  }
}

function attr(name: string): unknown {
  let a = attrCache.get(name)
  if (!a) {
    a = CFStringCreateWithCString!(null, name, kCFStringEncodingUTF8)
    attrCache.set(name, a)
  }
  return a
}

function isCFString(ref: unknown): boolean {
  try {
    return BigInt(CFGetTypeID!(ref)) === BigInt(CFStringGetTypeID!())
  } catch {
    return false
  }
}

function cfStringToJs(ref: unknown): string | null {
  if (!ref) return null
  const direct = CFStringGetCStringPtr!(ref, kCFStringEncodingUTF8)
  if (direct) {
    try {
      return koffi.decode(direct, 'char', -1)
    } catch {
      /* fall through to slow path */
    }
  }
  const buf = koffi.alloc('char', 65536)
  if (CFStringGetCString!(ref, buf, 65536, kCFStringEncodingUTF8)) {
    try {
      return koffi.decode(buf, 'char', -1)
    } catch {
      return null
    }
  }
  return null
}

function getStringAttribute(element: unknown, name: string): string | null {
  const out = [null]
  const rc = AXUIElementCopyAttributeValue!(element, attr(name), out)
  if (rc !== 0 || !out[0]) return null
  const value = out[0]
  try {
    if (isCFString(value)) return cfStringToJs(value)
    return null // non-string attribute (e.g. AXValue ranges): skip, don't crash
  } finally {
    CFRelease!(value)
  }
}

function getElementAttribute(element: unknown, name: string): unknown {
  const out = [null]
  const rc = AXUIElementCopyAttributeValue!(element, attr(name), out)
  if (rc !== 0 || !out[0]) return null
  return out[0] // caller must CFRelease
}

export interface FocusedContext {
  role?: string
  title?: string
  value?: string // focused element's text content (if a plain string)
  selectedText?: string
  windowTitle?: string
  pid?: number
}

/** Read everything we can about the focused UI element. Best-effort, never throws. */
export function readFocusedContext(): FocusedContext {
  const ctx: FocusedContext = {}
  if (!initAx() || !systemWide) return ctx
  try {
    const focused = getElementAttribute(systemWide, 'AXFocusedUIElement')
    if (focused) {
      try {
        ctx.role = getStringAttribute(focused, 'AXRole') ?? undefined
        ctx.title = getStringAttribute(focused, 'AXTitle') ?? undefined
        ctx.value = getStringAttribute(focused, 'AXValue') ?? undefined
        ctx.selectedText = getStringAttribute(focused, 'AXSelectedText') ?? undefined
        const pidOut = [0]
        if (AXUIElementGetPid!(focused, pidOut) === 0) ctx.pid = pidOut[0] as number
      } finally {
        CFRelease!(focused)
      }
    }
    const win = getElementAttribute(systemWide, 'AXFocusedWindow')
    if (win) {
      try {
        ctx.windowTitle = getStringAttribute(win, 'AXTitle') ?? undefined
      } finally {
        CFRelease!(win)
      }
    }
  } catch (err) {
    console.error('[ax] readFocusedContext error:', err)
  }
  return ctx
}
