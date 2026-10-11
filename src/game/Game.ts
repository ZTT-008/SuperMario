import {
  DEATH_Y,
  FLAG_X,
  GROUND_TOP_Y,
  LEVEL_W,
  START_LIVES,
  START_TIME,
  TIME_TICK_SECONDS,
  WATER_TOP_Y,
  WATER_ZONE,
} from './constants'
import { FixedStepLoop } from './FixedStepLoop'
import { InputManager } from './input/InputManager'
import { LEVEL_1_1 } from './level/Level1_1'
import { parseLevel, type ParsedLevel } from './level/LevelParser'
import { layerOf, TILE, type TileCode } from './level/tileMeta'
import { DEFAULT_PHYSICS as P } from './physics/PhysicsConfig'
import { aabb, moveAndSlide, overlaps, pointInside, type AABB } from './physics/TileResolver'
import type { GameHooks, HudSnapshot, InputState, Phase, Vec2, WorldEntity } from './types'

/** M2 灰盒实体;M3 起被 entities/ 下的正式实体类替换(接口不变) */
export interface GrayBoxEntity extends WorldEntity {
  kind:
    | 'mario'
    | 'crate'
    | 'question'
    | 'goomba'
    | 'bat'
    | 'bird'
    | 'paratroopa'
    | 'platform'
    | 'flag'
    | 'water'
  vel: Vec2
  onGround: boolean
  /** 巡逻/巡航方向(-1 左行) */
  dir?: number
  /** 敌人:被踩扁 */
  dead?: boolean
  deadT?: number
  /** 敌人/浮台:出生点(死亡/重开重置) */
  spawnX?: number
  spawnY?: number
  /** 敌人状态机:bird perch|dive;paratroopa fly|fall|walk */
  state?: string
  /** 确定性动画/运动计时(实体本地累加器,禁 Math.random) */
  t?: number
  /** 蝙蝠/飞怪/浮台:巡航区间 [x0, x1] */
  x0?: number
  x1?: number
  /** 蝙蝠:y = baseY + amp·sin(t·2 + phase) */
  baseY?: number
  amp?: number
  phase?: number
  /** 问号砖:顶砖动画计时(0 = 静止),渲染层读它做弹跳 + 金币弹出 */
  bumpT?: number
  used?: boolean
  /** 马里奥:死亡动画计时(>0 期间不受控) */
  dyingT?: number
  /** 马里奥:重生无敌剩余 */
  invT?: number
}

const MARIO_SPAWN_X = 3
const BUMP_DURATION = 0.6
/** 可踩敌人集合(踩头 = 踩杀;平碰 = 死亡) */
const STOMPABLE: ReadonlySet<GrayBoxEntity['kind']> = new Set([
  'goomba',
  'bat',
  'bird',
  'paratroopa',
])
/** 需要复位的全部动态实体(重生/重开共用,漏一个就会蹲守重生点) */
const RESETTABLE: ReadonlySet<GrayBoxEntity['kind']> = new Set([
  'goomba',
  'bat',
  'bird',
  'paratroopa',
  'platform',
])

/**
 * 玩法总编排 + 游戏阶段状态机(DESIGN §5.2)。纯 TS,零渲染依赖。
 * M2:ASCII 网格地形(单向平台 §7.3)、尖刺/坑/水危险区、
 * 地面敌 + 三种空中敌(蝙蝠/俯冲鸟/飞怪)、移动浮台(动态刚体 + 携带)。
 * 渲染层只读实体字段做动画;地形渲染移交 ChunkBuilder(读 level.grid)。
 */
export class Game {
  phase: Phase = 'ready'
  /** 解析后的关卡网格(spawn 表一并在此;ChunkBuilder 读 grid 建实例地形) */
  readonly level: ParsedLevel
  readonly entities: GrayBoxEntity[]

