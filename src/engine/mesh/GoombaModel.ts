import { BoxGeometry, BufferGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 板栗仔:棕色圆头 + 怒眉 + 两只脚掌,剪影一眼可读(造型优先)。
 * 脚掌暴露给动画层做交替蹭地步态;被踩扁由视图层压 scale.y。
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

  const body = mk('body', new SphereGeometry(0.34, 14, 10), materials.goombaBody, 0, 0.08)
  body.scale.set(1.08, 0.92, 1)

  // 怒脸:白眼珠 + 黑瞳 + 倒八字眉(朝向 +z)
  const eyeL = mk('eyeL', new SphereGeometry(0.07, 8, 6), materials.goombaEye, -0.12, 0.14, 0.26)
  const eyeR = mk('eyeR', new SphereGeometry(0.07, 8, 6), materials.goombaEye, 0.12, 0.14, 0.26)
  const pupilL = mk('pupilL', new SphereGeometry(0.03, 6, 5), materials.marioHair, -0.12, 0.12, 0.32)
  const pupilR = mk('pupilR', new SphereGeometry(0.03, 6, 5), materials.marioHair, 0.12, 0.12, 0.32)
  const browL = mk('browL', new BoxGeometry(0.13, 0.035, 0.03), materials.marioHair, -0.12, 0.24, 0.28)
  const browR = mk('browR', new BoxGeometry(0.13, 0.035, 0.03), materials.marioHair, 0.12, 0.24, 0.28)
  browL.rotation.z = 0.4 // 倒八字 = 生气
  browR.rotation.z = -0.4

  const leftFoot = mk('footL', new BoxGeometry(0.2, 0.1, 0.3), materials.goombaFoot, -0.16, -0.3, 0.02)
  const rightFoot = mk('footR', new BoxGeometry(0.2, 0.1, 0.3), materials.goombaFoot, 0.16, -0.3, 0.02)

  root.add(body, eyeL, eyeR, pupilL, pupilR, browL, browR, leftFoot, rightFoot)
  return { root, leftFoot, rightFoot, geometries }
}
