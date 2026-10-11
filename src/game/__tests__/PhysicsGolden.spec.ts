import { describe, expect, it } from 'vitest'
import { DEFAULT_PHYSICS as P } from '@/game/physics/PhysicsConfig'

/**
 * 手感参数黄金回归(DESIGN §13):跳跃顶点 / 越坑宽度由参数表解析算出,
 * 调参若悄悄破坏验收 #3(原地跳上 4 砖高台、跑跳越过 4 瓦片坑)直接红。
 */
describe('手感参数黄金回归(验收 #3)', () => {
  const apex = P.jumpVel ** 2 / (2 * P.gravityHold) // 按住跳的顶点高度(瓦片)
  const tRise = P.jumpVel / P.gravityHold
  const tFall = Math.sqrt((2 * apex) / P.gravityFall) // 松开后按 gravityFall 下落
  const airTime = tRise + tFall

  it('站跳顶点 ≥ 4 瓦片(可上 4 砖高台)', () => {
    expect(apex).toBeGreaterThanOrEqual(4)
    expect(apex).toBeCloseTo(4.26, 1)
  })

  it('跑跳滞空可越过 ≥ 4 瓦片坑', () => {
    expect(airTime * P.runMax).toBeGreaterThanOrEqual(4)
  })

  it('可变跳高:点按短跳(≈2.13 瓦片)≤ 满跳一半,仍能上 1 砖台', () => {
    const tapApex = P.jumpVel ** 2 / (2 * P.gravityFall) // 立刻松开 → 全程 gravityFall
    expect(tapApex).toBeLessThanOrEqual(apex * 0.5) // gravityFall = 2×gravityHold → 恰为半高
    expect(tapApex).toBeGreaterThanOrEqual(1.9) // 仍能上 1 砖台
  })

  it('下落终端速度与行走/跑动上限自洽', () => {
    expect(P.maxFall).toBeGreaterThan(P.runMax)
    expect(P.runMax).toBeGreaterThan(P.walkMax)
    expect(P.skidDecel).toBeGreaterThan(P.accelRun) // 急转身必须快于加速
  })
})
