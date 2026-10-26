/* =====================================================================
 *  ส่วนที่ 2: แผนที่ + วาด Polygon + สร้างกริด
 * ===================================================================== */

// [แก้ไขความเป็นส่วนตัว] ไม่ฝังพิกัดส่วนตัวไว้ในโค้ด ใช้ตำแหน่งผู้ใช้เมื่อได้รับอนุญาต
const DEFAULT_CENTER = [13.7563, 100.5018]; // กรุงเทพฯ
const DEFAULT_ZOOM = 6;
const MAX_POINTS = 20000;                // กันเบราว์เซอร์ค้าง
const TOL = 0.05;                        // เผื่อความคลาดเคลื่อนเชิงตัวเลข (เมตร)

// ---------- แผนที่และชั้นแผนที่ ----------
const esriImagery = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    // Esri บางพื้นที่ เช่น พัทลุงไม่มีภาพจริงที่ z19 และจะส่งภาพเทา
    // “Map data not yet available” กลับมา ให้ Leaflet ขยายภาพ z18 แทน
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
const esriLabels = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxNativeZoom: 18, maxZoom: 19, attribution: 'Labels &copy; Esri' });
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });

const map = L.map('map', { layers: [esriImagery] }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.control.layers(
  { 'ดาวเทียม (Esri World Imagery)': esriImagery, 'แผนที่ถนน (OSM)': osm },
  { 'ชื่อสถานที่': esriLabels }
).addTo(map);
L.control.scale({ metric: true, imperial: false }).addTo(map);

// ---------- Leaflet.draw ----------
const drawnItems = new L.FeatureGroup().addTo(map);
const gridLayer  = new L.FeatureGroup().addTo(map);
const guideLine  = L.polyline([], { color: '#ffeb3b', weight: 2, dashArray: '4 4' }).addTo(map);
const PLOT_BOUNDARY_STYLE = {
  color: '#f4c400',       // เหลืองเข้ม มองเห็นชัดบนภาพดาวเทียม
  weight: 6,
  opacity: 1,
  fillColor: '#f4c400',
  fillOpacity: 0.16,
  className: 'plot-boundary'
};

// เปลี่ยนข้อความภาษาอังกฤษของ Leaflet.draw เป็นไอคอน พร้อม Tooltip ภาษาไทย
L.drawLocal.draw.toolbar.actions = {
  title: 'ยกเลิกการวาด', text: '✕'
};
L.drawLocal.draw.toolbar.finish = {
  title: 'ปิดพื้นที่และเสร็จสิ้นการวาด', text: '✓'
};
L.drawLocal.draw.toolbar.undo = {
  title: 'ลบจุดล่าสุด', text: '↶'
};
L.drawLocal.draw.handlers.polygon.tooltip = {
  start: 'คลิกเพื่อเริ่มวาดขอบเขตแปลง',
  cont: 'คลิกเพื่อเพิ่มจุดขอบเขต',
  end: 'คลิกจุดแรกเพื่อปิดขอบเขตแปลง'
};
L.drawLocal.edit.toolbar.actions = {
  save: { title: 'บันทึกการแก้ไข', text: '✓' },
  cancel: { title: 'ยกเลิกการแก้ไข', text: '✕' },
  clearAll: { title: 'ลบพื้นที่ทั้งหมด', text: '⌫' }
};
L.drawLocal.edit.toolbar.buttons = {
  edit: 'แก้ไขขอบเขตพื้นที่',
  editDisabled: 'ยังไม่มีพื้นที่ให้แก้ไข',
  remove: 'ลบขอบเขตพื้นที่',
  removeDisabled: 'ยังไม่มีพื้นที่ให้ลบ'
};

map.addControl(new L.Control.Draw({
  draw: {
    polygon: { allowIntersection: true, showArea: false, shapeOptions: PLOT_BOUNDARY_STYLE },
    polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
  },
  edit: { featureGroup: drawnItems }
}));

// ---------- องค์ประกอบ UI ----------
const $ = id => document.getElementById(id);
// เปลี่ยนเฉพาะข้อความของปุ่ม โดยคงไอคอนไว้
// ไอคอน + ของปุ่มกลางล่าง (ใช้ซ้ำเมื่อรีเซ็ตปุ่ม)
const FAB_PLUS_ICON = '<svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>';
const setLabel = (el, text) => { const l = el && el.querySelector('.lbl'); if (l) l.textContent = text; else if (el) el.textContent = text; };
const statusEl = $('status');
const CONFIRM_NEW_BOUNDARY = 'การวาดขอบเขตใหม่จะแทนแปลงเดิมและล้างจุดปลูกทั้งหมด รวมถึงจุดที่ลากปรับไว้ ต้องการดำเนินการต่อหรือไม่?';
let boundaryEditApproved = false;
let reportExported = false;     // ส่งออกรายงาน/ไฟล์แล้ว (รีเซ็ตเมื่อข้อมูลเปลี่ยน)
let desktopDrawing = false;      // กำลังวาดด้วยเครื่องมือ Leaflet.draw บนเดสก์ท็อป
let flowBadCursor = 0;          // ลำดับจุดสีแดงที่กำลังพาไปดู
let flowLastStage = '';         // ใช้ทำแอนิเมชันเมื่อเปลี่ยนขั้นตอน
// ---------- กล่องยืนยันในแอป (แทน confirm ของเบราว์เซอร์ ที่บนมือถือดูแปลกและบล็อกหน้าจอ) ----------
let confirmResolver = null;
let confirmReturnFocus = null;
function closeConfirm(result) {
  const dialog = $('confirmDialog');
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  const resolve = confirmResolver;
  confirmResolver = null;
  if (confirmReturnFocus?.isConnected) confirmReturnFocus.focus({ preventScroll: true });
  if (resolve) resolve(result);
}
function askConfirm(message, { danger = false, okLabel = 'ดำเนินการต่อ', cancelLabel = 'ยกเลิก' } = {}) {
  const dialog = $('confirmDialog');
  if (!dialog) return Promise.resolve(window.confirm(message));   // ไม่มี UI ให้ใช้ ย้อนกลับไปกล่องของเบราว์เซอร์
  if (confirmResolver) closeConfirm(false);
  confirmReturnFocus = document.activeElement;
  $('confirmText').textContent = message;
  $('confirmOk').textContent = okLabel;
  $('confirmCancel').textContent = cancelLabel;
  $('confirmOk').classList.toggle('is-danger', danger);
  dialog.hidden = false;
  $('confirmCancel').focus({ preventScroll: true });   // โฟกัสที่ปุ่มปลอดภัยก่อน กันกดผ่านโดยไม่ตั้งใจ
  return new Promise(resolve => { confirmResolver = resolve; });
}
$('confirmOk')?.addEventListener('click', () => closeConfirm(true));
$('confirmCancel')?.addEventListener('click', () => closeConfirm(false));
$('confirmDialog')?.addEventListener('click', event => { if (event.target === $('confirmDialog')) closeConfirm(false); });
document.addEventListener('keydown', event => {
  if (!$('confirmDialog') || $('confirmDialog').hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeConfirm(false); }
  if (event.key === 'Tab') {   // ให้โฟกัสวนอยู่ในกล่องเท่านั้น
    const buttons = [$('confirmCancel'), $('confirmOk')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault();
    buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
  }
});

let mapToastTimer = null;
function hideMapToast() {
  const toast = $('mapToast');
  if (mapToastTimer) { clearTimeout(mapToastTimer); mapToastTimer = null; }
  if (toast) toast.hidden = true;
}
// แจ้งบนแผนที่ เพราะบนมือถือแผงสถานะอยู่ในหน้าเครื่องมือที่ซ่อนอยู่ ผู้ใช้จึงมองไม่เห็นข้อความเตือน
function showMapToast(text, cls, { label = '', onClick = null, ms = 0, force = false } = {}) {
  const toast = $('mapToast');
  if (!toast) return;
  const mobile = typeof usesMobileMapUI === 'function' && usesMobileMapUI();
  if (!force && !mobile) return;
  if (mobile && document.body.dataset.mobileView && document.body.dataset.mobileView !== 'map') return;
  $('mapToastText').textContent = text;
  toast.className = 'map-toast ' + (cls || '');
  const action = $('mapToastAction');
  action.hidden = !label;
  action.textContent = label;
  action.onclick = () => { hideMapToast(); if (onClick) onClick(); };
  toast.hidden = false;
  if (mapToastTimer) clearTimeout(mapToastTimer);
  mapToastTimer = setTimeout(hideMapToast, ms || (cls === 'warn' ? 6000 : 3500));
}
// สั่นเบา ๆ บนมือถือเมื่อปักจุด/สร้างจุดสำเร็จ เพื่อให้รู้สึกว่าแอปตอบสนอง
function buzz(ms = 12) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ไม่รองรับก็ข้าม */ } }
function prefersReducedMotion() { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
// ตัวเลขจำนวนต้นนับขึ้นจากค่าเดิมไปค่าใหม่ แทนการกระโดดทันที
let shownTreeCount = 0, treeCountRaf = 0;
function formatTreeSummary(n) { return n ? n.toLocaleString('th-TH') + ' ต้น' : 'ยังไม่สร้าง'; }
function setAnimatedTreeCount(el, target) {
  const from = shownTreeCount;
  shownTreeCount = target;
  cancelAnimationFrame(treeCountRaf);
  if (prefersReducedMotion() || !target || Math.abs(target - from) < 20) { el.textContent = formatTreeSummary(target); return; }
  const start = performance.now(), duration = 700;
  const step = now => {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = formatTreeSummary(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) treeCountRaf = requestAnimationFrame(step);
  };
  treeCountRaf = requestAnimationFrame(step);
  el.classList.remove('count-pop'); void el.offsetWidth; el.classList.add('count-pop');
}
function setStatus(text, cls, opts = {}) {
  statusEl.textContent = text;
  statusEl.className = cls || '';
  if (cls === 'warn' && opts.toast !== false) showMapToast(text, 'warn');
}

function activateCategory(name, focus = false) {
  const tab = document.querySelector('.category-tab[data-panel="' + name + '"]');
  const panel = document.getElementById('panel-' + name);
  if (!tab || !panel) return;
  document.querySelectorAll('.category-tab').forEach(item => {
    const selected = item === tab;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('.category-panel').forEach(item => {
    const selected = item === panel;
    item.hidden = !selected;
    item.classList.toggle('is-active', selected);
  });
  if (focus) tab.focus();
  requestAnimationFrame(() => map.invalidateSize({ animate: false }));
}

function updateWorkflow() {
  const hasName = Boolean(($('plotName')?.value || '').trim());
  const hasBoundary = Boolean(currentFeature);
  const hasTrees = trees.length > 0;
  const complete = [hasName, hasBoundary, hasTrees, hasTrees, hasTrees];
  const currentIndex = complete.findIndex(done => !done);
  const steps = Array.from(document.querySelectorAll('#workflowSteps [data-step]'));
  steps.forEach((step, index) => {
    step.classList.toggle('is-done', complete[index]);
    step.classList.toggle('is-current', index === (currentIndex < 0 ? 4 : currentIndex));
    step.setAttribute('aria-current', index === (currentIndex < 0 ? 4 : currentIndex) ? 'step' : 'false');
  });
  const hint = $('nextStepHint');
  if (hint) {
    hint.textContent = !hasName ? 'ขั้นตอนถัดไป: ใส่ชื่อแปลงในหมวด “แปลง” (ตำแหน่งเป็นตัวเลือก)' :
      !hasBoundary ? 'ขั้นตอนถัดไป: ใช้เครื่องมือรูปหลายเหลี่ยมบนแผนที่เพื่อวาดขอบเขต' :
      !hasTrees ? 'พร้อมแล้ว: กด “สร้างจุดปลูกปาล์ม” เพื่อคำนวณตำแหน่งตามระยะที่ตั้งไว้' :
      'สร้างจุดปลูกแล้ว: ตรวจจุดบนแผนที่ แก้ไขตำแหน่ง แล้วส่งออกรายงานได้';
  }
  const generate = $('btnGenerate');
  if (generate) {
    generate.disabled = !hasBoundary;
    generate.title = hasBoundary ? (hasTrees ? 'สร้างใหม่จะแทนที่จุดที่ปรับตำแหน่งไว้' : 'สร้างจุดปลูกจากขอบเขตและค่าตั้งปัจจุบัน') : 'วาดขอบเขตก่อนจึงจะสร้างจุดปลูกได้';
  }
  updateMapFlow();
}

function updateMapSummary() {
  const area = $('mapAreaSummary');
  const count = $('mapTreeSummary');
  const perimeter = $('mapPerimeterSummary');
  const perimeterLabel = $('mapPerimeterLabel');
  if (area) {
    area.textContent = currentFeature ? formatMapArea(currentAreaM2) : '– ไร่';
  }
  if (count) setAnimatedTreeCount(count, trees.length);
  if (perimeter && !mobileBoundaryMode) {
    const meters = currentFeature ? turf.length(currentFeature, { units: 'kilometers' }) * 1000 : 0;
    if (lastMeasuredDistance !== null) {
      if (perimeterLabel) perimeterLabel.textContent = 'ระยะวัด';
      perimeter.textContent = formatMapDistance(lastMeasuredDistance);
    } else {
      if (perimeterLabel) perimeterLabel.textContent = 'แนวเขต';
      perimeter.textContent = currentFeature ? formatMapDistance(meters) : '– ม.';
    }
  }
}

function getSeedlingPrice() {
  const input = $('seedlingPrice');
  const value = input ? parseFloat(input.value) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatBaht(value) {
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' บาท';
}

function updateSeedlingCost() {
  const totalEl = $('seedlingTotal');
  if (!totalEl) return;
  const price = getSeedlingPrice();
  totalEl.textContent = price !== null && trees.length
    ? formatBaht(price * trees.length)
    : '–';
}

function getConfiguredSpacing() {
  const value = parseFloat($('spacing')?.value);
  return Number.isFinite(value) && value >= 3 && value <= 20 ? value : SPACING;
}

function getSpacingMetrics(spacing = getConfiguredSpacing()) {
  const rowSpacing = spacing * Math.sin(Math.PI / 3);
  return {
    spacing,
    rowSpacing,
    areaPerTree: spacing * rowSpacing,
    treesPerRai: RAI_M2 / (spacing * rowSpacing)
  };
}

function updateSpacingSummary() {
  const metrics = getSpacingMetrics();
  const sub = $('appSub');
  if (sub) { const s = Number(getConfiguredSpacing().toFixed(1)); sub.textContent = 'ปลูกแบบสามเหลี่ยมด้านเท่า ' + s + ' × ' + s + ' × ' + s + ' เมตร'; }
  $('rowSpacing').textContent = metrics.rowSpacing.toFixed(3) + ' ม.';
  $('treePerRai').textContent = metrics.treesPerRai.toFixed(2) + ' (ปลูกได้ ' + Math.floor(metrics.treesPerRai) + ')';
  if (currentFeature) {
    $('treeEst').textContent = Math.floor(currentAreaM2 / metrics.areaPerTree).toLocaleString('th-TH') + ' ต้น';
  }
}

// [เพิ่ม] ตำแหน่งและที่อยู่ของผู้ใช้ เก็บไว้ในหน่วยความจำเท่านั้น ไม่ส่งไปเซิร์ฟเวอร์ของโปรเจกต์
let userLocation = null;
let userAddress = null;
let userLocationMarker = null;
let plotLocation = null;
let plotAddress = null;
let plotLocationMarker = null;
let pickingPlotLocation = false;
const geocodeCache = new Map();

function formatUserAddress(address) {
  if (!address) return 'ไม่ทราบตำแหน่ง';
  const clean = value => String(value || '').replace(/^(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\s*/u, '').trim();
  const subdistrict = address.subdistrict ? 'ตำบล/แขวง' + clean(address.subdistrict) : '';
  const district = address.district ? 'อำเภอ/เขต' + clean(address.district) : '';
  const province = address.province ? 'จังหวัด' + clean(address.province) : '';
  return [subdistrict, district, province].filter(Boolean).join(' ') || 'ไม่ทราบตำแหน่ง';
}

function updateLocationLabel() {
  const el = $('locationStatus');
  if (el) el.textContent = 'ตำแหน่งมือถือ: ' + (userLocation ? formatUserAddress(userAddress) : 'ยังไม่ได้อนุญาต');
  const plotEl = $('plotLocationStatus');
  if (plotEl) plotEl.textContent = 'ตำแหน่งแปลง: ' + (plotLocation ? formatUserAddress(plotAddress) : 'ยังไม่ได้ชี้บนแผนที่');
}

async function reverseGeocode(lat, lng, target = 'user') {
  // Nominatim ต้องการการระบุแอป; เบราว์เซอร์บางตัวอาจละเว้น User-Agent header แบบกำหนดเอง
  setStatus('กำลังค้นหาชื่อตำบล อำเภอ และจังหวัดจากพิกัด...');
  const cacheKey = lat.toFixed(5) + ',' + lng.toFixed(5);
  if (geocodeCache.has(cacheKey)) {
    if (target === 'plot') plotAddress = geocodeCache.get(cacheKey);
    else userAddress = geocodeCache.get(cacheKey);
    updateLocationLabel();
    setStatus(target === 'plot' ? 'บันทึกตำแหน่งแปลงแล้ว' : 'ได้รับตำแหน่งมือถือและข้อมูลพื้นที่แล้ว', 'ok');
    return;
  }
  const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&layer=address&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&accept-language=th';
  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'th',
        'User-Agent': 'SuanPalmApp/1.0'
      }
    });
    if (!response.ok) throw new Error('Reverse geocoding HTTP ' + response.status);
    const data = await response.json();
    const a = data.address || {};
    const isBangkok = a.city === 'กรุงเทพมหานคร' || a.province === 'กรุงเทพมหานคร';
    const address = {
      // กรุงเทพฯ มักใช้ quarter=แขวง และ suburb=เขต; จังหวัดอื่นมักใช้ suburb/village/city_district
      subdistrict: a.quarter || a.village || a.suburb || a.city_district || '',
      district: a.county || a.district || (isBangkok ? a.suburb : '') || '',
      province: a.state || a.province || (isBangkok ? a.city : '') || '',
      postcode: a.postcode || ''
    };
    geocodeCache.set(cacheKey, address);
    if (target === 'plot') plotAddress = address;
    else userAddress = address;
    setStatus(target === 'plot' ? 'บันทึกตำแหน่งแปลงและชื่อพื้นที่แล้ว' : 'ได้รับตำแหน่งมือถือและข้อมูลพื้นที่แล้ว', 'ok');
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    if (target === 'plot') plotAddress = null;
    else userAddress = null;
    setStatus((target === 'plot' ? 'บันทึกพิกัดแปลงแล้ว แต่ค้นหาชื่อพื้นที่ไม่สำเร็จ' : 'ได้พิกัดมือถือแล้ว แต่ค้นหาชื่อพื้นที่ไม่สำเร็จ') + ' สามารถใช้งานต่อได้', 'warn');
  }
  updateLocationLabel();
  saveDraft();
}

function requestUserLocation() {
  const button = $('btnLocate');
  if (!navigator.geolocation) {
    setStatus('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง กรุณาวาดพื้นที่ด้วยตนเอง', 'warn');
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังขอตำแหน่ง...';
  }
  userAddress = null;
  updateLocationLabel();
  setStatus('กำลังขออนุญาตใช้ตำแหน่ง เพื่อแสดงแผนที่บริเวณที่คุณอยู่...');
  navigator.geolocation.getCurrentPosition(position => {
    userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    map.setView([userLocation.lat, userLocation.lng], 16);
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    userLocationMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#1976d2', fillOpacity: 1
    }).bindTooltip('ตำแหน่งของฉัน').addTo(map);
    updateLocationLabel();
    saveDraft();
    reverseGeocode(userLocation.lat, userLocation.lng);
    setStatus('ได้รับตำแหน่งแล้ว กรุณาวาดขอบเขตแปลงของคุณ');
    if (button) {
      button.disabled = false;
      setLabel(button, 'ดึงตำแหน่งของฉันอีกครั้ง');
    }
  }, error => {
    userLocation = null;
    userAddress = null;
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
      userLocationMarker = null;
    }
    updateLocationLabel();
    saveDraft();
    const message = error && error.code === 1
      ? 'ยังไม่ได้รับอนุญาตตำแหน่ง กรุณาอนุญาต Location ในเบราว์เซอร์แล้วลองใหม่'
      : error && error.code === 2
        ? 'ไม่พบตำแหน่งปัจจุบัน กรุณาตรวจสอบ GPS หรือสัญญาณอินเทอร์เน็ตแล้วลองใหม่'
        : error && error.code === 3
          ? 'ค้นหาตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่ในบริเวณที่รับสัญญาณได้ดี'
          : 'ไม่สามารถดึงตำแหน่งได้ กรุณาตรวจสอบสิทธิ์ Location แล้วลองใหม่';
    setStatus(message, 'warn');
    if (button) {
      button.disabled = false;
      setLabel(button, 'อนุญาตและใช้ตำแหน่งของฉัน');
    }
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function beginPickPlotLocation() {
  pickingPlotLocation = true;
  $('map').classList.add('is-picking-plot');
  $('btnPickPlot').textContent = 'แตะแผนที่เพื่อวางหมุดแปลง...';
  setStatus('กรุณาแตะจุดกึ่งกลางแปลงบนแผนที่ แล้วระบบจะวางหมุดสีส้มให้', 'ok');
}

function savePlotLocation(latlng) {
  plotLocation = { lat: latlng.lat, lng: latlng.lng };
  renderPlotLocationMarker();
  pickingPlotLocation = false;
  $('map').classList.remove('is-picking-plot');
  setLabel($('btnPickPlot'), 'ชี้ตำแหน่งกึ่งกลางแปลงอีกครั้ง');
  plotAddress = null;
  updateLocationLabel();
  reverseGeocode(plotLocation.lat, plotLocation.lng, 'plot');
  saveDraft();
  setStatus('บันทึกตำแหน่งกึ่งกลางแปลงแล้ว', 'ok');
}

$('btnLocate').addEventListener('click', requestUserLocation);
$('btnPickPlot').addEventListener('click', beginPickPlotLocation);
$('plotName').addEventListener('input', () => { updateCount(); saveDraft(); });
$('reportPlotName')?.addEventListener('input', () => { $('plotName').value = $('reportPlotName').value; updateCount(); saveDraft(); });
$('reportGateAction')?.addEventListener('click', () => {
  if (usesMobileMapUI()) setMobileView('map');
  if (!currentFeature) startBoundaryDraw();
});
$('seedlingPrice').addEventListener('input', () => { updateSeedlingCost(); saveDraft(); });
$('spacing').addEventListener('change', async () => {
  const value = getConfiguredSpacing();
  $('spacing').value = value;
  if (trees.length && value !== lastGeneratedSpacing) {
    if (!(await askConfirm('การเปลี่ยนระยะห่างจะล้างจุดปลูกเดิม เพื่อสร้างกริดใหม่ ต้องการดำเนินการต่อหรือไม่?'))) {
      $('spacing').value = lastGeneratedSpacing;
      updateSpacingSummary();
      return;
    }
    clearGrid();
  }
  updateSpacingSummary();
  saveDraft();
  setStatus('ตั้งระยะห่างระหว่างต้นเป็น ' + value.toFixed(1) + ' เมตรแล้ว กรุณากดสร้างจุดปลูก', 'ok');
});
$('rotation').addEventListener('change', saveDraft);
$('margin').addEventListener('change', saveDraft);

$('treePerRai').textContent = TREES_PER_RAI.toFixed(2) + ' (ปลูกได้ ' + Math.floor(TREES_PER_RAI) + ')';
$('rowSpacing').textContent = ROW_SPACING.toFixed(3) + ' ม.';

// ---------- ตัวแปรสถานะ ----------
let currentFeature = null;   // GeoJSON Feature ของ Polygon ที่วาด
let currentAreaM2 = 0;       // พื้นที่ (ตร.ม.)
let origin = null;           // {lng0, lat0, mLng, mLat} สำหรับแปลงองศา <-> เมตร
let trees = [];              // [{marker, x, y}]  x,y เป็นเมตรในระบบพิกัดท้องถิ่น
let hash = new Map();        // Spatial hash สำหรับหาเพื่อนบ้านเร็ว ๆ
let lastGeneratedSpacing = SPACING;
let mobileBoundaryMode = false;
let mobileBoundaryKind = 'boundary';
let lastMeasuredDistance = null;
let mobileBoundaryPoints = [];
let mobileBoundaryLine = null;
let mobileBoundaryPreview = null;
let mobileBoundaryMarkers = [];
let mobileBoundaryDistanceMarkers = [];
let mobilePreviewDistanceMarker = null;
let desktopMeasureLayer = null;
let desktopMeasureHandler = null;

function usesMobileMapUI() {
  return window.matchMedia('(max-width: 720px), (orientation: landscape) and (max-width: 900px)').matches;
}

function formatMapDistance(meters) {
  return meters >= 1000 ? (meters / 1000).toFixed(2) + ' กม.' : meters.toFixed(1) + ' ม.';
}

function formatMapArea(squareMeters, preview = false) {
  if (squareMeters < 400) return (preview ? '≈ ' : '') + squareMeters.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ตร.ม.';
  return (preview ? '≈ ' : '') + (squareMeters / RAI_M2).toFixed(2) + ' ไร่';
}

function startDesktopMeasure() {
  if (desktopMeasureHandler?.enabled()) desktopMeasureHandler.disable();
  if (desktopMeasureLayer) map.removeLayer(desktopMeasureLayer);
  desktopMeasureLayer = null;
  lastMeasuredDistance = null;
  updateMapSummary();
  desktopMeasureHandler = new L.Draw.Polyline(map, {
    metric: true,
    shapeOptions: { color: '#f59a2e', weight: 4, opacity: 0.95, dashArray: '8 6' }
  });
  desktopMeasureHandler.enable();
  setStatus('โหมดวัดระยะ: คลิกจุดเริ่มและจุดถัดไปบนแผนที่ แล้วดับเบิลคลิกเพื่อจบ', 'ok');
}

function updateMobileMeasurePreview() {
  if (!mobileBoundaryMode) return;
  const center = map.getCenter();
  const liveSegment = mobileBoundaryPoints.length ? map.distance(mobileBoundaryPoints.at(-1), center) : 0;
  const segment = mobileBoundaryPoints.length > 1 && liveSegment < 1
    ? map.distance(mobileBoundaryPoints.at(-2), mobileBoundaryPoints.at(-1))
    : liveSegment;
  let total = liveSegment;
  for (let i = 1; i < mobileBoundaryPoints.length; i++) total += map.distance(mobileBoundaryPoints[i - 1], mobileBoundaryPoints[i]);
  if (mobileBoundaryKind === 'boundary' && mobileBoundaryPoints.length >= 3) total += map.distance(center, mobileBoundaryPoints[0]);
  const summary = $('mapPerimeterSummary');
  if (summary) summary.textContent = formatMapDistance(total);
  const perimeterLabel = $('mapPerimeterLabel');
  if (perimeterLabel) perimeterLabel.textContent = mobileBoundaryKind === 'measure' ? 'ระยะวัด' : 'แนวเขต';
  const segmentEl = $('mapSegmentDistance');
  if (segmentEl) segmentEl.textContent = mobileBoundaryPoints.length ? 'ช่วงล่าสุด ' + formatMapDistance(segment) : 'แตะ + เพื่อปักจุดแรก';
  const hint = $('mapBoundaryHint');
  if (hint) hint.textContent = mobileBoundaryPoints.length + ' จุด · เลื่อนแผนที่แล้วกด +';
  if (mobileBoundaryPreview) {
    const preview = mobileBoundaryPoints.length ? [mobileBoundaryPoints.at(-1), center] : [];
    if (mobileBoundaryKind === 'boundary' && mobileBoundaryPoints.length >= 3) preview.push(mobileBoundaryPoints[0]);
    mobileBoundaryPreview.setLatLngs(preview);
  }
  if (mobilePreviewDistanceMarker) map.removeLayer(mobilePreviewDistanceMarker);
  mobilePreviewDistanceMarker = null;
  if (mobileBoundaryPoints.length && liveSegment >= 1) {
    const last = mobileBoundaryPoints.at(-1);
    const midpoint = L.latLng((last.lat + center.lat) / 2, (last.lng + center.lng) / 2);
    mobilePreviewDistanceMarker = L.marker(midpoint, {
      interactive: false,
      icon: L.divIcon({ className: 'boundary-distance-icon', html: formatMapDistance(liveSegment), iconSize: [68, 25], iconAnchor: [34, 12] })
    }).addTo(map);
  }
  if (mobileBoundaryKind === 'boundary' && mobileBoundaryPoints.length >= 3) {
    try {
      const ring = mobileBoundaryPoints.map(p => [p.lng, p.lat]);
      ring.push(ring[0]);
      const areaM2 = turf.area(turf.polygon([ring]));
      const area = $('mapAreaSummary');
      if (area) area.textContent = formatMapArea(areaM2, true);
    } catch (error) { /* Leave the committed summary in place until a valid polygon exists. */ }
  }
}

function renderMobileBoundaryPoints() {
  if (mobileBoundaryLine) mobileBoundaryLine.setLatLngs(mobileBoundaryPoints);
  mobileBoundaryMarkers.forEach(marker => map.removeLayer(marker));
  mobileBoundaryDistanceMarkers.forEach(marker => map.removeLayer(marker));
  mobileBoundaryMarkers = mobileBoundaryPoints.map((point, index) => L.marker(point, {
    interactive: false,
    icon: L.divIcon({ className: 'boundary-number-icon', html: '<b>' + (index + 1) + '</b>', iconSize: [30, 30], iconAnchor: [15, 15] })
  }).addTo(map));
  mobileBoundaryDistanceMarkers = mobileBoundaryPoints.slice(1).map((point, index) => {
    const previous = mobileBoundaryPoints[index];
    const midpoint = L.latLng((previous.lat + point.lat) / 2, (previous.lng + point.lng) / 2);
    return L.marker(midpoint, {
      interactive: false,
      icon: L.divIcon({ className: 'boundary-distance-icon', html: formatMapDistance(map.distance(previous, point)), iconSize: [68, 25], iconAnchor: [34, 12] })
    }).addTo(map);
  });
  const undo = $('mapBoundaryUndo');
  if (undo) undo.hidden = mobileBoundaryPoints.length === 0;
  const canFinish = mobileBoundaryKind === 'measure' ? mobileBoundaryPoints.length >= 2 : mobileBoundaryPoints.length >= 3;
  const finishButton = $('mapBoundaryFinish');
  if (finishButton) {
    finishButton.hidden = !canFinish;
    setLabel(finishButton, mobileBoundaryKind === 'measure' ? 'จบวัด' : 'บันทึก');
    finishButton.setAttribute('aria-label', mobileBoundaryKind === 'measure' ? 'จบการวัดระยะ' : 'บันทึกขอบเขตแปลง');
  }
  const boundaryHint = $('mapBoundaryHint');
  if (boundaryHint) {
    boundaryHint.textContent = canFinish
      ? (mobileBoundaryKind === 'measure' ? 'กด + เพื่อเพิ่มจุด หรือกด จบวัด' : 'กด + เพื่อเพิ่มมุมได้ไม่จำกัด หรือกด บันทึกแปลง')
      : (mobileBoundaryKind === 'measure' ? 'เลื่อนแผนที่แล้วกด + เพื่อเพิ่มจุด (อย่างน้อย 2 จุด)' : 'เลื่อนแผนที่แล้วกด + เพื่อเพิ่มมุม (ปักได้ไม่จำกัด ครบ 3 มุมขึ้นไปจึงบันทึกได้)');
  }
  if (mapPrimaryAction && mobileBoundaryMode) {
    mapPrimaryAction.innerHTML = FAB_PLUS_ICON;
    mapPrimaryAction.dataset.canFinish = 'false';
    mapPrimaryAction.setAttribute('aria-label', 'ปักจุดที่กากบาท');
    mapPrimaryAction.title = 'เลื่อนแผนที่และกด + เพื่อเพิ่มจุด';
  }
  updateMobileMeasurePreview();
  updateMapFlow();
}

function startMobileBoundary(kind = 'boundary') {
  mobileBoundaryPoints = [];
  mobileBoundaryMode = true;
  mobileBoundaryKind = kind;
  lastMeasuredDistance = null;
  mobileBoundaryLine = L.polyline([], { color: '#f59a2e', weight: 4, opacity: 0.95 }).addTo(map);
  mobileBoundaryPreview = L.polyline([], { color: '#ffffff', weight: 3, dashArray: '5 7', opacity: 0.95 }).addTo(map);
  $('mapActionMenu').hidden = true;
  $('mapPrimaryAction').setAttribute('aria-expanded', 'false');
  $('mapPrimaryAction').innerHTML = FAB_PLUS_ICON;
  $('mapPrimaryAction').dataset.canFinish = 'false';
  $('mapPrimaryAction').setAttribute('aria-label', 'ปักจุดที่กากบาท');
  $('mapPrimaryAction').title = 'เลื่อนแผนที่และกด + เพื่อเพิ่มจุด';
  $('mapMeasureBadge').hidden = false;
  $('mapUI').classList.add('is-drawing');
  if ($('mapBoundaryUndo')) $('mapBoundaryUndo').hidden = true;
  setStatus(kind === 'measure'
    ? 'โหมดวัดระยะ: เลื่อนแผนที่ให้กากบาทตรงจุด แล้วกด + เพื่อปักจุด'
    : 'โหมดวาดขอบเขต: เลื่อนแผนที่ให้กากบาทตรงมุมแปลง แล้วกด + เพื่อปักจุด', 'ok');
  renderMobileBoundaryPoints();
}

function stopMobileBoundary() {
  mobileBoundaryMode = false;
  mobileBoundaryPoints = [];
  mobileBoundaryMarkers.forEach(marker => map.removeLayer(marker));
  mobileBoundaryDistanceMarkers.forEach(marker => map.removeLayer(marker));
  mobileBoundaryDistanceMarkers = [];
  if (mobilePreviewDistanceMarker) map.removeLayer(mobilePreviewDistanceMarker);
  mobilePreviewDistanceMarker = null;
  mobileBoundaryMarkers = [];
  if (mobileBoundaryLine) map.removeLayer(mobileBoundaryLine);
  if (mobileBoundaryPreview) map.removeLayer(mobileBoundaryPreview);
  mobileBoundaryLine = null;
  mobileBoundaryPreview = null;
  $('mapUI')?.classList.remove('is-drawing');
  if ($('mapMeasureBadge')) $('mapMeasureBadge').hidden = true;
  if ($('mapBoundaryUndo')) $('mapBoundaryUndo').hidden = true;
  if ($('mapBoundaryFinish')) $('mapBoundaryFinish').hidden = true;
  if ($('mapActionMenu')) $('mapActionMenu').hidden = false;
  if ($('mapPrimaryAction')) {
    $('mapPrimaryAction').innerHTML = FAB_PLUS_ICON;
    $('mapPrimaryAction').dataset.canFinish = 'false';
    $('mapPrimaryAction').setAttribute('aria-label', 'เปิดคำสั่งแผนที่');
    $('mapPrimaryAction').title = 'เปิดคำสั่งแผนที่';
  }
  mobileBoundaryKind = 'boundary';
  updateMapSummary();
  updateMapFlow();
}

function addMobileBoundaryPoint() {
  const center = map.getCenter();
  const last = mobileBoundaryPoints.at(-1);
  if (last && map.distance(last, center) < 0.25) {
    setStatus('จุดนี้ใกล้กับจุดก่อนหน้าเกินไป เลื่อนแผนที่เล็กน้อยก่อนปักจุด', 'warn');
    return;
  }
  mobileBoundaryPoints.push(L.latLng(center.lat, center.lng));
  renderMobileBoundaryPoints();
  if (typeof buzz === 'function') buzz(10);
  setStatus('ปักจุดที่ ' + mobileBoundaryPoints.length + ' แล้ว · ' + (mobileBoundaryPoints.length < 3 ? 'เลื่อนแผนที่ไปยังมุมถัดไป' : 'ปักมุมเพิ่มได้ไม่จำกัด หรือกด บันทึก'), 'ok');
}

function undoMobileBoundaryPoint() {
  if (!mobileBoundaryPoints.length) return;
  mobileBoundaryPoints.pop();
  renderMobileBoundaryPoints();
  setStatus('ย้อนจุดล่าสุดแล้ว · เหลือ ' + mobileBoundaryPoints.length + ' จุด', 'ok');
}

async function finishMobileBoundary() {
  if (mobileBoundaryKind === 'measure') {
    if (mobileBoundaryPoints.length < 2) {
      setStatus('ต้องปักอย่างน้อย 2 จุดก่อนจบการวัด', 'warn');
      return;
    }
    lastMeasuredDistance = mobileBoundaryPoints.slice(1).reduce((sum, point, index) => sum + map.distance(mobileBoundaryPoints[index], point), 0);
    stopMobileBoundary();
    updateMapSummary();
    setStatus('วัดระยะได้ ' + formatMapDistance(lastMeasuredDistance) + ' · แนววัดนี้ไม่เปลี่ยนขอบเขตแปลง', 'ok');
    return;
  }
  if (mobileBoundaryPoints.length < 3) {
    setStatus('ขอบเขตแปลงต้องมีอย่างน้อย 3 มุม (ปักเพิ่มได้ไม่จำกัด)', 'warn');
    return;
  }
  const coords = mobileBoundaryPoints.map(point => [point.lat, point.lng]);
  if (trees.length && !(await askConfirm(CONFIRM_NEW_BOUNDARY, { danger: true }))) {
    setStatus('ยกเลิกการวาดขอบเขตใหม่แล้ว; แปลงและจุดปลูกเดิมยังอยู่ · ปักมุมต่อหรือกด ยกเลิก', 'ok');
    return;
  }
  const layer = L.polygon(coords, PLOT_BOUNDARY_STYLE);
  map.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon', confirmed: true });
  if (drawnItems.hasLayer(layer)) {
    stopMobileBoundary();
    setStatus('บันทึกขอบเขตแล้ว · ตรวจพื้นที่และกดสร้างจุดปลูกได้', 'ok');
  }
}

// ---------- บันทึกข้อมูลแปลงไว้ในอุปกรณ์ของผู้ใช้ ----------
const STORAGE_KEY = 'suan-palm-draft-v1';
const SHEET_KEY = 'suan-palm-sheet-collapsed';
let restoringDraft = false;

function setSheetCollapsed(collapsed) {
  const sidebar = $('sidebar');
  const toggle = $('sheetToggle');
  if (!sidebar || !toggle) return;
  sidebar.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  $('mobileToolsToggle')?.setAttribute('aria-expanded', String(!collapsed));
  toggle.querySelector('.sheet-toggle-label').textContent = collapsed ? 'เปิดข้อมูลแปลงและเครื่องมือ' : 'ข้อมูลแปลงและเครื่องมือ';
  try { localStorage.setItem(SHEET_KEY, collapsed ? '1' : '0'); }
  catch (error) { setStorageStatus('เบราว์เซอร์ปิดกั้นพื้นที่บันทึกในเครื่อง'); }
  setTimeout(() => map.invalidateSize({ animate: false }), 260);
}

function toggleSheet() {
  setSheetCollapsed(!$('sidebar').classList.contains('is-collapsed'));
}

function setStorageStatus(text) {
  const el = $('storageStatus');
  if (el) el.textContent = text;
}

document.querySelectorAll('.category-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('click', () => activateCategory(tab.dataset.panel));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    activateCategory(tabs[next].dataset.panel, true);
  });
});

