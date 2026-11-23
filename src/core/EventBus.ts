/** Tiny typed pub/sub. Add new game events to GameEvents. */
export interface GameEvents {
  'debug:spawnBoxes': { count: number };
  'debug:resetLevel': void;
  'vehicle:enter': { id: string };
  'vehicle:exit': { id: string };
  'vehicle:pothole': { damage: number };
  'district:enter': { id: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof E>(type: K, ...payload: E[K] extends void ? [] : [E[K]]): void {
    this.handlers.get(type)?.forEach((h) => (h as Handler<E[K]>)(payload[0] as E[K]));
  }
}
