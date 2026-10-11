import { BoxGeometry, BufferGeometry, Group, Mesh, SphereGeometry } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 飞怪(M2 空中敌):绿壳 + 黄身 + 两脚。fly 态壳底朝下悬空、
 * fall 态整体翻滚、walk 态复用板栗仔步态(视图层驱动,模型只给关节)。
 */
export function createParatroopaModel(): {
  root: Group
  leftFoot: Mesh
  rightFoot: Mesh
  geometries: BufferGeometry[]
} {
  const root = new Group()
  root.name = 'paratroopa'
  const geometries: BufferGeometry[] = []

  const mk = (name: string, geo: BufferGeometry, mat: Mesh['material'], x: number, y: number, z = 0): Mesh => {
    geometries.push(geo)
    const m = new Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }

  // 壳:压扁球 + 壳沿圈(绿);身/头从壳顶探出(黄)
  const shell = mk('shell', new SphereGeometry(0.32, 14, 10), materials.paraShell, 0, -0.08)
  shell.scale.set(1.05, 0.8, 1)
  const rim = mk('rim', new SphereGeometry(0.3, 14, 6), materials.paraBody, 0, 0.02)
  rim.scale.set(1.02, 0.22, 0.98)

  const head = mk('head', new SphereGeometry(0.16, 12, 8), materials.paraBody, 0, 0.24, 0.06)
  const eyeL = mk('eyeL', new SphereGeometry(0.045, 8, 6), materials.goombaEye, -0.07, 0.28, 0.19)
  const eyeR = mk('eyeR', new SphereGeometry(0.045, 8, 6), materials.goombaEye, 0.07, 0.28, 0.19)
  const pupilL = mk('pupilL', new SphereGeometry(0.02, 6, 5), materials.marioHair, -0.07, 0.27, 0.23)
  const pupilR = mk('pupilR', new SphereGeometry(0.02, 6, 5), materials.marioHair, 0.07, 0.27, 0.23)

  const leftFoot = mk('footL', new BoxGeometry(0.16, 0.1, 0.24), materials.goombaFoot, -0.15, -0.36, 0.02)
  const rightFoot = mk('footR', new BoxGeometry(0.16, 0.1, 0.24), materials.goombaFoot, 0.15, -0.36, 0.02)

  root.add(shell, rim, head, eyeL, eyeR, pupilL, pupilR, leftFoot, rightFoot)
  return { root, leftFoot, rightFoot, geometries }
}
