import { BufferGeometry, ConeGeometry, Group, LatheGeometry, Mesh, SphereGeometry, Vector2 } from 'three'
import { materials } from '../material/MaterialLib'

/**
 * 板栗仔(初代剪影·圆润版):头部 = 车削曲面伞盖,profile 自底向顶连续内收
 * (下缘最宽 0.34 → 顶部 0,上小下大倒三角但全曲线无直棱);白色身体 = 蛋形
 * 球体明显收细(半宽 0.166 ≈ 盖宽一半);眉用压扁球替代硬盒,獠牙小锥,
 * 全身无圆柱/立方体,踩扁压 root.scale 时曲面摊平如软糖。
 *
 * 动画硬契约(GrayBox.updateGoomba/squish,勿改):
 * - leftFoot/rightFoot 必须是 Mesh,初始 z=0.02(每帧绝对写 position.z);
 * - 脸朝 +z;脚底 root-local −0.4 = 实体底(贴地)。
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

  // 伞盖:车削连续曲线(底心 → 外撇最宽 0.34 → 平滑收顶),法线连续 = 无板硬棱
  const capProfile = [
    [0.0, -0.12],
    [0.18, -0.115],
    [0.3, -0.1],
    [0.34, -0.07],
    [0.31, -0.01],
    [0.26, 0.06],
    [0.21, 0.13],
    [0.17, 0.19],
    [0.135, 0.245],
    [0.1, 0.29],
    [0.055, 0.325],
    [0.0, 0.34],
  ].map(([x, y]) => new Vector2(x, y))
  const cap = mk('cap', new LatheGeometry(capProfile, 24), materials.goombaBody, 0, 0)

  // 白色身体:蛋形(球微缩放),半宽 0.166 明显细于盖宽,底缘没入脚面
  const body = mk('body', new SphereGeometry(0.18, 16, 12), materials.goombaFace, 0, -0.22)
  body.scale.set(0.92, 1, 0.92)

  // 怒脸嵌盖面前缘(朝 +z):白眼黑瞳;眉 = 压扁球旋倒八字(比硬盒柔和)
  const eyeL = mk('eyeL', new SphereGeometry(0.065, 8, 6), materials.goombaEye, -0.11, -0.02, 0.26)
  const eyeR = mk('eyeR', new SphereGeometry(0.065, 8, 6), materials.goombaEye, 0.11, -0.02, 0.26)
  const pupilL = mk('pupilL', new SphereGeometry(0.03, 6, 5), materials.marioHair, -0.11, -0.04, 0.31)
  const pupilR = mk('pupilR', new SphereGeometry(0.03, 6, 5), materials.marioHair, 0.11, -0.04, 0.31)
  const browGeo = new SphereGeometry(0.06, 8, 6)
  const browL = mk('browL', browGeo, materials.marioHair, -0.11, 0.06, 0.21)
  const browR = mk('browR', browGeo, materials.marioHair, 0.11, 0.06, 0.21)
  browL.scale.set(1.25, 0.32, 0.5)
  browR.scale.set(1.25, 0.32, 0.5)
  browL.rotation.z = -0.5 // 倒八字 = 生气(内端下压)
  browR.rotation.z = 0.5
  // 獠牙:深色小锥从白身向上探,尖抵盖底沿(白身对比 + 盖沿压顶 = 凶相)
  const fangL = mk('fangL', new ConeGeometry(0.026, 0.07, 6), materials.goombaFoot, -0.08, -0.14, 0.14)
  const fangR = mk('fangR', new ConeGeometry(0.026, 0.07, 6), materials.goombaFoot, 0.08, -0.14, 0.14)

  // 圆脚:底 = −0.323 − 0.11×0.7 = −0.4 精确贴实体底
  const leftFoot = mk('footL', new SphereGeometry(0.11, 10, 8), materials.goombaFoot, -0.14, -0.323, 0.02)
  const rightFoot = mk('footR', new SphereGeometry(0.11, 10, 8), materials.goombaFoot, 0.14, -0.323, 0.02)
  leftFoot.scale.set(1, 0.7, 1.35)
  rightFoot.scale.set(1, 0.7, 1.35)

  root.add(cap, body, eyeL, eyeR, pupilL, pupilR, browL, browR, fangL, fangR, leftFoot, rightFoot)
  return { root, leftFoot, rightFoot, geometries }
}
