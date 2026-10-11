/** 轻量类型化事件总线。事件名约定 `domain:action`(见 DESIGN §13)。 */
export class TypedEventBus<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<(payload: never) => void>>()

  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as (payload: never) => void)
    return () => this.off(event, handler)
  }

  off<K extends keyof E>(event: K, handler: (payload: E[K]) => void): void {
    this.handlers.get(event)?.delete(handler as (payload: never) => void)
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    // 复制一份再遍历:允许 handler 在 emit 中 on/off,不破坏迭代
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const handler of [...set]) (handler as (payload: E[K]) => void)(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
