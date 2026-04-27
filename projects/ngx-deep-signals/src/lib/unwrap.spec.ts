import { TestBed } from '@angular/core/testing';
import { effect, isSignal } from '@angular/core';

import { DeepSignal, DeepInput } from './decorators';
import { unwrapSignal, unwrapInput } from './unwrap';

describe('unwrapSignal', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  class C {
    @DeepSignal(false) declare flag: boolean;
  }

  it('returns a writable signal', () => {
    const c = new C();
    const sig = unwrapSignal<boolean>(c, 'flag');
    expect(sig).toBeDefined();
    expect(isSignal(sig!)).toBe(true);
    expect(sig!()).toBe(false);
  });

  it('forces lazy init when field has not been read', () => {
    const c = new C();
    // Field never read or written — unwrapSignal must still return a signal.
    const sig = unwrapSignal<boolean>(c, 'flag');
    expect(sig).toBeDefined();
  });

  it('updates via signal propagate to the field', () => {
    const c = new C();
    const sig = unwrapSignal<boolean>(c, 'flag');
    sig!.set(true);
    expect(c.flag).toBe(true);
  });

  it('asReadonly works', () => {
    const c = new C();
    const ro = unwrapSignal<boolean>(c, 'flag')!.asReadonly();
    let seen: boolean | undefined;
    TestBed.runInInjectionContext(() => effect(() => (seen = ro())));
    TestBed.flushEffects();
    c.flag = true;
    TestBed.flushEffects();
    expect(seen).toBe(true);
  });
});

describe('unwrapInput', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  class Comp {
    @DeepInput(0) declare value: number;
  }

  it('returns a writable signal for @DeepInput fields', () => {
    const c = new Comp();
    const sig = unwrapInput<number>(c, 'value');
    expect(sig).toBeDefined();
    expect(isSignal(sig!)).toBe(true);
  });

  it('updates via signal propagate to the field', () => {
    const c = new Comp();
    const sig = unwrapInput<number>(c, 'value');
    sig!.set(7);
    expect(c.value).toBe(7);
  });
});
