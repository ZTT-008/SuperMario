import { describe, expect, it } from 'vitest'
import { FixedStepLoop } from '@/game/FixedStepLoop'
import { FIXED_DT, MAX_STEPS_PER_FRAME } from '@/game/constants'

describe('FixedStepLoop(固定步 + 渲染插值)', () => {
  it('恰好一个固定步:执行 1 步,alpha≈0', () => {
    const loop = new FixedStepLoop()
    const dts: number[] = []
    const { steps, alpha } = loop.advance(FIXED_DT, (dt) => dts.push(dt))
    expect(steps).toBe(1)
    expect(dts).toEqual([FIXED_DT]) // step 回调永远收到恒定 dt
    expect(alpha).toBeCloseTo(0, 5)
  })

  it('不足一步:不执行,alpha 为插值系数', () => {
    const loop = new FixedStepLoop()
    const { steps, alpha } = loop.advance(FIXED_DT * 0.5, () => {})
    expect(steps).toBe(0)
    expect(alpha).toBeCloseTo(0.5, 5)
  })

  it('累加补步:慢帧后一帧追多步', () => {
    const loop = new FixedStepLoop()
    loop.advance(FIXED_DT * 0.5, () => {})
    const { steps, alpha } = loop.advance(FIXED_DT * 2, () => {})
    expect(steps).toBe(2) // 0.5 + 2 = 2.5 步 → 2 步,余 0.5
    expect(alpha).toBeCloseTo(0.5, 5)
  })

  it('真实帧时间钳到 MAX_FRAME_DT:0.25s 卡顿帧与 0.1s 表现一致', () => {
    const a = new FixedStepLoop()
    const b = new FixedStepLoop()
    const ra = a.advance(0.25, () => {})
    const rb = b.advance(0.1, () => {})
    expect(ra).toEqual(rb)
  })

  it('单帧步数上限:超出部分丢弃,防追帧雪崩', () => {
    const loop = new FixedStepLoop()
    let count = 0
    const { steps, alpha } = loop.advance(0.5, () => count++)
    expect(steps).toBe(MAX_STEPS_PER_FRAME)
    expect(count).toBe(MAX_STEPS_PER_FRAME)
    expect(alpha).toBe(0) // 积压被清零,不会下一帧继续追
  })

  it('reset:清空积压(暂停恢复不追帧)', () => {
    const loop = new FixedStepLoop()
    loop.advance(FIXED_DT * 1.5, () => {})
    loop.reset()
    const { steps, alpha } = loop.advance(FIXED_DT * 0.5, () => {})
    expect(steps).toBe(0)
    expect(alpha).toBeCloseTo(0.5, 5)
  })
})
