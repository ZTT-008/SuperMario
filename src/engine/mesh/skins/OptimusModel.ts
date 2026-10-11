import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three'
import { skinMaterials as m } from './skinMaterials'

/**
 * 擎天柱皮肤(完全换模型):卡车胸舱 + 倾斜车窗 + 双烟囱 + 肩甲,红蓝银机甲剪影。
 * 动画契约与 MarioModel 逐字一致 —— 5 关节组名/原点/rotZ 相同,
 * 脚底腿局部 y=−0.285(= 基础模型 boot 底),体型 1.2x 只加宽躯干/肩甲不抬高脚底。
 */
export function createOptimusModel(): { root: Group; geometries: BufferGeometry[] } {
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

  // ── 腿(关节组:原点=髋 ±0.11,−0.17,0):红腿甲 + 蓝轮块脚(底 −0.285)──
  for (const side of [-1, 1] as const) {
    const hip = new Group()
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg'
    hip.position.set(0.11 * side, -0.17, 0)
    hip.add(mesh(`legArmor${side}`, new BoxGeometry(0.16, 0.2, 0.16), m.optiRed, 0, -0.09))
    hip.add(mesh(`wheelFoot${side}`, new BoxGeometry(0.19, 0.09, 0.26), m.optiBlue, 0, -0.24, 0.03))
    root.add(hip)
  }

  // ── 躯干:卡车胸舱(1.2x 宽)+ 前倾车窗 + 背侧双烟囱 ──
  root.add(mesh('cab', new BoxGeometry(0.36, 0.26, 0.24), m.optiRed, 0, 0.08))
  const windshield = mesh('windshield', new BoxGeometry(0.3, 0.13, 0.05), m.optiGlass, 0, 0.13, 0.12)
  windshield.rotation.x = -0.18 // 车头挡风玻璃倾角
  root.add(windshield)
  for (const side of [-1, 1] as const) {
    root.add(
      mesh(`stack${side}`, new CylinderGeometry(0.028, 0.028, 0.16, 8), m.optiSilver, 0.17 * side, 0.24, -0.06),
    )
  }

  // ── 手臂(关节组:原点=肩 ±0.21,0.13,0,rotZ=∓0.45):肩甲 + 蓝臂 + 银拳 ──
  for (const side of [-1, 1] as const) {
    const shoulder = new Group()
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm'
    shoulder.position.set(0.21 * side, 0.13, 0)
    shoulder.rotation.z = -0.45 * side
    shoulder.add(mesh(`shoulderPad${side}`, new BoxGeometry(0.1, 0.09, 0.16), m.optiBlue, 0.03 * side, 0.02))
    shoulder.add(mesh(`arm${side}`, new CapsuleGeometry(0.05, 0.1, 3, 8), m.optiBlue, 0, -0.11))
    shoulder.add(mesh(`fist${side}`, new BoxGeometry(0.09, 0.08, 0.09), m.optiSilver, 0, -0.22))
    root.add(shoulder)
  }

  // ── 头(关节组:原点=颈 0,0.26,0):头盔 + 面罩 + 双天线 ──
  const head = new Group()
  head.name = 'head'
  head.position.set(0, 0.26, 0)
  head.add(mesh('helmet', new BoxGeometry(0.2, 0.18, 0.18), m.optiRed, 0, 0.12))
  head.add(mesh('faceplate', new BoxGeometry(0.12, 0.07, 0.05), m.optiSilver, 0, 0.09, 0.1))
  for (const side of [-1, 1] as const) {
    head.add(mesh(`antenna${side}`, new CylinderGeometry(0.014, 0.014, 0.1, 6), m.optiSilver, 0.09 * side, 0.22, 0))
  }
  root.add(head)

  return { root, geometries }
}
