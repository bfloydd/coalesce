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

// Mock DOM elements that might not be available
Object.defineProperty(document, 'createElement', {
  writable: true,
  value: jest.fn().mockImplementation((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      className: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      style: {},
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      insertAdjacentElement: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      parentElement: null,
      children: [],
      textContent: '',
      innerHTML: '',
      outerHTML: ''
    };
    return element;
  })
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn().mockImplementation(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn();

// Mock setTimeout/clearTimeout for testing
jest.useFakeTimers();