function saveDraft() {
  if (restoringDraft) return;
  if (reportExported) { reportExported = false; updateMapFlow(); }
  try {
    const draft = {
      version: 1,
      savedAt: new Date().toISOString(),
      plotName: $('plotName').value || '',
      seedlingPrice: $('seedlingPrice').value || '',
      spacing: $('spacing').value || String(SPACING),
      rotation: $('rotation').value || '0',
      margin: $('margin').value || '0',
      feature: currentFeature,
      plotLocation,
      plotAddress,
      userLocation,
      userAddress,
      generatedSpacing: lastGeneratedSpacing,
      trees: trees.map(t => {
        const ll = t.marker.getLatLng();
        return { lat: ll.lat, lng: ll.lng, bad: Boolean(t.bad) };
      })
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setStorageStatus('บันทึกข้อมูลอัตโนมัติแล้วในอุปกรณ์นี้ · ' + new Date().toLocaleTimeString('th-TH'));
  } catch (error) {
    console.warn('LocalStorage save failed:', error);
    setStorageStatus('ไม่สามารถบันทึกข้อมูลในอุปกรณ์นี้ได้');
  }
}

function renderPlotLocationMarker() {
  if (!plotLocation) return;
  if (plotLocationMarker) map.removeLayer(plotLocationMarker);
  plotLocationMarker = L.marker([plotLocation.lat, plotLocation.lng], {
    icon: L.divIcon({ className: 'plot-center-marker', html: '<svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg>', iconSize: [30, 30], iconAnchor: [15, 30] })
  }).bindTooltip('กึ่งกลางแปลง', { direction: 'top', offset: [0, -24] }).addTo(map);
}

function createTreeMarker(lat, lng, bad = false, popDelay = null) {
  // popDelay != null = ผุดทีละจุดเป็นคลื่นตอนสร้างใหม่ (จุดที่กู้คืนจากเครื่องไม่ต้องเล่นแอนิเมชัน)
  const pop = popDelay !== null ? ' pop" style="animation-delay:' + popDelay + 'ms' : '';
  const icon = L.divIcon({ className: '', html: '<div class="tree-dot' + pop + '"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
  const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(gridLayer);
  const [x, y] = toXY(lng, lat);
  const tree = { marker, x, y, bad: Boolean(bad) };
  marker._tree = tree;
  if (bad) setTimeout(() => setBad(tree, true), 0);
  trees.push(tree);
  return tree;
}

function restoreDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (error) {
    console.warn('LocalStorage read failed:', error);
    setStorageStatus('อ่านข้อมูลที่บันทึกไว้ไม่ได้ เบราว์เซอร์อาจปิดกั้นพื้นที่จัดเก็บ');
    return;
  }
  if (!draft || draft.version !== 1) return;
  restoringDraft = true;
  try {
    $('plotName').value = draft.plotName || '';
    $('seedlingPrice').value = draft.seedlingPrice || '';
    $('spacing').value = draft.spacing || String(SPACING);
    $('rotation').value = draft.rotation || '0';
    $('margin').value = draft.margin || '0';
    plotLocation = draft.plotLocation || null;
    plotAddress = draft.plotAddress || null;
    userLocation = draft.userLocation || null;
    userAddress = draft.userAddress || null;
    lastGeneratedSpacing = Number.isFinite(Number(draft.generatedSpacing)) ? Number(draft.generatedSpacing) : getConfiguredSpacing();

    if (draft.feature && draft.feature.geometry) {
      const layer = L.geoJSON(draft.feature, { style: PLOT_BOUNDARY_STYLE }).getLayers()[0];
      if (layer) {
        drawnItems.addLayer(layer);
        updateArea();
        const [lng, lat] = turf.centroid(draft.feature).geometry.coordinates;
        origin = makeOrigin(lat, lng);
        (Array.isArray(draft.trees) ? draft.trees : []).forEach(t => {
          if (Number.isFinite(t.lat) && Number.isFinite(t.lng)) createTreeMarker(t.lat, t.lng, t.bad);
        });
        rebuildHash();
        updateCount();
        recheckAll();
      }
    }
    if (userLocation) {
      userLocationMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 6, color: '#fff', weight: 2, fillColor: '#1976d2', fillOpacity: 1
      }).bindTooltip('ตำแหน่งของฉัน').addTo(map);
    }
    renderPlotLocationMarker();
    updateLocationLabel();
    updateSpacingSummary();
    if (drawnItems.getLayers().length) fitToPlot();
    setStorageStatus('กู้คืนข้อมูลแปลงล่าสุดแล้ว · ' + (draft.savedAt ? new Date(draft.savedAt).toLocaleString('th-TH') : 'ข้อมูลในเครื่อง'));
    setStatus('กู้คืนข้อมูลแปลงจากการใช้งานครั้งล่าสุดแล้ว', 'ok');
  } finally {
    restoringDraft = false;
  }
}

