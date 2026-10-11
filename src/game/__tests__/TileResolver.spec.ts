import { describe, expect, it } from 'vitest'
import { aabb, moveAndSlide, overlaps, pointInside } from '../physics/TileResolver'

const ground = aabb(10, 0.5, 20, 1) // 顶面 y = 1
const crate = aabb(15, 1.5, 1, 1) // 顶面 y = 2
const ceilingBlock = aabb(15, 5, 1, 1) // 底面 y = 4.5

describe('moveAndSlide 分轴 AABB 解析', () => {
  it('下落站到实体顶面,位移被截断不陷入', () => {
    const r = moveAndSlide({ x: 10, y: 1.4, w: 0.8, h: 0.95, dx: 0, dy: -0.3 }, [ground])
    expect(r.onGround).toBe(true)
    expect(r.y).toBeCloseTo(1 + 0.95 / 2, 10)
  })

  it('最大单步位移(0.333 瓦片)不穿透 1 瓦片厚实体', () => {
    const startX = crate.minX - 0.2 - 0.8 / 2 // 右缘距箱 0.2 < 单步 0.333
    const r = moveAndSlide({ x: startX, y: 1.5, w: 0.8, h: 0.95, dx: 0.333, dy: 0 }, [crate])
    expect(r.hitWall).toBe(true)
    expect(r.x).toBeCloseTo(crate.minX - 0.8 / 2, 10) // 推出到贴边
  })

  it('上升顶头返回实体下标(供问号砖顶砖判定)', () => {
    const r = moveAndSlide({ x: 15, y: 4.0, w: 0.8, h: 0.95, dx: 0, dy: 0.3 }, [ground, ceilingBlock])
    expect(r.ceiling).toBe(1)
    expect(r.y).toBeCloseTo(4.5 - 0.95 / 2, 10)
  })

  it('贴边站立不算碰撞(无落地抖动)', () => {
    const resting = aabb(10, 1 + 0.95 / 2, 0.8, 0.95)
    expect(overlaps(resting, ground)).toBe(false)
    const r = moveAndSlide({ x: 10, y: 1 + 0.95 / 2, w: 0.8, h: 0.95, dx: 0.1, dy: 0 }, [ground])
    expect(r.onGround).toBe(false) // dy=0 且贴边 → 水平滑行无碰撞
  })

  it('pointInside 探边:板栗仔前脚掌下方有无地面', () => {
    expect(pointInside([ground], 10, 0.5)).toBe(true)
    expect(pointInside([ground], 10, 1.5)).toBe(false)
    expect(pointInside([ground], 100, 0.5)).toBe(false) // 坑里没地
  })
})

// 单向平台(§7.3):顶面 y = 4,占 y∈[3,4]
const bridge = { ...aabb(10, 3.5, 4, 1), semisolid: true }

describe('moveAndSlide 单向平台', () => {
  it('从上方下落:脚底步前在台顶之上 → 接住站稳', () => {
    const r = moveAndSlide({ x: 10, y: 4.5, w: 0.8, h: 0.95, dx: 0, dy: -0.3 }, [bridge])
    expect(r.onGround).toBe(true)
    expect(r.y).toBeCloseTo(4 + 0.95 / 2, 10)
  })

  it('从下方上升:穿过台体,无 ceiling', () => {
    const r = moveAndSlide({ x: 10, y: 3.0, w: 0.8, h: 0.95, dx: 0, dy: 0.3 }, [bridge])
    expect(r.ceiling).toBe(-1)
    expect(r.onGround).toBe(false)
    expect(r.y).toBeCloseTo(3.3, 10)
  })

  it('横移穿过台体:无 hitWall', () => {
    const r = moveAndSlide({ x: 9.5, y: 3.5, w: 0.8, h: 0.95, dx: 0.3, dy: 0 }, [bridge])
    expect(r.hitWall).toBe(false)
    expect(r.x).toBeCloseTo(9.8, 10)
  })

  it('与实心混合:步前脚底在台顶之下 → 穿台落到地面', () => {
    const r = moveAndSlide({ x: 10, y: 1.475, w: 0.8, h: 0.95, dx: 0, dy: -0.05 }, [bridge, ground])
    expect(r.onGround).toBe(true)
    expect(r.y).toBeCloseTo(1 + 0.95 / 2, 10) // 站地面(顶 y=1)而非台顶
  })
})
