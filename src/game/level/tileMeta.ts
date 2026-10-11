/**
 * 瓦片字典(DESIGN §8.1):ASCII 字符 → 瓦片编码 → 碰撞层。
 * 游戏层只认编码与碰撞层;渲染层(ChunkBuilder)按编码分组建实例网格。
 */

export const TILE = {
  empty: 0,
  dirt: 1,
  brick: 2,
  question: 3,
  crate: 4,
  pipe: 5,
  semisolid: 6,
  stair: 7,
  spike: 8,
} as const

export type TileCode = (typeof TILE)[keyof typeof TILE]

export const LEGEND: Record<string, TileCode> = {
  '.': TILE.empty,
  '#': TILE.dirt,
  X: TILE.brick,
  '?': TILE.question,
  C: TILE.crate,
  P: TILE.pipe,
  '=': TILE.semisolid,
  '^': TILE.stair,
  s: TILE.spike,
}

export type CollisionLayer = 'none' | 'solid' | 'semisolid'

const META: Record<TileCode, { layer: CollisionLayer }> = {
  [TILE.empty]: { layer: 'none' },
  [TILE.dirt]: { layer: 'solid' },
  [TILE.brick]: { layer: 'solid' },
  [TILE.question]: { layer: 'solid' },
  [TILE.crate]: { layer: 'solid' },
  [TILE.pipe]: { layer: 'solid' },
  [TILE.semisolid]: { layer: 'semisolid' }, // §7.3:下落可站、上升可穿
  [TILE.stair]: { layer: 'solid' },
  [TILE.spike]: { layer: 'none' }, // 非实心,触杀由 Game.checkHazards 判
}

export function layerOf(code: TileCode): CollisionLayer {
  return META[code].layer
}