// ---------- แปลงพิกัดองศา <-> เมตร (Local Equirectangular) ----------
// 1° ละติจูด ≈ 111,132.92 − 559.82·cos(2φ) + 1.175·cos(4φ)  เมตร
// 1° ลองจิจูด ≈ 111,412.84·cos φ − 93.5·cos(3φ)             เมตร
function makeOrigin(lat0, lng0) {
  const p = lat0 * Math.PI / 180;
  return {
    lat0, lng0,
    mLat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
    mLng: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p)
  };
}
const toXY     = (lng, lat) => [(lng - origin.lng0) * origin.mLng, (lat - origin.lat0) * origin.mLat];
const toLngLat = (x, y)     => [origin.lng0 + x / origin.mLng, origin.lat0 + y / origin.mLat];

// ---------- Spatial hash (ช่องละระยะที่ผู้ใช้กำหนด) ----------
// ทำให้การหาเพื่อนบ้านใกล้สุดเป็น O(1) ต่อจุด แทน O(n) → ตรวจทั้งแปลงเป็น O(n)
const cellKey = (x, y, spacing = lastGeneratedSpacing) => Math.floor(x / spacing) + ',' + Math.floor(y / spacing);
function rebuildHash() {
  hash = new Map();
  for (const t of trees) {
    const k = cellKey(t.x, t.y);
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k).push(t);
  }
}
// หาต้นที่ใกล้ที่สุดภายในรัศมี 2 ช่อง (≈ 18 ม.)
function nearestOf(t) {
  const spacing = lastGeneratedSpacing;
  const cx = Math.floor(t.x / spacing), cy = Math.floor(t.y / spacing);
  let best = Infinity, bestT = null;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const list = hash.get((cx + dx) + ',' + (cy + dy));
      if (!list) continue;
      for (const o of list) {
        if (o === t) continue;
        const d = Math.hypot(o.x - t.x, o.y - t.y);   // ระยะยุคลิด (เมตร)
        if (d < best) { best = d; bestT = o; }
      }
    }
  }
  return { d: best, other: bestT };
}

