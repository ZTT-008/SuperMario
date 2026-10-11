import { describe, expect, it } from 'vitest'
import { Game } from '../Game'
import {
  FIXED_DT,
  FLAG_X,
  GROUND_TOP_Y,
  START_LIVES,
  START_TIME,
  WATER_ZONE,
} from '../constants'
import { tileAt } from '../level/LevelParser'
import { TILE } from '../level/tileMeta'
import { DEFAULT_PHYSICS as P } from '../physics/PhysicsConfig'
import type { GrayBoxEntity } from '../Game'
import type { HudSnapshot, Phase } from '../types'

/**
 * M1+M2 玩法闭环回归:碰撞不穿墙、顶砖出币、踩杀/碰杀、触水/尖刺死亡、
 * 空中敌三态、单向平台、浮台携带、旗杆过关、就地重置。
 * 直接摆实体 + 步进固定帧,不依赖输入/渲染。
 */
function newGame() {
  const phases: Phase[] = []
  let hud: HudSnapshot = {
    score: 0,
    coins: 0,
    time: START_TIME,
    lives: START_LIVES,
    mario: 'small',
  }
  const game = new Game({
    onPhase: (p) => phases.push(p),
    onHud: (s) => {
      hud = s
    },
  })
  game.start()
  const ent = (kind: GrayBoxEntity['kind']): GrayBoxEntity =>
    game.entities.find((e) => e.kind === kind)!
  const count = (kind: GrayBoxEntity['kind']): number =>
    game.entities.filter((e) => e.kind === kind).length
  const run = (frames: number, stop?: () => boolean): void => {
    for (let i = 0; i < frames; i++) {
      game.frame(FIXED_DT)
      if (stop?.()) return
    }
  }
  return { game, phases, ent, count, run, get hud() { return hud } }
}

const standY = (m: GrayBoxEntity): number => GROUND_TOP_Y + m.size.y / 2

describe('Game 实体构成(网格 + spawn 表)', () => {
  it('网格实体:问号 4 / 木箱 6;spawn 实体:板栗 12 / 蝠 4 / 鸟 2 / 飞怪 2 / 浮台 3', () => {
    const g = newGame()
    expect(g.count('question')).toBe(4)
    expect(g.count('crate')).toBe(6)
    expect(g.count('goomba')).toBe(12)
    expect(g.count('bat')).toBe(4)
    expect(g.count('bird')).toBe(2)
    expect(g.count('paratroopa')).toBe(2)
    expect(g.count('platform')).toBe(3)
  })

  it('首个网格实体中心在瓦片中心:crate x=9.5、question x=7.5;首只板栗 x=24 在实地', () => {
    const g = newGame()
    expect(g.ent('crate').pos.x).toBeCloseTo(9.5, 10)
    expect(g.ent('question').pos.x).toBeCloseTo(7.5, 10)
    const goomba = g.ent('goomba')
    expect(goomba.pos.x).toBe(24)
    expect(tileAt(g.game.level, 24, 0)).toBe(TILE.dirt)
    expect(goomba.pos.y).toBeCloseTo(GROUND_TOP_Y + goomba.size.y / 2, 10)
  })
})

