// Probe: CGEventTap listen-only for flagsChanged — does fn/globe emit them?
// Plain Node doesn't run a CFRunLoop, so we pump it in slices with
// CFRunLoopRunInMode; koffi queues tap callbacks onto the main thread between
// slices. Run: node scripts/fn-tap-probe.mjs — press fn and shift a few times.
import koffi from 'koffi'

const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
const CF = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

const kCGSessionEventTap = 1
const kCGHeadInsertEventTap = 0
const kCGEventTapOptionListenOnly = 1
const kCGEventFlagsChanged = 12
const kCGKeyboardEventKeycode = 9
const kCFStringEncodingUTF8 = 0x08000100

koffi.pointer('CGEventRefP', koffi.opaque('CGEventP'))
koffi.pointer('CFStringRefP', koffi.opaque('CFStringP'))
koffi.pointer('CFRunLoopRefP', koffi.opaque('CFRunLoopP'))
koffi.pointer('CFRunLoopSourceRefP', koffi.opaque('CFRunLoopSourceP'))
koffi.pointer('CFMachPortRefP', koffi.opaque('CFMachPortP'))

const CGEventGetFlags = CG.func('uint64_t CGEventGetFlags(CGEventRefP event)')
const CGEventGetIntegerValueField = CG.func(
  'int64_t CGEventGetIntegerValueField(CGEventRefP event, uint32_t field)'
)
const CFStringCreateWithCString = CF.func(
  'CFStringRefP CFStringCreateWithCString(void *allocator, const char *cStr, uint32_t encoding)'
)
const CFMachPortCreateRunLoopSource = CF.func(
  'CFRunLoopSourceRefP CFMachPortCreateRunLoopSource(void *allocator, CFMachPortRefP port, int order)'
)
const CFRunLoopAddSource = CF.func(
  'void CFRunLoopAddSource(CFRunLoopRefP rl, CFRunLoopSourceRefP source, CFStringRefP mode)'
)
const CFRunLoopGetMain = CF.func('CFRunLoopRefP CFRunLoopGetMain()')
const CFRunLoopRunInMode = CF.func(
  'int CFRunLoopRunInMode(CFStringRefP mode, double seconds, bool returnAfterSourceHandled)'
)

const tapProto = koffi.proto(
  'CGEventRefP tapCallback(void *proxy, uint32_t type, CGEventRefP event, void *userInfo)'
)
let hits = 0
const cb = koffi.register(
  (_proxy, type, event) => {
    try {
      if (type === kCGEventFlagsChanged && event) {
        hits++
        const kc = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)
        const flags = CGEventGetFlags(event)
        console.log(
          `flagsChanged keyCode=${kc} flags=0x${BigInt(flags).toString(16)} fnBit=${(BigInt(flags) & 0x800000n) !== 0n}`
        )
      }
    } catch (err) {
      console.log('callback error:', err)
    }
    return null
  },
  koffi.pointer(tapProto)
)

const CGEventTapCreate = CG.func(
  'void *CGEventTapCreate(uint32_t tap, uint32_t place, uint32_t options, uint64_t mask, void *callback, void *userInfo)'
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
  console.log('TAP CREATE FAILED (NULL) — needs Input Monitoring / Accessibility permission')
  process.exit(1)
}
console.log('tap created ok')

const defaultMode = CFStringCreateWithCString(null, 'kCFRunLoopDefaultMode', kCFStringEncodingUTF8)
const commonMode = CFStringCreateWithCString(null, 'kCFRunLoopCommonModes', kCFStringEncodingUTF8)
const source = CFMachPortCreateRunLoopSource(null, tap, 0)
CFRunLoopAddSource(CFRunLoopGetMain(), source, commonMode)
console.log('listening for 40s — press fn and shift a few times now...')

const end = Date.now() + 40000
while (Date.now() < end) {
  CFRunLoopRunInMode(defaultMode, 0.05, false)
  await new Promise((r) => setTimeout(r, 5))
}
console.log(`done, flagsChanged hits=${hits}`)
process.exit(0)
