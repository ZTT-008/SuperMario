import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three'
import { skinMaterials as m } from './skinMaterials'

/**
 * 大黄蜂皮肤(完全换模型):圆润跑车线条 —— 黄胶囊车身 + 黑赛车条纹 +
 * 散热翼肩(挂 root 不随臂摆)+ 圆头触角。动画契约与 MarioModel 逐字一致,
 * 脚底腿局部 y=−0.285。
 */
export function createBumblebeeModel(): { root: Group; geometries: BufferGeometry[] } {
  const root = new Group()
  root.name = 'mario'
  const geometries: BufferGeometry[] = []

  const mesh = (
    name: string,
    geo: BufferGeometry,
    mat: MeshStandardMaterial,
    x: number,
    y: number,
    z = 0,
  ): Mesh => {
    geometries.push(geo)
    const mesh = new Mesh(geo, mat)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }

  // ── 腿(髋 ±0.11,−0.17,0):黑胫胶囊 + 黄轮拱脚(底 −0.285)──
  for (const side of [-1, 1] as const) {
    const hip = new Group()
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg'
    hip.position.set(0.11 * side, -0.17, 0)
    hip.add(mesh(`shin${side}`, new CapsuleGeometry(0.06, 0.12, 3, 8), m.bumbleBlack, 0, -0.09))
    hip.add(mesh(`foot${side}`, new BoxGeometry(0.18, 0.08, 0.26), m.bumbleYellow, 0, -0.245, 0.04))
    root.add(hip)
  }

  // ── 躯干:圆润黄胶囊 + 中央赛车条纹 + 引擎盖进气口 ──
  root.add(mesh('body', new CapsuleGeometry(0.18, 0.1, 3, 10), m.bumbleYellow, 0, 0.06))
  root.add(mesh('stripe', new BoxGeometry(0.08, 0.2, 0.03), m.bumbleBlack, 0, 0.06, 0.18))
  root.add(mesh('scoop', new BoxGeometry(0.14, 0.05, 0.1), m.bumbleBlack, 0, 0.19, 0.1))

  // 散热翼肩:挂 root(臂摆动时肩翼不跟,跑车翼子板语义)
  for (const side of [-1, 1] as const) {
    const wing = mesh(`ventWing${side}`, new BoxGeometry(0.18, 0.03, 0.2), m.bumbleBlack, 0.26 * side, 0.17, -0.02)
    wing.rotation.z = -0.22 * side
    root.add(wing)
  }

  // ── 手臂(肩 ±0.21,0.13,0,rotZ=∓0.45):黄袖 + 银拳 ──
  for (const side of [-1, 1] as const) {
    const shoulder = new Group()
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm'
    shoulder.position.set(0.21 * side, 0.13, 0)
    shoulder.rotation.z = -0.45 * side
    shoulder.add(mesh(`sleeve${side}`, new CapsuleGeometry(0.05, 0.12, 3, 8), m.bumbleYellow, 0, -0.1))
    shoulder.add(mesh(`hand${side}`, new SphereGeometry(0.06, 10, 8), m.bumbleSilver, 0, -0.22))
    root.add(shoulder)
  }

  // ── 头(颈 0,0.26,0):圆黄头 + 黑面罩 + 外倾触角 ──
  const head = new Group()
  head.name = 'head'
  head.position.set(0, 0.26, 0)
  head.add(mesh('skull', new SphereGeometry(0.19, 16, 12), m.bumbleYellow, 0, 0.12))
  head.add(mesh('visor', new BoxGeometry(0.16, 0.06, 0.06), m.bumbleBlack, 0, 0.11, 0.15))
  for (const side of [-1, 1] as const) {
    const antenna = mesh(`antenna${side}`, new CylinderGeometry(0.012, 0.012, 0.12, 6), m.bumbleBlack, 0.07 * side, 0.26, 0)
    antenna.rotation.z = -0.35 * side
    head.add(antenna)
  }
  root.add(head)

  return { root, geometries }
}
