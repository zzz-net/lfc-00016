import { expect } from 'vitest';

const originalRandom = Math.random;
Math.random = () => 0.95;

// @ts-ignore
global.expect = expect;
// @ts-ignore
global.__originalRandom = originalRandom;

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = {};
}

// @ts-ignore
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// @ts-ignore
global.localStorage = localStorageMock;
