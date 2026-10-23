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

test('mobile map-first dock has named controls and follows the existing workflow states', () => {
  for (const id of ['mobilePrimaryAction', 'mobileActionHint', 'mobileToolsToggle']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /aria-controls="sidebarContent"/);
  assert.match(css, /#sidebar:not\(\.is-collapsed\) ~ \.mobile-action-dock\s*\{\s*display:\s*none/);
  assert.match(css, /\.leaflet-bottom\s*\{\s*bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  const app = read('js/app.js');
  assert.match(app, /mobileAction\.dataset\.action = 'draw'/);
  assert.match(app, /mobileAction\.dataset\.action = 'generate'/);
  assert.match(app, /mobileAction\.dataset\.action = 'review'/);
  assert.match(app, /\$\('btnGenerate'\)\.click\(\)/);
  assert.match(app, /restoreDraft\(\);\s*updateWorkflow\(\);/);
});

test('mobile default collapses the sheet without changing the draft storage schema', () => {
  const app = read('js/app.js');
  assert.match(app, /savedSheetState === '1' \|\| savedSheetState === null/);
  assert.match(app, /const STORAGE_KEY = 'suan-palm-draft-v1'/);
  assert.match(app, /version: 1/);
  assert.match(app, /const SHEET_KEY = 'suan-palm-sheet-collapsed'/);
});

test('replacing, editing, or removing a boundary warns before existing planting points are discarded', () => {
  const app = read('js/app.js');
  assert.match(app, /trees\.length && !confirm\('การวาดขอบเขตใหม่จะแทนแปลงเดิม/);
  assert.match(app, /\.leaflet-draw-edit-edit, \.leaflet-draw-edit-remove/);
  assert.match(app, /การแก้ไขขอบเขตและกดบันทึกจะล้างจุดปลูกเดิม/);
  assert.match(app, /การลบขอบเขตจะล้างจุดปลูกทั้งหมด/);
  assert.match(app, /event\.stopImmediatePropagation\(\)/);
});

test('GPS permission failure persists the cleared location in the existing draft', () => {
  const app = read('js/app.js');
  const requestStart = app.indexOf('navigator.geolocation.getCurrentPosition');
  const failureStart = app.indexOf('}, error => {', requestStart);
  const failureEnd = app.indexOf('}, { enableHighAccuracy', failureStart);
  assert.ok(requestStart >= 0 && failureStart > requestStart && failureEnd > failureStart);
  const failureHandler = app.slice(failureStart, failureEnd);
  assert.match(failureHandler, /userLocation\s*=\s*null/);
  assert.match(failureHandler, /userAddress\s*=\s*null/);
  assert.match(failureHandler, /saveDraft\(\)/);
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
