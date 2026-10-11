import { FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from './constants'

/**
 * 固定步累加器:真实帧时间 → 整数个固定物理步 + 渲染插值系数。
 * 被 GameEngine 的 rAF 循环经 Game.frame 调用;纯 TS,可无浏览器单测。
 */
export class FixedStepLoop {
  private acc = 0

  /**
   * @param realDt 真实帧间隔(秒),先钳制到 MAX_FRAME_DT
   * @param step   固定步回调(dt 恒为 FIXED_DT)
   * @returns steps 本帧实际执行的固定步数;alpha = acc/FIXED_DT,供渲染插值
   */
  advance(realDt: number, step: (dt: number) => void): { steps: number; alpha: number } {
    this.acc += Math.min(realDt, MAX_FRAME_DT)
    let steps = 0
    while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      step(FIXED_DT)
      this.acc -= FIXED_DT
      steps++
    }
    // 达到步数上限仍有积压 → 丢弃,防追帧雪崩
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0
    return { steps, alpha: this.acc / FIXED_DT }
  }

  reset(): void {
    this.acc = 0
  }
}
