import { Tray, Menu, nativeImage, app } from 'electron'
import icon from '../../resources/icon.png?asset'
import type { DictationState } from './orchestrator'

export interface TrayHandle {
  tray: Tray
  refresh: () => void
}

/**
 * Menu-bar tray. v0.1 uses one template icon; recording state is surfaced
 * through the status menu item (distinct two-state icons are an M4 visual
 * polish item).
 */
export function createTray(onOpenSettings: () => void, getState: () => DictationState): TrayHandle {
  const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  image.setTemplateImage(true)
  const tray = new Tray(image)

  const stateLabel = (): string => {
    switch (getState()) {
      case 'recording':
        return '● 录音中…（再按快捷键结束）'
      case 'processing':
        return '… 处理中'
      case 'starting':
        return '… 启动中'
      default:
        return '就绪'
    }
  }

  const refresh = (): void => {
    tray.setToolTip('OpenTypeless')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `状态：${stateLabel()}`, enabled: false },
        { type: 'separator' },
        { label: '打开设置', click: onOpenSettings },
        { type: 'separator' },
        { label: '退出', click: (): void => app.quit() }
      ])
    )
  }

  refresh()
  return { tray, refresh }
}
