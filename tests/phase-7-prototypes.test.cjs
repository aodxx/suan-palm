const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const previewDir = path.join(root, 'prototypes', 'phase-7');
const readPreview = name => fs.readFileSync(path.join(previewDir, name), 'utf8');

test('Phase 7 preview is standalone and never loads production handlers or persistence', () => {
  const html = readPreview('index.html');
  const js = readPreview('prototype.js');
  assert.match(html, /data-prototype-only="true"/);
  assert.match(html, /prototype\.css/);
  assert.match(html, /prototype\.js/);
  assert.doesNotMatch(html, /(?:\.\.\/){1,}js\/app\.js|<script[^>]+src=["'][^"']*js\/app\.js/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|suan-palm-draft-v1|L\.map\(|L\.control\.draw/);
});

test('both alternatives have one primary navigation model and prototype-specific controls', () => {
  const html = readPreview('index.html');
  const css = readPreview('prototype.css');
  assert.match(html, /data-variant="a"/);
  assert.match(html, /data-variant="b"/);
  assert.match(html, /id="p7PrimaryNav"/);
  assert.match(html, /id="p7ContextPanel"/);
  assert.match(css, /\.p7-action-dock/);
  assert.match(html, /id="p7Map"/);
  assert.match(css, /\.p7-primary-nav/);
  assert.match(css, /\.p7-action-dock/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)/);
});

test('prototype state supports boundary, planting, select, drag, delete, undo and export without production state', () => {
  const prototype = require(path.join(previewDir, 'prototype.js'));
  const js = readPreview('prototype.js');
  assert.match(js, /pointerdown/);
  assert.match(js, /pointermove/);
  assert.match(js, /pointerup/);
  prototype.reset();
  prototype.startDrawing();
  for (let i = 0; i < 4; i++) prototype.addVertex();
  assert.equal(prototype.finishBoundary(), true);
  assert.equal(prototype.generate(), true);
  assert.equal(prototype.getState().treeCount, 187);
  prototype.selectTree();
  assert.equal(prototype.dragSelectedTree(), true);
  assert.equal(prototype.deleteSelectedTree(), true);
  assert.equal(prototype.getState().treeCount, 186);
  assert.equal(prototype.undoDelete(), true);
  assert.equal(prototype.getState().treeCount, 187);
  prototype.openReports();
  assert.equal(prototype.exportCsv(), true);
  assert.equal(prototype.getState().exports, 1);
});

test('prototype keeps primary action and auto-save explanation visible when context details collapse', () => {
  const html = readPreview('index.html');
  const css = readPreview('prototype.css');
  assert.match(html, /id="p7PrimaryAction"/);
  assert.match(html, /id="p7SaveStatus"/);
  assert.match(html, /auto-save|บันทึกอัตโนมัติ/i);
  assert.match(html, /id="p7Collapse"/);
  assert.match(css, /\.is-collapsed[\s\S]*\.p7-primary-action/);
  assert.match(css, /\.is-collapsed[\s\S]*\.p7-save-status/);
});

test('Leaflet-like mock controls and dock have separate clearances and safe-area support', () => {
  const html = readPreview('index.html');
  const css = readPreview('prototype.css');
  assert.match(html, /class="p7-map-controls/);
  assert.match(html, /class="p7-layers-control/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.p7-action-dock[\s\S]*bottom:/);
  assert.match(css, /\.p7-map-controls[\s\S]*top:/);
  assert.match(css, /\.p7-layers-control[\s\S]*top:/);
});
