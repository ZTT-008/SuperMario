import { DoubleSide, MeshStandardMaterial } from 'three'

/**
 * 皮肤 MOD 专属材质平表:每皮肤独立实例,与 MaterialLib 的 mario* 条目完全隔离
 * (marioHair 被 Goomba/Bird/Paratroopa 瞳孔共用,皮肤若复用会互相污染)。
 * 机甲漆面靠 metalness/roughness 对比区分(亮漆 vs 暗金属),延续平表「按角色命名」纪律。
 */
export const skinMaterials = {
  // 擎天柱:红蓝卡车漆 + 银金属 + 车窗黑
  optiRed: new MeshStandardMaterial({ color: 0xc0271d, metalness: 0.45, roughness: 0.35 }),
  optiBlue: new MeshStandardMaterial({ color: 0x1f4f9e, metalness: 0.45, roughness: 0.38 }),
  optiSilver: new MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.7, roughness: 0.3 }),
  optiGlass: new MeshStandardMaterial({ color: 0x10161f, metalness: 0.2, roughness: 0.12 }),
  // 大黄蜂:黄漆 + 黑装甲 + 银
  bumbleYellow: new MeshStandardMaterial({ color: 0xf2c018, metalness: 0.5, roughness: 0.3 }),
  bumbleBlack: new MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.5, roughness: 0.35 }),
  bumbleSilver: new MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.7, roughness: 0.28 }),
  // 龙神丸:白甲 + 蓝甲 + 金饰 + 红披风(DoubleSide,绕到背后也可见)
  ryuWhite: new MeshStandardMaterial({ color: 0xeef2f8, metalness: 0.3, roughness: 0.4 }),
  ryuBlue: new MeshStandardMaterial({ color: 0x2450a8, metalness: 0.4, roughness: 0.35 }),
  ryuGold: new MeshStandardMaterial({ color: 0xe8b23a, metalness: 0.6, roughness: 0.3 }),
  ryuCape: new MeshStandardMaterial({ color: 0xb3242c, roughness: 0.7, side: DoubleSide }),
}

export function disposeSkinMaterials(): void {
  for (const m of Object.values(skinMaterials)) m.dispose()
}
