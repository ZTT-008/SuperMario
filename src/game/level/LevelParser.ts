import { LEVEL_H, LEVEL_W } from '../constants'
import { LEGEND, type TileCode } from './tileMeta'

/** 空中/地面敌人 + 移动浮台出生表(地形专属,不进 ASCII) */
export interface BatSpawn {
  x0: number
  x1: number
  baseY: number
  amp: number
  phase: number
}
export interface BirdSpawn {
  x: number
  y: number
}
export interface ParatroopaSpawn {
  x0: number
  x1: number
  y: number
}
export interface PlatformSpawn {
  x0: number
  x1: number
  y: number
  w: number
}

export interface LevelSpawns {
  goomba: readonly number[]
  bat: readonly BatSpawn[]
  bird: readonly BirdSpawn[]
  paratroopa: readonly ParatroopaSpawn[]
  platform: readonly PlatformSpawn[]
}

export interface LevelDef {
  /** 15 行,行 0 = 顶行;每行 211 字符,图例见 tileMeta.LEGEND */
  rows: readonly string[]
  spawns: LevelSpawns
}

export interface ParsedLevel {
  /** grid[x + y * LEVEL_W];x 列(左→右),y 行(自底向上,0 = 地面行) */
  grid: Uint8Array
  width: number
  height: number
  spawns: LevelSpawns
}

export function tileAt(level: ParsedLevel, x: number, y: number): TileCode {
  return level.grid[x + y * level.width] as TileCode
}

/** 校验 + 转码:行数/行长/图例全覆盖,非法即抛(地图错误在启动即暴露,而非玩法中偶发) */
export function parseLevel(def: LevelDef): ParsedLevel {
  if (def.rows.length !== LEVEL_H)
    throw new Error(`关卡行数 ${def.rows.length} ≠ LEVEL_H ${LEVEL_H}`)
  const grid = new Uint8Array(LEVEL_W * LEVEL_H)
  for (let r = 0; r < LEVEL_H; r++) {
    const row = def.rows[r]!
    if (row.length !== LEVEL_W)
      throw new Error(`关卡第 ${r} 行长度 ${row.length} ≠ LEVEL_W ${LEVEL_W}`)
    const y = LEVEL_H - 1 - r // 行 0 = 顶行 → y = 14
    for (let x = 0; x < LEVEL_W; x++) {
      const code = LEGEND[row[x]!]
      if (code === undefined)
        throw new Error(`关卡 (${x},${y}) 非法字符 '${row[x]}'`)
      grid[x + y * LEVEL_W] = code
    }
  }
  return { grid, width: LEVEL_W, height: LEVEL_H, spawns: def.spawns }
}
