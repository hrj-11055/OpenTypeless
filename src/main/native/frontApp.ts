// Frontmost application identity via osascript (System Events).
// AppleEvents may be denied — degrade to AX-only info, never throw.
import { execFile } from 'child_process'

export interface FrontAppInfo {
  appName?: string
  bundleId?: string
}

export function getFrontApp(timeoutMs = 1500): Promise<FrontAppInfo> {
  return new Promise((resolve) => {
    execFile(
      'osascript',
      [
        '-e',
        'tell application "System Events" to get {name, bundle identifier} of first application process whose frontmost is true'
      ],
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err || typeof stdout !== 'string') return resolve({})
        const parts = stdout.trim().split(', ').map((s) => s.trim())
        const info: FrontAppInfo = {}
        if (parts[0]) info.appName = parts[0]
        if (parts[1]) info.bundleId = parts[1]
        resolve(info)
      }
    )
  })
}
