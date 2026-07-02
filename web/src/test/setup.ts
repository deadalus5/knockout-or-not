// Node 26 defines a non-functional global localStorage (needs
// --localstorage-file), which prevents vitest's jsdom environment from
// copying jsdom's working localStorage onto the global. Vitest exposes the
// raw JSDOM instance as `global.jsdom` — wire its storage up explicitly.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom
if (dom) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.window.localStorage,
    configurable: true,
    writable: true,
  })
}
