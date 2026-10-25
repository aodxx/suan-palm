const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('css/style.css');

const requiredIds = [
  'plotName', 'btnLocate', 'locationStatus', 'btnPickPlot', 'plotLocationStatus',
  'areaM2', 'areaRai', 'areaNgan', 'areaWa', 'treeEst', 'treeActual',
  'treeDensity', 'treePerRai', 'rowSpacing', 'seedlingPrice', 'seedlingTotal',
  'spacing', 'rotation', 'margin', 'btnGenerate', 'btnPDF', 'btnPrint',
  'btnGeoJSON', 'btnCSV', 'btnUndo', 'btnCenter', 'btnClear', 'status',
  'storageStatus', 'sidebarContent', 'map'
];

test('preserves all required tool IDs exactly once and removes obsolete tab/sheet controls', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'HTML contains duplicate IDs');
  for (const id of requiredIds) assert.equal(ids.filter(found => found === id).length, 1, `missing or repeated #${id}`);
  for (const id of ['sheetToggle', 'mobileToolsToggle', 'mobilePrimaryAction']) {
    assert.equal(ids.includes(id), false, `obsolete hidden control #${id} must not remain`);
  }
});

test('all six tool groups are visible together without tab semantics or hidden panels', () => {
  const panels = [...html.matchAll(/<section class="category-panel" id="panel-([^\"]+)"([^>]*)>/g)];
  assert.deepEqual(panels.map(([, name]) => name), ['plot', 'draw', 'plant', 'settings', 'report', 'more']);
  for (const [, name, attrs] of panels) {
    assert.match(attrs, /aria-label=/, `${name} should be accessible`);
    assert.doesNotMatch(attrs, /\bhidden\b|role="tabpanel"/);
  }
  assert.doesNotMatch(html, /role="tablist"|class="category-tab/);
  assert.match(css, /\.category-panel\[hidden\],\s*\.category-panel\s*\{\s*display:\s*block\s*!important/);
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
  const sources = [...html.matchAll(/<img[^>]+src="(assets\/icons\/ui-3d\/[^"]+\.svg)"/g)].map(match => match[1]);
  assert.ok(sources.length >= 10);
  for (const src of new Set(sources)) {
    const svg = read(src);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox=/);
  }
});

test('responsive mobile shell is full-screen and has separate tools/report views', () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /max-width: 720px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#app\s*\{\s*position:\s*static;\s*display:\s*flex;\s*flex-direction:\s*column/);
  assert.match(css, /#map\s*\{\s*position:\s*relative;[^}]*order:\s*0;[^}]*height:\s*42dvh/);
  assert.match(css, /#sidebar\s*\{\s*position:\s*relative;[^}]*order:\s*1/);
  assert.match(css, /html, body\s*\{\s*height:\s*auto;[^}]*overflow-y:\s*auto/);
  assert.match(css, /#sidebarContent\s*\{\s*overflow-y:\s*auto/);
  assert.match(css, /\.mobile-action-dock\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /#map\s*\{\s*position:\s*fixed;\s*z-index:\s*0;\s*inset:\s*0;[^}]*height:\s*100dvh/);
  assert.match(css, /body\[data-mobile-view="tools"\] #sidebar/);
  assert.match(css, /body\[data-mobile-view="report"\] #sidebar/);
  assert.match(css, /body\[data-mobile-view="tools"\] #panel-report/);
  assert.doesNotMatch(css, /body\[data-mobile-view="tools"\] #panel-more/);
  assert.match(css, /body\[data-mobile-view="report"\] #panel-more/);
  assert.match(css, /body\[data-mobile-view="report"\] \.primary-action/);
});

test('existing boundary, grid, export, and persistence handlers remain connected', () => {
  const app = read('js/app.js');
  for (const id of ['btnGenerate', 'btnUndo', 'btnPDF', 'btnPrint', 'btnCSV', 'btnGeoJSON', 'btnClear', 'btnPickPlot', 'btnLocate']) {
    assert.ok(app.includes(`$('${id}')`), `missing handler reference for #${id}`);
  }
  assert.match(app, /restoreDraft\(\);\s*updateWorkflow\(\);/);
  assert.match(app, /const STORAGE_KEY = 'suan-palm-draft-v1'/);
  assert.match(app, /version: 1/);
  assert.match(app, /L\.Draw\.Event\.CREATED/);
  assert.match(app, /function generateGrid\(/);
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

test('CSS keeps shared icon sizing and no sidebar sheet/dock in one-page mobile mode', () => {
  assert.match(css, /\.inline-icon\s*\{[^}]*width:\s*23px/);
  assert.match(css, /\.sheet-toggle\s*\{\s*display:\s*none\s*!important/);
});

test('map workflow supports crosshair boundary placement and separate app destinations', () => {
  for (const id of ['mapAreaSummary', 'mapTreeSummary', 'mapPerimeterSummary', 'mapPerimeterLabel', 'mapCrosshair', 'mapMeasureBadge', 'mapLocateAction', 'mapLayersAction', 'mapLayerSheet', 'mapLayerScrim', 'mapLayerClose', 'mapPrimaryAction', 'mapActionMenu', 'mapDrawAction', 'mapMeasureAction', 'mapPlantAction', 'mapPlotPinAction', 'mapBoundaryUndo', 'mapBoundaryCancel', 'mapToolsShortcut', 'mapReportShortcut']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing map control #${id}`);
  }
  assert.match(css, /\.map-ui\.is-drawing \.map-crosshair\s*\{\s*display:\s*block/);
  assert.match(css, /\.map-ui\.is-drawing \.map-primary-action\[data-can-finish="true"\]/);
  assert.match(css, /\.map-layer-sheet\s*\{\s*position:\s*fixed/);
  assert.match(css, /\.map-primary-action\s*\{[^}]*background:\s*#f28c28/);
  assert.deepEqual([...html.matchAll(/data-map-layer="([^"]+)"/g)].map(match => match[1]), ['satellite', 'road', 'hybrid']);
  const app = read('js/app.js');
  for (const fn of ['startMobileBoundary', 'addMobileBoundaryPoint', 'undoMobileBoundaryPoint', 'finishMobileBoundary', 'setMobileView']) assert.match(app, new RegExp(`function ${fn}\\(`));
  assert.match(app, /map\.getCenter\(\)/);
  assert.match(app, /map\.distance\(mobileBoundaryPoints\.at\(-1\), center\)/);
  assert.match(app, /function setMobileMapLayer\(/);
  assert.match(app, /mobileBoundaryDistanceMarkers = mobileBoundaryPoints\.slice\(1\)/);
  assert.match(app, /startMobileBoundary\('measure'\)/);
  assert.match(app, /แนววัดนี้ไม่เปลี่ยนขอบเขตแปลง/);
  assert.match(app, /map\.fire\(L\.Draw\.Event\.CREATED/);
  assert.match(app, /document\.body\.dataset\.mobileView = view/);
  for (const id of ['btnGenerate', 'btnPickPlot', 'btnLocate']) assert.ok(app.includes(`$('${id}')`));
  assert.match(app, /function updateMapSummary\(/);
  assert.match(app, /function formatMapArea\(/);
  assert.match(app, /formatMapArea\(currentAreaM2\)/);
  assert.match(app, /area\.textContent = currentFeature/);
});

test('mobile map provides an explicit north-up indicator and user-initiated camera capture', () => {
  assert.match(html, /class="map-compass"[^>]*aria-label="ทิศเหนืออยู่ด้านบนของแผนที่"/);
  assert.match(html, /id="mapCameraAction"[^>]*aria-label="ถ่ายภาพและปักหมุดบนแผนที่"/);
  assert.match(html, /id="mapCameraInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*capture="environment"/);
  assert.match(css, /\.map-compass\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px/);
  assert.match(css, /\.map-quick-actions\s*\{[^}]*top:\s*calc\(144px/);
  assert.match(css, /\.camera-photo-icon\s*\{[^}]*border-radius:\s*50%/);
  assert.match(read('assets/icons/ui-3d/camera.svg'), /<svg\b[^>]*viewBox=/);
  assert.match(read('assets/icons/ui-3d/north-arrow.svg'), /<svg\b[^>]*viewBox=/);
  const app = read('js/app.js');
  assert.match(app, /if \(\$\('mapCameraInput'\)\) \$\('mapCameraInput'\)\.addEventListener\('change'/);
  assert.match(app, /URL\.createObjectURL\(file\)/);
  assert.match(app, /marker\.bindPopup\(popup/);
  assert.match(app, /ภาพอยู่ชั่วคราวในหน้านี้และไม่ถูกอัปโหลด/);
  assert.match(app, /cameraPhotoMarkers\.length\) && !confirm/);
  assert.match(app, /function clearCameraPhotoMarkers\(/);
  assert.match(app, /URL\.revokeObjectURL\(imageUrl\)/);
});