// ---------- อัปเดตตัวเลขสรุป ----------
function updateCount() {
  if (!trees.length) {
    $('treeActual').textContent = '–';
    $('treeDensity').textContent = '–';
  } else {
    $('treeActual').textContent = trees.length.toLocaleString('th-TH') + ' ต้น';
    const rai = currentAreaM2 / RAI_M2;
    $('treeDensity').textContent = rai > 0 ? (trees.length / rai).toFixed(2) : '–';
  }
  const has = trees.length > 0;
  const hasPlotName = Boolean(($('plotName').value || '').trim());
  const reportName = $('reportPlotName');
  if (reportName && reportName.value !== $('plotName').value && document.activeElement !== reportName) reportName.value = $('plotName').value;
  const gate = $('reportGate');
  if (gate) {
    gate.hidden = has;
    $('reportGateText').textContent = currentFeature ? 'ยังไม่ได้สร้างจุดปลูก · กลับไปแผนที่แล้วกด “สร้างจุดปลูก” ก่อนจึงส่งออกได้' : 'ยังไม่ได้วาดขอบเขตแปลง · วาดแปลงและสร้างจุดปลูกก่อนจึงส่งออกได้';
    $('reportGateAction').textContent = currentFeature ? 'กลับไปแผนที่' : 'ไปวาดแปลง';
  }
  const nameHint = $('reportNameHint');
  if (nameHint) nameHint.hidden = !has || hasPlotName;
  $('btnGeoJSON').disabled = !has;
  $('btnCSV').disabled = !has;
  $('btnPDF').disabled = !has || !hasPlotName;
  $('btnPrint').disabled = !has || !hasPlotName;
  $('btnUndo').disabled = !removed.length;
  $('btnGeoJSON').title = has ? 'ดาวน์โหลดข้อมูลจุดปลูกเป็น GeoJSON' : 'สร้างจุดปลูกก่อนจึงจะส่งออก GeoJSON ได้';
  $('btnCSV').title = has ? 'ดาวน์โหลดข้อมูลจุดปลูกเป็น CSV' : 'สร้างจุดปลูกก่อนจึงจะส่งออก CSV ได้';
  $('btnPDF').title = !has ? 'สร้างจุดปลูกก่อนจึงจะทำรายงาน PDF ได้' : !hasPlotName ? 'กรอกชื่อแปลงก่อนจึงจะทำรายงาน PDF ได้' : 'ดาวน์โหลดแผนที่และข้อมูลเป็นไฟล์ PDF';
  $('btnPrint').title = !has ? 'สร้างจุดปลูกก่อนจึงจะพิมพ์รายงานได้' : !hasPlotName ? 'กรอกชื่อแปลงก่อนจึงจะพิมพ์รายงานได้' : 'พิมพ์รายงานหรือบันทึกเป็น PDF';
  $('btnUndo').title = removed.length ? 'คืนค่าจุดปลูกที่ลบล่าสุด' : 'ลบจุดปลูกก่อนจึงจะเลิกทำได้';
  updateSeedlingCost();
  updateWorkflow();
  updateMapSummary();
}

