import type { BufferGeometry, Group } from 'three'
import { createMarioModel } from '../MarioModel'
import { createBumblebeeModel } from './BumblebeeModel'
import { createOptimusModel } from './OptimusModel'
import { createRyujinmaruModel } from './RyujinmaruModel'

/**
 * 皮肤 MOD 注册表:每款 = 独立模型工厂,全部遵守 MarioModel 动画硬契约 ——
 * root.name='mario',5 关节 Group(leftLeg/rightLeg/leftArm/rightArm/head)
 * 名/原点/手臂初始 rotZ 逐字一致,脚底 root-local y≈−0.455(贴地)。
 * 数组顺序 = 数字键 1-4 映射(useGameSession 热键 + GameCanvas 卡片行共用)。
 */
export type SkinId = 'mario' | 'optimus' | 'bumblebee' | 'ryujinmaru'

export interface SkinDef {
  id: SkinId
  label: string
  create(): { root: Group; geometries: BufferGeometry[] }
}

export const SKINS: readonly SkinDef[] = [
  { id: 'mario', label: '马里奥', create: createMarioModel },
  { id: 'optimus', label: '擎天柱', create: createOptimusModel },
  { id: 'bumblebee', label: '大黄蜂', create: createBumblebeeModel },
  { id: 'ryujinmaru', label: '龙神丸', create: createRyujinmaruModel },
]

export function isSkinId(v: unknown): v is SkinId {
  return SKINS.some((s) => s.id === v)
}

export function createSkin(id: SkinId): { root: Group; geometries: BufferGeometry[] } {
  return (SKINS.find((s) => s.id === id) ?? SKINS[0]!).create()
}

export { disposeSkinMaterials } from './skinMaterials'
