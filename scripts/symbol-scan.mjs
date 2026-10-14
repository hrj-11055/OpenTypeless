// Scan candidate system dylibs for the AXUIElement C API symbols via koffi.
import koffi from 'koffi'

const candidates = [
  '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices',
  '/System/Library/Frameworks/ApplicationServices.framework/Frameworks/HIServices.framework/HIServices',
  '/System/Library/Frameworks/Accessibility.framework/Accessibility',
  '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics',
  '/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight',
  '/System/Library/PrivateFrameworks/AccessibilityStack.framework/AccessibilityStack',
  '/System/Library/PrivateFrameworks/AccessibilityUtilities.framework/AccessibilityUtilities'
]

const symbols = [
  'AXIsProcessTrusted',
  'AXUIElementCreateSystemWide',
  'AXUIElementCopySystemFocusedElement',
  'AXUIElementCopyAttributeValue',
  'AXUIElementGetPid',
  'CFStringGetCString'
]

for (const path of candidates) {
  let lib
  try {
    lib = koffi.load(path)
  } catch (e) {
    console.log(`${path.split('/').pop()}: LOAD FAILED`)
    continue
  }
  const found = []
  for (const sym of symbols) {
    try {
      lib.func(`void ${sym}()`)
      found.push(sym)
    } catch {
      /* not here */
    }
  }
  console.log(`${path.split('/').pop()}: ${found.length ? found.join(', ') : '(none)'}`)
}
process.exit(0)
