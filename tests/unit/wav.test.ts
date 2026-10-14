import { describe, it, expect } from 'vitest'
import { encodeWav } from '../../src/renderer/src/capture/wav'

function readStr(view: DataView, offset: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}

describe('encodeWav', () => {
  it('produces a byte-correct 16-bit mono RIFF header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const buf = encodeWav(samples, 16000)
    const v = new DataView(buf)

    expect(buf.byteLength).toBe(44 + samples.length * 2)
    expect(readStr(v, 0, 4)).toBe('RIFF')
    expect(v.getUint32(4, true)).toBe(36 + samples.length * 2)
    expect(readStr(v, 8, 4)).toBe('WAVE')
    expect(readStr(v, 12, 4)).toBe('fmt ')
    expect(v.getUint32(16, true)).toBe(16)
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(1) // mono
    expect(v.getUint32(24, true)).toBe(16000)
    expect(v.getUint32(28, true)).toBe(32000) // byte rate
    expect(v.getUint16(32, true)).toBe(2) // block align
    expect(v.getUint16(34, true)).toBe(16) // bits
    expect(readStr(v, 36, 4)).toBe('data')
    expect(v.getUint32(40, true)).toBe(samples.length * 2)
  })

  it('encodes sample values to int16 with correct clipping', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2])
    const v = new DataView(encodeWav(samples, 16000))
    expect(v.getInt16(44, true)).toBe(0)
    expect(v.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff))
    expect(v.getInt16(48, true)).toBe(-Math.round(0.5 * 0x8000))
    expect(v.getInt16(50, true)).toBe(0x7fff)
    expect(v.getInt16(52, true)).toBe(-0x8000)
    expect(v.getInt16(54, true)).toBe(0x7fff) // clipped
    expect(v.getInt16(56, true)).toBe(-0x8000) // clipped
  })

  it('handles empty input', () => {
    const buf = encodeWav(new Float32Array(0), 16000)
    expect(buf.byteLength).toBe(44)
  })
})
