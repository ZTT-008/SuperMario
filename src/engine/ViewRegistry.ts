import { Object3D } from 'three'
import type { WorldEntity } from '@/game/types'

/**
 * 实体 → 网格绑定与每帧 transform 同步(DESIGN §5.1/§6)。
 * 固定步 + 插值:pos 写网格 = lerp(prevPos, pos, alpha),高刷屏丝滑。
 * 对象池/剔除(M2/M6)都挂在本层,game 层无感知。
 */
export class ViewRegistry {
  private pairs: { entity: WorldEntity; object: Object3D }[] = []

  constructor(private readonly scene: Object3D) {}

  register(entity: WorldEntity, object: Object3D): void {
    object.position.set(entity.pos.x, entity.pos.y, entity.z)
    this.scene.add(object)
    this.pairs.push({ entity, object })
  }

  /** 换绑同一实体的网格(皮肤 MOD):摘旧对象、新对象按实体当前位姿落位,避免一帧跳回原点 */
  replace(entity: WorldEntity, object: Object3D): boolean {
    const pair = this.pairs.find((p) => p.entity === entity)
    if (!pair) return false
    this.scene.remove(pair.object)
    object.position.set(entity.pos.x, entity.pos.y, entity.z)
    this.scene.add(object)
    pair.object = object
    return true
  }

  /** 每个渲染帧调用一次;alpha 来自 FixedStepLoop */
  sync(alpha: number): void {
    for (const { entity, object } of this.pairs) {
      object.position.x = entity.prevPos.x + (entity.pos.x - entity.prevPos.x) * alpha
      object.position.y = entity.prevPos.y + (entity.pos.y - entity.prevPos.y) * alpha
    }
  }

  dispose(): void {
    for (const { object } of this.pairs) this.scene.remove(object)
    this.pairs = []
  }
}