describe('Game 地面闭环', () => {
  it('全速奔跑撞上木箱被推出,不穿墙', () => {
    const g = newGame()
    const m = g.ent('mario')
    const crate = g.ent('crate')
    m.pos = { x: crate.pos.x - 1.5, y: standY(m) }
    m.vel = { x: P.runMax, y: 0 }
    g.run(90)
    const wallX = crate.pos.x - crate.size.x / 2 - m.size.x / 2
    expect(m.pos.x).toBeLessThanOrEqual(wallX + 1e-6)
    expect(m.pos.x).toBeGreaterThan(wallX - 0.5) // 贴住墙而非弹开
  })

  it('从下方顶问号砖:变已用、+1 金币 +200 分、bumpT 启动动画', () => {
    const g = newGame()
    const m = g.ent('mario')
    const q = g.ent('question')
    m.pos = { x: q.pos.x, y: q.pos.y - q.size.y / 2 - m.size.y / 2 - 0.02 }
    m.vel = { x: 0, y: P.jumpVel }
    g.run(30, () => q.used === true)
    expect(q.used).toBe(true)
    expect(q.bumpT).toBeGreaterThan(0) // 渲染层据此弹金币
    expect(g.hud.coins).toBe(1)
    expect(g.hud.score).toBe(200)
  })

  it('下落踩板栗仔:踩扁 +100 分并弹跳', () => {
    const g = newGame()
    const m = g.ent('mario')
    const s = g.ent('goomba')
    m.pos = { x: s.pos.x, y: s.pos.y + s.size.y / 2 + m.size.y / 2 + 0.05 }
    m.vel = { x: 0, y: -5 }
    g.run(30, () => s.dead === true)
    expect(s.dead).toBe(true)
    expect(g.hud.score).toBeGreaterThanOrEqual(100)
    expect(m.vel.y).toBeGreaterThan(0) // stompBounce
  })

  it('平碰板栗仔:死亡扣命(非踩杀判据)', () => {
    const g = newGame()
    const m = g.ent('mario')
    const s = g.ent('goomba')
    m.pos = { x: s.pos.x - 0.6, y: standY(m) }
    m.vel = { x: 3, y: 0 }
    g.run(30, () => (m.dyingT ?? 0) > 0)
    expect(m.dyingT ?? 0).toBeGreaterThan(0)
    expect(g.hud.lives).toBe(START_LIVES - 1)
  })

  it('踏上尖刺:盒重叠即死(不可跳免死)', () => {
    const g = newGame()
    const m = g.ent('mario')
    m.pos = { x: 48.5, y: standY(m) } // 尖刺瓦 x=48,49
    m.vel = { x: 0, y: 0 }
    g.run(3)
    expect(m.dyingT ?? 0).toBeGreaterThan(0)
  })

  it('落入水域:触水即死', () => {
    const g = newGame()
    const m = g.ent('mario')
    m.pos = { x: (WATER_ZONE[0] + WATER_ZONE[1]) / 2, y: 1.2 }
    m.vel = { x: 0, y: 0 }
    g.run(5)
    expect(m.dyingT ?? 0).toBeGreaterThan(0)
  })

  it('越过旗杆:过关 + 时间奖励', () => {
    const g = newGame()
    const m = g.ent('mario')
    m.pos = { x: FLAG_X - 1, y: standY(m) }
    m.vel = { x: P.runMax, y: 0 }
    g.run(120, () => g.phases.includes('clear'))
    expect(g.phases).toContain('clear')
    expect(g.hud.score).toBeGreaterThanOrEqual(2000)
  })
})

describe('Game 空中敌对', () => {
  it('下落踩蝙蝠:踩扁 +100 分并弹跳', () => {
    const g = newGame()
    const m = g.ent('mario')
    const b = g.ent('bat')
    m.pos = { x: b.pos.x, y: b.pos.y + b.size.y / 2 + m.size.y / 2 + 0.05 }
    m.vel = { x: 0, y: -5 }
    g.run(30, () => b.dead === true)
    expect(b.dead).toBe(true)
    expect(g.hud.score).toBeGreaterThanOrEqual(100)
    expect(m.vel.y).toBeGreaterThan(0)
  })

  it('马里奥进入俯冲窗:鸟从栖息转 dive 并下坠', () => {
    const g = newGame()
    const m = g.ent('mario')
    const b = g.ent('bird')
    expect(b.state).toBe('perch')
    m.pos = { x: b.spawnX!, y: standY(m) } // 正下方地面
    m.vel = { x: 0, y: 0 }
    g.run(5)
    expect(b.state).toBe('dive')
    expect(b.vel.y).toBeLessThan(0)
  })

  it('鸟坠出世界:回栖循环(perch + 出生点)', () => {
    const g = newGame()
    const m = g.ent('mario')
    const b = g.ent('bird')
    m.pos = { x: b.spawnX!, y: standY(m) }
    g.run(12) // 触发 dive
    expect(b.state).toBe('dive')
    m.pos = { x: 5, y: standY(m) } // 离开窗口,让鸟自由坠落
    g.run(180, () => b.state === 'perch')
    expect(b.state).toBe('perch')
    expect(b.pos.x).toBe(b.spawnX!)
    expect(b.pos.y).toBe(b.spawnY!)
  })

  it('飞怪三态:首踩坠落不记分 → 落地转爬 → 再踩踩扁 +100', () => {
    const g = newGame()
    const m = g.ent('mario')
    const p = g.ent('paratroopa')
    expect(p.state).toBe('fly')
    // 第一踩:壳坠落,不记分
    m.pos = { x: p.pos.x, y: p.pos.y + p.size.y / 2 + m.size.y / 2 + 0.05 }
    m.vel = { x: 0, y: -5 }
    g.run(30, () => p.state === 'fall')
    expect(p.state).toBe('fall')
    expect(g.hud.score).toBe(0)
    // 拉开距离,壳自由落地转 walk
    m.pos = { x: p.x0! - 4, y: standY(m) }
    m.vel = { x: 0, y: 0 }
    g.run(150, () => p.state === 'walk')
    expect(p.state).toBe('walk')
    // 第二踩:踩扁 +100
    m.pos = { x: p.pos.x, y: p.pos.y + p.size.y / 2 + m.size.y / 2 + 0.05 }
    m.vel = { x: 0, y: -5 }
    g.run(30, () => p.dead === true)
    expect(p.dead).toBe(true)
    expect(g.hud.score).toBe(100)
  })
})

