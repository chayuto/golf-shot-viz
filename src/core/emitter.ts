type AnyListener = (...args: unknown[]) => void

/** Minimal typed event emitter. */
export class Emitter<Events extends Record<string, unknown[]>> {
  private map = new Map<keyof Events, Set<AnyListener>>()

  on<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    let set = this.map.get(event)
    if (!set) {
      set = new Set()
      this.map.set(event, set)
    }
    set.add(fn as AnyListener)
    return () => this.off(event, fn)
  }

  off<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): void {
    this.map.get(event)?.delete(fn as AnyListener)
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    this.map.get(event)?.forEach((fn) => fn(...args))
  }

  clear(): void {
    this.map.clear()
  }
}
