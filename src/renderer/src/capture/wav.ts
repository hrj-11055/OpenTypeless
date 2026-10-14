// Pure-TS WAV encoder + WebM→16kHz mono WAV converter (renderer-side).
// Gemini's supported audio list has no WebM, so the capture window always
// attaches a WAV rendition alongside the WebM original.

export const WAV_TARGET_RATE = 16000

/** Encode mono Float32 PCM [-1,1] as a 16-bit PCM WAV file. Pure function. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // rest of file size
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
  }
  return buffer
}

/** Decode any browser-supported audio blob to mono Float32 at 16 kHz. */
export async function blobToWav16kMono(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    const raw = await blob.arrayBuffer()
    const ctx = new AudioContext()
    let decoded: AudioBuffer
    try {
      decoded = await ctx.decodeAudioData(raw.slice(0))
    } finally {
      void ctx.close()
    }
    if (decoded.length === 0) return null

    const frames = Math.ceil((decoded.length / decoded.sampleRate) * WAV_TARGET_RATE)
    if (frames === 0) return null
    const offline = new OfflineAudioContext(1, frames, WAV_TARGET_RATE)
    const src = offline.createBufferSource()
    // Mono-mix happens automatically when feeding a stereo buffer to a
    // 1-channel OfflineAudioContext via a buffer source.
    src.buffer = decoded
    src.connect(offline.destination)
    src.start()
    const rendered = await offline.startRendering()
    return encodeWav(rendered.getChannelData(0), WAV_TARGET_RATE)
  } catch {
    return null
  }
}
