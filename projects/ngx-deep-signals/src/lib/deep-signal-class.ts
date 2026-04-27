import { computed, signal, WritableSignal } from '@angular/core';
import { deepSignal } from './deep-signal';

/**
 * Equivalent of MobX `makeAutoObservable`. Call as the **last** statement of
 * the constructor.
 *
 * What it does:
 *  1. All own instance fields (including TypeScript `private` / `protected`)
 *     are wrapped in `signal()`. Arrays become `deepSignalArray`. Nested plain
 *     objects become `deepSignal` (recursively).
 *  2. Getters defined on the prototype (`get foo() { ... }`) become `computed()`
 *     accessors defined directly on the instance.
 *  3. Methods and non-configurable properties are skipped.
 *
 * Caveats:
 *  - ECMAScript private fields (`#field`) are truly private — this function
 *    cannot touch them. Use TypeScript `private` (without `#`).
 *  - Fields initialised AFTER calling `deepSignalClass()` will not be reactive.
 *    Always call `deepSignalClass(this)` as the last constructor statement.
 *
 * @example
 * class CartStore {
 *   private _items: CartItem[] = [];
 *   private _discount = 0;
 *   get total() { return this._items.reduce((s, i) => s + i.price, 0); }
 *   constructor() { deepSignalClass(this); }
 * }
 */
export function deepSignalClass<T extends object>(instance: T): void {
  // ── Step 1: own properties (class fields, including private/protected) ──
  for (const key of Object.getOwnPropertyNames(instance)) {
    const descriptor = Object.getOwnPropertyDescriptor(instance, key)!;

    // Skip: non-configurable, accessors (already a getter/setter), functions.
    if (!descriptor.configurable) continue;
    if (descriptor.get || descriptor.set) continue;
    if (typeof descriptor.value === 'function') continue;

    const rawValue = descriptor.value;
    const initialVal = deepSignal(rawValue);
    const sig: WritableSignal<any> = signal(initialVal);

    Object.defineProperty(instance, key, {
      get() {
        return sig();
      },
      set(newValue: any) {
        sig.set(deepSignal(newValue));
      },
      enumerable: descriptor.enumerable,
      configurable: true,
    });
  }

  // ── Step 2: prototype getters → computed on the instance ───────────────
  let proto = Object.getPrototypeOf(instance);
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key)!;

      // Pure getters only (skip methods and setter-only accessors).
      if (!descriptor.get) continue;

      // Don't override anything we already defined on the instance in step 1.
      if (Object.getOwnPropertyDescriptor(instance, key)) continue;

      const originalGetter = descriptor.get;
      const comp = computed(() => originalGetter.call(instance));

      Object.defineProperty(instance, key, {
        get() {
          return comp();
        },
        enumerable: descriptor.enumerable,
        configurable: true,
      });
    }
    proto = Object.getPrototypeOf(proto);
  }
}
