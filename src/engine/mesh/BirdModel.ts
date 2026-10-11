import { BoxGeometry, BufferGeometry, ConeGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 俯冲鸟(M2 空中敌):红圆身 + 黄喙 + 白肚 + 双翼 + 尾羽。
 * 栖息时翅膀收拢慢扇,俯冲时翅膀后掠(视图层驱动)。
 */
export function createBirdModel(): {
  root: Group
  leftWing: Mesh
  rightWing: Mesh
  geometries: BufferGeometry[]
} {
  const root = new Group()
  root.name = 'bird'
  const geometries: BufferGeometry[] = []

  const mk = (name: string, geo: BufferGeometry, mat: Mesh['material'], x: number, y: number, z = 0): Mesh => {
    geometries.push(geo)
    const m = new Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const body = mk('body', new SphereGeometry(0.3, 14, 10), materials.birdBody, 0, 0.02)
  body.scale.set(1, 0.95, 0.9)
  const belly = mk('belly', new SphereGeometry(0.2, 12, 8), materials.goombaEye, 0, -0.08, 0.14)
  belly.scale.set(0.9, 0.8, 0.6)

  const beak = mk('beak', new ConeGeometry(0.08, 0.22, 6), materials.birdBeak, 0, 0.02, 0.34)
  beak.rotation.x = Math.PI / 2 // 锥尖 → +z

  const eyeL = mk('eyeL', new SphereGeometry(0.05, 8, 6), materials.goombaEye, -0.11, 0.14, 0.24)
  const eyeR = mk('eyeR', new SphereGeometry(0.05, 8, 6), materials.goombaEye, 0.11, 0.14, 0.24)
  const pupilL = mk('pupilL', new SphereGeometry(0.022, 6, 5), materials.marioHair, -0.11, 0.13, 0.28)
  const pupilR = mk('pupilR', new SphereGeometry(0.022, 6, 5), materials.marioHair, 0.11, 0.13, 0.28)

  const tail = mk('tail', new BoxGeometry(0.16, 0.05, 0.24), materials.birdWing, 0, 0.06, -0.34)
  tail.rotation.x = -0.35

  const leftWing = mk('leftWing', new BoxGeometry(0.36, 0.06, 0.3), materials.birdWing, -0.4, 0.06)
  const rightWing = mk('rightWing', new BoxGeometry(0.36, 0.06, 0.3), materials.birdWing, 0.4, 0.06)

  const footL = mk('footL', new BoxGeometry(0.07, 0.12, 0.1), materials.birdBeak, -0.1, -0.3, 0.04)
  const footR = mk('footR', new BoxGeometry(0.07, 0.12, 0.1), materials.birdBeak, 0.1, -0.3, 0.04)

  root.add(body, belly, beak, eyeL, eyeR, pupilL, pupilR, tail, leftWing, rightWing, footL, footR)
  return { root, leftWing, rightWing, geometries }
}
