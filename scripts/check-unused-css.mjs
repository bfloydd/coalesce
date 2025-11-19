#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CSS_DIR = path.join(ROOT, 'styles');
const SRC_DIR = path.join(ROOT, 'src');

const SKIP_DIRS = ['node_modules', '.git', 'dist'];
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

async function collectFiles(dir, exts) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.some(skip => full.includes(path.sep + skip + path.sep))) {
          continue;
        }
        await walk(full);
      } else if (exts.some(ext => full.endsWith(ext))) {
        files.push(full);
      }
    }
  }
  await walk(dir);
  return files;
}

async function collectCssFiles() {
  return collectFiles(CSS_DIR, ['.css']);
}

async function collectSourceFiles() {
  return collectFiles(SRC_DIR, SOURCE_EXTS);
}

function extractClassesFromCss(css) {
  const classRegex = /\.([a-zA-Z0-9_-]+)/g;
  const classes = new Set();
  let match;
  while ((match = classRegex.exec(css)) !== null) {
    const name = match[1];
    if (/^(coalesce|backlinks|markdown|theme|is|has|no)-/.test(name)) {
      classes.add(name);
    }
  }
  return classes;
}

async function buildFileCache(files) {
  const cache = new Map();
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      cache.set(file, content);
    } catch {
      // ignore read errors
    }
  }
  return cache;
}

function isClassUsedInSources(className, sourceCache) {
  for (const content of sourceCache.values()) {
    if (content.includes(className)) {
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('[coalesce] CSS unused-selector check starting...');

  const cssFiles = await collectCssFiles();
  const sourceFiles = await collectSourceFiles();

  if (cssFiles.length === 0) {
    console.log('[coalesce] No CSS files found under styles/');
    return;
  }

  const sourceCache = await buildFileCache(sourceFiles);

  const allClasses = new Set();
  for (const cssFile of cssFiles) {
    const css = await fs.readFile(cssFile, 'utf8');
    const classes = extractClassesFromCss(css);
    for (const cls of classes) {
      allClasses.add(cls);
    }
  }

  const possiblyUnused = [];
  for (const cls of allClasses) {
    const used = isClassUsedInSources(cls, sourceCache);
    if (!used) {
      possiblyUnused.push(cls);
    }
  }

  if (possiblyUnused.length === 0) {
    console.log('[coalesce] No obvious unused plugin CSS classes found.');
  } else {
    console.log('[coalesce] Potentially unused plugin CSS classes (heuristic):');
    for (const cls of possiblyUnused) {
      console.log('  - .' + cls);
    }
    console.log('[coalesce] Review these and remove any truly unused selectors. This check is informational and does not fail the build.');
  }
}

main().catch((err) => {
  console.error('[coalesce] CSS unused-selector check failed:', err);
  process.exitCode = 1;
});