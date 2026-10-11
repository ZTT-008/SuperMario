import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 板栗仔(初代剪影):头部 = 上小下大的锥形伞盖(向外撇的倒三角,顶加圆穹),
 * 白色身体明显收细(半径 0.19 ≈ 盖底 0.37 的一半),怒眉白眼嵌盖面前缘,
 * 深色獠牙从白身向上探到盖沿,深棕圆脚。
 *
 * 动画硬契约(GrayBox.updateGoomba/squish,勿改):
 * - leftFoot/rightFoot 必须是 Mesh,初始 z=0.02(每帧绝对写 position.z);
 * - 脸朝 +z(yaw 把 +z 转向行进方向偏相机侧);
 * - 脚底 root-local −0.4 = 实体底(贴地);
 * - 踩扁压 root.scale(→1.45, 0.25, 1),锥+柱体压扁即摊平饼,无穿模。
 */
export function createGoombaModel(): {
  root: Group
  leftFoot: Mesh
  rightFoot: Mesh
  geometries: BufferGeometry[]
} {
  const root = new Group()
  root.name = 'goomba'
  const geometries: BufferGeometry[] = []

  const mk = (name: string, geo: BufferGeometry, mat: Mesh['material'], x: number, y: number, z = 0): Mesh => {
    geometries.push(geo)
    const m = new Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  // 头:上小下大圆台(顶半径 0.15 → 底 0.37,外撇倒三角)+ 顶圆穹收口
  const cap = mk('cap', new CylinderGeometry(0.15, 0.37, 0.38, 16), materials.goombaBody, 0, 0.1)
  const dome = mk('dome', new SphereGeometry(0.15, 16, 10), materials.goombaBody, 0, 0.29)
  dome.scale.set(1, 0.6, 1)
  // 白色身体:细柱(半径 0.19,明显窄于盖底),从盖底垂到脚面
  const body = mk('body', new CylinderGeometry(0.19, 0.19, 0.32, 14), materials.goombaFace, 0, -0.22)

  // 怒脸嵌在盖面前缘(朝 +z):白眼黑瞳 + 倒八字眉(内端下压)
  const eyeL = mk('eyeL', new SphereGeometry(0.07, 8, 6), materials.goombaEye, -0.12, -0.02, 0.24)
  const eyeR = mk('eyeR', new SphereGeometry(0.07, 8, 6), materials.goombaEye, 0.12, -0.02, 0.24)
  const pupilL = mk('pupilL', new SphereGeometry(0.035, 6, 5), materials.marioHair, -0.12, -0.04, 0.295)
  const pupilR = mk('pupilR', new SphereGeometry(0.035, 6, 5), materials.marioHair, 0.12, -0.04, 0.295)
  const browL = mk('browL', new BoxGeometry(0.14, 0.04, 0.04), materials.marioHair, -0.12, 0.07, 0.25)
  const browR = mk('browR', new BoxGeometry(0.14, 0.04, 0.04), materials.marioHair, 0.12, 0.07, 0.25)
  browL.rotation.z = -0.5 // 倒八字 = 生气(内端下压)
  browR.rotation.z = 0.5
  // 獠牙:深色锥(白身上才有对比)从白身向上探,尖端正抵伞盖下沿
  const fangL = mk('fangL', new ConeGeometry(0.03, 0.08, 4), materials.goombaFoot, -0.085, -0.13, 0.165)
  const fangR = mk('fangR', new ConeGeometry(0.03, 0.08, 4), materials.goombaFoot, 0.085, -0.13, 0.165)

  // 圆脚:底 = −0.332 − 0.11×0.62 = −0.4 精确贴实体底
  const leftFoot = mk('footL', new SphereGeometry(0.11, 10, 8), materials.goombaFoot, -0.15, -0.332, 0.02)
  const rightFoot = mk('footR', new SphereGeometry(0.11, 10, 8), materials.goombaFoot, 0.15, -0.332, 0.02)
  leftFoot.scale.set(1.1, 0.62, 1.5)
  rightFoot.scale.set(1.1, 0.62, 1.5)

  root.add(cap, dome, body, eyeL, eyeR, pupilL, pupilR, browL, browR, fangL, fangR, leftFoot, rightFoot)
  return { root, leftFoot, rightFoot, geometries }
}
