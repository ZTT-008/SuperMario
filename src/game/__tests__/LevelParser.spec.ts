import { describe, expect, it } from 'vitest'
import { LEVEL_H, LEVEL_W, WATER_ZONE } from '../constants'
import { LEVEL_1_1 } from '../level/Level1_1'
import { parseLevel, tileAt } from '../level/LevelParser'
import { TILE, layerOf } from '../level/tileMeta'

/**
 * 网格地图回归:parseLevel 校验(尺寸/图例)+ 关键瓦片落位 + 出生表对地形合法。
 * 地图错误必须在启动即暴露,而非玩法中偶发穿墙/怪卡死。
 */
const level = parseLevel(LEVEL_1_1)

describe('LevelParser 校验', () => {
  it('尺寸:15 行 × 211 列,grid 长度吻合', () => {
    expect(level.width).toBe(LEVEL_W)
    expect(level.height).toBe(LEVEL_H)
    expect(level.grid.length).toBe(LEVEL_W * LEVEL_H)
  })

  it('行数错 / 行长错 / 非法字符 → 即抛', () => {
    const def = (rows: readonly string[]) => ({ rows, spawns: LEVEL_1_1.spawns })
    expect(() => parseLevel(def(LEVEL_1_1.rows.slice(0, 14)))).toThrow(/行数/)
    expect(() => parseLevel(def([...LEVEL_1_1.rows.slice(0, 7), LEVEL_1_1.rows[7]!.slice(0, 210), ...LEVEL_1_1.rows.slice(8)]))).toThrow(/长度/)
    const bottom = LEVEL_1_1.rows[LEVEL_H - 1]!
    expect(() => parseLevel(def([...LEVEL_1_1.rows.slice(0, LEVEL_H - 1), bottom.replace('.', '@')]))).toThrow(/非法字符/)
  })

  it('碰撞层映射:实心/单向/无层', () => {
    expect(layerOf(TILE.dirt)).toBe('solid')
    expect(layerOf(TILE.semisolid)).toBe('semisolid')
    expect(layerOf(TILE.spike)).toBe('none')
  })
})

describe('1-1 网格关键瓦片', () => {
  it('地面段与坑:行 0 泥土,71/101/131/145/171 列是坑', () => {
    expect(tileAt(level, 0, 0)).toBe(TILE.dirt)
    expect(tileAt(level, 70, 0)).toBe(TILE.dirt)
    for (const pitX of [71, 101, 131, 145, 171]) expect(tileAt(level, pitX, 0)).toBe(TILE.empty)
    expect(tileAt(level, 198, 0)).toBe(TILE.dirt) // 旗杆有地
  })

  it('管道/砖/问号/木箱/阶梯/单向桥/尖刺落位', () => {
    expect(tileAt(level, 30, 1)).toBe(TILE.pipe)
    expect(tileAt(level, 30, 0)).toBe(TILE.dirt) // 管道坐地面,不占地面行
    expect(tileAt(level, 36, 5)).toBe(TILE.brick)
    expect(tileAt(level, 7, 5)).toBe(TILE.question)
    expect(tileAt(level, 9, 1)).toBe(TILE.crate)
    expect(tileAt(level, 152, 1)).toBe(TILE.stair)
    expect(tileAt(level, 131, 3)).toBe(TILE.semisolid)
    expect(tileAt(level, 48, 1)).toBe(TILE.spike)
  })
})

describe('1-1 出生表对地形合法', () => {
  const s = level.spawns

  it('板栗仔 12 只:站在泥土行上、头顶无瓦片、间距 ≥4、不在水域', () => {
    expect(s.goomba.length).toBe(12)
    for (const x of s.goomba) {
      expect(tileAt(level, Math.floor(x), 0)).toBe(TILE.dirt)
      expect(tileAt(level, Math.floor(x), 1)).toBe(TILE.empty)
      expect(x > WATER_ZONE[0] && x < WATER_ZONE[1]).toBe(false)
    }
    for (let i = 1; i < s.goomba.length; i++)
      expect(s.goomba[i]! - s.goomba[i - 1]!).toBeGreaterThanOrEqual(4)
  })

  it('蝙蝠 4 / 鸟 2 / 飞怪 2:区间有序、高度在场内', () => {
    expect(s.bat.length).toBe(4)
    for (const b of s.bat) {
      expect(b.x1).toBeGreaterThan(b.x0)
      expect(b.baseY + b.amp).toBeLessThan(LEVEL_H)
      expect(b.baseY - b.amp).toBeGreaterThan(1) // 不贴地
    }
    expect(s.bird.length).toBe(2)
    for (const b of s.bird) expect(b.y).toBeLessThan(LEVEL_H)
    expect(s.paratroopa.length).toBe(2)
    for (const p of s.paratroopa) {
      expect(p.x1).toBeGreaterThan(p.x0)
      expect(p.y).toBeLessThan(LEVEL_H)
    }
  })

  it('浮台 3 条:全部横跨坑(出生列行 0 无地)', () => {
    expect(s.platform.length).toBe(3)
    for (const p of s.platform) {
      expect(p.x1).toBeGreaterThan(p.x0)
      expect(tileAt(level, Math.floor(p.x0), 0)).toBe(TILE.empty)
      expect(p.y).toBeGreaterThan(1)
    }
  })
})
