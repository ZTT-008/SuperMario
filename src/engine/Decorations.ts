import {
  type BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  type Material,
  Object3D,
  PlaneGeometry,
  Points,
  SphereGeometry,
  type Scene,
} from 'three'
import { materials } from './material/MaterialLib'
import { decorSpots, mulberry32 } from './decorSpots'

/**
 * M3 地面装饰(纯渲染层,零 game 依赖):花/草丛/雪松/雪堆 4 个 InstancedMesh +
 * 蝴蝶 + 水边芦苇 + 雪/花瓣粒子。
 *
 * 全部世界锚定(无视差):品种带按 STYLE_ZONES 选位(草区花 / 石区草丛 /
 * 雪区雪松雪堆 / 水域两侧芦苇 / 雪区飘雪 / 草区花瓣),视差会把品种滑出自己的
 * 样式带(灌木 p=0.55 是纯背景装饰,意图不同,此处带位 = 玩法分区)。
 *
 * 纪律:布点 decorSpots 种子确定性;动画全部解析式 f(seed, i, time) ——
 * sin(time+固定 phase) + 取模,零 Math.random、零累积状态,截图逐帧可复现。
 * 几何自持数组 dispose,材质归 MaterialLib 平表。
 */
const mod = (a: number, n: number): number => ((a % n) + n) % n

export class Decorations {
  private readonly groups: Group[] = []
  private readonly geometries: BufferGeometry[] = []
  private readonly dummy = new Object3D()
  private readonly butterflies: InstancedMesh
  private readonly butterflySpots: number[]
  private readonly reeds: InstancedMesh
  private readonly reedSpots: number[]
  private readonly snow: Points
  private readonly snowBase: number[]
  private readonly petals: Points
  private readonly petalBase: number[]

  constructor(scene: Scene) {
    // ── 地面样式装饰:z=−2.8(地形之后、贴地顶缘之上),静态实例零每帧成本 ──
    const decor = new Group()
    decor.name = 'decor'
    decor.position.z = -2.8

    const flowerGeo = new PlaneGeometry(0.9, 0.9).translate(0, 0.45, 0)
    const tuftGeo = new PlaneGeometry(1.0, 1.0).translate(0, 0.5, 0)
    const pineGeo = new ConeGeometry(0.75, 1.9, 7).translate(0, 0.95, 0)
    const moundGeo = new SphereGeometry(0.55, 10, 6).scale(1.5, 0.55, 1.1).translate(0, 0.3, 0)
    this.geometries.push(flowerGeo, tuftGeo, pineGeo, moundGeo)

    decor.add(
      // 草区(0–71):花,避开灌木/管道/砖堆驻点
      this.scatter(flowerGeo, materials.flower, decorSpots(11, 2, 69, 12, [[3, 5], [8, 19], [29, 32], [51, 54]] as const), 1.0, 12),
      // 石区(71–143):草丛碎石
      this.scatter(tuftGeo, materials.tuft, decorSpots(22, 73, 140, 14, [[101, 105], [119, 122], [129, 131]] as const), 1.0, 23),
      // 雪区(143–211):雪松 + 雪堆,避开长阶梯/旗杆段
      this.scatter(pineGeo, materials.pineDark, decorSpots(33, 148, 209, 10, [[151, 167], [196, 200]] as const), 1.0, 34),
      this.scatter(moundGeo, materials.snowMound, decorSpots(44, 147, 210, 10, [[151, 167], [196, 200]] as const), 1.0, 45),
    )

    // 蝴蝶:草区花上方游走,翅扇 = scale.x 收缩(侧视折翅),每帧写矩阵
    this.butterflySpots = decorSpots(77, 6, 66, 6, [[8, 19], [29, 32], [51, 54]] as const)
    const bflyGeo = new PlaneGeometry(0.5, 0.4)
    this.geometries.push(bflyGeo)
    this.butterflies = new InstancedMesh(bflyGeo, materials.butterfly, this.butterflySpots.length)
    this.butterflies.position.z = 0.3 // → 世界 z=−2.5,略在花前
    this.butterflies.renderOrder = -2
    decor.add(this.butterflies)

    // ── 芦苇:水域 [143,147] 两侧,z=−1 前景带,微摆 ──
    this.reedSpots = [
      ...decorSpots(55, 140.6, 142.6, 3, [], 0.6),
      ...decorSpots(66, 147.4, 149.4, 3, [], 0.6),
    ]
    const reedGeo = new PlaneGeometry(0.8, 1.6)
    this.geometries.push(reedGeo)
    this.reeds = new InstancedMesh(reedGeo, materials.reed, this.reedSpots.length)
    const reeds = new Group()
    reeds.name = 'reeds'
    reeds.position.z = -1
    this.reeds.renderOrder = -2
    reeds.add(this.reeds)

    // ── 粒子:雪(雪区带)/ 花瓣(草区带),解析式下落 f(seed, i, time) ──
    this.snowBase = decorSpots(88, 144, 210, 60, [], 0.4)
    this.petalBase = decorSpots(99, 1, 70, 40, [], 0.4)
    const s = this.makePoints(materials.snowDots, this.snowBase)
    this.snow = s.points
    const p = this.makePoints(materials.petal, this.petalBase)
    this.petals = p.points
    const particles = new Group()
    particles.name = 'particles'
    particles.position.z = -2.2
    particles.add(this.snow, this.petals)

    this.groups.push(decor, reeds, particles)
    for (const g of this.groups) scene.add(g)
  }

