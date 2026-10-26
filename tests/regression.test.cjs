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
  assert.match(app, /restoreDraft\(\);\s*updateSpacingSummary\(\);\s*updateWorkflow\(\);/);
  assert.match(app, /const STORAGE_KEY = 'suan-palm-draft-v1'/);
  assert.match(app, /version: 1/);
  assert.match(app, /L\.Draw\.Event\.CREATED/);
  assert.match(app, /(async )?function generateGrid\(/);
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
  for (const id of ['mapAreaSummary', 'mapTreeSummary', 'mapPerimeterSummary', 'mapPerimeterLabel', 'mapCrosshair', 'mapMeasureBadge', 'mapLocateAction', 'mapLayersAction', 'mapLayerSheet', 'mapLayerScrim', 'mapLayerClose', 'mapPrimaryAction', 'mapActionMenu', 'mapActionArea', 'mapActionBackdrop', 'mapDrawAction', 'mapMeasureAction', 'mapPlantAction', 'mapPlotPinAction', 'mapBoundaryUndo', 'mapBoundaryFinish', 'mapBoundaryCancel', 'mapToolsShortcut', 'mapReportShortcut']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing map control #${id}`);
  }
  assert.match(css, /\.map-ui\.is-drawing \.map-crosshair\s*\{\s*display:\s*block/);
  assert.match(css, /\.map-boundary-tools #mapBoundaryFinish\s*\{[^}]*background:\s*#168447/);
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

test('mobile boundary can add more than three vertices and finishes with a separate confirmation button', () => {
  const app = read('js/app.js');
  assert.match(app, /if \(mobileBoundaryMode\) \{\s*addMobileBoundaryPoint\(\);\s*return;/);
  assert.match(app, /if \(\$\('mapBoundaryFinish'\)\) \$\('mapBoundaryFinish'\)\.addEventListener\('click', \(\) => \{\s*finishMobileBoundary\(\);/);
  assert.match(app, /finishButton\.hidden = !canFinish/);
  assert.match(app, /mobileBoundaryKind === 'measure' \? mobileBoundaryPoints\.length >= 2 : mobileBoundaryPoints\.length >= 3/);
  assert.match(app, /const coords = mobileBoundaryPoints\.map\(point => \[point\.lat, point\.lng\]\)/);

  const start = app.indexOf('function addMobileBoundaryPoint() {');
  const end = app.indexOf('\nfunction undoMobileBoundaryPoint()', start);
  assert.ok(start >= 0 && end > start, 'mobile point insertion function exists');
  let longitude = 100;
  const context = {
    mobileBoundaryPoints: [],
    map: {
      getCenter: () => ({ lat: 13, lng: longitude += 0.001 }),
      distance: () => 100
    },
    L: { latLng: (lat, lng) => ({ lat, lng }) },
    renderMobileBoundaryPoints() {},
    setStatus() {}
  };
  vm.runInNewContext(`${app.slice(start, end)}\nthis.addPoint = addMobileBoundaryPoint;`, context);
  for (let point = 0; point < 5; point++) context.addPoint();
  assert.equal(context.mobileBoundaryPoints.length, 5, 'the mobile polygon accepts vertices beyond the three-point minimum');
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
  assert.match(app, /cameraPhotoMarkers\.length\) && !\(await askConfirm\(/);
  assert.match(app, /function clearCameraPhotoMarkers\(/);
  assert.match(app, /URL\.revokeObjectURL\(imageUrl\)/);
});

test('mobile primary action expands four round actions in a staggered semicircle with dim backdrop and auto-close', () => {
  assert.match(html, /id="mapActionArea" class="map-action-area"/);
  assert.match(html, /id="mapActionBackdrop"[^>]*aria-label="ปิดเมนูคำสั่ง"[^>]*hidden/);
  assert.match(html, /id="mapActionMenu"[^>]*aria-hidden="true" inert/);
  for (const icon of ['draw.svg', 'measure.svg', 'plant.svg', 'plot.svg']) {
    assert.match(html, new RegExp(`assets/icons/ui-3d/${icon}`));
  }
  assert.match(css, /\.map-action-area\s*\{[^}]*left:\s*50%/);
  assert.match(css, /--radial-outer-x:\s*clamp\(78px,\s*30vw,\s*104px\)/);
  assert.match(css, /--radial-inner-x:\s*clamp\(45px,\s*16vw,\s*58px\)/);
  assert.match(css, /#mapDrawAction\s*\{[^}]*--radial-x:\s*calc\(-1 \* var\(--radial-outer-x\)\);[^}]*--radial-y:\s*var\(--radial-outer-y\)/);
  assert.match(css, /#mapMeasureAction\s*\{[^}]*--radial-x:\s*calc\(-1 \* var\(--radial-inner-x\)\);[^}]*--radial-y:\s*var\(--radial-inner-y\)/);
  assert.match(css, /#mapPlantAction\s*\{[^}]*--radial-x:\s*var\(--radial-inner-x\);[^}]*--radial-y:\s*var\(--radial-inner-y\)/);
  assert.match(css, /#mapPlotPinAction\s*\{[^}]*--radial-x:\s*var\(--radial-outer-x\);[^}]*--radial-y:\s*var\(--radial-outer-y\)/);
  assert.match(css, /transform:\s*translate\(calc\(-50% - var\(--radial-x\)\), calc\(-50% - var\(--radial-y\)\)\) scale\(\.24\)/);
  assert.match(css, /transition:\s*opacity \.16s ease, transform \.38s cubic-bezier/);
  assert.match(css, /--radial-delay:\s*120ms/);
  assert.match(css, /\.map-action-area\s*\{\s*bottom:\s*calc\(108px/);
  assert.match(css, /\.map-action-menu button \.menu-action-label\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.map-action-menu \.menu-action-label\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.map-action-area\.is-open \.map-action-menu button\s*\{[^}]*scale\(1\)/);
  assert.match(css, /\.map-action-backdrop\.is-visible\s*\{[^}]*opacity:\s*1/);
  const app = read('js/app.js');
  assert.match(app, /function setMapActionMenuOpen\(open/);
  assert.match(app, /mapActionMenu\.inert = !open/);
  assert.match(app, /mapActionBackdrop\.addEventListener\('click'/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(app, /closeMapActionMenu\(\{ restoreFocus: true \}\)/);
  assert.match(app, /if \(open\) \{[\s\S]*?mapActionMenu\.hidden = false;/);
  assert.match(app, /function stopMobileBoundary\([\s\S]*?mapActionMenu'\)\) \$\('mapActionMenu'\)\.hidden = false;/);
});

test('map submenu actions connect drawing, measurement, planting and plot-center pinning to usable features', () => {
  const app = read('js/app.js');
  assert.match(app, /if \(\$\('mapDrawAction'\)\)[\s\S]*?startMobileBoundary\(\)[\s\S]*?leaflet-draw-draw-polygon/);
  assert.match(app, /if \(\$\('mapMeasureAction'\)\)[\s\S]*?startMobileBoundary\('measure'\)[\s\S]*?startDesktopMeasure\(\)/);
  assert.match(app, /function startDesktopMeasure\([\s\S]*?desktopMeasureHandler\?\.enabled\(\)[\s\S]*?desktopMeasureHandler\.disable\(\)[\s\S]*?desktopMeasureHandler = new L\.Draw\.Polyline\(map/);
  assert.match(app, /if \(e\.layerType === 'polyline'\)[\s\S]*?formatMapDistance\(distance\)[\s\S]*?return;/);
  assert.match(app, /if \(\$\('mapPlantAction'\)\)[\s\S]*?\$\('btnGenerate'\)\.click\(\)/);
  assert.match(app, /if \(\$\('mapPlotPinAction'\)\)[\s\S]*?savePlotLocation\(map\.getCenter\(\)\)[\s\S]*?\$\('btnPickPlot'\)\.click\(\)/);
});

test('small portrait screens keep the four circular menu actions compact and accessible', () => {
  assert.match(css, /@media \(max-width: 380px\) and \(orientation: portrait\)[\s\S]*?--radial-outer-x:\s*clamp\(78px,\s*30vw,\s*104px\)/);
  assert.match(css, /\.map-action-menu button\s*\{[^}]*width:\s*58px;[^}]*height:\s*58px;[^}]*border-radius:\s*50%/);
  assert.match(css, /@media \(max-width: 380px\) and \(orientation: portrait\)[\s\S]*?\.map-action-menu \.menu-action-label\s*\{\s*display:\s*none !important/);
  for (const id of ['mapDrawAction', 'mapMeasureAction', 'mapPlantAction', 'mapPlotPinAction']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-label="[^"]+"`));
  }
});

test('guided main flow card connects draw -> area -> plant -> check with one next action', () => {
  const app = read('js/app.js');
  for (const id of ['mapFlow', 'mapFlowTitle', 'mapFlowDetail', 'mapFlowCta', 'mapFlowSecondary']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.deepEqual([...html.matchAll(/data-flow-step="([^"]+)"/g)].map(match => match[1]), ['draw', 'area', 'plant', 'check']);
  for (const fn of ['updateMapFlow', 'startBoundaryDraw', 'fitToPlot', 'goToNextBadTree', 'goToReport', 'goToPlotName']) {
    assert.match(app, new RegExp(`function ${fn}\\(`));
  }
  for (const action of ["'draw'", "'finish-draw'", "'generate'", "'bad'", "'name'", "'report'"]) assert.ok(app.includes(`case ${action}:`), `flow action ${action}`);
  // after generating on mobile the user is returned to the map and the plot is framed
  assert.match(app, /document\.body\.dataset\.mobileView !== 'map'\) setMobileView\('map'\)/);
  assert.match(app, /map\.fitBounds\(layers\[0\]\.getBounds\(\)/);
  // plant shortcut without a boundary starts drawing instead of a dead-end warning
  assert.match(app, /startBoundaryDraw\(\);\s*return;/);
  assert.match(css, /\.map-flow\s*\{/);
  assert.match(css, /body\[data-mobile-view="tools"\] \.map-flow/);
  assert.match(css, /\.map-flow\.flow-pop \.flow-chip\s*\{\s*animation: none/);
});

test('boundary drawing has no upper vertex limit on mobile or desktop', () => {
  const app = read('js/app.js');
  assert.match(app, /polygon:\s*\{\s*allowIntersection:\s*true/);
  assert.doesNotMatch(app, /mobileBoundaryPoints\.length\s*(>=|>|===)\s*(3|4|5|6|8|10)\s*\)\s*(return|\{\s*return)/);
  assert.doesNotMatch(app, /MAX_(VERTEX|VERTICES|BOUNDARY)/i);
  assert.match(app, /turf\.kinks\(currentFeature\)/);
  assert.match(html, /ปักกี่มุมก็ได้/);
});

test('flow card is a collapsed chip by default, expands on demand and auto-collapses', () => {
  const app = read('js/app.js');
  assert.match(html, /<section id="mapFlow" class="map-flow is-collapsed"/);
  assert.match(html, /id="mapFlowPanel" class="flow-panel" hidden/);
  assert.match(html, /id="mapFlowToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mapFlowPanel"/);
  assert.match(app, /function setFlowExpanded\(/);
  assert.match(app, /setTimeout\(\(\) => setFlowExpanded\(false\), 6000\)/);
  assert.match(app, /map\.on\('click movestart'/);
  assert.match(css, /\.flow-panel\s*\{[^}]*position:\s*absolute/);
});

test('map shows warnings and delete-undo itself because the status panel is hidden on mobile', () => {
  const app = read('js/app.js');
  assert.match(html, /id="mapToast"[^>]*role="status"/);
  assert.match(html, /id="mapToastAction"/);
  assert.match(app, /function showMapToast\(/);
  assert.match(app, /if \(cls === 'warn' && opts\.toast !== false\) showMapToast/);
  assert.match(app, /label: 'เลิกทำ', onClick: undoRemove/);
  assert.match(app, /class=\"tree-delete-btn\"/);
  assert.match(css, /\.tree-delete-btn\s*\{\s*min-height:\s*44px/);
  assert.match(app, /if \(drawnItems\.getLayers\(\)\.length\) fitToPlot\(\)/);
});

test('destructive actions use the in-app confirm dialog instead of window.confirm', () => {
  const app = read('js/app.js');
  for (const id of ['confirmDialog', 'confirmText', 'confirmOk', 'confirmCancel']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /role="alertdialog"[^>]*aria-modal="true"/);
  assert.match(app, /function askConfirm\(/);
  const calls = [...app.matchAll(/(?<![\w.$])confirm\(/g)];
  assert.equal(calls.length, 0, 'no bare confirm() calls remain');
  assert.match(app, /window\.confirm\(message\)/);
  assert.ok((app.match(/await askConfirm\(/g) || []).length >= 5);
  assert.match(app, /async function generateGrid\(/);
  assert.match(app, /boundaryEditApproved/);
  assert.match(app, /layerType: 'polygon', confirmed: true/);
  assert.match(css, /\.confirm-scrim\s*\{[^}]*position:\s*fixed/);
});

test('too-close wording follows the configured spacing instead of a fixed 9 m', () => {
  const app = read('js/app.js');
  assert.doesNotMatch(app, /น้อยกว่า 9 ม\.|ต่ำกว่า 9 ม\.|น้อยกว่า 9 เมตร|อย่างน้อย 9 ม\. \(รวม/);
  assert.match(app, /lastGeneratedSpacing\.toFixed\(1\)/);
  assert.match(html, /id="appSub"/);
  assert.match(app, /sub\.textContent = 'ปลูกแบบสามเหลี่ยมด้านเท่า '/);
});
