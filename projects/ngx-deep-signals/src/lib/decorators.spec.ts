import { TestBed } from '@angular/core/testing';
import { effect, Injector, isSignal } from '@angular/core';

import { DeepSignal, DeepComputed, DeepInput } from './decorators';

/** Run an `effect()` synchronously inside an injection context and return a flush helper. */
function runEffect(fn: () => void): { flush: () => void; injector: Injector } {
  const injector = TestBed.inject(Injector);
  TestBed.runInInjectionContext(() => effect(fn));
  TestBed.flushEffects();
  return {
    flush: () => TestBed.flushEffects(),
    injector,
  };
}

describe('@DeepSignal', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  class WithSignal {
    @DeepSignal(0) declare count: number;
    @DeepSignal('a') declare label: string;
  }

  it('returns the initial value on first read', () => {
    const w = new WithSignal();
    expect(w.count).toBe(0);
    expect(w.label).toBe('a');
  });

  it('writes update the underlying signal', () => {
    const w = new WithSignal();
    w.count = 5;
    expect(w.count).toBe(5);
  });

  it('triggers reactivity in effect()', () => {
    const w = new WithSignal();
    const seen: number[] = [];
    runEffect(() => seen.push(w.count));
    w.count = 1;
    TestBed.flushEffects();
    w.count = 2;
    TestBed.flushEffects();
    expect(seen).toEqual([0, 1, 2]);
  });

  it('two instances have independent signals', () => {
    const a = new WithSignal();
    const b = new WithSignal();
    a.count = 10;
    expect(b.count).toBe(0);
  });

  it('write-before-read still creates a working signal', () => {
    const w = new WithSignal();
    w.count = 99;
    const seen: number[] = [];
    runEffect(() => seen.push(w.count));
    w.count = 100;
    TestBed.flushEffects();
    expect(seen).toEqual([99, 100]);
  });
});

describe('@DeepComputed', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  class C {
    @DeepSignal(2) declare a: number;
    @DeepSignal(3) declare b: number;
    calls = 0;

    @DeepComputed
    get sum(): number {
      this.calls++;
      return this.a + this.b;
    }
  }

  it('computes the value', () => {
    const c = new C();
    expect(c.sum).toBe(5);
  });

  it('caches the result while dependencies are stable', () => {
    const c = new C();
    runEffect(() => void c.sum);
    const before = c.calls;
    void c.sum;
    void c.sum;
    expect(c.calls).toBe(before);
  });

  it('recomputes when a dependency changes', () => {
    const c = new C();
    runEffect(() => void c.sum);
    c.a = 10;
    TestBed.flushEffects();
    expect(c.sum).toBe(13);
  });

  it('throws when applied to a non-getter', () => {
    expect(() => {
      class Bad {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        @DeepComputed
        method() { return 1; }
      }
      new Bad().method();
    }).toThrow(/getters/);
  });
});

describe('@DeepInput', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  class Comp {
    @DeepInput(false) declare flag: boolean;
  }

  it('reads default value', () => {
    expect(new Comp().flag).toBe(false);
  });

  it('writes update the signal', () => {
    const c = new Comp();
    c.flag = true;
    expect(c.flag).toBe(true);
  });

  it('write-before-read works', () => {
    const c = new Comp();
    c.flag = true;
    const seen: boolean[] = [];
    runEffect(() => seen.push(c.flag));
    c.flag = false;
    TestBed.flushEffects();
    expect(seen).toEqual([true, false]);
  });

  it('triggers reactivity', () => {
    const c = new Comp();
    const seen: boolean[] = [];
    runEffect(() => seen.push(c.flag));
    c.flag = true;
    TestBed.flushEffects();
    expect(seen).toEqual([false, true]);
  });

  it('isSignal returns true for the unwrapped signal', () => {
    const c = new Comp();
    void c.flag; // force lazy init
    const sigKey = Symbol.for('__di_flag');
    const sig = (c as any)[sigKey];
    expect(isSignal(sig)).toBe(true);
  });
});
