// Probe: does the fn/globe key show up in CGEventSourceFlagsState?
// Run: node scripts/fn-probe.mjs  — press fn a few times during the 24s window.
import koffi from 'koffi'

const CG = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
const flags = CG.func('uint64_t CGEventSourceFlagsState(uint32_t stateID)')

let prev = 0n
const t0 = Date.now()
const timer = setInterval(() => {
  const f = BigInt(flags(0))
  if (f !== prev) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`t+${sec}s flags=0x${f.toString(16)} fnBit=${(f & 0x800000n) !== 0n}`)
    prev = f
  }
}, 30)
setTimeout(() => {
  clearInterval(timer)
  console.log('done')
  process.exit(0)
}, 40000)
