import { TestBed } from '@angular/core/testing';
import { effect } from '@angular/core';

import { deepSignalClass } from './deep-signal-class';

function runEffect(fn: () => void): void {
  TestBed.runInInjectionContext(() => effect(fn));
  TestBed.flushEffects();
}

describe('deepSignalClass', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('makes own fields reactive', () => {
    class Store {
      count = 0;
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    const seen: number[] = [];
    runEffect(() => seen.push(s.count));
    s.count = 5;
    TestBed.flushEffects();
    expect(seen).toEqual([0, 5]);
  });

  it('wraps array fields as reactive arrays', () => {
    class Store {
      items: number[] = [1, 2];
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    const seen: number[] = [];
    runEffect(() => seen.push(s.items.length));
    s.items.push(3);
    TestBed.flushEffects();
    expect(seen).toEqual([2, 3]);
  });

  it('wraps nested plain objects', () => {
    class Store {
      user = { name: 'a' };
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    const seen: string[] = [];
    runEffect(() => seen.push(s.user.name));
    s.user.name = 'b';
    TestBed.flushEffects();
    expect(seen).toEqual(['a', 'b']);
  });

  it('wraps prototype getters in computed', () => {
    let calls = 0;
    class Store {
      private a = 1;
      private b = 2;
      get sum() { calls++; return this.a + this.b; }
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    runEffect(() => void s.sum);
    const before = calls;
    void s.sum;
    void s.sum;
    expect(calls).toBe(before);
  });

  it('skips methods', () => {
    class Store {
      greet(n: string) { return 'hi ' + n; }
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    expect(s.greet('jan')).toBe('hi jan');
  });

  it('skips ECMAScript private (#) fields', () => {
    class Store {
      #secret = 42;
      reveal() { return this.#secret; }
      constructor() { deepSignalClass(this); }
    }
    const s = new Store();
    expect(s.reveal()).toBe(42);
  });

  it('two instances are independent', () => {
    class Store {
      count = 0;
      constructor() { deepSignalClass(this); }
    }
    const a = new Store();
    const b = new Store();
    a.count = 10;
    expect(b.count).toBe(0);
  });
});
