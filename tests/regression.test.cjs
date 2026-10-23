const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('css/style.css');

const legacyIds = [
  'plotName', 'btnLocate', 'locationStatus', 'btnPickPlot', 'plotLocationStatus',
  'areaM2', 'areaRai', 'areaNgan', 'areaWa', 'treeEst', 'treeActual',
  'treeDensity', 'treePerRai', 'rowSpacing', 'seedlingPrice', 'seedlingTotal',
  'spacing', 'rotation', 'margin', 'btnGenerate', 'btnPDF', 'btnPrint',
  'btnGeoJSON', 'btnCSV', 'btnUndo', 'btnCenter', 'btnClear', 'status',
  'storageStatus', 'sheetToggle', 'sidebarContent', 'map'
];

test('preserves every legacy JavaScript element ID exactly once', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'HTML contains duplicate IDs');
  for (const id of legacyIds) assert.equal(ids.filter(found => found === id).length, 1, `missing or repeated #${id}`);
});

test('category tabs point to labelled panels and expose visible Thai labels', () => {
  const tabs = [...html.matchAll(/<button class="category-tab[^"]*"[^>]*id="([^"]+)"[^>]*aria-controls="([^"]+)"[^>]*data-panel="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(tabs.length, 6);
  for (const [, tabId, panelId, name, body] of tabs) {
    assert.match(html, new RegExp(`<section[^>]*id="${panelId}"[^>]*role="tabpanel"[^>]*aria-labelledby="${tabId}"`));
    assert.match(body, /<span>[^<ก-๙]*(?:[ก-๙][^<]*)?<\/span>/);
    assert.equal(panelId, `panel-${name}`);
  }
});

test('disabled primary/export actions explain which prerequisite is missing', () => {
  for (const id of ['btnGenerate', 'btnPDF', 'btnPrint', 'btnCSV', 'btnGeoJSON']) {
    const button = html.match(new RegExp(`<button\\b(?=[^>]*\\bid="${id}")([^>]*)>`));
    assert.ok(button, `missing #${id}`);
    assert.match(button[1], /disabled/);
    assert.match(button[1], /title="[^"]+[ก-๙][^"]*"/, `#${id} needs a Thai reason`);
  }
});

test('all referenced 3D SVG icons exist and have an SVG viewBox', () => {
  const sources = [...html.matchAll(/<img[^>]+src="(assets\/icons\/ui-3d\/[^\"]+\.svg)"/g)].map(match => match[1]);
  assert.ok(sources.length >= 10);
  for (const src of new Set(sources)) {
    const svg = read(src);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox=/);
  }
});

test('responsive and accessibility affordances are present', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /max-width: 720px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test('equilateral planting calculations retain baseline values and supported spacings', () => {
  const context = { window: {} };
  vm.runInNewContext(read('js/calculator.js'), context);
  const rowSpacing = context.window.rowSpacingFor;
  const areaPerTree = context.window.areaPerTreeFor;
  const treesPerRai = context.window.treesPerRaiFor;
  assert.ok(Math.abs(rowSpacing(9) - 7.794228634) < 1e-8);
  assert.ok(Math.abs(areaPerTree(9) - 70.1480577) < 1e-6);
  assert.ok(Math.abs(treesPerRai(9) - 22.809) < 0.01);
  for (const spacing of [3, 6, 9, 12, 20]) {
    assert.ok(rowSpacing(spacing) > 0);
    assert.ok(areaPerTree(spacing) > 0);
    assert.ok(treesPerRai(spacing) > 0);
  }
});

test('CSS uses a single shared class for 3D icon sizing and panels can be hidden', () => {
  assert.match(css, /\.inline-icon\s*\{[^}]*width:\s*23px/);
  assert.match(css, /\.category-panel\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
