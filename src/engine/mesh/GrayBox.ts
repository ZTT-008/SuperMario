import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Scene,
} from 'three'
import type { GrayBoxEntity } from '@/game/Game'
import { ViewRegistry } from '../ViewRegistry'
import { materials } from '../material/MaterialLib'
import { createBatModel } from './BatModel'
import { createBirdModel } from './BirdModel'
import { createGoombaModel } from './GoombaModel'
import { createMarioModel } from './MarioModel'
import { createParatroopaModel } from './ParatroopaModel'
import { createSkin, type SkinId } from './skins'

/**
 * M1/M2 视图层:实体 → 网格绑定 + 程序化动画(无骨骼,直接驱动关节组)。
 * 渲染层只读 game 实体字段(pos/vel/dir/dead/state/bumpT/dyingT/invT),零反向依赖。
 * 动画清单:马里奥走/跳/待机/朝向/死亡旋转/无敌闪烁;板栗仔步态/踩扁;
 * 蝙蝠翅扇、俯冲鸟栖/俯冲倾转、飞怪 fly/fall/walk 三态(M2 空中敌);
 * 问号砖顶砖弹跳 + 金币弹出;水面 uv 流动;旗面飘动。地形网格已移交 ChunkBuilder。
 * 注:ViewRegistry.sync 先写基础 transform,本类 update 在其后叠加动画偏移。
 */

// 模型默认朝 +z → 绕 y 转到 ±x,留 0.4/0.3 rad 让脸朝向相机(3/4 视角)
const MARIO_YAW = Math.PI / 2 - 0.4
const GOOMBA_YAW = Math.PI / 2 - 0.3
const FLY_YAW = Math.PI / 2 - 0.25 // 空中敌略转正,翅展对相机可读
const COIN_LIFE = 0.55
const COIN_VY = 7
const COIN_G = 26
const COIN_POOL = 12

interface MarioView {
  e: GrayBoxEntity
  root: Group
  leftLeg: Group
  rightLeg: Group
  leftArm: Group
  rightArm: Group
  head: Group
  walkPhase: number
  facing: number
}

interface GoombaView {
  e: GrayBoxEntity
  root: Group
  leftFoot: Mesh
  rightFoot: Mesh
  phase: number
}

interface BatView {
  e: GrayBoxEntity
  root: Group
  leftWing: Mesh
  rightWing: Mesh
  phase: number
}

interface BirdView {
  e: GrayBoxEntity
  root: Group
  leftWing: Mesh
  rightWing: Mesh
  phase: number
}

interface ParaView {
  e: GrayBoxEntity
  root: Group
  leftFoot: Mesh
  rightFoot: Mesh
  phase: number
}

interface QuestionView {
  e: GrayBoxEntity
  mesh: Mesh
  prevBump: number
}

interface CoinFx {
  group: Group
  active: boolean
  t: number
  vy: number
}

export class GrayBox {
  private readonly geometries: BufferGeometry[] = []
  // 皮肤几何独立追踪:swap 时即时 dispose 旧款,不混入全局 geometries(防双重释放)
  private marioGeometries: BufferGeometry[] = []
  private skinId: SkinId = 'mario'
  private readonly coinGeo: CylinderGeometry
  private readonly vfx: Group
  private hasQuestion = false
  private marioView: MarioView | null = null
  private readonly goombaViews: GoombaView[] = []
  private readonly batViews: BatView[] = []
  private readonly birdViews: BirdView[] = []
  private readonly paraViews: ParaView[] = []
  private readonly questionViews: QuestionView[] = []
  private cloth: Mesh | null = null
  private readonly coins: CoinFx[] = []

  constructor(
    private readonly views: ViewRegistry,
    entities: readonly GrayBoxEntity[],
    scene: Scene,
  ) {
    this.coinGeo = new CylinderGeometry(0.16, 0.16, 0.05, 14)
    this.geometries.push(this.coinGeo)
    this.vfx = new Group()
    this.vfx.name = 'coin-vfx'
    scene.add(this.vfx)
    for (const e of entities) views.register(e, this.build(e))
  }

