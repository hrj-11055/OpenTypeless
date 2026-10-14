// Recording engine for the hidden capture window.
// Holds the MediaStream only while recording; all lifecycle errors are thrown
// as coded errors so the caller can map them to user-facing messages.

export type EngineErrorCode = 'mic-denied' | 'no-device' | 'recorder-failed'

export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message?: string
  ) {
    super(message ?? code)
  }
}

let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null
let startedAt = 0
let autoStopTimer: number | null = null
let onStoppedCallback:
  | ((
      audio: { webm: { data: Uint8Array; mimeType: string }; wav?: { data: Uint8Array; mimeType: string } },
      durationMs: number,
      autoStopped: boolean
    ) => void)
  | null = null

let stopRequested = false

export function isRecording(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}

export async function startRecording(maxDurationSec: number, onAutoStop: () => void): Promise<void> {
  if (isRecording()) return

  let micStream: MediaStream
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    })
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError')
      throw new EngineError('mic-denied', name)
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      throw new EngineError('no-device', name)
    throw new EngineError('recorder-failed', name || String(err))
  }

  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' })
  } catch {
    // Fallback: let the browser pick a container it supports.
    try {
      recorder = new MediaRecorder(micStream)
    } catch (err) {
      micStream.getTracks().forEach((t) => t.stop())
      throw new EngineError('recorder-failed', String(err))
    }
  }

  stream = micStream
  mediaRecorder = recorder
  chunks = []
  stopRequested = false
  startedAt = Date.now()

  recorder.ondataavailable = (e: BlobEvent): void => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  recorder.onstop = (): void => {
    const mimeType = recorder.mimeType || 'audio/webm'
    const durationMs = Date.now() - startedAt
    const blob = new Blob(chunks, { type: mimeType })
    releaseStream()
    void (async () => {
      const [webmBuf, wavBuf] = await Promise.all([
        blob.arrayBuffer(),
        import('./wav').then((m) => m.blobToWav16kMono(blob))
      ])
      onStoppedCallback?.(
        {
          webm: { data: new Uint8Array(webmBuf), mimeType },
          wav: wavBuf ? { data: new Uint8Array(wavBuf), mimeType: 'audio/wav' } : undefined
        },
        durationMs,
        stopRequested
      )
    })()
  }

  // Regular timeslice keeps chunks flushing even if the page is throttled,
  // and bounds data loss if the process dies mid-recording.
  recorder.start(250)
  autoStopTimer = window.setTimeout(() => {
    if (isRecording()) {
      stopRequested = true
      onAutoStop()
      stopRecording()
    }
  }, maxDurationSec * 1000)
}

export function stopRecording(): boolean {
  if (autoStopTimer !== null) {
    window.clearTimeout(autoStopTimer)
    autoStopTimer = null
  }
  if (!isRecording()) return false
  stopRequested = true
  mediaRecorder!.stop()
  return true
}

export function setOnStopped(
  cb: (
    audio: { webm: { data: Uint8Array; mimeType: string }; wav?: { data: Uint8Array; mimeType: string } },
    durationMs: number,
    autoStopped: boolean
  ) => void
): void {
  onStoppedCallback = cb
}

function releaseStream(): void {
  mediaRecorder = null
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    stream = null
  }
}
