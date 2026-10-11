/**
 * 分轴 AABB 碰撞解析(DESIGN §7):先 X 后 Y,逐轴推出。
 * 每步位移 ≤ 0.33 瓦片(6.4 t/s 跑速、20 t/s 终坠 × 1/60)< 1 瓦片实体厚度
 * → 无穿透,无需扫掠。纯函数、零依赖,黄金回归直接断言。
 */

export interface AABB {
  minX: number
  maxX: number
  minY: number
  maxY: number
  /** 单向平台(DESIGN §7.3):下落可站、上升与横移可穿 */
  semisolid?: boolean
}

/** 中心点 + 全宽高 → AABB */
export function aabb(cx: number, cy: number, w: number, h: number): AABB {
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2 }
}

/**
 * 严格相交(贴边不算碰撞 → 站立/落地无抖动)。
 * EPS 吸收 IEEE-754 的 1-ulp 误差:如 1.4 − 0.4 = 0.9999999999999999,
 * 站立实体的底边会比地面顶面低 1 ulp → 若不加容差,会被当成嵌入实体,
 * X 轴推出把它横抛到实体远端(板栗仔出生即"瞬移"到坑缘)。
 * 1e-9 ≪ 每步最小位移(重力首步 ≈ 0.018),不会吞掉真实碰撞。
 */
const EPS = 1e-9
export function overlaps(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minY < b.maxY - EPS && a.maxY > b.minY + EPS
}

export function pointInside(solids: readonly AABB[], x: number, y: number): boolean {
  for (const s of solids) {
    if (x >= s.minX && x <= s.maxX && y >= s.minY && y <= s.maxY) return true
  }
  return false
}

export interface Mover {
  x: number
  y: number
  w: number
  h: number
  /** 本步位移(已乘 dt) */
  dx: number
  dy: number
}

export interface SlideResult {
  x: number
  y: number
  hitWall: boolean
  onGround: boolean
  /** 顶到的实体在 solids 中的下标;-1 = 没顶到 */
  ceiling: number
}

/** 单向平台站立判据容差:步前脚底不低于台顶(含 1-ulp 误差)才接住 */
const SEMI_EPS = 1e-6

export function moveAndSlide(m: Mover, solids: readonly AABB[]): SlideResult {
  let { x, y } = m
  let hitWall = false
  let onGround = false
  let ceiling = -1
  const prevBottom = m.y - m.h / 2 // 单向平台判据:本步之前的脚底高度

  // X 轴:推出到贴边(单向平台横移无阻挡,§7.3)
  x += m.dx
  if (m.dx !== 0) {
    for (const s of solids) {
      if (s.semisolid) continue
      if (!overlaps(aabb(x, y, m.w, m.h), s)) continue
      x = m.dx > 0 ? s.minX - m.w / 2 : s.maxX + m.w / 2
      hitWall = true
    }
  }

  // Y 轴:下落站顶、上升顶头(记下标供顶砖判定)
  y += m.dy
  if (m.dy !== 0) {
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i]!
      if (s.semisolid) {
        // 仅下落且步前脚底已在台顶之上才接住;上升从下方穿过
        if (m.dy < 0 && prevBottom >= s.maxY - SEMI_EPS && overlaps(aabb(x, y, m.w, m.h), s)) {
          y = s.maxY + m.h / 2
          onGround = true
        }
        continue
      }
      if (!overlaps(aabb(x, y, m.w, m.h), s)) continue
      if (m.dy > 0) {
        y = s.minY - m.h / 2
        ceiling = i
      } else {
        y = s.maxY + m.h / 2
        onGround = true
      }
    }
  }

  return { x, y, hitWall, onGround, ceiling }
}
