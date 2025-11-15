// Mock implementation of Obsidian types for testing
export class App {
  vault = {
    getMarkdownFiles: jest.fn(),
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    create: jest.fn(),
    modify: jest.fn(),
    delete: jest.fn()
  };

  metadataCache = {
    resolvedLinks: {},
    unresolvedLinks: {},
    getCache: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  };

  workspace = {
    getActiveViewOfType: jest.fn(),
    getLeavesOfType: jest.fn(),
    openLinkText: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    activeLeaf: null
  };

  constructor() {
    // Initialize with empty metadata cache
    this.metadataCache.resolvedLinks = {};
    this.metadataCache.unresolvedLinks = {};
  }
}

export class TFile {
  path: string;
  basename: string;
  name: string;
  extension: string;
  stat: {
    mtime: number;
    ctime: number;
    size: number;
  };

  constructor(path: string, basename?: string, name?: string, extension = 'md') {
    this.path = path;
    this.basename = basename || path.replace(/\.[^/.]+$/, '');
    this.name = name || `${this.basename}.${extension}`;
    this.extension = extension;
    this.stat = {
      mtime: Date.now(),
      ctime: Date.now(),
      size: 0
    };
  }
}

// Make TFile pass instanceof checks
Object.defineProperty(TFile, Symbol.hasInstance, {
  value: function(obj: any) {
    return obj && typeof obj === 'object' && 'path' in obj && 'basename' in obj;
  }
});

export class MarkdownView {
  file: TFile | null = null;
  contentEl: HTMLElement;
  containerEl: HTMLElement;
  leaf: any;

  constructor(file?: TFile) {
    this.file = file || null;
    this.contentEl = document.createElement('div');
    this.containerEl = document.createElement('div');
    this.leaf = { id: 'test-leaf' };
  }

  getMode(): string {
    return 'preview';
  }

  on = jest.fn();
  off = jest.fn();
}

export class WorkspaceLeaf {
  id: string;
  view: any;

  constructor(id = 'test-leaf') {
    this.id = id;
    this.view = null;
  }
}

// Export other commonly used types
export type { Plugin, Component } from 'obsidian';