// Validate AX FFI mechanics in plain node (no AX trust expected here):
// - koffi _Out_ array params
// - CFString create/decode fast+slow paths
// - AXUIElementCreateSystemWide / CopySystemFocusedElement error handling
import koffi from 'koffi'

const HIS = koffi.load(
  '/System/Library/Frameworks/ApplicationServices.framework/Frameworks/HIServices.framework/HIServices'
)
const CF = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')

koffi.pointer('AXUIElementRefX', koffi.opaque('AXUIElementX'))
koffi.pointer('CFStringRefX', koffi.opaque('CFStringX'))
koffi.pointer('CFTypeRefX', koffi.opaque('CFTypeX'))
koffi.pointer('CGEventSourceRefX', koffi.opaque('CGEventSourceX'))
koffi.pointer('CGEventRefX', koffi.opaque('CGEventX'))

const CFStringCreateWithCString = CF.func(
  'CFStringRefX CFStringCreateWithCString(void *allocator, const char *cStr, uint32_t encoding)'
)
const CFStringGetCStringPtr = CF.func(
  'const char *CFStringGetCStringPtr(CFStringRefX str, uint32_t encoding)'
)
const CFStringGetCString = CF.func(
  'bool CFStringGetCString(CFStringRefX str, _Out_ char *buffer, long bufSize, uint32_t encoding)'
)
const CFRelease = CF.func('void CFRelease(CFTypeRefX ref)')
const CFGetTypeID = CF.func('uint64_t CFGetTypeID(CFTypeRefX cf)')
const CFStringGetTypeID = CF.func('uint64_t CFStringGetTypeID()')

const AXIsProcessTrusted = HIS.func('bool AXIsProcessTrusted()')
const AXUIElementCreateSystemWide = HIS.func('AXUIElementRefX AXUIElementCreateSystemWide()')
const AXUIElementCopySystemFocusedElement = HIS.func(
  'int32_t AXUIElementCopySystemFocusedElement(AXUIElementRefX systemWide, _Out_ AXUIElementRefX *focused)'
)
const AXUIElementCopyAttributeValue = HIS.func(
  'int32_t AXUIElementCopyAttributeValue(AXUIElementRefX element, CFStringRefX attribute, _Out_ CFTypeRefX *value)'
)

const kCFStringEncodingUTF8 = 0x08000100

// 1. CFString decode utils (fast path then slow path)
function cfStrToJs(cfstr) {
  const direct = CFStringGetCStringPtr(cfstr, kCFStringEncodingUTF8)
  if (direct) return koffi.decode(direct, 'char', -1)
  const buf = koffi.alloc('char', 65536)
  if (CFStringGetCString(cfstr, buf, 65536, kCFStringEncodingUTF8)) {
    return koffi.decode(buf, 'char', -1)
  }
  return null
}

const made = CFStringCreateWithCString(null, '你好 AX world', kCFStringEncodingUTF8)
console.log('cfstring created:', !!made)
console.log('decoded:', cfStrToJs(made))
CFRelease(made)
console.log('stringTypeID match:', CFGetTypeID(made) === CFStringGetTypeID())

// 2. AX trust + system wide + focused element (expects error in untrusted node)
console.log('AXIsProcessTrusted:', AXIsProcessTrusted())
const sw = AXUIElementCreateSystemWide()
console.log('systemWide element:', !!sw)
const focused = [null]
const rc = AXUIElementCopySystemFocusedElement(sw, focused)
console.log('CopySystemFocusedElement rc=', rc, 'focused[0]=', focused[0] ? 'non-null' : 'null')

// 3. read an attribute through route B (also expected to fail untrusted)
const attr = CFStringCreateWithCString(null, 'AXFocusedUIElement', kCFStringEncodingUTF8)
const val = [null]
const rc2 = AXUIElementCopyAttributeValue(sw, attr, val)
console.log('route B rc=', rc2, 'val[0]=', val[0] ? 'non-null' : 'null')
CFRelease(attr)

console.log('MECHANICS OK')
process.exit(0)
