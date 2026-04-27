import { signal, WritableSignal } from '@angular/core';

/** Returns true for plain objects (`{}` or `Object.create(null)`). */
function isPlainObject(value: unknown): value is Record<string | symbol, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Array methods that mutate the underlying array and must trigger reactivity. */
const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice',
  'sort', 'reverse', 'fill', 'copyWithin',
]);

/**
 * Wraps an array in a Proxy so that:
 *   - any read (index, length, method call) registers a signal dependency,
 *   - any mutation (push, splice, indexed assignment, ...) triggers reactivity.
 *
 * The original array is mutated in place — no copy is made.
 *
 * @example
 * const items = deepSignalArray(['a', 'b']);
 * effect(() => console.log(items.length));
 * items.push('c');     // triggers effect
 * items[0] = 'x';      // triggers effect
 */
export function deepSignalArray<T extends any[]>(arr: T): T {
  // A version counter signal — incremented on every mutation.
  // Reading version() inside `get` registers this array as a dependency.
  const version = signal(0);
  const bump = () => version.set(version() + 1);

  return new Proxy(arr, {
    get(target, key) {
      if (typeof key === 'symbol') {
        return Reflect.get(target, key);
      }

      // Every read (index, length, methods) registers a dependency.
      version();

      const value = Reflect.get(target, key);

      if (typeof value === 'function') {
        if (MUTATING_METHODS.has(key as string)) {
          // Mutating method: run on raw target, then bump version.
          return function (this: any, ...args: any[]) {
            const result = (value as Function).apply(target, args);
            bump();
            return result;
          };
        }
        return value.bind(target);
      }

      // Nested objects/arrays are reactive too.
      return deepSignal(value as any);
    },

    set(target, key, value) {
      Reflect.set(target, key, value);
      bump();
      return true;
    },

    has(target, key) { return Reflect.has(target, key); },
    ownKeys(target) { return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) {
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}

/**
 * Universal reactive wrapper. Behavior depends on the input type:
 *
 *   - **Array** → delegates to {@link deepSignalArray}: a Proxy with a single
 *     version signal where mutating methods and indexed assignment trigger
 *     reactivity.
 *   - **Plain object (POJO)** → wrapped in a Proxy with per-property signals.
 *     Reads register a dependency on that property; writes trigger reactivity.
 *     Nested objects and arrays are recursively wrapped on access.
 *   - **Anything else** (primitives, class instances, functions, `null`) →
 *     returned as-is. `deepSignal` deliberately does NOT touch class instances;
 *     use {@link deepSignalClass} for those.
 *
 * Equivalent to Vue's `reactive()` / MobX's `observable()` — a single entry
 * point that turns "any value" into the appropriate reactive primitive.
 *
 * @example
 * // POJO
 * const state = deepSignal({ count: 0, user: { name: 'Jan' } });
 * effect(() => console.log(state.user.name));
 * state.count = 1;                   // triggers effect that depends on count
 * state.user = { name: 'Anna' };     // nested object stays reactive
 *
 * @example
 * // Array (same as calling deepSignalArray directly)
 * const items = deepSignal(['a', 'b']);
 * effect(() => console.log(items.length));
 * items.push('c');                   // triggers effect
 */
export function deepSignal<T>(value: T): T {
  if (Array.isArray(value)) {
    return deepSignalArray(value as any) as unknown as T;
  }
  if (!isPlainObject(value)) {
    // Primitives, class instances, functions, null — passthrough.
    return value;
  }

  const initialValue = value as Record<string | symbol, unknown>;
  const signalMap = new Map<string | symbol, WritableSignal<any>>();

  function ensureSignal(target: typeof initialValue, key: string | symbol): WritableSignal<any> {
    if (!signalMap.has(key)) {
      const raw = Reflect.get(target, key);
      signalMap.set(key, signal(deepSignal(raw)));
    }
    return signalMap.get(key)!;
  }

  return new Proxy(initialValue, {
    get(target, key) {
      if (typeof key === 'symbol') {
        return Reflect.get(target, key);
      }
      const v = Reflect.get(target, key);
      if (typeof v === 'function') {
        return v.bind(target);
      }
      return ensureSignal(target, key)();
    },

    set(target, key, v) {
      Reflect.set(target, key, v);
      const newVal = deepSignal(v);
      if (signalMap.has(key)) {
        signalMap.get(key)!.set(newVal);
      } else {
        signalMap.set(key, signal(newVal));
      }
      return true;
    },

    has(target, key) { return Reflect.has(target, key); },
    ownKeys(target) { return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) {
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  }) as unknown as T;
}
