import { computed, signal } from '@angular/core';

/**
 * Property decorator. Turns a class field into a reactive Angular signal.
 * Reads return the value (not the signal); writes call `signal.set()`.
 *
 * Requires `useDefineForClassFields: false` in your tsconfig (or `declare`
 * on the field).
 *
 * @example
 * @DeepSignal(false) private declare _popupOpen: boolean;
 *
 * console.log(this._popupOpen);  // → false (registers dependency)
 * this._popupOpen = true;        // triggers reactivity
 */
export function DeepSignal<T>(initialValue: T): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const sigKey = Symbol.for(`__ds_${String(propertyKey)}`);

    Object.defineProperty(target, propertyKey, {
      get: function () {
        const sig = signal<T>(initialValue);
        (this as any)[sigKey] = sig;
        Object.defineProperty(this, propertyKey, {
          get() { return sig(); },
          set(newValue: T) { sig.set(newValue); },
          enumerable: true,
          configurable: true,
        });
        return sig();
      },
      set: function (newValue: T) {
        const sig = signal<T>(newValue);
        (this as any)[sigKey] = sig;
        Object.defineProperty(this, propertyKey, {
          get() { return sig(); },
          set(v: T) { sig.set(v); },
          enumerable: true,
          configurable: true,
        });
      },
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Method (accessor) decorator. Wraps a class getter in `computed()`.
 * The result is cached and only recomputed when its dependencies change.
 *
 * Unlike `@DeepSignal`, this does NOT depend on `useDefineForClassFields`
 * because it operates on accessor descriptors on the prototype.
 *
 * @example
 * @DeepComputed
 * get popupOpen(): boolean { return this._popupOpen; }
 */
export function DeepComputed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalGetter = descriptor.get;

  if (!originalGetter) {
    throw new Error('@DeepComputed can only decorate getters (e.g. get myValue() { ... })');
  }

  // Per-property unique symbol so the computed cache lives on the instance
  // without polluting its public API.
  const cacheKey = Symbol(`__computed_cache_${propertyKey}`);

  descriptor.get = function () {
    if (!(this as any)[cacheKey]) {
      (this as any)[cacheKey] = computed(() => originalGetter.call(this));
    }
    return (this as any)[cacheKey]();
  };

  return descriptor;
}

/**
 * Property decorator. Combines an Angular `@Input()` with a backing signal so
 * the field stays transparently accessible (`this.foo`) but is reactive.
 *
 * Requires an explicit `@Input()` next to it because Angular AOT must see
 * the input metadata statically.
 *
 * @example
 * @DeepInput(false) @Input() isCompact!: boolean;
 *
 * // template of parent: <app-foo [isCompact]="signal()"></app-foo>
 * // inside the component:
 * this.isCompact;          // → boolean (signal read, registers dep)
 * this.isCompact = true;   // → signal.set(true)
 */
export function DeepInput<T>(defaultValue: T): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const sigKey = Symbol.for(`__di_${String(propertyKey)}`);

    Object.defineProperty(target, propertyKey, {
      get: function () {
        if (!this[sigKey]) {
          const sig = signal<T>(defaultValue);
          this[sigKey] = sig;
          Object.defineProperty(this, propertyKey, {
            get() { return sig(); },
            set(v: T) { sig.set(v); },
            enumerable: true,
            configurable: true,
          });
          return sig();
        }
        return this[sigKey]();
      },
      set: function (newValue: T) {
        if (!this[sigKey]) {
          const sig = signal<T>(newValue);
          this[sigKey] = sig;
          Object.defineProperty(this, propertyKey, {
            get() { return sig(); },
            set(v: T) { sig.set(v); },
            enumerable: true,
            configurable: true,
          });
        } else {
          this[sigKey].set(newValue);
        }
      },
      enumerable: true,
      configurable: true,
    });
  };
}
