import { reactive } from 'vue'
import { Game } from '@/game/Game'
import { START_LIVES, START_TIME } from '@/game/constants'
import type { HudSnapshot, Phase } from '@/game/types'
import { GameEngine } from '@/engine/GameEngine'
import { isSkinId, SKINS, type SkinId } from '@/engine/mesh/skins'

/** UI 读取的响应式快照 + 命令方法(§5.1 规则 2:UI→引擎只有命令,无双向耦合) */
export interface GameSession {
  readonly state: { phase: Phase; hud: HudSnapshot; skin: SkinId }
  start(): void
  pause(): void
  resume(): void
  restart(): void
  setSkin(id: SkinId): void
  dispose(): void
}

// 皮肤持久化(项目首个 localStorage 用例):非法值/隐私模式回退 mario
const SKIN_KEY = 'sm.skin'
const SKIN_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4']

function readSavedSkin(): SkinId {
  try {
    const v = localStorage.getItem(SKIN_KEY)
    return isSkinId(v) ? v : 'mario'
  } catch {
    return 'mario'
  }
}

/**
 * UI ↔ 引擎的组合点:Game(纯玩法)+ GameEngine(渲染生命周期)在此装配。
 * 引擎→UI 只经 GameHooks 离散事件写入快照;UI→引擎只调命令。
 * visibilitychange 自动暂停在 UI 层接线(game/ 保持零浏览器 API)。
 * 须在 canvas 挂载后调用,调用方负责 dispose。
 */
export function createGameSession(canvas: HTMLCanvasElement): GameSession {
  const state = reactive<{ phase: Phase; hud: HudSnapshot; skin: SkinId }>({
    phase: 'ready',
    hud: { score: 0, coins: 0, time: START_TIME, lives: START_LIVES, mario: 'small' },
    skin: 'mario',
  })

  const game = new Game({
    onPhase: (p) => {
      state.phase = p
    },
    onHud: (s) => {
      Object.assign(state.hud, s)
    },
  })
  game.attachInput(window)
  const engine = new GameEngine(canvas, game)

  const onVisibility = (): void => {
    if (document.hidden) game.pause() // 切后台自动暂停(§6)
  }
  document.addEventListener('visibilitychange', onVisibility)

  // 皮肤:恢复持久化选择 + window 级数字键 1-4(游玩/暂停/覆盖层均可切,
  // InputManager 不吞 Digit 键;game 层对皮肤无感知)
  const applySkin = (id: SkinId): void => {
    engine.setSkin(id)
    state.skin = id
    try {
      localStorage.setItem(SKIN_KEY, id)
    } catch {
      /* 存储不可写(隐私模式),本局内仍生效 */
    }
  }
  state.skin = readSavedSkin()
  if (state.skin !== 'mario') engine.setSkin(state.skin)
  const onSkinKey = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const i = SKIN_CODES.indexOf(e.code)
    if (i >= 0) applySkin(SKINS[i % 4]!.id)
  }
  window.addEventListener('keydown', onSkinKey)

  return {
    state,
    start: () => game.start(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.restart(),
    setSkin: applySkin,
    dispose: () => {
      window.removeEventListener('keydown', onSkinKey)
      document.removeEventListener('visibilitychange', onVisibility)
      engine.dispose()
      game.dispose()
    },
  }
}