  /** 静态碰撞盒:网格实心段(逐行水平合并)+ 木箱/问号砖实体;构造时快照一次 */
  private readonly solids: AABB[] = []
  private readonly solidEntities: (GrayBoxEntity | null)[] = []
  /** 尖刺盒(非实心,触杀由 checkHazards 判) */
  private readonly spikeAABBs: AABB[] = []
  /** 动态刚体:移动浮台,每步重建(仅 3 个,开销可忽略) */
  private readonly dynamicSolids: AABB[] = []
  private readonly dynamicEntities: GrayBoxEntity[] = []
  /** 本步生效碰撞盒 = 静态 + 动态;moveAndSlide / 探边 / 携带全部走它 */
  private activeSolids: AABB[] = []
  private activeSolidEntities: (GrayBoxEntity | null)[] = []

  private readonly hooks: GameHooks
  private readonly loop = new FixedStepLoop()
  private readonly input = new InputManager()
  private hud: HudSnapshot = {
    score: 0,
    coins: 0,
    time: START_TIME,
    lives: START_LIVES,
    mario: 'small',
  }
  private timeAcc = 0

  constructor(hooks: GameHooks) {
    this.hooks = hooks
    this.level = parseLevel(LEVEL_1_1)
    this.entities = this.buildLevel()
    this.rebuildSolids()
    this.activeSolids = this.solids
    this.activeSolidEntities = this.solidEntities
    this.input.setCommandHandler((cmd) => {
      if (cmd === 'pauseToggle') {
        if (this.phase === 'playing') this.pause()
        else if (this.phase === 'paused') this.resume()
      } else if (cmd === 'restart') {
        this.restart()
      }
    })
  }

