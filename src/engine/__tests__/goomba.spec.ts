import './canvasStub' // 必须最先:MaterialLib 模块级贴图需 Canvas 2d
import { Box3, Mesh, type BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import { createGoombaModel } from '../mesh/GoombaModel'

/**
 * 板栗仔动画硬契约回归(GrayBox.updateGoomba/squish 只认这套结构):
 * 脚必须是 Mesh 且初始 z=0.02(每帧绝对写 position.z,错位即瞬跳)、
 * 脚底贴地 −0.4(实体底,悬空/穿地防线)、脸朝 +z(yaw 语义)、
 * 部件数受 draw 预算约束(12 只独立 mesh,非实例化)。
 */
describe('板栗仔模型契约', () => {
  it('leftFoot/rightFoot 为 Mesh 且初始 z=0.02(updateGoomba 绝对写 z 对齐)', () => {
    const { leftFoot, rightFoot } = createGoombaModel()
    expect(leftFoot).toBeInstanceOf(Mesh)
    expect(rightFoot).toBeInstanceOf(Mesh)
    expect(leftFoot.position.z).toBe(0.02)
    expect(rightFoot.position.z).toBe(0.02)
  })

  it('脚底 root-local −0.4 = 实体底(贴地),轮廓不出 0.8×0.8 实体框', () => {
    const { root } = createGoombaModel()
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root)
    expect(box.min.y).toBeCloseTo(-0.4, 2)
    expect(box.max.y).toBeLessThanOrEqual(0.4)
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThanOrEqual(0.4)
  })

  it('脸朝 +z:眼/瞳/眉/獠牙全部 z>0(yaw 把 +z 转向行进方向)', () => {
    const { root } = createGoombaModel()
    for (const n of ['eyeL', 'eyeR', 'pupilL', 'pupilR', 'browL', 'browR', 'fangL', 'fangR']) {
      const o = root.getObjectByName(n)
      expect(o, `缺特征件 ${n}`).toBeTruthy()
      expect((o as Mesh).position.z).toBeGreaterThan(0)
    }
  })

  it('伞盖车削曲面法线外翻(LatheGeometry 绕序反了会渲染成内翻黑洞)', () => {
    const { root } = createGoombaModel()
    const cap = root.getObjectByName('cap') as Mesh
    const pos = cap.geometry.attributes.position as BufferAttribute
    const nrm = cap.geometry.attributes.normal as BufferAttribute
    let maxZ = -Infinity
    let idx = 0
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) > maxZ) {
        maxZ = pos.getZ(i)
        idx = i
      }
    }
    expect(nrm.getZ(idx)).toBeGreaterThan(0.5) // 最前点法线应指向 +z(外侧)
  })

  it('geometries 非空、全件 castShadow、mesh ≤14(draw 预算防线)', () => {
    const { root, geometries } = createGoombaModel()
    expect(geometries.length).toBeGreaterThan(0)
    const meshes: Mesh[] = []
    root.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o)
    })
    expect(meshes.length).toBeLessThanOrEqual(14)
    for (const m of meshes) expect(m.castShadow).toBe(true)
  })
})
