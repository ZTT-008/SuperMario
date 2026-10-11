import { describe, expect, it } from 'vitest'
import { WATER_ZONE } from '@/game/constants'
import { decorSpots } from '../decorSpots'

/**
 * 装饰布点纯函数回归:确定性(同种子逐位等)、带内、避障、间距。
 * 背景装饰是纯渲染层,唯一值得钉死的就是布点不越界/不怼脸。
 */
describe('decorSpots', () => {
  it('同种子两次调用逐位相等(确定性)', () => {
    const a = decorSpots(11, 2, 69, 12)
    const b = decorSpots(11, 2, 69, 12)
    expect(a).toEqual(b)
    expect(a.length).toBe(12)
  })

  it('不同种子结果不同(种子真的参与)', () => {
    expect(decorSpots(11, 2, 69, 12)).not.toEqual(decorSpots(12, 2, 69, 12))
  })

  it('全部落带内且满足最小间距', () => {
    const spots = decorSpots(22, 73, 140, 14, [], 1.5)
    expect(spots.length).toBe(14)
    for (const x of spots) {
      expect(x).toBeGreaterThanOrEqual(73)
      expect(x).toBeLessThan(140)
    }
    const sorted = [...spots].sort((p, q) => p - q)
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(1.5)
  })

  it('避开障碍区间(含 ±1 缓冲):水域两侧芦苇点不落水', () => {
    const spots = decorSpots(55, 139, 151, 8, [WATER_ZONE])
    for (const x of spots) {
      expect(x > WATER_ZONE[0] - 1 && x < WATER_ZONE[1] + 1).toBe(false)
    }
  })

  it('障碍过密时不无限循环:重试上限内返回(可少于 n)', () => {
    const spots = decorSpots(33, 0, 10, 20, [[0, 10]])
    expect(spots.length).toBeLessThanOrEqual(20)
    expect(spots.length).toBe(0) // 全带被避 → 空数组而非死循环
  })
})
