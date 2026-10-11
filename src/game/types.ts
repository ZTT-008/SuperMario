/** 玩法层公共类型。本层禁止 import three / vue(ESLint 锁死)。 */

export interface Vec2 {
  x: number
  y: number
}

export type PowerState = 'small' | 'super' | 'fire'
export type Phase = 'ready' | 'playing' | 'paused' | 'dying' | 'clear' | 'gameover'

/** 每个固定步开始时采样的输入快照(含边沿) */
export interface InputState {
  left: boolean
  right: boolean
  run: boolean
  crouch: boolean
  jumpHeld: boolean
  jumpPressed: boolean
}

export interface HudSnapshot {
  score: number
  coins: number
  time: number
  lives: number
  mario: PowerState
}

/** 引擎 → UI 的唯一通道(仅离散事件,非每帧) */
export interface GameHooks {
  onPhase(p: Phase): void
  onHud(s: HudSnapshot): void
}

/** 渲染层每帧读取的实体只读视图(engine 经 ViewRegistry 同步到网格) */
export interface WorldEntity {
  id: string
  /** M0 灰盒种类;M2 起由具体实体类型驱动视图 */
  kind: string
  pos: Vec2
  prevPos: Vec2
  size: Vec2
  /** 渲染层次(Z 仅视觉,不参与玩法) */
  z: number
}
