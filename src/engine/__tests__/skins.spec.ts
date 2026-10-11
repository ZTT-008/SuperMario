import './canvasStub' // 必须最先:MaterialLib 模块级贴图需 Canvas 2d
import { Box3, Group, Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { createSkin, isSkinId, SKINS, type SkinId } from '../mesh/skins'

/**
 * 皮肤工厂动画硬契约回归(GrayBox.updateMario 只驱动这些名字/原点):
 * 任何皮肤工厂改关节名/原点/rotZ/脚底 → updateMario 立刻失配(断肢、悬空),
 * 本 spec 是这条隐式契约的唯一自动化防线。
 */
const JOINT_ORIGINS = {
  leftLeg: [-0.11, -0.17, 0],
  rightLeg: [0.11, -0.17, 0],
  leftArm: [-0.21, 0.13, 0],
  rightArm: [0.21, 0.13, 0],
  head: [0, 0.26, 0],
} as const

describe('皮肤工厂契约', () => {
  for (const skin of SKINS) {
    it(`${skin.id}:关节名/原点/手臂初始 rotZ/脚底贴地与马里奥逐字一致`, () => {
      const { root, geometries } = skin.create()
      expect(root.name).toBe('mario')
      expect(geometries.length).toBeGreaterThan(0)

      const joint = (n: string): Group => {
        const g = root.getObjectByName(n)
        if (!(g instanceof Group)) throw new Error(`${skin.id}:关节 "${n}" 缺失或不是 Group`)
        return g
      }
      for (const name of Object.keys(JOINT_ORIGINS) as (keyof typeof JOINT_ORIGINS)[]) {
        const p = joint(name).position
        const [x, y, z] = JOINT_ORIGINS[name]
        expect([p.x, p.y, p.z]).toEqual([x, y, z])
      }
      // 手臂初始下垂烘在关节组(updateMario 只写 rotation.x),左 +0.45 / 右 −0.45
      expect(joint('leftArm').rotation.z).toBeCloseTo(0.45)
      expect(joint('rightArm').rotation.z).toBeCloseTo(-0.45)

      // 脚底 root-local = 基础模型 boot 底 −0.455(实体中心语义),穿地/悬空防线
      root.updateMatrixWorld(true)
      expect(new Box3().setFromObject(root).min.y).toBeCloseTo(-0.455, 2)

      // 全件投影(与基础模型观感一致)
      const meshes: Mesh[] = []
      root.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o)
      })
      expect(meshes.length).toBeGreaterThan(0)
      for (const mesh of meshes) expect(mesh.castShadow).toBe(true)
    })
  }
})

describe('SKINS 注册表', () => {
  it('顺序 = 数字键 1-4 映射(UI 卡片行与热键共用)', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['mario', 'optimus', 'bumblebee', 'ryujinmaru'])
  })

  it('isSkinId 白名单 + createSkin 未命中回退马里奥(localStorage 脏数据防线)', () => {
    expect(isSkinId('optimus')).toBe(true)
    expect(isSkinId('bogus')).toBe(false)
    expect(isSkinId(null)).toBe(false)
    expect(createSkin('bogus' as SkinId).root.name).toBe('mario')
  })
})
