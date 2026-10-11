import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three'
import { skinMaterials as m } from './skinMaterials'

/**
 * 龙神丸皮肤(完全换模型):日式机甲 —— 龙角头盔 + 金冠 + 蓝肩甲锥 + 背后红披风。
 * 披风挂 root(静态,不随臂摆),DoubleSide 绕到背后也可见。动画契约与
 * MarioModel 逐字一致,脚底腿局部 y=−0.285(root-local −0.455,贴地)。
 */
export function createRyujinmaruModel(): { root: Group; geometries: BufferGeometry[] } {
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

  // ── 腿(髋 ±0.11,−0.17,0):白大腿甲 + 金胫 + 蓝脚(底 −0.285)──
  for (const side of [-1, 1] as const) {
    const hip = new Group()
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg'
    hip.position.set(0.11 * side, -0.17, 0)
    hip.add(mesh(`thighArmor${side}`, new BoxGeometry(0.15, 0.14, 0.15), m.ryuWhite, 0, -0.06))
    hip.add(mesh(`greave${side}`, new BoxGeometry(0.12, 0.12, 0.13), m.ryuGold, 0, -0.185))
    hip.add(mesh(`foot${side}`, new BoxGeometry(0.17, 0.08, 0.24), m.ryuBlue, 0, -0.245, 0.03))
    root.add(hip)
  }

  // ── 躯干:白胸甲 + 金色纹章 ──
  root.add(mesh('chest', new BoxGeometry(0.3, 0.24, 0.2), m.ryuWhite, 0, 0.08))
  root.add(mesh('crest', new BoxGeometry(0.1, 0.1, 0.04), m.ryuGold, 0, 0.1, 0.11))

  // 蓝肩甲锥:挂 root(臂摆时肩甲不动,日式机甲语义),外倾
  for (const side of [-1, 1] as const) {
    const pauldron = mesh(`pauldron${side}`, new ConeGeometry(0.11, 0.16, 8), m.ryuBlue, 0.25 * side, 0.19, 0)
    pauldron.rotation.z = -0.6 * side
    root.add(pauldron)
  }

  // 披风:背后薄面片,顶部微前倾贴背
  const cape = mesh('cape', new PlaneGeometry(0.52, 0.72), m.ryuCape, 0, -0.02, -0.17)
  cape.rotation.x = 0.12
  root.add(cape)

  // ── 手臂(肩 ±0.21,0.13,0,rotZ=∓0.45):蓝袖 + 金拳 ──
  for (const side of [-1, 1] as const) {
    const shoulder = new Group()
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm'
    shoulder.position.set(0.21 * side, 0.13, 0)
    shoulder.rotation.z = -0.45 * side
    shoulder.add(mesh(`sleeve${side}`, new CapsuleGeometry(0.05, 0.11, 3, 8), m.ryuBlue, 0, -0.1))
    shoulder.add(mesh(`hand${side}`, new SphereGeometry(0.058, 10, 8), m.ryuGold, 0, -0.21))
    root.add(shoulder)
  }

  // ── 头(颈 0,0.26,0):白颅 + 蓝盔 + 外倾双龙角 + 金冠 + 金眼 ──
  const head = new Group()
  head.name = 'head'
  head.position.set(0, 0.26, 0)
  head.add(mesh('skull', new SphereGeometry(0.19, 16, 12), m.ryuWhite, 0, 0.12))
  head.add(mesh('helmetCap', new CylinderGeometry(0.2, 0.17, 0.1, 12), m.ryuBlue, 0, 0.22))
  for (const side of [-1, 1] as const) {
    const horn = mesh(`horn${side}`, new ConeGeometry(0.035, 0.16, 6), m.ryuGold, 0.1 * side, 0.28, 0)
    horn.rotation.z = -0.55 * side
    head.add(horn)
    head.add(mesh(`eye${side}`, new SphereGeometry(0.02, 8, 6), m.ryuGold, 0.06 * side, 0.13, 0.165))
  }
  head.add(mesh('goldCrest', new BoxGeometry(0.03, 0.09, 0.14), m.ryuGold, 0, 0.27, 0.02))
  root.add(head)

  return { root, geometries }
}