describe('Game 地形机制', () => {
  it('单向平台桥:从下方跳起穿过、过顶后落回站稳', () => {
    const g = newGame()
    const m = g.ent('mario')
    m.pos = { x: 131.5, y: 3.0 } // 桥(顶 y=4)正下方的坑中
    m.vel = { x: 0, y: P.jumpVel }
    let peak = m.pos.y
    g.run(120, () => {
      peak = Math.max(peak, m.pos.y)
      return m.onGround
    })
    expect(peak).toBeGreaterThan(4.5) // 上升段无 ceiling,穿到台顶之上
    expect(m.onGround).toBe(true)
    expect(m.pos.y).toBeCloseTo(4 + m.size.y / 2, 6) // 落回被接住
  })

  it('移动浮台携带:马里奥位移 = 台位移(确定性)', () => {
    const a = newGame()
    const b = newGame()
    const results = [a, b].map((g) => {
      const m = g.ent('mario')
      const p = g.ent('platform')
      m.pos = { x: p.pos.x, y: p.pos.y + p.size.y / 2 + m.size.y / 2 }
      m.vel = { x: 0, y: 0 }
      g.run(60)
      return { mx: m.pos.x, px: p.pos.x, onGround: m.onGround }
    })
    const [r1, r2] = results as [
      { mx: number; px: number; onGround: boolean },
      { mx: number; px: number; onGround: boolean },
    ]
    expect(r1.onGround).toBe(true)
    expect(r1.px).toBeGreaterThan(103) // 台确实巡航了
    expect(Math.abs(r1.mx - r1.px)).toBeLessThan(1e-6) // 人被台带着走
    expect(r1.mx).toBe(r2.mx) // 两局逐位一致(无随机)
  })

  it('restart 就地重置:实体回位、全部敌人复活复位、HUD 归零(引用不变)', () => {
    const g = newGame()
    const m = g.ent('mario')
    const s = g.ent('goomba')
    const bat = g.ent('bat')
    const bird = g.ent('bird')
    const para = g.ent('paratroopa')
    const plat = g.ent('platform')
    const sRef = s
    m.pos = { x: FLAG_X - 1, y: standY(m) }
    m.vel = { x: P.runMax, y: 0 }
    g.run(120, () => g.phases.includes('clear'))
    s.dead = true
    g.game.restart()
    expect(g.game.phase).toBe('ready')
    expect(m.pos.x).toBe(3) // MARIO_SPAWN_X
    expect(g.ent('goomba')).toBe(sRef) // ViewRegistry 绑定引用不变
    expect(sRef.dead).toBe(false)
    expect(bat.pos.x).toBe(bat.x0!) // 空中敌全部复位(重生不被蹲守)
    expect(bird.state).toBe('perch')
    expect(para.state).toBe('fly')
    expect(plat.pos.x).toBe(plat.x0!)
    expect(g.hud.score).toBe(0)
    expect(g.hud.coins).toBe(0)
    expect(g.hud.lives).toBe(START_LIVES)
  })
})
