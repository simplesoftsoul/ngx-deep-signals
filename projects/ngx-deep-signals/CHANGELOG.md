# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `deepSignal()` is now a **universal reactive wrapper**. It accepts arrays
  (delegates to `deepSignalArray`), plain objects (Proxy with per-property
  signals), and any other value (returned as-is). The internal `wrapReactive`
  helper has been removed — `deepSignal` subsumes its behavior.

### Removed
- Internal `wrapReactive` / `wrap-reactive.ts` (was never part of the public
  API; functionality merged into `deepSignal`).

## [0.1.0] - 2026-04-27

### Added
- `deepSignal()` — Vue-style reactive proxy for plain objects, with recursive nested wrapping.
- `deepSignalArray()` — reactive array proxy. Mutating methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`) and indexed assignment trigger reactivity.
- `deepSignalClass()` — MobX-style `makeAutoObservable` equivalent. Wraps own fields in signals and prototype getters in `computed`.
- `@DeepSignal()` — property decorator for transparent reactive class fields.
- `@DeepComputed` — accessor decorator wrapping a getter in `computed()`.
- `@DeepInput()` — combines an Angular `@Input()` with a backing signal.
- `unwrapSignal()` / `unwrapInput()` — escape hatch to access the underlying `WritableSignal`.
- Test suite (47 tests) covering all public APIs.