function updateArea() {
  const layers = drawnItems.getLayers();
  if (!layers.length) {
    currentFeature = null; currentAreaM2 = 0;
    ['areaM2', 'areaRai', 'areaNgan', 'areaWa', 'treeEst'].forEach(id => $(id).textContent = '–');
    $('btnGenerate').disabled = true;
    updateWorkflow();
    updateMapSummary();
    return;
  }
  currentFeature = layers[0].toGeoJSON();
  currentAreaM2 = turf.area(currentFeature);             // ตร.ม. (Turf.js)
  const { rai, ngan, wa } = m2ToThaiArea(currentAreaM2);
  $('areaM2').textContent   = currentAreaM2.toLocaleString('th-TH', { maximumFractionDigits: 1 });
  $('areaRai').textContent  = rai;
  $('areaNgan').textContent = ngan;
  $('areaWa').textContent   = wa.toFixed(2);
  $('treeEst').textContent  = Math.floor(currentAreaM2 / getSpacingMetrics().areaPerTree).toLocaleString('th-TH') + ' ต้น';
  $('btnGenerate').disabled = false;
  updateWorkflow();
  updateMapSummary();
}

function clearGrid() {
  gridLayer.clearLayers();
  guideLine.setLatLngs([]);
  trees = []; hash = new Map(); removed = [];
  updateCount();
}

// ---------- ตัวช่วย: tooltip ตอนลาก, ประวัติการลบ, popup ลบ ----------
const MAX_CANDIDATES = 1000000;          // จำนวนตำแหน่งที่ลองสูงสุด (กันค้าง)
const dragTip  = L.tooltip({ permanent: true, direction: 'top', offset: [0, -8] });
const delPopup = L.popup({ offset: [0, -6] });
let removed = [];                        // ต้นที่ลบไป (เลิกทำได้สูงสุด 100 ต้น)

