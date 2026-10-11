/**
 * 1-1 关卡 ASCII 地图(DESIGN §8.1)。15 行 × 211 列,行 0 = 顶行。
 * 图例:'#' 泥土 'X' 砖(实心)'?' 问号 'C' 木箱 'P' 管道
 *       '=' 单向平台 '^' 阶梯 's' 尖刺(非实心,触杀)'.' 空。
 * 敌人/浮台不进地图,走 spawns 表;样式带见 constants.STYLE_ZONES。
 *
 * 地形布局(世界 y 自底,地面占行 y=0,顶面 y=1):
 *   地面段 [0,71) [74,101) [105,130) [133,143) [147,169) [173,211)
 *   坑 71–73(3 格)101–104(4 格,浮台 1)130–132(3 格,单向桥)169–172(4 格,浮台 3)
 *   水域 143–146(浮台 2,见 WATER_ZONE);旗杆 x=198 不变。
 */
import { LEVEL_H, LEVEL_W } from '../constants'
import type { LevelDef } from './LevelParser'

const cells: string[][] = Array.from(
  { length: LEVEL_H },
  () => Array.from({ length: LEVEL_W }, () => '.'),
)

/** 刷矩形:x∈[x0,x1)、y∈[y0,y1),世界坐标(y 自底) */
function rect(x0: number, x1: number, y0: number, y1: number, ch: string): void {
  for (let x = x0; x < x1; x++)
    for (let y = y0; y < y1; y++) cells[LEVEL_H - 1 - y]![x] = ch
}
/** 单列 y∈[y0,y1) */
function column(x: number, y0: number, y1: number, ch: string): void {
  rect(x, x + 1, y0, y1, ch)
}
/** 单行 x∈[x0,x1) */
function row(y: number, x0: number, x1: number, ch: string): void {
  rect(x0, x1, y, y + 1, ch)
}

// ── 地面:单行 y=0,顶面 y=1;段间即坑/水 ──
for (const [a, b] of [
  [0, 71],
  [74, 101],
  [105, 130],
  [133, 143],
  [147, 169],
  [173, 211],
] as const)
  row(0, a, b, '#')

// ── 管道 h2–h4:当墙跳越 ──
column(30, 1, 3, 'P')
column(52, 1, 4, 'P')
column(120, 1, 3, 'P')
column(158, 1, 5, 'P')

// ── 阶梯:152–155 升(高 1..4)、163–166 降(高 4..1)──
for (let i = 0; i < 4; i++) {
  column(152 + i, 1, 2 + i, '^')
  column(163 + i, 1, 5 - i, '^')
}

// ── 浮空砖排(实心,踩不到头顶当天花板)与问号砖 ──
row(5, 36, 39, 'X')
row(5, 112, 115, 'X')
row(6, 178, 181, 'X')
for (const [x, y] of [[7, 5], [26, 5], [96, 5], [126, 5]] as const)
  column(x, y, y + 1, '?')

// ── 单向平台桥:顶面 y=4(跳顶 4.26 恰好可达),上升穿过、下落站立 ──
row(3, 129, 134, '=')

// ── 尖刺:非实心、触之即死,只能跳过 ──
for (const x of [48, 49, 107, 108, 176]) column(x, 1, 2, 's')

// ── 木箱堆:经典 1/2/3 阶梯(首个 x=9,保住测试首匹配)──
column(9, 1, 2, 'C')
column(13, 1, 3, 'C')
column(17, 1, 4, 'C')

export const LEVEL_1_1: LevelDef = {
  rows: cells.map((r) => r.join('')),
  spawns: {
    // 板栗仔 ×12:成对错位、逐段分布;间距 ≥4、全在实地、避开管道/箱堆
    goomba: [24, 28, 40, 45, 60, 64, 78, 84, 95, 110, 115, 185],
    // 蝙蝠 ×4:悬于坑与桥上方,y = baseY + amp·sin(t·2 + phase)
    bat: [
      { x0: 70, x1: 74, baseY: 4, amp: 1, phase: 0 },
      { x0: 35, x1: 40, baseY: 5, amp: 0.8, phase: 1.7 },
      { x0: 128, x1: 134, baseY: 5.5, amp: 1, phase: 3.4 },
      { x0: 168, x1: 173, baseY: 4.5, amp: 1, phase: 5.1 },
    ],
    // 俯冲鸟 ×2:高栖,马里奥入窗即俯冲
    bird: [
      { x: 55, y: 7 },
      { x: 160, y: 8 },
    ],
    // 飞怪 ×2:高空巡逻,被踩坠地变地爬
    paratroopa: [
      { x0: 42, x1: 50, y: 5 },
      { x0: 118, x1: 126, y: 5.5 },
    ],
    // 移动浮台 ×3:横跨 4 格坑与水域;y = 台顶面高度
    platform: [
      { x0: 101.5, x1: 103.5, y: 2, w: 2 },
      { x0: 143.5, x1: 145.5, y: 2, w: 2 },
      { x0: 169.5, x1: 171.5, y: 2, w: 2 },
    ],
  },
}
