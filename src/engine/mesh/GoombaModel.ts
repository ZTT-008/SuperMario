import { BoxGeometry, BufferGeometry, ConeGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 板栗仔(经典蘑菇怪精修):棕色蘑菇伞盖压奶白下脸带 + 倒八字怒眉 +
 * 白眼黑瞳 + 脸带下缘两颗上獠牙 + 深棕圆脚,初代 Goomba 剪影一眼可读。
 *
 * 动画硬契约(GrayBox.updateGoomba/squish,勿改):
 * - leftFoot/rightFoot 必须是 Mesh,初始 z=0.02(每帧绝对写 position.z);
 * - 脸朝 +z(yaw 把 +z 转向行进方向偏相机侧);
 * - 脚底 root-local −0.4 = 实体底(贴地,旧模型悬空 0.05 已修);
 * - 踩扁压 root.scale(→1.45, 0.25, 1),造型须为可压扁圆顶,无竖直细件穿模。
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

  // 上棕下奶两段体:扁球伞盖(底缘垂到脸带中段)→ 下缘露出一圈奶白脸带
  const cap = mk('cap', new SphereGeometry(0.36, 16, 12), materials.goombaBody, 0, 0.12)
  cap.scale.set(1.05, 0.75, 1)
  const face = mk('face', new SphereGeometry(0.31, 14, 10), materials.goombaFace, 0, -0.09, 0.02)
  face.scale.set(1, 0.62, 0.98)

  // 怒脸(朝 +z):眼嵌伞盖下缘微凸(原版眼位),倒八字眉内端下压
  const eyeL = mk('eyeL', new SphereGeometry(0.075, 8, 6), materials.goombaEye, -0.13, 0.06, 0.29)
  const eyeR = mk('eyeR', new SphereGeometry(0.075, 8, 6), materials.goombaEye, 0.13, 0.06, 0.29)
  const pupilL = mk('pupilL', new SphereGeometry(0.035, 6, 5), materials.marioHair, -0.13, 0.04, 0.345)
  const pupilR = mk('pupilR', new SphereGeometry(0.035, 6, 5), materials.marioHair, 0.13, 0.04, 0.345)
  const browL = mk('browL', new BoxGeometry(0.15, 0.04, 0.04), materials.marioHair, -0.13, 0.16, 0.33)
  const browR = mk('browR', new BoxGeometry(0.15, 0.04, 0.04), materials.marioHair, 0.13, 0.16, 0.33)
  browL.rotation.z = -0.5 // 倒八字 = 生气(内端下压)
  browR.rotation.z = 0.5
  // 獠牙从奶白脸带前下缘探出(锥默认尖朝 +y,不旋转)
  const fangL = mk('fangL', new ConeGeometry(0.028, 0.07, 4), materials.goombaEye, -0.09, -0.21, 0.27)
  const fangR = mk('fangR', new ConeGeometry(0.028, 0.07, 4), materials.goombaEye, 0.09, -0.21, 0.27)

  // 圆脚(压扁拉长球):底 = −0.309 − 0.13×0.7 = −0.4 精确贴实体底
  const leftFoot = mk('footL', new SphereGeometry(0.13, 10, 8), materials.goombaFoot, -0.17, -0.309, 0.02)
  const rightFoot = mk('footR', new SphereGeometry(0.13, 10, 8), materials.goombaFoot, 0.17, -0.309, 0.02)
  leftFoot.scale.set(1.1, 0.7, 1.5)
  rightFoot.scale.set(1.1, 0.7, 1.5)

  root.add(cap, face, eyeL, eyeR, pupilL, pupilR, browL, browR, fangL, fangR, leftFoot, rightFoot)
  return { root, leftFoot, rightFoot, geometries }
}
