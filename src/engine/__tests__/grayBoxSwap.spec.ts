import './canvasStub' // 必须最先:MaterialLib 模块级贴图需 Canvas 2d
import { Scene, Group, Mesh, type BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { GrayBoxEntity } from '@/game/Game'
import { ViewRegistry } from '../ViewRegistry'
import { GrayBox } from '../mesh/GrayBox'

/**
 * 皮肤 MOD 换模型集成:ViewRegistry.replace + GrayBox.setSkin 的接缝行为。
 * jsdom 下 Scene/ViewRegistry/GrayBox 均为纯对象(无需 WebGL),
 * 用假马里奥实体即可覆盖:换绑唯一性、落位、姿态继承、旧几何 dispose、幂等。
 */
function setup() {
  const scene = new Scene()
  const views = new ViewRegistry(scene)
  const e: GrayBoxEntity = {
    id: 'mario',
    kind: 'mario',
    pos: { x: 42, y: 1.5 }, // 非原点坐标:验证 replace 按实体落位不跳回 (0,0,0)
    prevPos: { x: 42, y: 1.5 },
    size: { x: 0.8, y: 0.95 },
    z: 0,
    vel: { x: 0, y: 0 },
    onGround: true,
  }
  const gray = new GrayBox(views, [e], scene)
  return { scene, e, gray }
}

const meshGeos = (root: Group): BufferGeometry[] => {
  const set = new Set<BufferGeometry>()
  root.traverse((o) => {
    if (o instanceof Mesh) set.add(o.geometry)
  })
  return [...set]
}

describe('GrayBox.setSkin 换模型', () => {
  it('换绑后场景唯一马里奥,按实体位姿落位,含 5 关节与皮肤特征件', () => {
    const { scene, e, gray } = setup()
    const before = scene.getObjectByName('mario') as Group
    expect(before).toBeTruthy()
    expect(scene.children.length).toBe(2) // 马里奥 root + coin-vfx

    gray.setSkin('optimus')
    const after = scene.getObjectByName('mario') as Group
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
    expect(after.parent).toBe(scene)
    expect(before.parent).toBeNull() // 旧 root 已摘出场景
    expect(scene.children.length).toBe(2) // 换绑不增不减
    expect(after.position.x).toBe(e.pos.x)
    expect(after.position.y).toBe(e.pos.y)
    for (const n of ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'head'])
      expect(after.getObjectByName(n)).toBeTruthy()
    expect(after.getObjectByName('windshield')).toBeTruthy() // 擎天柱特征件 = 皮肤已生效
  })

  it('旧皮肤几何即时 dispose(防泄漏),新皮肤几何不动', () => {
    const { scene, gray } = setup()
    const spies = meshGeos(scene.getObjectByName('mario') as Group).map((g) => vi.spyOn(g, 'dispose'))
    expect(spies.length).toBeGreaterThan(0)

    gray.setSkin('bumblebee')
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1)

    gray.dispose() // 已释放的旧几何不在 marioGeometries,dispose 不二次释放
  })

  it('同 id 幂等:不重建模型、不重复 dispose', () => {
    const { scene, gray } = setup()
    gray.setSkin('optimus')
    const root1 = scene.getObjectByName('mario') as Group
    const spies = meshGeos(root1).map((g) => vi.spyOn(g, 'dispose'))

    gray.setSkin('optimus')
    expect(scene.getObjectByName('mario')).toBe(root1)
    for (const s of spies) expect(s).not.toHaveBeenCalled()
  })

  it('姿态继承:切换瞬间旋转/可见性延续,无视觉跳变', () => {
    const { scene, gray } = setup()
    const before = scene.getObjectByName('mario') as Group
    before.rotation.y = 1.23
    before.visible = false // 模拟无敌闪烁相位

    gray.setSkin('ryujinmaru')
    const after = scene.getObjectByName('mario') as Group
    expect(after.rotation.y).toBeCloseTo(1.23)
    expect(after.visible).toBe(false)
  })

  it('swap 后 update 照常驱动新模型关节(走路步态/朝向)', () => {
    const { scene, e, gray } = setup()
    gray.setSkin('optimus')
    e.vel.x = 3
    e.onGround = true
    expect(() => {
      for (let i = 0; i < 10; i++) gray.update(1 / 60, i / 60)
    }).not.toThrow()

    const root = scene.getObjectByName('mario') as Group
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2 - 0.4) // MARIO_YAW 右向
    const leg = root.getObjectByName('leftLeg') as Group
    expect(leg.rotation.x).not.toBe(0) // updateMario 驱动的是新模型的关节
  })

  it('dispose 释放当前皮肤几何且 swap 后不双重释放', () => {
    const { scene, gray } = setup()
    gray.setSkin('optimus')
    const spies = meshGeos(scene.getObjectByName('mario') as Group).map((g) => vi.spyOn(g, 'dispose'))
    expect(spies.length).toBeGreaterThan(0)

    gray.dispose()
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1)
    gray.dispose() // 二次 dispose 安全(marioGeometries 已置空)
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1)
  })
})