// ---------- ทดสอบจุดอยู่ในรูปหลายเหลี่ยม (Ray casting, รองรับรู/MultiPolygon) ----------
function regionToXY(region) {
  const g = region.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.map(rings => {
    const r = rings.map(ring => ring.map(([lng, lat]) => toXY(lng, lat)));
    const xs = r[0].map(p => p[0]), ys = r[0].map(p => p[1]);
    return { rings: r, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
}
function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function insidePolys(x, y, polys) {
  for (const p of polys) {
    if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
    if (!inRing(x, y, p.rings[0])) continue;
    let hole = false;
    for (let k = 1; k < p.rings.length; k++) if (inRing(x, y, p.rings[k])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

// ---------- สร้างกริดสามเหลี่ยมด้านเท่า ----------
async function generateGrid() {
  if (!currentFeature) return;

  const metrics = getSpacingMetrics();
  const spacing = metrics.spacing;
  const rowSpacing = metrics.rowSpacing;

  const [clng, clat] = turf.centroid(currentFeature).geometry.coordinates;
  origin = makeOrigin(clat, clng);

  // เว้นระยะจากขอบแปลง: buffer ด้วยค่าลบ (Turf ใช้กิโลเมตร)
  let region = currentFeature;
  const margin = Math.max(0, parseFloat($('margin').value) || 0);
  if (margin > 0) {
    let shrunk = null;
    try { shrunk = turf.buffer(currentFeature, -margin / 1000, { units: 'kilometers' }); } catch (e) {}
    if (!shrunk || !shrunk.geometry) {
      setStatus('ระยะเว้นขอบมากเกินไป ไม่เหลือพื้นที่ปลูก', 'warn');
      return;
    }
    region = shrunk;
  }

  // มุมหมุนของแนวแถว (องศา → เรเดียน)
  const th = Math.max(-90, Math.min(90, parseFloat($('rotation').value) || 0)) * Math.PI / 180;
  const cos = Math.cos(th), sin = Math.sin(th);

  // แปลงจุดยอดเป็นเมตร แล้วหมุนย้อน (-θ) เข้า "กรอบกริด" เพื่อหา bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  turf.coordAll(region).forEach(([lng, lat]) => {
    const [x, y] = toXY(lng, lat);
    const gx =  x * cos + y * sin;
    const gy = -x * sin + y * cos;
    minX = Math.min(minX, gx); maxX = Math.max(maxX, gx);
    minY = Math.min(minY, gy); maxY = Math.max(maxY, gy);
  });

  // ทดสอบ "จุดอยู่ในแปลง" เป็นเมตรด้วยฟังก์ชันของเราเอง (เร็วกว่าเรียก turf ทีละจุดหลายเท่า)
  const polys = regionToXY(region);
  const candidates = ((maxX - minX) / spacing) * ((maxY - minY) / rowSpacing);
  if (candidates > MAX_CANDIDATES) {
    setStatus('พื้นที่ใหญ่เกินไป กรุณาวาดพื้นที่ให้เล็กลง', 'warn');
    return;
  }

  /* -------------------------------------------------------------------
   * วางจุดในกรอบกริด (หน่วยเมตร):
   *   แถวที่ j  → y = j × h          (h = 9 × sin60° = 7.794 ม.)
   *   ต้นที่ i  → x = i × s + offset (s = 9 ม.)
   *   offset    = 0 ถ้า j เป็นเลขคู่ / s/2 ถ้า j เป็นเลขคี่ (แถวเยื้องกันเป็นสามเหลี่ยมด้านเท่า)
   * แล้วหมุนกลับ (+θ) และเก็บเฉพาะจุดที่อยู่ในแปลง
   * ------------------------------------------------------------------- */
  const jMin = Math.floor(minY / rowSpacing) - 1;
  const jMax = Math.ceil(maxY / rowSpacing) + 1;
  const iMin = Math.floor(minX / spacing) - 1;
  const iMax = Math.ceil(maxX / spacing) + 1;

  const pts = [];
  for (let j = jMin; j <= jMax; j++) {
    const offset = (((j % 2) + 2) % 2) * (spacing / 2);
    const gy = j * rowSpacing;
    for (let i = iMin; i <= iMax; i++) {
      const gx = i * spacing + offset;
      if (gx < minX || gx > maxX || gy < minY || gy > maxY) continue;
      const x = gx * cos - gy * sin;             // หมุนกลับ +θ
      const y = gx * sin + gy * cos;
      if (!insidePolys(x, y, polys)) continue;
      pts.push({ x, y });
      if (pts.length > MAX_POINTS) {
        setStatus('จุดปลูกมากเกิน ' + MAX_POINTS.toLocaleString('th-TH') + ' จุด กรุณาวาดพื้นที่ให้เล็กลง', 'warn');
        return;
      }
    }
  }

  if (!pts.length) { setStatus('ไม่พบจุดปลูกในพื้นที่นี้', 'warn'); return; }
  if (pts.length > 5000 &&
      !(await askConfirm('จะสร้าง ' + pts.length.toLocaleString('th-TH') + ' จุด อาจทำให้เครื่องช้า ต้องการดำเนินการต่อหรือไม่?'))) return;

  // ล้างจุดเดิมหลังตรวจสอบทุกเงื่อนไขผ่านแล้วเท่านั้น
  clearGrid();
  lastGeneratedSpacing = spacing;

  // สร้าง Marker (ลากได้) — เหตุการณ์ลาก/คลิกจัดการที่ gridLayer ครั้งเดียว
  const animateTrees = pts.length <= 800 && !prefersReducedMotion();
  pts.forEach((p, index) => {
    const [lng, lat] = toLngLat(p.x, p.y);
    createTreeMarker(lat, lng, false, animateTrees ? Math.round(index * 900 / pts.length) : null);
  });

  rebuildHash();
  updateCount();
  const price = getSeedlingPrice();
  const costText = price !== null ? ' ค่าต้นกล้าประมาณ ' + formatBaht(price * trees.length) : '';
  saveDraft();
  activateCategory('plant');
  if (usesMobileMapUI() && document.body.dataset.mobileView !== 'map') setMobileView('map');
  flowBadCursor = 0;
  fitToPlot();
  setStatus('สร้างจุดปลูกสำเร็จทั้งหมด ' + trees.length.toLocaleString('th-TH') + ' ต้น (ระยะห่าง ' + spacing.toFixed(1) + ' เมตร).' + costText, 'ok');
  showMapToast('สร้างจุดปลูกแล้ว ' + trees.length.toLocaleString('th-TH') + ' ต้น · ลากจุดเพื่อปรับตำแหน่งได้', 'ok', { force: true, ms: 3200 });
  buzz(18);
}

function removeTree(t) {
  gridLayer.removeLayer(t.marker);
  trees = trees.filter(o => o !== t);
  removed.push(t);
  if (removed.length > 100) removed.shift();
  map.closePopup();
  rebuildHash(); updateCount(); recheckAll(); saveDraft();
  showMapToast('ลบต้นแล้ว · เหลือ ' + trees.length.toLocaleString('th-TH') + ' ต้น', 'ok', { label: 'เลิกทำ', onClick: undoRemove, ms: 7000, force: true });
}
function undoRemove() {
  const t = removed.pop();
  if (!t) return;
  hideMapToast();
  t.bad = false;                       // marker ถูกสร้างใหม่ จึงเริ่มเป็นสีเขียว
  gridLayer.addLayer(t.marker);
  trees.push(t);
  rebuildHash(); updateCount(); recheckAll(); saveDraft();
}
function openDeletePopup(t) {
  const div = document.createElement('div');
  div.innerHTML = '<button type="button" class="tree-delete-btn"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg> ลบต้นนี้</button>';
  div.firstChild.onclick = () => removeTree(t);
  delPopup.setLatLng(t.marker.getLatLng()).setContent(div).openOn(map);
}

// เปลี่ยนสีจุดเฉพาะเมื่อสถานะเปลี่ยนจริง (ลดการแตะ DOM)
function setBad(t, bad) {
  if (t.bad === bad) return;
  t.bad = bad;
  const el = t.marker.getElement();
  if (el && el.firstChild) el.firstChild.classList.toggle('bad', bad);
}

// ---------- ตรวจระยะระหว่างจุดขณะลาก (ใช้ tooltip อันเดียวร่วมกัน) ----------
function onDrag(t) {
  const ll = t.marker.getLatLng();
  [t.x, t.y] = toXY(ll.lng, ll.lat);
  const { d, other } = nearestOf(t);
  const bad = !!other && d < lastGeneratedSpacing - TOL;
  setBad(t, bad);
  dragTip.setLatLng(ll);
  if (!map.hasLayer(dragTip)) map.addLayer(dragTip);
  if (!other) {
    dragTip.setContent('ไม่มีต้นข้างเคียงในระยะ ' + (2 * lastGeneratedSpacing).toFixed(0) + ' ม.');
    guideLine.setLatLngs([]);
    return;
  }
  dragTip.setContent('ใกล้สุด ' + d.toFixed(2) + ' ม.' + (bad ? ' · น้อยกว่า ' + lastGeneratedSpacing.toFixed(1) + ' ม.' : ''));
  guideLine.setStyle({ color: bad ? '#ff1744' : '#ffeb3b' });
  guideLine.setLatLngs([ll, other.marker.getLatLng()]);
  if (bad) setStatus('ต้นนี้อยู่ห่างจากต้นข้างเคียงเพียง ' + d.toFixed(2) + ' ม. (ต่ำกว่า ' + lastGeneratedSpacing.toFixed(1) + ' ม.)', 'warn', { toast: false });
  else setStatus('ระยะถึงต้นที่ใกล้ที่สุด ' + d.toFixed(2) + ' ม.', 'ok');
}

// หลังปล่อยเมาส์/ลบ/เลิกทำ ตรวจทุกต้นว่ามีต้นไหนใกล้เกินไปบ้าง (ใช้ spatial hash)
function recheckAll() {
  let n = 0;
  for (const t of trees) {
    const bad = nearestOf(t).d < lastGeneratedSpacing - TOL;
    if (bad) n++;
    setBad(t, bad);
  }
  if (n) setStatus('พบ ' + n + ' ต้นที่อยู่ใกล้กันเกินไป (น้อยกว่า ' + lastGeneratedSpacing.toFixed(1) + ' เมตร) จุดเหล่านี้จะแสดงเป็นสีแดง', 'warn', { toast: false });
  else setStatus('ทุกต้นห่างกันอย่างน้อย ' + lastGeneratedSpacing.toFixed(1) + ' ม. (รวม ' + trees.length.toLocaleString('th-TH') + ' ต้น)', 'ok');
  flowBadCursor = 0;
  updateMapFlow();
}



// ---------- แถบขั้นตอนต่อเนื่อง: วาดแปลง → ดูพื้นที่ → สร้างจุดปลูก → ตรวจจำนวนจริง ----------
function markReportExported() {
  reportExported = true;
  updateMapFlow();
}

function startBoundaryDraw() {
  if (usesMobileMapUI()) startMobileBoundary();
  else document.querySelector('.leaflet-draw-draw-polygon')?.click();
}

function fitToPlot() {
  const layers = drawnItems.getLayers();
  if (!layers.length) return;
  const mobile = usesMobileMapUI();
  map.fitBounds(layers[0].getBounds(), {
    paddingTopLeft: [24, mobile ? 130 : 48],
    paddingBottomRight: [24, mobile ? 210 : 120],
    maxZoom: 19
  });
}

function goToPlotName() {
  if (usesMobileMapUI()) setMobileView('tools');
  setTimeout(() => {
    $('plotName').scrollIntoView({ block: 'center' });
    $('plotName').focus();
  }, 60);
}

function goToReport() {
  if (usesMobileMapUI()) {
    setMobileView('report');
    setStatus('พร้อมส่งออกรายงานแล้ว', 'ok');
  } else {
    $('panel-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('btnPDF').focus({ preventScroll: true });
  }
}

function goToNextBadTree() {
  const bad = trees.filter(t => t.bad);
  if (!bad.length) return;
  flowBadCursor = flowBadCursor % bad.length;
  const target = bad[flowBadCursor++];
  map.flyTo(target.marker.getLatLng(), Math.max(map.getZoom(), 19), { duration: 0.6 });
  setStatus('จุดแดงที่ ' + flowBadCursor + '/' + bad.length + ' · ลากให้ห่างต้นข้างเคียงอย่างน้อย ' + lastGeneratedSpacing.toFixed(1) + ' ม.', 'warn');
}

let flowCollapseTimer = null;
function setFlowExpanded(open, { auto = false } = {}) {
  const card = $('mapFlow'), panel = $('mapFlowPanel'), toggle = $('mapFlowToggle');
  if (!card || !panel || !toggle) return;
  if (flowCollapseTimer) { clearTimeout(flowCollapseTimer); flowCollapseTimer = null; }
  card.classList.toggle('is-collapsed', !open);
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  // เปิดอัตโนมัติชั่วคราวเมื่อขั้นตอนเปลี่ยน แล้วพับเก็บเองเพื่อไม่บังแผนที่
  if (open && auto) flowCollapseTimer = setTimeout(() => setFlowExpanded(false), 6000);
}

function updateMapFlow() {
  const card = $('mapFlow');
  if (!card) return;
  const mobileDrawing = mobileBoundaryMode && mobileBoundaryKind === 'boundary';
  if (mobileBoundaryMode && mobileBoundaryKind === 'measure') { card.hidden = true; return; }
  card.hidden = false;
  const hasBoundary = Boolean(currentFeature);
  const hasTrees = trees.length > 0;
  // หน้าเริ่มต้นที่เป็นมิตร + จุดแจ้งบนแท็บรายงานเมื่อพร้อมส่งออก
  document.body.classList.toggle('is-empty-plot', !hasBoundary && !mobileDrawing && !desktopDrawing);
  const reportTab = $('mapReportShortcut');
  if (reportTab) reportTab.dataset.ready = String(hasTrees && !reportExported);
  const title = $('mapFlowTitle'), detail = $('mapFlowDetail');
  const cta = $('mapFlowCta'), second = $('mapFlowSecondary');
  let stage = 'draw', action = 'draw', current = 0, count = '1/4', short = 'วาดแปลง';
  second.hidden = true;
  cta.hidden = false;
  cta.disabled = false;

  if (mobileDrawing) {
    const n = mobileBoundaryPoints.length;
    short = 'ปักแล้ว ' + n + ' มุม';
    title.textContent = 'วาดขอบเขต · ปักแล้ว ' + n + ' มุม';
    if (n < 3) {
      detail.textContent = 'เลื่อนแผนที่ให้กากบาทตรงมุมแปลง แล้วกด + ปักมุมต่อไป (ครบอย่างน้อย 3 มุมจึงบันทึกได้)';
      cta.textContent = 'ปักต่อ';
      cta.disabled = true;
    } else {
      detail.textContent = 'ปักมุมเพิ่มได้ไม่จำกัด ตามรูปร่างแปลงจริง หรือกดบันทึกเพื่อดูพื้นที่ทันที';
      cta.textContent = 'บันทึก';
    }
    action = 'finish-draw';
  } else if (desktopDrawing) {
    short = 'กำลังวาด';
    title.textContent = 'กำลังวาดขอบเขต';
    detail.textContent = 'คลิกทีละมุมแปลง แล้วคลิกจุดแรกอีกครั้งเพื่อปิดขอบเขต';
    cta.hidden = true;
    action = 'none';
  } else if (!hasBoundary) {
    title.textContent = 'เริ่มจากวาดขอบเขตแปลง';
    detail.textContent = 'ปักมุมแปลงบนแผนที่ ระบบจะคำนวณพื้นที่ให้ทันที';
    cta.textContent = 'เริ่มวาด';
  } else if (!hasTrees) {
    stage = 'area'; current = 1; action = 'generate'; count = '2/4';
    const { rai, ngan, wa } = m2ToThaiArea(currentAreaM2);
    const est = Math.floor(currentAreaM2 / getSpacingMetrics().areaPerTree);
    short = rai + ' ไร่ ' + ngan + ' งาน';
    title.textContent = 'พื้นที่ ' + rai + ' ไร่ ' + ngan + ' งาน ' + wa.toFixed(0) + ' ตร.ว.';
    detail.textContent = 'ประมาณ ' + est.toLocaleString('th-TH') + ' ต้น ที่ระยะ ' + getConfiguredSpacing().toFixed(1) + ' ม.';
    cta.textContent = 'สร้างจุดปลูก';
    second.hidden = false;
  } else if (reportExported && !trees.some(t => t.bad)) {
    stage = 'done'; current = -1; count = 'เสร็จ'; short = 'ส่งออกแล้ว';
    title.textContent = 'ส่งออกรายงานเรียบร้อย';
    detail.textContent = 'จำนวนจริง ' + trees.length.toLocaleString('th-TH') + ' ต้น · แก้ไขจุดแล้วส่งออกใหม่ได้ตลอด';
    cta.textContent = 'ส่งออกอีกครั้ง';
    action = 'report';
  } else {
    stage = 'check'; current = 3; count = '4/4';
    const rai = currentAreaM2 / RAI_M2;
    const density = rai > 0 ? (trees.length / rai).toFixed(1) : '–';
    const est = Math.floor(currentAreaM2 / getSpacingMetrics().areaPerTree);
    const bad = trees.filter(t => t.bad).length;
    const diff = trees.length - est;
    short = trees.length.toLocaleString('th-TH') + ' ต้น' + (bad ? ' · ใกล้เกิน ' + bad : '');
    title.textContent = 'จำนวนจริง ' + trees.length.toLocaleString('th-TH') + ' ต้น · ' + density + ' ต้น/ไร่';
    if (bad) {
      detail.textContent = 'ใกล้กันเกินไป ' + bad.toLocaleString('th-TH') + ' จุด (สีแดง) · ลากแก้ได้บนแผนที่';
      cta.textContent = 'ดูจุดแดง';
      action = 'bad';
    } else {
      detail.textContent = 'ทุกต้นห่างพอ · ต่างจากสูตร ' + (diff >= 0 ? '+' : '') + diff.toLocaleString('th-TH') + ' ต้น (แตะจุดเพื่อลบ/ลากปรับ)';
      if (!($('plotName').value || '').trim()) {
        cta.textContent = 'ตั้งชื่อแปลง';
        action = 'name';
      } else {
        cta.textContent = 'ส่งออกรายงาน';
        action = 'report';
      }
    }
  }
  $('mapFlowCount').textContent = count;
  $('mapFlowShort').textContent = short;
  cta.dataset.action = action;
  card.dataset.stage = stage;
  const drawing = mobileDrawing || desktopDrawing;
  card.querySelectorAll('[data-flow-step]').forEach((step, index) => {
    const doneUpTo = drawing || !hasBoundary ? 0 : !hasTrees ? 1 : stage === 'done' ? 4 : 3;
    const isCurrent = index === (drawing ? 0 : current);
    step.classList.toggle('is-done', index < doneUpTo);
    step.classList.toggle('is-current', isCurrent);
    step.setAttribute('aria-current', isCurrent ? 'step' : 'false');
  });
  if (stage !== flowLastStage) {
    const first = flowLastStage === '';
    flowLastStage = stage;
    card.classList.remove('flow-pop');
    void card.offsetWidth;
    card.classList.add('flow-pop');
    if (!first && !drawing) setFlowExpanded(true, { auto: true });
  }
  if (drawing) setFlowExpanded(false);
}

$('mapFlowToggle')?.addEventListener('click', () => setFlowExpanded($('mapFlowPanel').hidden));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('mapFlowPanel')?.hidden) setFlowExpanded(false);
});
map.on('click movestart', () => { if (!$('mapFlowPanel')?.hidden) setFlowExpanded(false); });
$('mapFlowCta')?.addEventListener('click', () => {
  setFlowExpanded(false);
  switch ($('mapFlowCta').dataset.action) {
    case 'draw': startBoundaryDraw(); break;
    case 'finish-draw': finishMobileBoundary(); break;
    case 'generate': $('btnGenerate').click(); break;
    case 'bad': goToNextBadTree(); break;
    case 'name': goToPlotName(); break;
    case 'report': goToReport(); break;
  }
});
$('mapFlowSecondary')?.addEventListener('click', () => {
  setFlowExpanded(false);
  if (usesMobileMapUI()) setMobileView('tools');
  setTimeout(() => {
    $('panel-settings').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('spacing').focus({ preventScroll: true });
  }, 60);
});
map.on(L.Draw.Event.DRAWSTART, e => { if (e.layerType === 'polygon') { desktopDrawing = true; updateMapFlow(); } });
map.on(L.Draw.Event.DRAWSTOP, () => { desktopDrawing = false; updateMapFlow(); });

// ---------- เหตุการณ์ ----------
if ($('sheetToggle')) $('sheetToggle').addEventListener('click', toggleSheet);
if ($('mobileToolsToggle')) $('mobileToolsToggle').addEventListener('click', () => {
  const collapsed = $('sidebar').classList.contains('is-collapsed');
  setSheetCollapsed(!collapsed);
  $('mobileToolsToggle').setAttribute('aria-expanded', String(collapsed));
});
if ($('mobilePrimaryAction')) $('mobilePrimaryAction').addEventListener('click', () => {
  const action = $('mobilePrimaryAction').dataset.action;
  if (action === 'draw') {
    const drawButton = document.querySelector('.leaflet-draw-draw-polygon');
    if (drawButton) drawButton.click();
    else setStatus('ใช้เครื่องมือรูปหลายเหลี่ยมบนแผนที่เพื่อเริ่มวาดขอบเขต', 'warn');
  } else if (action === 'generate') {
    $('btnGenerate').click();
  } else {
    activateCategory('plant');
    setSheetCollapsed(false);
    $('mobileToolsToggle')?.setAttribute('aria-expanded', 'true');
  }
});
const mapActionMenu = $('mapActionMenu');
const mapActionArea = $('mapActionArea');
const mapActionBackdrop = $('mapActionBackdrop');
const mapPrimaryAction = $('mapPrimaryAction');
let mapActionBackdropTimer = null;
function setMapActionMenuOpen(open, { restoreFocus = false } = {}) {
  if (!mapActionMenu || !mapActionArea || !mapActionBackdrop || !mapPrimaryAction) return;
  if (mapActionBackdropTimer) clearTimeout(mapActionBackdropTimer);
  mapActionArea.classList.toggle('is-open', open);
  mapActionMenu.setAttribute('aria-hidden', String(!open));
  mapActionMenu.inert = !open;
  mapPrimaryAction.setAttribute('aria-expanded', String(open));
  mapPrimaryAction.setAttribute('aria-label', open ? 'ปิดเมนูคำสั่ง' : 'เปิดคำสั่งแผนที่');
  if (open) {
    mapActionMenu.hidden = false;
    mapActionBackdrop.hidden = false;
    requestAnimationFrame(() => {
      if (mapActionArea.classList.contains('is-open')) mapActionBackdrop.classList.add('is-visible');
    });
    requestAnimationFrame(() => {
      if (mapActionArea.classList.contains('is-open')) mapActionMenu.querySelector('button')?.focus({ preventScroll: true });
    });
  } else {
    mapActionBackdrop.classList.remove('is-visible');
    mapActionBackdropTimer = window.setTimeout(() => {
      if (!mapActionArea.classList.contains('is-open')) mapActionBackdrop.hidden = true;
    }, 220);
    if (restoreFocus) mapPrimaryAction.focus({ preventScroll: true });
  }
}
function closeMapActionMenu(options = {}) {
  setMapActionMenuOpen(false, options);
}
if (mapPrimaryAction) mapPrimaryAction.addEventListener('click', () => {
  if (mobileBoundaryMode) {
    addMobileBoundaryPoint();
    return;
  }
  const open = mapPrimaryAction.getAttribute('aria-expanded') !== 'true';
  setMapActionMenuOpen(open);
});
if (mapActionBackdrop) mapActionBackdrop.addEventListener('click', () => closeMapActionMenu({ restoreFocus: true }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mapActionArea?.classList.contains('is-open')) {
    event.preventDefault();
    closeMapActionMenu({ restoreFocus: true });
  }
});
if ($('mapDrawAction')) $('mapDrawAction').addEventListener('click', () => {
  closeMapActionMenu({ restoreFocus: true });
  if (usesMobileMapUI()) startMobileBoundary();
  else document.querySelector('.leaflet-draw-draw-polygon')?.click();
});
if ($('mapMeasureAction')) $('mapMeasureAction').addEventListener('click', () => {
  closeMapActionMenu({ restoreFocus: true });
  if (usesMobileMapUI()) startMobileBoundary('measure');
  else startDesktopMeasure();
});
if ($('mapPlantAction')) $('mapPlantAction').addEventListener('click', () => {
  closeMapActionMenu({ restoreFocus: true });
  if ($('btnGenerate').disabled) {
    setStatus('ยังไม่มีขอบเขตแปลง · เริ่มวาดให้เลย แล้วระบบจะนำไปขั้นตอนสร้างจุดปลูกต่อ', 'ok');
    startBoundaryDraw();
    return;
  }
  $('btnGenerate').click();
});
if ($('mapPlotPinAction')) $('mapPlotPinAction').addEventListener('click', () => {
  closeMapActionMenu({ restoreFocus: true });
  if (usesMobileMapUI()) savePlotLocation(map.getCenter());
  else $('btnPickPlot').click();
});
if ($('mapLocateAction')) $('mapLocateAction').addEventListener('click', () => $('btnLocate').click());
const cameraPhotoMarkers = [];
function clearCameraPhotoMarkers() {
  cameraPhotoMarkers.forEach(({ marker, imageUrl }) => {
    map.removeLayer(marker);
    URL.revokeObjectURL(imageUrl);
  });
  cameraPhotoMarkers.length = 0;
}
if ($('mapCameraAction')) $('mapCameraAction').addEventListener('click', () => {
  closeMapActionMenu();
  closeMapLayerSheet();
  $('mapCameraInput')?.click();
});
if ($('mapCameraInput')) $('mapCameraInput').addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) {
    setStatus('กรุณาเลือกไฟล์ภาพจากกล้องหรืออุปกรณ์', 'warn');
    return;
  }
  const imageUrl = URL.createObjectURL(file);
  const center = map.getCenter();
  const popup = document.createElement('div');
  popup.className = 'camera-photo-popup';
  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = 'ภาพภาคสนามที่ถ่ายไว้';
  const caption = document.createElement('p');
  caption.textContent = (file.name || 'ภาพภาคสนาม') + ' · ' + center.lat.toFixed(6) + ', ' + center.lng.toFixed(6);
  popup.append(image, caption);
  const marker = L.marker(center, {
    title: 'ภาพภาคสนาม',
    icon: L.divIcon({
      className: 'camera-photo-icon',
      html: '<svg class="ic" aria-hidden="true"><use href="#i-camera"/></svg>',
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    })
  }).addTo(map);
  marker.bindPopup(popup, { maxWidth: 270 }).openPopup();
  cameraPhotoMarkers.push({ marker, imageUrl, fileName: file.name || 'ภาพภาคสนาม' });
  setStatus('ปักหมุดภาพไว้ที่กึ่งกลางแผนที่แล้ว · ภาพอยู่ชั่วคราวในหน้านี้และไม่ถูกอัปโหลด', 'ok');
});
function closeMapLayerSheet() {
  if ($('mapLayerSheet')) $('mapLayerSheet').hidden = true;
  if ($('mapLayerScrim')) $('mapLayerScrim').hidden = true;
  $('mapLayersAction')?.setAttribute('aria-expanded', 'false');
}
if ($('mapLayersAction')) $('mapLayersAction').addEventListener('click', () => {
  closeMapActionMenu();
  const open = $('mapLayerSheet').hidden;
  $('mapLayerSheet').hidden = !open;
  $('mapLayerScrim').hidden = !open;
  $('mapLayersAction').setAttribute('aria-expanded', String(open));
});
$('mapLayerClose')?.addEventListener('click', closeMapLayerSheet);
$('mapLayerScrim')?.addEventListener('click', closeMapLayerSheet);
function setMobileMapLayer(name) {
  [esriImagery, osm, esriLabels].forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
  if (name === 'road') map.addLayer(osm);
  else {
    map.addLayer(esriImagery);
    if (name === 'hybrid') map.addLayer(esriLabels);
  }
  document.querySelectorAll('[data-map-layer]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapLayer === name)));
  closeMapLayerSheet();
}
document.querySelectorAll('[data-map-layer]').forEach(button => button.addEventListener('click', () => setMobileMapLayer(button.dataset.mapLayer)));
if ($('mapBoundaryUndo')) $('mapBoundaryUndo').addEventListener('click', undoMobileBoundaryPoint);
if ($('mapBoundaryFinish')) $('mapBoundaryFinish').addEventListener('click', () => {
  finishMobileBoundary();
  mapPrimaryAction?.focus({ preventScroll: true });
});
if ($('mapBoundaryCancel')) $('mapBoundaryCancel').addEventListener('click', () => { stopMobileBoundary(); setStatus('ยกเลิกการวาดขอบเขตแล้ว'); });
function setMobileView(view) {
  if (!['map', 'tools', 'report'].includes(view)) return;
  document.body.dataset.mobileView = view;
  document.querySelectorAll('[data-mobile-view]').forEach(button => {
    if (button.dataset.mobileView === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  closeMapActionMenu();
  if (view !== 'map') hideMapToast();
  if (mobileBoundaryMode && view !== 'map') stopMobileBoundary();
  if (view === 'map') setTimeout(() => map.invalidateSize({ animate: false }), 80);
  if (view === 'tools') setTimeout(() => $('sidebarContent').scrollTo({ top: 0 }), 0);
}
if ($('mapHomeShortcut')) $('mapHomeShortcut').addEventListener('click', () => setMobileView('map'));
if ($('mapToolsShortcut')) $('mapToolsShortcut').addEventListener('click', () => setMobileView('tools'));
if ($('mapReportShortcut')) $('mapReportShortcut').addEventListener('click', () => setMobileView('report'));
if (usesMobileMapUI()) setMobileView('map');
map.on('move', updateMobileMeasurePreview);
map.on('zoomend', updateMobileMeasurePreview);
document.addEventListener('click', event => {
  if (mapActionArea?.classList.contains('is-open') && !event.target.closest('.map-action-area')) closeMapActionMenu();
});
if (window.matchMedia('(max-width: 720px), (orientation: landscape) and (max-width: 900px)').matches) {
  try {
    const savedSheetState = localStorage.getItem(SHEET_KEY);
    if (savedSheetState === '1' || savedSheetState === null) setSheetCollapsed(true);
  }
  catch (error) { setStorageStatus('เบราว์เซอร์ปิดกั้นการจำสถานะแผงเครื่องมือ'); }
  map.on('click', () => {
    if (!pickingPlotLocation && !$('sidebar').classList.contains('is-collapsed')) setSheetCollapsed(true);
  });
  map.on(L.Draw.Event.DRAWSTART, () => setSheetCollapsed(true));
  map.on(L.Draw.Event.CREATED, () => setSheetCollapsed(false));
}
document.addEventListener('click', event => {
  const control = event.target.closest('.leaflet-draw-edit-edit, .leaflet-draw-edit-remove');
  if (!control || !trees.length) return;
  const editing = control.matches('.leaflet-draw-edit-edit');
  const mode = editing ? map._toolbars?.edit?._modes?.edit?.handler : map._toolbars?.edit?._modes?.remove?.handler;
  if (mode?.enabled()) return;
  const message = editing
    ? 'การแก้ไขขอบเขตและกดบันทึกจะล้างจุดปลูกเดิม รวมถึงจุดที่ลากปรับไว้ ต้องการเข้าโหมดแก้ไขหรือไม่?'
    : 'การลบขอบเขตจะล้างจุดปลูกทั้งหมด รวมถึงจุดที่ลากปรับไว้ ต้องการเข้าโหมดลบหรือไม่?';
  if (boundaryEditApproved) { boundaryEditApproved = false; return; }
  event.preventDefault();
  event.stopImmediatePropagation();
  askConfirm(message, { danger: true }).then(ok => {
    if (ok) { boundaryEditApproved = true; control.click(); }
    else setStatus('ยกเลิกการเปลี่ยนขอบเขตแล้ว; จุดปลูกเดิมยังอยู่', 'ok');
  });
}, true);
map.on('click', e => {
  if (pickingPlotLocation) savePlotLocation(e.latlng);
});
map.on(L.Draw.Event.CREATED, async e => {
  if (e.layerType === 'polyline') {
    const points = e.layer.getLatLngs();
    const distance = points.slice(1).reduce((sum, point, index) => sum + map.distance(points[index], point), 0);
    desktopMeasureLayer = e.layer.addTo(map);
    desktopMeasureHandler = null;
    lastMeasuredDistance = distance;
    desktopMeasureLayer.bindTooltip('ระยะรวม ' + formatMapDistance(distance), {
      permanent: true, direction: 'center', className: 'boundary-distance-icon'
    }).openTooltip();
    updateMapSummary();
    setStatus('วัดระยะได้ ' + formatMapDistance(distance) + ' · แนววัดนี้ไม่เปลี่ยนขอบเขตแปลง', 'ok');
    return;
  }
  if (trees.length && !e.confirmed && !(await askConfirm(CONFIRM_NEW_BOUNDARY, { danger: true }))) {
    setStatus('ยกเลิกการวาดขอบเขตใหม่แล้ว; แปลงและจุดปลูกเดิมยังอยู่', 'ok');
    return;
  }
  if (desktopMeasureLayer) map.removeLayer(desktopMeasureLayer);
  desktopMeasureLayer = null;
  if (desktopMeasureHandler?.enabled()) desktopMeasureHandler.disable();
  desktopMeasureHandler = null;
  lastMeasuredDistance = null;
  drawnItems.clearLayers();          // จำกัดให้มี 1 Polygon
  clearGrid();
  drawnItems.addLayer(e.layer);
  updateArea();
  saveDraft();
  fitToPlot();
  const areaText = m2ToThaiArea(currentAreaM2);
  let crossing = false;
  try { crossing = turf.kinks(currentFeature).features.length > 0; } catch (error) { crossing = false; }
  if (crossing) setStatus('เส้นขอบตัดกันเอง พื้นที่อาจคลาดเคลื่อน · ตรวจลำดับมุม หรือวาดใหม่ก่อนสร้างจุดปลูก', 'warn');
  else setStatus('พื้นที่ ' + areaText.rai + ' ไร่ ' + areaText.ngan + ' งาน · กด "สร้างจุดปลูก" ได้เลย', 'ok');
});
map.on(L.Draw.Event.EDITED, () => {
  clearGrid(); updateArea();
  saveDraft();
  setStatus('แก้ไขขอบเขตแล้ว กรุณากด "สร้างจุดปลูกปาล์ม" ใหม่');
});
map.on(L.Draw.Event.DELETED, () => {
  clearGrid(); updateArea();
  saveDraft();
  setStatus('ลบขอบเขตแล้ว วาด Polygon ใหม่ได้เลย');
});

// [แก้ไข 2] เพิ่ม confirm ก่อนสร้างจุดปลูก (ถ้ากดยกเลิกจะไม่ทำงาน)
$('btnGenerate').addEventListener('click', async () => {
  if (trees.length && !(await askConfirm('มีจุดปลูกเดิมอยู่แล้ว การสร้างใหม่จะแทนที่จุดที่คุณปรับไว้ ต้องการดำเนินการต่อหรือไม่?'))) return;
  await generateGrid();
});
// [แก้ไข 2] เพิ่ม confirm ก่อนล้างทั้งหมด (ถ้ากดยกเลิกให้ยกเลิกการล้าง)
$('btnClear').addEventListener('click', async () => {
  if ((drawnItems.getLayers().length || trees.length || cameraPhotoMarkers.length) && !(await askConfirm('คุณแน่ใจหรือไม่ที่จะล้างพื้นที่ จุดปลูก และหมุดภาพทั้งหมด? ข้อมูลจะหายไปและกู้คืนไม่ได้'))) return;
  drawnItems.clearLayers(); clearGrid();
  clearCameraPhotoMarkers();
  plotLocation = null;
  plotAddress = null;
  pickingPlotLocation = false;
  $('map').classList.remove('is-picking-plot');
  if (plotLocationMarker) {
    map.removeLayer(plotLocationMarker);
    plotLocationMarker = null;
  }
  setLabel($('btnPickPlot'), 'ชี้ตำแหน่งกึ่งกลางแปลง');
  updateLocationLabel();
  updateArea();
  try {
    localStorage.removeItem(STORAGE_KEY);
    setStorageStatus('ล้างข้อมูลที่บันทึกไว้ในอุปกรณ์แล้ว');
  } catch (error) {
    setStorageStatus('ล้างข้อมูลบนแผนที่แล้ว แต่เบราว์เซอร์ปิดกั้นการลบข้อมูลที่บันทึกในเครื่อง');
  }
  setStatus('ล้างข้อมูลแล้ว');
});
$('btnCenter').addEventListener('click', () => {
  if (userLocation) map.setView([userLocation.lat, userLocation.lng], 16);
  else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
});

// ---------- เลิกทำการลบ / ลบด้วยการแตะ / เหตุการณ์ของจุดปลูก (ใช้ event ของกลุ่มแทนผูกทีละจุด) ----------
$('btnUndo').addEventListener('click', undoRemove);
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undoRemove(); }
});
gridLayer.on('drag',        e => onDrag(e.layer._tree));
gridLayer.on('dragend',     () => { map.removeLayer(dragTip); guideLine.setLatLngs([]); rebuildHash(); recheckAll(); saveDraft(); });
gridLayer.on('click',       e => openDeletePopup(e.layer._tree));   // แตะ/คลิก → ปุ่มลบ (ใช้บนมือถือได้)
gridLayer.on('contextmenu', e => removeTree(e.layer._tree));        // คลิกขวา → ลบทันที

// [แก้ไข 3] แปลข้อความ Tooltip ของปุ่มเครื่องมือวาด (Leaflet.draw) เป็นภาษาไทย
map.whenReady(() => {
  const setTitle = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) {
      el.title = text;
      el.setAttribute('aria-label', text);
    }
  };
  setTitle('.leaflet-draw-draw-polygon', 'วาดขอบเขตพื้นที่ (คลิกเพื่อเริ่ม)');
  setTitle('.leaflet-draw-edit-edit',    'แก้ไขขอบเขตพื้นที่ (ลากจุดมุม)');
  setTitle('.leaflet-draw-edit-remove',  'ลบขอบเขตพื้นที่');
  document.querySelectorAll('.leaflet-draw-actions a').forEach(action => {
    const text = action.textContent.trim();
    const labels = { '✓': 'เสร็จสิ้นการวาด', '↶': 'ลบจุดล่าสุด', '✕': 'ยกเลิกการวาด', '⌫': 'ลบพื้นที่ทั้งหมด' };
    const label = labels[text];
    if (label) {
      action.title = label;
      action.setAttribute('aria-label', label);
    }
  });
});

// กู้คืนข้อมูลล่าสุดหลังประกาศ event และฟังก์ชันทั้งหมดแล้ว
restoreDraft();
updateSpacingSummary();
updateWorkflow();
updateCount();   // ให้ข้อความช่วยเหลือหน้ารายงานและสถานะปุ่มถูกต้องตั้งแต่เปิดแอป