  private build(e: GrayBoxEntity): Group | Mesh {
    switch (e.kind) {
      case 'mario': {
        const { root, geometries } = createMarioModel()
        this.marioGeometries = geometries
        const joint = (n: string): Group => root.getObjectByName(n) as Group
        this.marioView = {
          e,
          root,
          leftLeg: joint('leftLeg'),
          rightLeg: joint('rightLeg'),
          leftArm: joint('leftArm'),
          rightArm: joint('rightArm'),
          head: joint('head'),
          walkPhase: 0,
          facing: 1,
        }
        return root
      }
      case 'crate': {
        const geo = new BoxGeometry(e.size.x, e.size.y, e.size.x)
        this.geometries.push(geo)
        const mesh = new Mesh(geo, materials.crateWood)
        mesh.castShadow = true
        mesh.receiveShadow = true
        return mesh
      }
      case 'question': {
        this.hasQuestion = true
        const geo = new BoxGeometry(e.size.x, e.size.y, e.size.x)
        this.geometries.push(geo)
        const mesh = new Mesh(geo, materials.questionGold)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.questionViews.push({ e, mesh, prevBump: 0 })
        return mesh
      }
      case 'goomba': {
        const { root, leftFoot, rightFoot, geometries } = createGoombaModel()
        root.name = e.id // QA 脚本按 id 检查可见性
        this.geometries.push(...geometries)
        this.goombaViews.push({
          e,
          root,
          leftFoot,
          rightFoot,
          phase: this.goombaViews.length * 1.7, // 确定性错相,群体不同步摆动
        })
        return root
      }
      case 'bat': {
        const { root, leftWing, rightWing, geometries } = createBatModel()
        root.name = e.id
        this.geometries.push(...geometries)
        this.batViews.push({ e, root, leftWing, rightWing, phase: this.batViews.length * 1.7 })
        return root
      }
      case 'bird': {
        const { root, leftWing, rightWing, geometries } = createBirdModel()
        root.name = e.id
        this.geometries.push(...geometries)
        this.birdViews.push({ e, root, leftWing, rightWing, phase: this.birdViews.length * 1.7 })
        return root
      }
      case 'paratroopa': {
        const { root, leftFoot, rightFoot, geometries } = createParatroopaModel()
        root.name = e.id
        this.geometries.push(...geometries)
        this.paraViews.push({ e, root, leftFoot, rightFoot, phase: this.paraViews.length * 1.7 })
        return root
      }
      case 'platform': {
        // 移动浮台:静态外观,位置由 ViewRegistry.sync 每帧跟实体(动态刚体)
        const geo = new BoxGeometry(e.size.x, e.size.y, 1.2)
        this.geometries.push(geo)
        const mesh = new Mesh(geo, materials.platformWood)
        mesh.name = e.id // QA 脚本按 id 检查可见性
        mesh.castShadow = true
        mesh.receiveShadow = true
        return mesh
      }
      case 'flag': {
        const group = new Group()
        const poleGeo = new CylinderGeometry(0.06, 0.06, e.size.y, 10)
        const ballGeo = new SphereGeometry(0.14, 12, 10)
        const clothGeo = new PlaneGeometry(1.8, 1.2)
        this.geometries.push(poleGeo, ballGeo, clothGeo)
        const pole = new Mesh(poleGeo, materials.flagPole)
        pole.castShadow = true
        const ball = new Mesh(ballGeo, materials.flagPole)
        ball.position.y = e.size.y / 2 + 0.1
        ball.castShadow = true
        const cloth = new Mesh(clothGeo, materials.flagCloth)
        cloth.position.set(0.95, 3.3, 0) // 杆顶附近,局部坐标
        this.cloth = cloth
        group.add(pole, ball, cloth)
        return group
      }
      case 'water': {
        const group = new Group()
        const bodyGeo = new BoxGeometry(e.size.x, e.size.y, 1.2)
        const topGeo = new BoxGeometry(e.size.x, 0.14, 1.2)
        this.geometries.push(bodyGeo, topGeo)
        const body = new Mesh(bodyGeo, materials.waterBody)
        body.receiveShadow = true
        const top = new Mesh(topGeo, materials.waterTop)
        top.position.y = 0.6 // 世界 y 0.9 = WATER_TOP_Y
        group.add(body, top)
        return group
      }
    }
  }

