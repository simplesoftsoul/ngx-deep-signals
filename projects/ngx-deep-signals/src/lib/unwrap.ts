import { WritableSignal } from '@angular/core';

/**
 * Returns the underlying `WritableSignal` for a field decorated with
 * `@DeepSignal`. The signal is stored on the instance under a `Symbol.for`
 * key — if the field hasn't been read yet, this function forces a read so
 * the signal is created lazily.
 *
 * @example
 * const sig = unwrapSignal<boolean>(this, '_popupOpen');
 * sig?.set(true);
 * const ro = sig?.asReadonly();
 */
export function unwrapSignal<T>(instance: object, key: string | symbol): WritableSignal<T> | undefined {
  const sigKey = Symbol.for(`__ds_${String(key)}`);
  if (!(instance as any)[sigKey]) {
    void (instance as any)[key];
  }
  return (instance as any)[sigKey] as WritableSignal<T> | undefined;
}

/**
 * Returns the underlying `WritableSignal` for a field decorated with
 * `@DeepInput`. Analogous to `unwrapSignal`, but for `@DeepInput` fields.
 *
 * @example
 * const sig = unwrapInput<boolean>(this, 'isCompact');
 * effect(() => console.log(sig?.()));
 * sig?.set(true);
 */
export function unwrapInput<T>(instance: object, key: string | symbol): WritableSignal<T> | undefined {
  const sigKey = Symbol.for(`__di_${String(key)}`);
  if (!(instance as any)[sigKey]) {
    void (instance as any)[key];
  }
  return (instance as any)[sigKey] as WritableSignal<T> | undefined;
}
