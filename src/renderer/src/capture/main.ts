import { startRecording, stopRecording, setOnStopped, EngineError } from './recorderEngine'

const api = window.api.recorder

api.onCommand(async (cmd) => {
  try {
    if (cmd.action === 'start') {
      await startRecording(cmd.maxDurationSec, () => {
        // auto-stop triggered inside the engine
      })
      api.sendStarted()
    } else if (cmd.action === 'stop') {
      stopRecording()
    }
  } catch (err) {
    const code = err instanceof EngineError ? err.code : 'recorder-failed'
    api.sendError({ code, message: err instanceof Error ? err.message : String(err) })
  }
})

setOnStopped((audio, durationMs) => {
  api.sendStopped({ ...audio, durationMs })
})
