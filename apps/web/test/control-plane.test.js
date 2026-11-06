import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from '../node_modules/typescript/lib/typescript.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile the real TSX modules with the existing TypeScript toolchain for SSR checks.
function load(file) {
  const path = resolve(file); const native = createRequire(path); const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(
    name => name.startsWith('.') ? load(resolve(dirname(path), `${name}.tsx`)) : native(name), module, module.exports);
  return module.exports;
}
const components = () => load(fileURLToPath(new URL('../src/components.tsx', import.meta.url)));

test('overview explicitly dates its snapshot and distinguishes acceptance from live data', () => {
  const html = renderToStaticMarkup(React.createElement(components().Overview));
  assert.match(html, /2026-11-02/); assert.match(html, /snapshot/i); assert.match(html, /not live/i);
  assert.match(html, /ES2/); assert.match(html, /Needs evidence/);
});
test('snapshot supporting copy remains inside description-list definitions', () => {
  const html = renderToStaticMarkup(React.createElement(components().Overview));
  assert.doesNotMatch(html, /<\/dd><p>/);
  assert.equal((html.match(/<p>[^<]+<\/p><\/dd>/g) ?? []).length, 3);
});
test('every operational screen is empty, disabled and describes prerequisites', () => {
  for (const section of ['projects', 'environments', 'services', 'domains', 'releases', 'observability']) {
    const html = renderToStaticMarkup(React.createElement(components().EmptyState, { section }));
    assert.match(html, /No connected data/); assert.match(html, /<button[^>]*disabled=""/);
    assert.match(html, new RegExp(`aria-describedby="${section}-requirements"`));
    assert.match(html, /authenticated/i);
  }
});