  /** 静态散布:x 来自 decorSpots、y 固定、rotZ 种子微倾 —— 构造期写一次矩阵 */
  private scatter(geo: BufferGeometry, mat: Material, spots: readonly number[], y: number, seed: number): InstancedMesh {
    const im = new InstancedMesh(geo, mat, spots.length)
    const rnd = mulberry32(seed)
    for (let i = 0; i < spots.length; i++) {
      this.dummy.position.set(spots[i]!, y, 0)
      this.dummy.rotation.set(0, 0, (rnd() - 0.5) * 0.16)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      im.setMatrixAt(i, this.dummy.matrix)
    }
    im.instanceMatrix.needsUpdate = true
    return im
  }

  private makePoints(mat: Material, base: readonly number[]): { points: Points; geo: BufferGeometry } {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(base.length * 3), 3))
    this.geometries.push(geo)
    const points = new Points(geo, mat)
    points.frustumCulled = false // 位置每帧解析式移动,包围球不可靠
    points.renderOrder = -3
    return { points, geo }
  }

  /** 每渲染帧一次(世界锚定 → 无 camX;只有相位动画) */
  update(time: number): void {
    // 蝴蝶:双频 sin 叠加的游走 + 折翅扇动 + 随游走横滚
    for (let i = 0; i < this.butterflySpots.length; i++) {
      const phase = i * 1.7
      const x = this.butterflySpots[i]! + Math.sin(time * 0.23 + phase) * 5 + Math.sin(time * 0.61 + phase * 2) * 1.8
      const y = 2.2 + (i % 4) * 0.7 + Math.sin(time * 0.9 + phase) * 0.45 + Math.sin(time * 1.7 + phase * 3) * 0.2
      this.dummy.position.set(x, y, 0)
      this.dummy.rotation.set(0, 0, Math.sin(time * 0.61 + phase * 2) * 0.25)
      this.dummy.scale.set(0.55 + 0.45 * Math.abs(Math.sin(time * 6 + phase)), 1, 1)
      this.dummy.updateMatrix()
      this.butterflies.setMatrixAt(i, this.dummy.matrix)
    }
    this.butterflies.instanceMatrix.needsUpdate = true

    // 芦苇:风摆 rotZ(定根,梢部画弧)
    for (let i = 0; i < this.reedSpots.length; i++) {
      this.dummy.position.set(this.reedSpots[i]!, 1.8, 0)
      this.dummy.rotation.set(0, 0, Math.sin(time * 1.4 + i * 1.7) * 0.08)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.reeds.setMatrixAt(i, this.dummy.matrix)
    }
    this.reeds.instanceMatrix.needsUpdate = true

    // 雪:15 → 0 循环下落 + 横向摆;花瓣:7 → 1(草地上空)
    const snowPos = this.snow.geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < this.snowBase.length; i++)
      snowPos.setXYZ(i, this.snowBase[i]! + Math.sin(time * 0.7 + i * 1.3) * 0.6, 15 - mod(i * 2.37 + time * 0.9, 15), 0)
    snowPos.needsUpdate = true
    const petalPos = this.petals.geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < this.petalBase.length; i++)
      petalPos.setXYZ(i, this.petalBase[i]! + Math.sin(time * 0.5 + i * 2.1) * 0.8, 1 + (6 - mod(i * 1.93 + time * 0.5, 6)), 0)
    petalPos.needsUpdate = true
  }

  dispose(): void {
    for (const g of this.groups) g.parent?.remove(g)
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0 // 材质归平表(disposeMaterials),此处不重复释放
  }
}