  /** 灰盒实体发射:木箱/问号来自网格(列升序 → 首个 x9/x7),敌与浮台来自 spawn 表 */
  private buildLevel(): GrayBoxEntity[] {
    const list: GrayBoxEntity[] = []
    const { grid, width, height, spawns } = this.level

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const code = grid[x + y * width] as TileCode
        if (code === TILE.crate) {
          list.push(this.makeStatic(`crate-${x}-${y}`, 'crate', { x: x + 0.5, y: y + 0.5 }, { x: 1, y: 1 }))
        } else if (code === TILE.question) {
          const q = this.makeStatic(`question-${x}`, 'question', { x: x + 0.5, y: y + 0.5 }, { x: 1, y: 1 })
          q.bumpT = 0
          list.push(q)
        }
      }
    }

    spawns.goomba.forEach((x, i) => {
      const g = this.makeStatic(`goomba-${i}`, 'goomba', { x, y: GROUND_TOP_Y + 0.4 }, { x: 0.8, y: 0.8 })
      g.dir = -1
      g.spawnX = x
      list.push(g)
    })
    spawns.bat.forEach((b, i) => {
      const e = this.makeStatic(`bat-${i}`, 'bat', { x: b.x0, y: b.baseY + b.amp * Math.sin(b.phase) }, { x: 0.8, y: 0.7 })
      e.spawnX = b.x0
      e.x0 = b.x0
      e.x1 = b.x1
      e.baseY = b.baseY
      e.amp = b.amp
      e.phase = b.phase
      e.dir = -1
      e.t = 0
      list.push(e)
    })
    spawns.bird.forEach((b, i) => {
      const e = this.makeStatic(`bird-${i}`, 'bird', { x: b.x, y: b.y }, { x: 0.9, y: 0.7 })
      e.spawnX = b.x
      e.spawnY = b.y
      e.state = 'perch'
      e.t = 0
      list.push(e)
    })
    spawns.paratroopa.forEach((p, i) => {
      const e = this.makeStatic(`para-${i}`, 'paratroopa', { x: p.x0, y: p.y }, { x: 0.8, y: 0.9 })
      e.spawnX = p.x0
      e.spawnY = p.y
      e.x0 = p.x0
      e.x1 = p.x1
      e.state = 'fly'
      e.dir = -1
      e.t = 0
      list.push(e)
    })
    spawns.platform.forEach((p, i) => {
      const e = this.makeStatic(`platform-${i}`, 'platform', { x: p.x0, y: p.y - 0.25 }, { x: p.w, y: 0.5 })
      e.spawnX = p.x0
      e.spawnY = p.y
      e.x0 = p.x0
      e.x1 = p.x1
      e.dir = 1
      list.push(e)
    })

    list.push(
      this.makeStatic('water-0', 'water', { x: (WATER_ZONE[0] + WATER_ZONE[1]) / 2, y: 0.3 }, { x: WATER_ZONE[1] - WATER_ZONE[0], y: 1.4 }),
    )
    list.push(this.makeStatic('flag-0', 'flag', { x: FLAG_X, y: 5.5 }, { x: 0.5, y: 9 }))

    const mario = this.makeStatic('mario', 'mario', { x: MARIO_SPAWN_X, y: GROUND_TOP_Y + 0.475 }, { x: 0.8, y: 0.95 })
    list.push(mario)
    return list
  }

  /**
   * 网格 → 静态碰撞盒:逐行扫描,水平连续实心瓦片合并成段 AABB
   * (全关卡 ≈30 个盒,不是几千);木箱/问号仍走实体(顶砖反查 + 测试引用)。
   */
  private rebuildSolids(): void {
    const { grid, width, height } = this.level
    for (let y = 0; y < height; y++) {
      let runStart = -1
      let runCode = -1
      for (let x = 0; x <= width; x++) {
        const code = x < width ? (grid[x + y * width] as TileCode) : (-1 as TileCode)
        const layer = code >= 0 ? layerOf(code) : 'none'
        const mergeable =
          layer === 'semisolid' ||
          (layer === 'solid' && code !== TILE.question && code !== TILE.crate)
        if (code === runCode && mergeable) continue
        if (runStart >= 0) {
          this.solids.push({
            minX: runStart,
            maxX: x,
            minY: y,
            maxY: y + 1,
            semisolid: layerOf(runCode as TileCode) === 'semisolid',
          })
          this.solidEntities.push(null)
        }
        runStart = mergeable ? x : -1
        runCode = mergeable ? code : -1
      }
    }
    for (const e of this.entities) {
      if (e.kind === 'crate' || e.kind === 'question') {
        this.solids.push(aabb(e.pos.x, e.pos.y, e.size.x, e.size.y))
        this.solidEntities.push(e)
      }
    }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (grid[x + y * width] === TILE.spike)
          this.spikeAABBs.push({ minX: x, maxX: x + 1, minY: y, maxY: y + 1 })
  }

  /** 每步重建动态盒并拼接(一次/步,全部 mover 共用同一列表) */
  private buildDynamicSolids(): void {
    this.dynamicSolids.length = 0
    this.dynamicEntities.length = 0
    for (const e of this.entities) {
      if (e.kind !== 'platform') continue
      this.dynamicSolids.push(aabb(e.pos.x, e.pos.y, e.size.x, e.size.y))
      this.dynamicEntities.push(e)
    }
    this.activeSolids = this.solids.concat(this.dynamicSolids)
    this.activeSolidEntities = this.solidEntities.concat(this.dynamicEntities)
  }

  private makeStatic(id: string, kind: GrayBoxEntity['kind'], pos: Vec2, size: Vec2): GrayBoxEntity {
    return { id, kind, pos: { ...pos }, prevPos: { ...pos }, vel: { x: 0, y: 0 }, size, z: 0, onGround: true }
  }

  private find(kind: GrayBoxEntity['kind']): GrayBoxEntity {
    return this.entities.find((e) => e.kind === kind)!
  }

  attachInput(target: Window & typeof globalThis): void {
    this.input.attach(target)
  }

  // ── UI → 引擎命令 ────────────────────────────────────────────────
  start(): void {
    if (this.phase !== 'ready') return
    this.setPhase('playing')
    this.emitHud()
  }

  pause(): void {
    if (this.phase !== 'playing') return
    this.setPhase('paused')
  }

  resume(): void {
    if (this.phase !== 'paused') return
    this.loop.reset() // 恢复瞬间不追帧
    this.setPhase('playing')
  }

  /** 就地重置全部实体(ViewRegistry 绑定的是对象引用,不能换对象) */
  restart(): void {
    for (const e of this.entities) {
      e.vel = { x: 0, y: 0 }
      e.onGround = true
      e.dead = false
      e.deadT = 0
      e.bumpT = 0
      e.used = false
      e.dyingT = 0
      e.invT = 0
      if (e.kind === 'mario') {
        e.pos = { x: MARIO_SPAWN_X, y: GROUND_TOP_Y + e.size.y / 2 }
        e.prevPos = { ...e.pos }
      } else if (RESETTABLE.has(e.kind)) {
        this.resetEnemy(e)
      }
    }
    this.hud = { score: 0, coins: 0, time: START_TIME, lives: START_LIVES, mario: 'small' }
    this.timeAcc = 0
    this.loop.reset()
    this.input.clearAll()
    this.setPhase('ready')
    this.emitHud()
  }

  /** 动态实体复位:出生点 + 相位归 0 + 状态机回初始(就地 mutate) */
  private resetEnemy(e: GrayBoxEntity): void {
    e.dead = false
    e.deadT = 0
    e.vel = { x: 0, y: 0 }
    e.t = 0
    switch (e.kind) {
      case 'goomba':
        e.pos = { x: e.spawnX!, y: GROUND_TOP_Y + e.size.y / 2 }
        e.dir = -1
        break
      case 'bat':
        e.pos = { x: e.x0!, y: e.baseY! + e.amp! * Math.sin(e.phase!) }
        e.dir = -1
        break
      case 'bird':
        e.pos = { x: e.spawnX!, y: e.spawnY! }
        e.state = 'perch'
        break
      case 'paratroopa':
        e.pos = { x: e.x0!, y: e.spawnY! }
        e.state = 'fly'
        e.dir = -1
        break
      case 'platform':
        e.pos = { x: e.x0!, y: e.spawnY! - e.size.y / 2 }
        e.dir = 1
        break
    }
    e.prevPos = { ...e.pos }
  }

  dispose(): void {
    this.input.detach()
  }

  // ── 引擎驱动 ────────────────────────────────────────────────────
  /**
   * 每个渲染帧调用一次。仅 playing 阶段推进世界;其余阶段返回 alpha=1
   * (渲染停在当前状态)。
   * @returns 渲染插值系数,交给 ViewRegistry.sync(alpha)
   */
  frame(realDt: number): number {
    if (this.phase !== 'playing') return 1
    const { alpha } = this.loop.advance(realDt, (dt) => this.step(dt))
    return alpha
  }

  /** 单个固定步:浮台 → 携带 → 马里奥 → 敌人 → 接触/危险/过关判定 → 计时 */
  private step(dt: number): void {
    const mario = this.find('mario')

    if ((mario.dyingT ?? 0) > 0) {
      // 死亡动画:自由坠落一小段,计时无敌,到点重生
      mario.dyingT! -= dt
      mario.vel.y -= 30 * dt
      mario.pos.y += mario.vel.y * dt
      if (mario.dyingT! <= 0) this.respawnMario(mario)
    } else {
      if ((mario.invT ?? 0) > 0) mario.invT! -= dt
      for (const e of this.entities) {
        if (e.kind === 'platform') this.stepPlatform(e, dt)
      }
      this.buildDynamicSolids()
      this.carryMario(mario)
      this.stepMario(mario, this.input.sample(), dt)
      for (const e of this.entities) {
        if (e.kind === 'goomba') this.stepGoomba(e, dt)
        else if (e.kind === 'bat') this.stepBat(e, dt)
        else if (e.kind === 'bird') this.stepBird(e, mario, dt)
        else if (e.kind === 'paratroopa') this.stepParatroopa(e, dt)
      }
      for (const e of this.entities) {
        if (e.kind === 'question' && (e.bumpT ?? 0) > 0) {
          e.bumpT = e.bumpT! + dt >= BUMP_DURATION ? 0 : e.bumpT! + dt
        }
      }
      this.checkContacts(mario)
      this.checkHazards(mario)
      this.checkWin(mario)
    }
    this.stepClock(dt)
  }

  /** 浮台巡航:[x0, x1] 往返,速度恒定(携带位移 = 台 Δx,确定性) */
  private stepPlatform(p: GrayBoxEntity, dt: number): void {
    p.prevPos = { ...p.pos }
    p.pos.x += (p.dir ?? 1) * P.platformSpeed * dt
    if (p.pos.x <= p.x0!) {
      p.pos.x = p.x0!
      p.dir = 1
    } else if (p.pos.x >= p.x1!) {
      p.pos.x = p.x1!
      p.dir = -1
    }
  }

  /** 马里奥携带:脚贴在台顶 ±0.06 且水平在台面内 → 随台平移,撞墙则贴墙截断 */
  private carryMario(m: GrayBoxEntity): void {
    if ((m.dyingT ?? 0) > 0) return
    for (const p of this.entities) {
      if (p.kind !== 'platform') continue
      const dx = p.pos.x - p.prevPos.x
      if (dx === 0) continue
      const top = p.pos.y + p.size.y / 2
      const feet = m.pos.y - m.size.y / 2
      if (Math.abs(feet - top) > 0.06) continue
      if (Math.abs(m.pos.x - p.pos.x) >= (p.size.x + m.size.x) / 2) continue
      m.pos.x += dx
      for (const s of this.activeSolids) {
        if (s.semisolid) continue
        if (!overlaps(aabb(m.pos.x, m.pos.y, m.size.x, m.size.y), s)) continue
        m.pos.x = dx > 0 ? s.minX - m.size.x / 2 : s.maxX + m.size.x / 2
      }
    }
  }

  private stepMario(m: GrayBoxEntity, input: InputState, dt: number): void {
    m.prevPos = { ...m.pos }

    // 水平:加速 / 急转身 / 摩擦
    const maxSpeed = input.run ? P.runMax : P.walkMax
    const accel = input.run ? P.accelRun : P.accelWalk
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (dir !== 0) {
      if (dir * m.vel.x < 0) m.vel.x += Math.sign(dir) * P.skidDecel * dt // 反向输入 → 急停转身
      else m.vel.x = clampApproach(m.vel.x, Math.sign(dir) * maxSpeed, accel * dt)
    } else if (m.vel.x !== 0) {
      m.vel.x = clampApproach(m.vel.x, 0, P.friction * dt)
    }

    // 垂直:可变跳高(按住 = gravityHold,松开/下落 = gravityFall)
    if (input.jumpPressed && m.onGround) {
      m.vel.y = P.jumpVel
      m.onGround = false
    }
    const rising = m.vel.y > 0 && input.jumpHeld
    const g = rising ? P.gravityHold : P.gravityFall
    m.vel.y = Math.max(m.vel.y - g * dt, -P.maxFall)

    // 分轴 AABB 解析:实心/单向平台/浮台 → 不穿墙、下落可上桥
    m.onGround = false
    const r = moveAndSlide(
      { x: m.pos.x, y: m.pos.y, w: m.size.x, h: m.size.y, dx: m.vel.x * dt, dy: m.vel.y * dt },
      this.activeSolids,
    )
    m.pos.x = r.x
    m.pos.y = r.y
    if (r.hitWall) m.vel.x = 0
    if (r.onGround) {
      m.onGround = true
      if (m.vel.y < 0) m.vel.y = 0
    }
    if (r.ceiling >= 0) {
      m.vel.y = 0
      this.bumpBlock(this.activeSolidEntities[r.ceiling]!)
    }
    m.pos.x = Math.min(Math.max(m.pos.x, m.size.x / 2), LEVEL_W - m.size.x / 2)
  }

  /** 顶砖:问号砖未用 → 出金币(+200 分 +1 币),变已用;木箱/地面/浮台只停住 */
  private bumpBlock(e: GrayBoxEntity | null): void {
    if (!e || e.kind !== 'question' || e.used) return
    e.used = true
    e.bumpT = 1e-4 // 渲染层检测 0→正跳变 → 弹跳动画 + 金币弹出
    this.hud.coins += 1
    this.hud.score += 200
    this.emitHud()
  }

  /** 地面行走通用逻辑:板栗仔与落地后的飞怪共用(撞墙折返 + 探边折返) */
  private stepWalker(e: GrayBoxEntity, dt: number, speed: number): void {
    e.vel.x = (e.dir ?? -1) * speed
    e.vel.y = Math.max(e.vel.y - P.gravityFall * dt, -P.maxFall)
    e.onGround = false
    const r = moveAndSlide(
      { x: e.pos.x, y: e.pos.y, w: e.size.x, h: e.size.y, dx: e.vel.x * dt, dy: e.vel.y * dt },
      this.activeSolids,
    )
    e.pos.x = r.x
    e.pos.y = r.y
    if (r.hitWall) e.dir = -(e.dir ?? -1)
    if (r.onGround) {
      e.onGround = true
      if (e.vel.y < 0) e.vel.y = 0
      // 探边:前脚掌下方没地 → 折返(不掉坑)
      const aheadX = e.pos.x + (e.dir ?? -1) * (e.size.x / 2 + 0.2)
      const footY = e.pos.y - e.size.y / 2 - 0.2
      if (!pointInside(this.activeSolids, aheadX, footY)) e.dir = -(e.dir ?? -1)
    }
  }

  private stepGoomba(g: GrayBoxEntity, dt: number): void {
    g.prevPos = { ...g.pos }
    if (g.dead) {
      g.deadT = Math.min((g.deadT ?? 0) + dt, 0.6)
      return
    }
    this.stepWalker(g, dt, P.goombaSpeed)
  }

  /** 蝙蝠:x0–x1 匀速往返,y = baseY + amp·sin(t·2 + phase),无重力无碰撞 */
  private stepBat(b: GrayBoxEntity, dt: number): void {
    b.prevPos = { ...b.pos }
    if (b.dead) {
      b.deadT = Math.min((b.deadT ?? 0) + dt, 0.6)
      return
    }
    b.t = (b.t ?? 0) + dt
    b.pos.x += (b.dir ?? -1) * P.batSpeed * dt
    if (b.pos.x <= b.x0!) {
      b.pos.x = b.x0!
      b.dir = 1
    } else if (b.pos.x >= b.x1!) {
      b.pos.x = b.x1!
      b.dir = -1
    }
    b.pos.y = b.baseY! + b.amp! * Math.sin(b.t * 2 + b.phase!)
  }

  /** 俯冲鸟:高栖待命;马里奥进水平窗且在其下方 → 定向俯冲;坠出世界 → 回栖循环 */
  private stepBird(b: GrayBoxEntity, m: GrayBoxEntity, dt: number): void {
    b.prevPos = { ...b.pos }
    if (b.dead) {
      b.deadT = Math.min((b.deadT ?? 0) + dt, 0.6)
      return
    }
    b.t = (b.t ?? 0) + dt
    if (b.state === 'perch') {
      if (Math.abs(m.pos.x - b.spawnX!) < P.birdDiveWindow && m.pos.y < b.pos.y - 0.5) {
        b.state = 'dive'
        const s = Math.sign(m.pos.x - b.pos.x) || -1
        b.vel = { x: s * P.birdDiveSpeed * 0.55, y: -P.birdDiveSpeed }
      }
    } else {
      b.pos.x += b.vel.x * dt
      b.pos.y += b.vel.y * dt
      if (b.pos.y < DEATH_Y) {
        b.state = 'perch'
        b.pos = { x: b.spawnX!, y: b.spawnY! }
        b.vel = { x: 0, y: 0 }
        b.prevPos = { ...b.pos }
      }
    }
  }

  /** 飞怪三态:fly 高空巡逻 → 被踩 fall 重力坠落 → 落地 walk(板栗仔逻辑) */
  private stepParatroopa(p: GrayBoxEntity, dt: number): void {
    p.prevPos = { ...p.pos }
    if (p.dead) {
      p.deadT = Math.min((p.deadT ?? 0) + dt, 0.6)
      return
    }
    p.t = (p.t ?? 0) + dt
    if (p.state === 'fly') {
      p.pos.x += (p.dir ?? -1) * P.paratroopaFlySpeed * dt
      if (p.pos.x <= p.x0!) {
        p.pos.x = p.x0!
        p.dir = 1
      } else if (p.pos.x >= p.x1!) {
        p.pos.x = p.x1!
        p.dir = -1
      }
      p.pos.y = p.spawnY!
    } else if (p.state === 'fall') {
      p.vel.y = Math.max(p.vel.y - P.gravityFall * dt, -P.maxFall)
      const r = moveAndSlide(
        { x: p.pos.x, y: p.pos.y, w: p.size.x, h: p.size.y, dx: 0, dy: p.vel.y * dt },
        this.activeSolids,
      )
      p.pos.x = r.x
      p.pos.y = r.y
      if (r.onGround) {
        p.state = 'walk'
        p.dir = -1
        p.vel = { x: 0, y: 0 }
        p.onGround = true
      }
    } else {
      this.stepWalker(p, dt, P.koopaSpeed)
    }
  }

  /** 马里奥 × 可踩敌人:下落踩头 = 踩杀 + 弹跳;侧面碰到 = 死亡(无敌期除外) */
  private checkContacts(m: GrayBoxEntity): void {
    for (const g of this.entities) {
      if (!STOMPABLE.has(g.kind) || g.dead) continue
      if (!overlaps(aabb(m.pos.x, m.pos.y, m.size.x, m.size.y), aabb(g.pos.x, g.pos.y, g.size.x, g.size.y)))
        continue
      const marioPrevBottom = m.prevPos.y - m.size.y / 2
      const enemyTop = g.pos.y + g.size.y / 2
      if (m.vel.y < 0 && marioPrevBottom >= enemyTop - 0.15) {
        if (g.kind === 'paratroopa' && g.state === 'fly') {
          g.state = 'fall' // 第一踩:壳坠落,不记分;再踩才踩扁
          g.vel = { x: 0, y: 0 }
        } else {
          g.dead = true
          g.deadT = 0
          this.hud.score += 100
        }
        m.vel.y = P.stompBounce
        m.onGround = false
        this.emitHud()
      } else if ((m.invT ?? 0) <= 0) {
        this.killMario(m)
        return
      }
    }
  }

  /** 坑(掉出世界)、尖刺(盒重叠即死)、水域(触水即死) */
  private checkHazards(m: GrayBoxEntity): void {
    if (m.pos.y < DEATH_Y) {
      this.killMario(m)
      return
    }
    const marioBox = aabb(m.pos.x, m.pos.y, m.size.x, m.size.y)
    for (const s of this.spikeAABBs) {
      if (overlaps(marioBox, s)) {
        this.killMario(m)
        return
      }
    }
    const inWaterX = m.pos.x > WATER_ZONE[0] && m.pos.x < WATER_ZONE[1]
    if (inWaterX && m.pos.y - m.size.y / 2 < WATER_TOP_Y) this.killMario(m)
  }

  private killMario(m: GrayBoxEntity): void {
    m.dyingT = 1.0
    m.vel = { x: 0, y: 6 } // 经典死亡小弹起
    this.hud.lives -= 1
    this.emitHud()
  }

  private respawnMario(m: GrayBoxEntity): void {
    if (this.hud.lives <= 0) {
      this.setPhase('gameover')
      return
    }
    m.pos = { x: MARIO_SPAWN_X, y: GROUND_TOP_Y + m.size.y / 2 }
    m.prevPos = { ...m.pos }
    m.vel = { x: 0, y: 0 }
    m.onGround = true
    m.dyingT = 0
    m.invT = P.invincibleTime
    // 全部敌人 + 浮台复位,重生点不被蹲守(浮台相位归 0 保确定性)
    for (const e of this.entities) {
      if (RESETTABLE.has(e.kind)) this.resetEnemy(e)
    }
  }

  /** 旗杆:越过即过关,时间奖励入账 */
  private checkWin(m: GrayBoxEntity): void {
    if (m.pos.x < FLAG_X) return
    this.hud.score += 2000 + this.hud.time * 10
    this.emitHud()
    this.setPhase('clear')
  }

  /** 游戏内倒计时:按固定步计数,约 0.4s/格,与真实秒解耦 */
  private stepClock(dt: number): void {
    this.timeAcc += dt
    let changed = false
    while (this.timeAcc >= TIME_TICK_SECONDS && this.hud.time > 0) {
      this.timeAcc -= TIME_TICK_SECONDS
      this.hud.time -= 1
      changed = true
      if (this.hud.time === 0) {
        this.timeAcc = 0
        this.killMario(this.find('mario')) // 时间耗尽 → 扣命(M4 细化连续惩罚)
        break
      }
    }
    if (changed) this.emitHud()
  }

  private setPhase(p: Phase): void {
    if (this.phase === p) return
    this.phase = p
    this.hooks.onPhase(p)
  }

  private emitHud(): void {
    this.hooks.onHud({ ...this.hud })
  }
}

function clampApproach(value: number, target: number, maxDelta: number): number {
  const d = target - value
  if (Math.abs(d) <= maxDelta) return target
  return value + Math.sign(d) * maxDelta
}
