import { TestBed } from '@angular/core/testing';
import { effect } from '@angular/core';

import { deepSignal, deepSignalArray } from './deep-signal';

function runEffect(fn: () => void): void {
  TestBed.runInInjectionContext(() => effect(fn));
  TestBed.flushEffects();
}

describe('deepSignal', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('reads return underlying values', () => {
    const s = deepSignal({ count: 0, name: 'jan' });
    expect(s.count).toBe(0);
    expect(s.name).toBe('jan');
  });

  it('writes trigger reactivity on top-level fields', () => {
    const s = deepSignal({ count: 0 });
    const seen: number[] = [];
    runEffect(() => seen.push(s.count));
    s.count = 1;
    TestBed.flushEffects();
    s.count = 2;
    TestBed.flushEffects();
    expect(seen).toEqual([0, 1, 2]);
  });

  it('nested objects are reactive', () => {
    const s = deepSignal({ user: { name: 'a' } });
    const seen: string[] = [];
    runEffect(() => seen.push(s.user.name));
    s.user.name = 'b';
    TestBed.flushEffects();
    expect(seen).toEqual(['a', 'b']);
  });

  it('reassigning a nested object keeps reactivity', () => {
    const s = deepSignal<{ user: { name: string } }>({ user: { name: 'a' } });
    const seen: string[] = [];
    runEffect(() => seen.push(s.user.name));
    s.user = { name: 'c' };
    TestBed.flushEffects();
    s.user.name = 'd';
    TestBed.flushEffects();
    expect(seen).toEqual(['a', 'c', 'd']);
  });

  it('arrays inside deepSignal become reactive', () => {
    const s = deepSignal<{ items: string[] }>({ items: ['x'] });
    const seen: number[] = [];
    runEffect(() => seen.push(s.items.length));
    s.items.push('y');
    TestBed.flushEffects();
    expect(seen[seen.length - 1]).toBe(2);
  });

  it('methods on nested data are bound to the raw target', () => {
    const s = deepSignal({ greet(name: string) { return 'hi ' + name; } });
    expect(s.greet('jan')).toBe('hi jan');
  });
});

describe('deepSignalArray', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('mutating push triggers reactivity', () => {
    const arr = deepSignalArray<number[]>([1, 2]);
    const seen: number[] = [];
    runEffect(() => seen.push(arr.length));
    arr.push(3);
    TestBed.flushEffects();
    expect(seen).toEqual([2, 3]);
  });

  it.each(['pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill'] as const)(
    '%s triggers reactivity',
    (method) => {
      const arr = deepSignalArray<number[]>([3, 1, 2]);
      let calls = 0;
      runEffect(() => { void arr.length; calls++; });
      const initial = calls;
      // Call the mutating method with sane args.
      const fn = (arr as any)[method] as Function;
      const args = method === 'unshift' ? [0]
                 : method === 'splice'   ? [0, 1]
                 : method === 'fill'     ? [9]
                 : [];
      fn.apply(arr, args);
      TestBed.flushEffects();
      expect(calls).toBeGreaterThan(initial);
    }
  );

  it('indexed assignment triggers reactivity', () => {
    const arr = deepSignalArray<number[]>([1, 2, 3]);
    const seen: number[] = [];
    runEffect(() => seen.push(arr[0]));
    arr[0] = 99;
    TestBed.flushEffects();
    expect(seen).toEqual([1, 99]);
  });

  it('reads register dependencies (forEach / map)', () => {
    const arr = deepSignalArray<number[]>([1, 2, 3]);
    let total = 0;
    runEffect(() => {
      total = 0;
      arr.forEach(n => (total += n));
    });
    expect(total).toBe(6);
    arr.push(4);
    TestBed.flushEffects();
    expect(total).toBe(10);
  });

  it('non-mutating methods do not bump version', () => {
    const arr = deepSignalArray<number[]>([1, 2, 3]);
    let calls = 0;
    runEffect(() => { void arr.length; calls++; });
    const initial = calls;
    arr.map(x => x * 2);
    arr.filter(x => x > 1);
    TestBed.flushEffects();
    expect(calls).toBe(initial);
  });
});
