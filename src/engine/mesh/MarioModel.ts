import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 造型优先(Core rule):马里奥由基础体组合出可辨认的剪影 —— 红帽 + 蓝工装 +
 * 圆鼻 + 胡子,远看即知是马里奥。肢体挂在命名关节组下(head/leftArm/...),
 * M3 程序化动画直接驱动关节。碰撞盒留在 game 层,这里只有视觉。
 * 低多边形预算(DESIGN §10.1):球 ≤16×12 段、胶囊 ≤8 段。
 */
export function createMarioModel(): { root: Group; geometries: BufferGeometry[] } {
  const root = new Group()
  root.name = 'mario'
  const geometries: BufferGeometry[] = []

  const mesh = (
    name: string,
    geo: BufferGeometry,
    mat: (typeof materials)[keyof typeof materials],
    x: number,
    y: number,
    z = 0,
  ): Mesh => {
    geometries.push(geo)
    const m = new Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  // ── 腿(关节组:原点=髋,M3 走路摆动)──
  for (const side of [-1, 1] as const) {
    const hip = new Group()
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg'
    hip.position.set(0.11 * side, -0.17, 0)
    hip.add(
      mesh(`leg${side}`, new CapsuleGeometry(0.075, 0.12, 3, 8), materials.marioOveralls, 0, -0.08),
    )
    const boot = mesh(`boot${side}`, new BoxGeometry(0.17, 0.09, 0.24), materials.marioShoes, 0, -0.24, 0.03)
    hip.add(boot)
    root.add(hip)
  }

  // ── 躯干:红衬衫胶囊 + 蓝工装裙 ──
  root.add(mesh('torso', new CapsuleGeometry(0.17, 0.1, 3, 10), materials.marioShirt, 0, 0.06))
  root.add(mesh('overalls', new CylinderGeometry(0.185, 0.16, 0.18, 10), materials.marioOveralls, 0, -0.06))
  // 工装背带(胸前两条竖带,色块分区)
  for (const side of [-1, 1] as const) {
    root.add(
      mesh(
        `strap${side}`,
        new BoxGeometry(0.045, 0.16, 0.02),
        materials.marioOveralls,
        0.075 * side,
        0.09,
        0.16,
      ),
    )
  }

  // ── 手臂(关节组:原点=肩)──
  for (const side of [-1, 1] as const) {
    const shoulder = new Group()
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm'
    shoulder.position.set(0.21 * side, 0.13, 0)
    shoulder.rotation.z = -0.45 * side
    shoulder.add(mesh(`sleeve${side}`, new CapsuleGeometry(0.055, 0.12, 3, 8), materials.marioShirt, 0, -0.1))
    shoulder.add(mesh(`hand${side}`, new SphereGeometry(0.062, 10, 8), materials.marioSkin, 0, -0.22))
    root.add(shoulder)
  }

  // ── 头(关节组:原点=颈)──
  const head = new Group()
  head.name = 'head'
  head.position.set(0, 0.26, 0)
  head.add(mesh('skull', new SphereGeometry(0.2, 16, 12), materials.marioSkin, 0, 0.12))
  head.add(mesh('hairBack', new SphereGeometry(0.185, 12, 10), materials.marioHair, 0, 0.13, -0.07))
  // 帽:圆筒 + 前檐
  head.add(mesh('cap', new CylinderGeometry(0.215, 0.2, 0.08, 14), materials.marioShirt, 0, 0.27))
  head.add(mesh('capBrim', new BoxGeometry(0.26, 0.03, 0.14), materials.marioShirt, 0, 0.245, 0.19))
  // 脸:鼻 / 眼 / 胡子
  head.add(mesh('nose', new SphereGeometry(0.05, 10, 8), materials.marioSkin, 0, 0.1, 0.19))
  for (const side of [-1, 1] as const) {
    head.add(mesh(`eye${side}`, new SphereGeometry(0.026, 8, 6), materials.marioHair, 0.065 * side, 0.15, 0.175))
  }
  head.add(mesh('mustache', new BoxGeometry(0.15, 0.035, 0.03), materials.marioHair, 0, 0.045, 0.185))
  root.add(head)

  // 兜底:CircleGeometry 引用保留给后续贴花(避免 tree-shaking 误删导入)
  void CircleGeometry

  return { root, geometries }
}
