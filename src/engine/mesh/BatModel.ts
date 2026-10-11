import { BoxGeometry, BufferGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 蝙蝠(M2 空中敌):小圆身 + 尖耳 + 两面膜翼(命名关节供动画扇动),
 * 白眼珠红瞳 = 洞穴读感。低模:球 ≤14×10,翼为薄盒。
 */
export function createBatModel(): {
  root: Group
  leftWing: Mesh
  rightWing: Mesh
  geometries: BufferGeometry[]
} {
  const root = new Group()
  root.name = 'bat'
  const geometries: BufferGeometry[] = []

  const mk = (name: string, geo: BufferGeometry, mat: Mesh['material'], x: number, y: number, z = 0): Mesh => {
    geometries.push(geo)
    const m = new Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  const body = mk('body', new SphereGeometry(0.24, 14, 10), materials.batBody, 0, 0)
  body.scale.set(1.05, 0.9, 0.9)

  const earL = mk('earL', new BoxGeometry(0.08, 0.16, 0.05), materials.batWing, -0.12, 0.24)
  const earR = mk('earR', new BoxGeometry(0.08, 0.16, 0.05), materials.batWing, 0.12, 0.24)
  earL.rotation.z = 0.25
  earR.rotation.z = -0.25

  const eyeL = mk('eyeL', new SphereGeometry(0.045, 8, 6), materials.goombaEye, -0.09, 0.05, 0.2)
  const eyeR = mk('eyeR', new SphereGeometry(0.045, 8, 6), materials.goombaEye, 0.09, 0.05, 0.2)
  const pupilL = mk('pupilL', new SphereGeometry(0.02, 6, 5), materials.flagCloth, -0.09, 0.04, 0.24)
  const pupilR = mk('pupilR', new SphereGeometry(0.02, 6, 5), materials.flagCloth, 0.09, 0.04, 0.24)

  // 膜翼:枢轴在根部(翼盒向 ±x 延伸,rotation.z 扇动)
  const leftWing = mk('leftWing', new BoxGeometry(0.34, 0.05, 0.26), materials.batWing, -0.38, 0.04)
  const rightWing = mk('rightWing', new BoxGeometry(0.34, 0.05, 0.26), materials.batWing, 0.38, 0.04)

  root.add(body, earL, earR, eyeL, eyeR, pupilL, pupilR, leftWing, rightWing)
  return { root, leftWing, rightWing, geometries }
}
