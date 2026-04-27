import { TestBed } from '@angular/core/testing';
import { effect, Injectable } from '@angular/core';

import { DeepSignal, DeepComputed } from './decorators';
import { deepSignalClass } from './deep-signal-class';
import { deepSignal } from './deep-signal';

describe('integration', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('service with @DeepSignal + @DeepComputed', () => {
    @Injectable({ providedIn: 'root' })
    class PopupService {
      @DeepSignal(false) private declare _open: boolean;

      @DeepComputed
      get open(): boolean { return this._open; }

      show() { this._open = true; }
      hide() { this._open = false; }
    }

    const svc = TestBed.inject(PopupService);
    const seen: boolean[] = [];
    TestBed.runInInjectionContext(() => effect(() => seen.push(svc.open)));
    TestBed.flushEffects();
    svc.show();
    TestBed.flushEffects();
    svc.hide();
    TestBed.flushEffects();
    expect(seen).toEqual([false, true, false]);
  });

  it('mobx-style cart store with deepSignalClass', () => {
    class CartStore {
      items: { name: string; price: number }[] = [];
      discount = 0;

      get total() {
        return this.items.reduce((s, i) => s + i.price, 0) * (1 - this.discount / 100);
      }

      add(name: string, price: number) {
        this.items.push({ name, price });
      }

      constructor() { deepSignalClass(this); }
    }

    const store = new CartStore();
    const seen: number[] = [];
    TestBed.runInInjectionContext(() => effect(() => seen.push(store.total)));
    TestBed.flushEffects();
    store.add('a', 10);
    TestBed.flushEffects();
    store.add('b', 20);
    TestBed.flushEffects();
    store.discount = 50;
    TestBed.flushEffects();
    expect(seen).toEqual([0, 10, 30, 15]);
  });

  it('standalone deepSignal POJO state', () => {
    const state = deepSignal({
      theme: 'dark',
      sidebar: { open: true, width: 250 },
    });

    const themes: string[] = [];
    const widths: number[] = [];
    TestBed.runInInjectionContext(() => {
      effect(() => themes.push(state.theme));
      effect(() => widths.push(state.sidebar.width));
    });
    TestBed.flushEffects();

    state.theme = 'light';
    state.sidebar.width = 300;
    TestBed.flushEffects();

    expect(themes).toEqual(['dark', 'light']);
    expect(widths).toEqual([250, 300]);
  });
});
