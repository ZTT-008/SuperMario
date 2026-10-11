import type { InputState } from '../types'

export type GameCommand = 'pauseToggle' | 'restart'

/**
 * 键盘 → InputState。原始事件只更新位图;每个固定步开始时 sample() 生成快照
 * (含 jumpPressed 边沿),保证同一步内所有实体看到同一输入,且测试可注入。
 * 触屏(M7)产出同一 InputState,不改本类对外接口。
 */
export class InputManager {
  private raw = { left: false, right: false, run: false, crouch: false, jump: false }
  private jumpWasDown = false
  private commandHandler: ((cmd: GameCommand) => void) | null = null
  private cleanups: (() => void)[] = []

  /** 键位:方向键/WASD 移动、Space/Z 跳、Shift/X 跑、下蹲 ↓/S(见 DESIGN §12.3) */
  attach(target: Window & typeof globalThis): void {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.raw.left = down
          break
        case 'ArrowRight':
        case 'KeyD':
          this.raw.right = down
          break
        case 'ArrowDown':
        case 'KeyS':
          this.raw.crouch = down
          break
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyX':
          this.raw.run = down
          break
        case 'Space':
        case 'KeyZ':
        case 'ArrowUp':
        case 'KeyW':
          this.raw.jump = down
          break
        default:
          return
      }
      e.preventDefault() // 防方向键/空格滚动页面
    }
    const down = (e: KeyboardEvent) => {
      // 非玩法命令键(边沿触发,不进 InputState)
      if (!e.repeat && (e.code === 'Enter' || e.code === 'KeyP')) this.commandHandler?.('pauseToggle')
      if (!e.repeat && e.code === 'KeyR') this.commandHandler?.('restart')
      onKey(e, true)
    }
    const up = (e: KeyboardEvent) => onKey(e, false)
    const blur = () => this.clearAll() // 失焦清位图,防「按键卡住」

    target.addEventListener('keydown', down)
    target.addEventListener('keyup', up)
    target.addEventListener('blur', blur)
    this.cleanups = [
      () => target.removeEventListener('keydown', down),
      () => target.removeEventListener('keyup', up),
      () => target.removeEventListener('blur', blur),
    ]
  }

  detach(): void {
    for (const fn of this.cleanups) fn()
    this.cleanups = []
    this.commandHandler = null
  }

  setCommandHandler(fn: (cmd: GameCommand) => void): void {
    this.commandHandler = fn
  }

  /** 每个固定步调用一次:生成快照并计算 jumpPressed 边沿 */
  sample(): InputState {
    const jumpPressed = this.raw.jump && !this.jumpWasDown
    this.jumpWasDown = this.raw.jump
    return {
      left: this.raw.left,
      right: this.raw.right,
      run: this.raw.run,
      crouch: this.raw.crouch,
      jumpHeld: this.raw.jump,
      jumpPressed,
    }
  }

  clearAll(): void {
    this.raw.left = this.raw.right = this.raw.run = this.raw.crouch = this.raw.jump = false
    this.jumpWasDown = false
  }
}
