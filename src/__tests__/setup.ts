// Jest setup file for Coalesce plugin tests
import 'jest-environment-jsdom';

// Mock Obsidian's global objects
Object.defineProperty(window, 'app', {
  writable: true,
  value: undefined
});

Object.defineProperty(window, 'plugin', {
  writable: true,
  value: undefined
});

// Mock console methods to reduce noise during testing
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

 // Add Obsidian-style helper methods to HTMLElement for tests, while keeping
 // jsdom's native DOM implementation intact.
const elementProto = (HTMLElement.prototype as any);

if (!elementProto.createDiv) {
  elementProto.createDiv = function (
    options?: { cls?: string; attr?: Record<string, string> }
  ) {
    const div = document.createElement('div');
    if (options?.cls) {
      div.className = options.cls;
    }
    if (options?.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        div.setAttribute(key, value);
      });
    }
    this.appendChild(div);
    return div;
  };
}

if (!elementProto.createEl) {
  elementProto.createEl = function (
    tag: string,
    options?: { cls?: string; attr?: Record<string, string>; text?: string }
  ) {
    const el = document.createElement(tag);
    if (options?.cls) {
      el.className = options.cls;
    }
    if (options?.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        el.setAttribute(key, value);
      });
    }
    if (options?.text) {
      el.textContent = options.text;
    }
    this.appendChild(el);
    return el;
  };
}

if (!elementProto.createSvg) {
  elementProto.createSvg = function (
    tag: string,
    options?: { attr?: Record<string, string> }
  ) {
    const svg = document.createElement(tag);
    if (options?.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        (svg as any).setAttribute(key, value);
      });
    }
    this.appendChild(svg);
    return svg;
  };
}

// Polyfill ResizeObserver for jsdom-based tests
if (!(global as any).ResizeObserver) {
  (global as any).ResizeObserver = class {
    constructor(_callback: any) {}
    observe(_target: Element) {}
    unobserve(_target: Element) {}
    disconnect() {}
  };
}

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn().mockImplementation(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn();

// Mock setTimeout/clearTimeout for testing
jest.useFakeTimers();