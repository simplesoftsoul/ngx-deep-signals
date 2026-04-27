# ngx-deep-signals

> **Code like NgZone. React like Signals.**  
> One line turns any class, object, or array into a deeply reactive signal graph — no `()`, no `.set()`, no `.update()`, no `.asReadonly()`.

Angular Signals feel great for a single boolean, number, or derived value. They start feeling painful when state becomes **nested**: a profile inside a user, items inside a cart, filters inside a dashboard. At that point, the explicit API stops documenting intent and starts leaking implementation details into every line of business code.

`explicit > implicit` is not a law. It is only true when the explicit form makes code easier to read, change, and trust. For nested state, repetitive `signal()`, `computed()`, `.set()`, `.update()`, readonly mirrors, and `()` calls often do the opposite: they make simple domain logic look mechanically complex. `ngx-deep-signals` keeps Angular's signal graph, but removes the ceremony that makes deeply reactive state feel heavier than the problem you're solving.

[![npm](https://img.shields.io/npm/v/ngx-deep-signals.svg)](https://www.npmjs.com/package/ngx-deep-signals)
[![license](https://img.shields.io/npm/l/ngx-deep-signals.svg)](./LICENSE)

---

## The problem with vanilla Signals

Angular Signals are fast and zoneless — but they trade ergonomics for explicitness.
Once your state is anything beyond a primitive, the API gets in your way:

```ts
// NgZone — what your brain writes:
this.user.profile.name = 'Anna';
this.cart.items.push(item);
this.discount = 10;
const name = this.user.profile.name;

// Vanilla Signals — what you have to write:
this._user.update(u => ({ ...u, profile: { ...u.profile, name: 'Anna' } }));
this._items.update(arr => [...arr, item]);
this._discount.set(10);
const name = this._user().profile.name;  
```

A `signal()` is a **single atomic cell**. The moment your state has nested objects,
arrays, or a class instance, you face two bad options:

| Option | Cost |
|---|---|
| Wrap everything in **one** `signal({ ...bigObject })` | Lose granularity — every read of `state().a.b.c` depends on **everything** |
| Explode each leaf into its **own** signal | Boilerplate explosion — 5 fields → 10 declarations + readonly aliases + computed |

**There is no "just make this object reactive" primitive in vanilla Signals.**  
That is exactly what `ngx-deep-signals` provides.

---

## The solution — write NgZone, get Signals

```ts
import { deepSignalClass } from 'ngx-deep-signals';

@Injectable({ providedIn: 'root' })
export class CartService {
  items: CartItem[] = [];
  discount = 0;

  get total() {
    return this.items.reduce((s, i) => s + i.price * i.qty, 0)
      * (1 - this.discount / 100);
  }

  constructor() {
    deepSignalClass(this); // ← one line. That's the whole library.
  }

  addItem(item: CartItem) { this.items.push(item); }  // real reactive push
  setDiscount(pct: number) { this.discount = pct; }   // real reactive assign
  clear() { this.items = []; }
}
```

Every field becomes a `signal()`. Every getter becomes a `computed()`.  
`items.push(...)` triggers re-render. The code reads like NgZone, **runs like Signals**.

### Side-by-side comparison

<table>
<tr><th>ZoneJS (legacy)</th><th>ngx-deep-signals</th><th>Vanilla Signals</th></tr>
<tr><td>

```ts
@Injectable({providedIn:'root'})
export class CartService {
  items: CartItem[] = [];
  discount = 0;

  get itemCount() {
    return this.items.length;
  }
  get total() {
    return this.items
      .reduce((s,i) => s+i.price, 0)
      * (1 - this.discount / 100);
  }

  addItem(i: CartItem) {
    this.items.push(i);
  }
}
```

Clean — but requires `zone.js`,
no fine-grained reactivity.

</td><td>

```ts
@Injectable({providedIn:'root'})
export class CartService {
  items: CartItem[] = [];
  discount = 0;

  get itemCount() {
    return this.items.length;
  }
  get total() {
    return this.items
      .reduce((s,i) => s+i.price, 0)
      * (1 - this.discount / 100);
  }

  constructor() {
    deepSignalClass(this); // ← add this
  }

  addItem(i: CartItem) {
    this.items.push(i);
  }
}
```

**Identical** to NgZone + 1 line.
Zoneless. Fine-grained reactivity.

</td><td>

```ts
@Injectable({providedIn:'root'})
export class CartService {
  private _items =
    signal<CartItem[]>([]);
  private _discount = signal(0);

  readonly items =
    this._items.asReadonly();
  readonly discount =
    this._discount.asReadonly();
  readonly itemCount = computed(
    () => this._items().length
  );
  readonly total = computed(() =>
    this._items()
      .reduce((s,i) => s+i.price, 0)
    * (1 - this._discount() / 100)
  );

  addItem(i: CartItem) {
    this._items.update(p => [...p,i]);
  }
}
```

2 fields → 4 signals + 2 readonly
+ 2 computed. Logic buried under
ceremony.

</td></tr>
</table>

### Why this matters

- **Migration from NgZone → near zero cost.** Add `deepSignalClass(this)` per service. Done.
- **Onboarding new devs → near zero friction.** They write TypeScript. Reactivity is invisible.
- **Same performance as vanilla signals.** The underlying primitives *are* `WritableSignal` and `computed` — `ngx-deep-signals` is a thin transparent layer, not a separate reactive runtime.
- **Per-property granularity for free.** `state.user.profile.name = 'Anna'` only invalidates dependents that read `name` — not the whole `user` object.

Inspired by Vue's `reactive()` and MobX's `makeAutoObservable`, built on Angular's native signal graph.

---

## Installation

```bash
npm install ngx-deep-signals
```

Peer dependency: `@angular/core >= 17`.

## ⚠️ Required `tsconfig`

This is the most important step. Without these flags, the property decorators
(`@DeepSignal`, `@DeepInput`) silently no-op.

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false,   // ← critical
    "target": "ES2022"
  }
}
```

### Why `useDefineForClassFields: false`?

With `target >= ES2022`, TypeScript defaults to `useDefineForClassFields: true`,
which emits every class field as `Object.defineProperty(this, '_field', ...)`.
That creates an *own property* on the instance, **shadowing** the
getter/setter installed by the decorator on the prototype — the decorator
becomes dead code.

`useDefineForClassFields: false` restores the legacy behavior (`this._field = value`),
which routes through the prototype setter where the decorator lives.

### Per-field alternative: `declare`

If you can't change the global flag, mark individual fields with `declare`:

```ts
@DeepSignal(false) private declare _open: boolean;
```

`declare` tells TypeScript not to emit any JS for the field. Note: some
bundlers (older swc/esbuild) may not respect `declare` reliably.
`useDefineForClassFields: false` is the safer choice.

---

## Quick start

### 1. `deepSignal()` — reactive POJO

```ts
import { effect } from '@angular/core';
import { deepSignal } from 'ngx-deep-signals';

const theme = deepSignal({
  mode: 'dark',
  colors: { primary: '#ff0000', bg: '#1a1a1a' },
  fontSize: 14,
});

effect(() => console.log(theme.colors.primary));

// Nested writes propagate automatically:
theme.colors.primary = '#00ff00';
theme.fontSize = 16;
```

### 2. `@DeepSignal` + `@DeepComputed` — service style

```ts
import { Injectable } from '@angular/core';
import { DeepSignal, DeepComputed } from 'ngx-deep-signals';

@Injectable({ providedIn: 'root' })
export class PopupService {
  @DeepSignal(false) private declare _open: boolean;

  @DeepComputed
  get open(): boolean { return this._open; }

  show() { this._open = true; }
  hide() { this._open = false; }
}
```

### 3. `deepSignalClass()` — MobX style

```ts
import { deepSignalClass } from 'ngx-deep-signals';

class CartStore {
  items: { name: string; price: number }[] = [];
  discount = 0;

  get total() {
    return this.items.reduce((s, i) => s + i.price, 0) * (1 - this.discount / 100);
  }

  add(name: string, price: number) {
    this.items.push({ name, price });
  }

  constructor() {
    deepSignalClass(this); // ← always last
  }
}
```

### 4. `@DeepInput` — reactive component inputs without `()`

```ts
import { Component, Input } from '@angular/core';
import { DeepInput } from 'ngx-deep-signals';

@Component({ /* ... */ })
export class FooComponent {
  @DeepInput(false) @Input() isCompact!: boolean;
  // this.isCompact         → boolean (signal read)
  // this.isCompact = true  → signal.set(true)
}
```

> The explicit `@Input()` is **required** — Angular AOT scans decorator
> metadata statically; it can't see runtime-only `@DeepInput`.

---

## API

### `deepSignal<T>(value: T): T`
Universal reactive wrapper. Dispatches by input type:

| Input | Result |
|---|---|
| **Array** | delegates to `deepSignalArray` (Proxy + version signal) |
| **Plain object** (`{}` / `Object.create(null)`) | Proxy with per-property signals; nested objects/arrays wrapped recursively |
| **Primitive / class instance / function / `null`** | returned as-is (no-op) |

This is the single entry point — equivalent to Vue's `reactive()`. For class
instances use `deepSignalClass` instead; `deepSignal` deliberately won't touch them.

```ts
// POJO — per-property reactivity
const state = deepSignal({ count: 0, user: { name: 'Jan' } });
effect(() => console.log(state.user.name)); // registers dep on 'name' only
state.count = 1;              // triggers effects that read count
state.user.name = 'Anna';     // triggers effects that read user.name
state.user = { name: 'Ewa' }; // replacing nested object also reactive

// Array — same as calling deepSignalArray directly
const items = deepSignal(['a', 'b']);
effect(() => console.log(items.length));
items.push('c'); // triggers effect
```

### `deepSignalArray<T extends any[]>(arr: T): T`
Wraps an array in a Proxy with a single version signal. Mutating methods and
indexed assignment bump the version. Equivalent to `deepSignal(arr)` when `arr`
is an array — exported separately for type-precision when you know the input.

```ts
const items = deepSignalArray<string[]>(['a', 'b']);

effect(() => console.log(items.length));

items.push('c');       // triggers effect → length: 3
items[0] = 'x';        // triggers effect
items.splice(1, 1);    // triggers effect
items.sort();          // triggers effect
```

### `deepSignalClass<T extends object>(instance: T): void`
Walks own properties (plain values, arrays, nested POJOs) and prototype
getters. Wraps fields in signals and getters in `computed`. Call **last**
in your constructor.

```ts
@Injectable({ providedIn: 'root' })
class AuthStore {
  user: User | null = null;
  loading = false;

  get isLoggedIn() { return this.user !== null; } // → auto computed()

  constructor() {
    deepSignalClass(this); // ← always last
  }

  setUser(u: User) { this.user = u; }      // reactive assign
  logout()         { this.user = null; }   // reactive assign
}

const store = new AuthStore();
effect(() => console.log(store.isLoggedIn)); // tracks user
store.setUser({ name: 'Jan' });              // triggers effect → true
```

### `@DeepSignal<T>(initial: T)`
Property decorator. Transparent reactive field. Requires `useDefineForClassFields: false`
or `declare`.

```ts
class PopupService {
  @DeepSignal(false) private declare _open: boolean;
  @DeepSignal(0)     private declare _count: number;

  open()  { this._open = true; }   // signal.set(true)
  close() { this._open = false; }  // signal.set(false)
  inc()   { this._count++; }       // read + write, both reactive
}

const svc = new PopupService();
effect(() => console.log(svc._open)); // registers dependency
svc.open(); // triggers effect → true
```

### `@DeepComputed`
Accessor decorator. Wraps a getter in `computed()`. Not affected by
`useDefineForClassFields`.

```ts
class PopupService {
  @DeepSignal(false) private declare _open: boolean;
  @DeepSignal(0)     private declare _count: number;

  @DeepComputed
  get summary() {
    return `open=${this._open}, count=${this._count}`;
  }
  // summary is cached — recomputes only when _open or _count change

  open()  { this._open = true; }
  inc()   { this._count++; }
}
```

### `@DeepInput<T>(default: T)`
Property decorator. Combine with an explicit `@Input()`. The field reads as
a value, writes go through a signal.

```ts
@Component({
  selector: 'app-card',
  template: `<div [class.compact]="isCompact">...</div>`,
})
export class CardComponent {
  @DeepInput(false) @Input() isCompact!: boolean;
  // ↑ plain boolean read in template — no () needed
  // ↑ Angular sets it via normal @Input() setter → stored in signal

  @DeepComputed
  get padding() { return this.isCompact ? 4 : 16; } // reactive
}
// parent template:
// <app-card [isCompact]="someSignal()"></app-card>
```

### `unwrapSignal<T>(instance, key)` / `unwrapInput<T>(instance, key)`
Returns the underlying `WritableSignal<T>` backing a `@DeepSignal` /
`@DeepInput` field. Useful when you need to expose a `Signal<T>` to
consumers or wire into `toObservable()` / `effect()` directly.

```ts
class PopupService {
  @DeepSignal(false) private declare _open: boolean;

  // Expose a read-only signal for consumers:
  readonly open$ = unwrapSignal<boolean>(this, '_open')!.asReadonly();

  // Or wire to RxJS:
  readonly open$$ = toObservable(unwrapSignal<boolean>(this, '_open')!);

  show() { this._open = true; }
}

// Consumer component:
// @Input() set open(v: boolean) { /* uses svc.open$ */ }
effect(() => console.log(svc.open$())); // reactive

// unwrapInput — same, but for @DeepInput fields:
const inputSig = unwrapInput<boolean>(this, 'isCompact');
effect(() => console.log(inputSig?.()));
```

---

## Caveats

| Pitfall | Affected | Fix |
|---|---|---|
| `useDefineForClassFields: true` kills decorators | `@DeepSignal`, `@DeepInput` | Set to `false` or use `declare` |
| Angular AOT can't see runtime inputs | `@DeepInput` | Add explicit `@Input()` |
| Late-init fields aren't reactive | `deepSignalClass` | Initialise before calling, or use `@DeepSignal` |

---

## License

[MIT](./LICENSE)
