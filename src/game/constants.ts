/** 全局常量。单位:瓦片(t)、秒。1 瓦片 = 1 世界单位。 */

export const LEVEL_W = 211
export const LEVEL_H = 15
/** 地面占网格行 y = 0,顶面 y = 1(自底向上,世界原点在最左下) */
export const GROUND_TOP_Y = 1

/** 正交相机半高:竖向恰可见 15 瓦片,忠实原版构图 */
export const CAM_HALF_H = 7.5
/** 水平跟随死区(±瓦片),区内相机不动 */
export const CAM_DEADZONE = 1.5

export const FIXED_DT = 1 / 60
/** 单帧最多固定步数,超出丢弃积压(慢机器降物理频率而非螺旋卡死) */
export const MAX_STEPS_PER_FRAME = 5
/** 真实帧时间钳制,防卡顿雪崩 */
export const MAX_FRAME_DT = 0.1

/** 原版倒计时节奏:约 0.4s 减 1 */
export const TIME_TICK_SECONDS = 0.4
/** 与原版 1-1 同长:400 格 × 0.4s/格 ≈ 160s 实况(250 时仅 100s,敌潮+水域下体感过紧) */
export const START_TIME = 400
export const START_LIVES = 3

// ── 关卡 1-1:地形见 level/Level1_1.ts(ASCII 网格),此处只留全局危险区 ──
/** 危险水域 [start, end):落入即死亡(水面顶 y) */
export const WATER_ZONE: readonly [number, number] = [143, 147]
export const WATER_TOP_Y = 0.9
/** 掉出世界底部的死亡线 */
export const DEATH_Y = -3
/** 旗杆 x:马里奥越过即过关 */
export const FLAG_X = 198

/** 地形样式带 [x0, x1):ChunkBuilder 按区间给 dirt/cap 实例换材质(每样式独立实例网格,+0 draw) */
export type TerrainStyle = 'grass' | 'stone' | 'snow'
export const STYLE_ZONES: readonly { x0: number; x1: number; style: TerrainStyle }[] = [
  { x0: 0, x1: 71, style: 'grass' },
  { x0: 71, x1: 143, style: 'stone' },
  { x0: 143, x1: 211, style: 'snow' },
]