  /**
   * 皮肤 MOD:整体换马里奥模型(rAF 单线程,UI 事件在 tick 间隙直接调,无竞态)。
   * ViewRegistry.replace 摘旧 root 并按实体位姿落位;旧皮肤几何即时 dispose
   * (材质模块级常驻,切回免重建);5 关节引用按名重建,walkPhase/facing 继承。
   */
  setSkin(id: SkinId): void {
    const old = this.marioView
    if (!old || id === this.skinId) return
    const { root, geometries } = createSkin(id)
    if (!this.views.replace(old.e, root)) return
    // 姿态继承:本帧旋转/可见与旧模型一致(updateMario 下一帧起照常驱动)
    root.rotation.copy(old.root.rotation)
    root.visible = old.root.visible
    for (const g of this.marioGeometries) g.dispose()
    this.marioGeometries = geometries
    const joint = (n: string): Group => root.getObjectByName(n) as Group
    this.marioView = {
      e: old.e,
      root,
      leftLeg: joint('leftLeg'),
      rightLeg: joint('rightLeg'),
      leftArm: joint('leftArm'),
      rightArm: joint('rightArm'),
      head: joint('head'),
      walkPhase: old.walkPhase,
      facing: old.facing,
    }
    this.skinId = id
  }

  /** 每渲染帧一次(sync 之后):环境循环动画 + 实体驱动动画 + VFX 生命周期 */
  update(dt: number, time: number): void {
    if (this.hasQuestion)
      materials.questionGold.emissiveIntensity = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(time * 3))
    const waterMap = materials.waterTop.map
    if (waterMap) waterMap.offset.x = time * 0.22 // 横向滚动 = 流动
    if (this.cloth) this.cloth.rotation.y = Math.sin(time * 3) * 0.3
    this.updateMario(dt, time)
    for (const g of this.goombaViews) this.updateGoomba(g, time)
    for (const b of this.batViews) this.updateBat(b)
    for (const b of this.birdViews) this.updateBird(b, time)
    for (const p of this.paraViews) this.updatePara(p, time)
    for (const q of this.questionViews) this.updateQuestion(q)
    this.updateCoins(dt)
  }

  private updateMario(dt: number, time: number): void {
    const m = this.marioView
    if (!m) return
    if (Math.abs(m.e.vel.x) > 0.1) m.facing = Math.sign(m.e.vel.x)
    m.root.rotation.y = m.facing > 0 ? MARIO_YAW : -MARIO_YAW

    if ((m.e.dyingT ?? 0) > 0) {
      // 死亡:旋转 + 高频闪烁,位置由自由坠落物理驱动
      m.root.rotation.z += dt * 10
      m.root.visible = Math.floor(time * 12) % 2 === 0
      return
    }
    m.root.rotation.z = 0
    m.root.visible = (m.e.invT ?? 0) > 0 ? Math.floor(time * 10) % 2 === 0 : true

    const speed = Math.abs(m.e.vel.x)
    if (!m.e.onGround) {
      // 跳跃姿态:前腿收、后腿蹬、双臂上扬、微抬头
      m.leftLeg.rotation.x = -0.55
      m.rightLeg.rotation.x = -0.2
      m.leftArm.rotation.x = -2.4
      m.rightArm.rotation.x = -2.4
      m.head.rotation.x = 0.12
    } else if (speed > 0.1) {
      // 走路:步频随速度,腿摆 + 臂反摆 + 身体起伏
      m.walkPhase += speed * dt * 2.6
      const s = Math.sin(m.walkPhase)
      m.leftLeg.rotation.x = s * 0.62
      m.rightLeg.rotation.x = -s * 0.62
      m.leftArm.rotation.x = -s * 0.5
      m.rightArm.rotation.x = s * 0.5
      m.head.rotation.x = 0.06
      m.root.position.y += Math.abs(Math.sin(m.walkPhase)) * 0.035
    } else {
      // 待机:关节归零 + 呼吸起伏
      m.walkPhase = 0
      m.leftLeg.rotation.x = 0
      m.rightLeg.rotation.x = 0
      m.leftArm.rotation.x = 0
      m.rightArm.rotation.x = 0
      m.head.rotation.x = 0
      m.root.position.y += Math.sin(time * 2.2) * 0.012
    }
  }

  private updateGoomba(g: GoombaView, time: number): void {
    const e = g.e
    if (e.dead) {
      // 踩扁:0.15s 内压扁 + 横向摊开,0.6s 后移除
      g.root.visible = (e.deadT ?? 0) < 0.6
      const k = Math.min(e.deadT ?? 0, 0.15) / 0.15
      const sy = 1 - k * 0.75
      g.root.scale.set(1 + (1 - sy) * 0.6, sy, 1)
      return
    }
    // 复活(restart/respawn)时必须恢复可见:踩扁 0.6s 后 visible 被置 false,
    // 不显式重置则下一局板栗仔全部隐藏
    g.root.visible = true
    g.root.scale.set(1, 1, 1)
    const w = Math.sin(time * 9 + g.phase)
    g.root.rotation.z = w * 0.07 // 左右摇晃步态
    g.leftFoot.position.z = 0.02 + w * 0.05 // 脚掌交替蹭地
    g.rightFoot.position.z = 0.02 - w * 0.05
    g.root.rotation.y = (e.dir ?? -1) > 0 ? GOOMBA_YAW : -GOOMBA_YAW
  }

  /** 踩扁通用收尾:0.15s 压扁 + 0.6s 后隐藏(与板栗仔同节奏) */
  private squish(root: Group, e: GrayBoxEntity): void {
    root.visible = (e.deadT ?? 0) < 0.6
    const k = Math.min(e.deadT ?? 0, 0.15) / 0.15
    const sy = 1 - k * 0.75
    root.scale.set(1 + (1 - sy) * 0.6, sy, 1)
  }

  private updateBat(b: BatView): void {
    const e = b.e
    if (e.dead) {
      this.squish(b.root, e)
      return
    }
    b.root.visible = true
    b.root.scale.set(1, 1, 1)
    b.root.rotation.y = (e.dir ?? -1) > 0 ? FLY_YAW : -FLY_YAW
    // 高频翅扇:实体 t 驱动(与运动同相位),俯仰随正弦起伏
    const w = Math.sin((e.t ?? 0) * 11 + b.phase)
    b.leftWing.rotation.z = w * 0.7
    b.rightWing.rotation.z = -w * 0.7
    b.root.rotation.z = Math.cos((e.t ?? 0) * 2 + (e.phase ?? 0)) * 0.12
  }

  private updateBird(b: BirdView, time: number): void {
    const e = b.e
    if (e.dead) {
      this.squish(b.root, e)
      return
    }
    b.root.visible = true
    b.root.scale.set(1, 1, 1)
    const facing = (e.dir ?? -1) > 0 ? 1 : -1
    b.root.rotation.y = facing > 0 ? FLY_YAW : -FLY_YAW
    if (e.state === 'dive') {
      // 俯冲:鼻向下倾 + 翅后掠(机翼失速姿态)
      b.root.rotation.z = facing * -0.65
      b.leftWing.rotation.z = -facing * 0.9
      b.rightWing.rotation.z = facing * 0.9
    } else {
      // 栖息:直立慢扇,翅收拢贴背
      b.root.rotation.z = 0
      const w = Math.sin(time * 2.4 + b.phase)
      b.leftWing.rotation.z = 0.35 + w * 0.12
      b.rightWing.rotation.z = -0.35 - w * 0.12
    }
  }

  private updatePara(p: ParaView, time: number): void {
    const e = p.e
    if (e.dead) {
      this.squish(p.root, e)
      return
    }
    p.root.visible = true
    p.root.scale.set(1, 1, 1)
    p.root.rotation.y = (e.dir ?? -1) > 0 ? GOOMBA_YAW : -GOOMBA_YAW
    if (e.state === 'fall') {
      // 坠落翻滚:绕 z 持续转,脚不再步态
      p.root.rotation.z = (e.t ?? 0) * 9
      p.leftFoot.rotation.x = 0
      p.rightFoot.rotation.x = 0
    } else if (e.state === 'walk') {
      // 壳落地面:复用板栗仔步态(脚掌交替 + 摇晃)
      p.root.rotation.z = Math.sin(time * 9 + p.phase) * 0.07
      const w = Math.sin(time * 9 + p.phase)
      p.leftFoot.position.z = 0.02 + w * 0.05
      p.rightFoot.position.z = 0.02 - w * 0.05
    } else {
      // fly:微俯冲前倾 + 悬浮起伏 + 脚后收
      p.root.rotation.z = (e.dir ?? -1) * -0.12
      p.root.position.y += Math.sin(time * 3.2 + p.phase) * 0.04
      p.leftFoot.rotation.x = -0.5
      p.rightFoot.rotation.x = -0.5
      p.leftFoot.position.z = 0.02
      p.rightFoot.position.z = 0.02
    }
  }

  private updateQuestion(q: QuestionView): void {
    const cur = q.e.bumpT ?? 0
    if (q.prevBump === 0 && cur > 0) this.spawnCoin(q.e) // 0→正跳变 = 刚被顶
    q.prevBump = cur
    if (cur > 0) {
      // 衰减弹跳:sin 振荡 × exp 衰减,一次顶砖一两个来回
      q.mesh.position.y += Math.sin(cur * 24) * 0.28 * Math.exp(-cur * 7)
    }
  }

  private spawnCoin(e: GrayBoxEntity): void {
    let coin = this.coins.find((c) => !c.active)
    if (!coin) {
      if (this.coins.length >= COIN_POOL) return
      const group = new Group()
      const mesh = new Mesh(this.coinGeo, materials.coin)
      mesh.rotation.x = Math.PI / 2 // 圆柱轴 → z,圆盘正对相机
      mesh.castShadow = true
      group.add(mesh)
      this.vfx.add(group)
      coin = { group, active: false, t: 0, vy: 0 }
      this.coins.push(coin)
    }
    coin.active = true
    coin.t = 0
    coin.vy = COIN_VY
    coin.group.position.set(e.pos.x, e.pos.y + e.size.y / 2 + 0.25, e.z + 0.3)
    coin.group.rotation.y = 0
    coin.group.visible = true
  }

  private updateCoins(dt: number): void {
    for (const c of this.coins) {
      if (!c.active) continue
      c.t += dt
      if (c.t >= COIN_LIFE) {
        c.active = false
        c.group.visible = false
        continue
      }
      c.vy -= COIN_G * dt
      c.group.position.y += c.vy * dt
      c.group.rotation.y += dt * 12 // 绕竖轴旋转 = 经典金币翻转
    }
  }

  dispose(): void {
    this.vfx.parent?.remove(this.vfx)
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    for (const g of this.marioGeometries) g.dispose()
    this.marioGeometries = [] // 皮肤材质归 skins 模块(disposeSkinMaterials),此处不重复释放
  }
}
