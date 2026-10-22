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
  { maxZoom: 19, attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' });
const esriLabels = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Labels &copy; Esri' });
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
    polygon: { allowIntersection: false, showArea: false, shapeOptions: PLOT_BOUNDARY_STYLE },
    polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
  },
  edit: { featureGroup: drawnItems }
}));

// ---------- องค์ประกอบ UI ----------
const $ = id => document.getElementById(id);
const statusEl = $('status');
function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = cls || ''; }

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
  if (el) el.textContent = '🔵 ตำแหน่งมือถือ: ' + (userLocation ? formatUserAddress(userAddress) : 'ยังไม่ได้อนุญาต');
  const plotEl = $('plotLocationStatus');
  if (plotEl) plotEl.textContent = '🟠 ตำแหน่งแปลง: ' + (plotLocation ? formatUserAddress(plotAddress) : 'ยังไม่ได้ชี้บนแผนที่');
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
    reverseGeocode(userLocation.lat, userLocation.lng);
    setStatus('ได้รับตำแหน่งแล้ว กรุณาวาดขอบเขตแปลงของคุณ');
    if (button) {
      button.disabled = false;
      button.textContent = '📍 ดึงตำแหน่งของฉันอีกครั้ง';
    }
  }, error => {
    userLocation = null;
    userAddress = null;
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
      userLocationMarker = null;
    }
    updateLocationLabel();
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
      button.textContent = '📍 อนุญาตและใช้ตำแหน่งของฉัน';
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
  if (plotLocationMarker) map.removeLayer(plotLocationMarker);
  plotLocationMarker = L.marker([latlng.lat, latlng.lng], {
    icon: L.divIcon({ className: 'plot-center-marker', html: '📌', iconSize: [30, 30], iconAnchor: [15, 30] })
  }).bindTooltip('กึ่งกลางแปลง', { direction: 'top', offset: [0, -24] }).addTo(map);
  pickingPlotLocation = false;
  $('map').classList.remove('is-picking-plot');
  $('btnPickPlot').textContent = '📌 ชี้ตำแหน่งกึ่งกลางแปลงอีกครั้ง';
  plotAddress = null;
  updateLocationLabel();
  reverseGeocode(plotLocation.lat, plotLocation.lng, 'plot');
  setStatus('บันทึกตำแหน่งกึ่งกลางแปลงแล้ว', 'ok');
}

$('btnLocate').addEventListener('click', requestUserLocation);
$('btnPickPlot').addEventListener('click', beginPickPlotLocation);
$('plotName').addEventListener('input', updateCount);
$('seedlingPrice').addEventListener('input', updateSeedlingCost);
$('spacing').addEventListener('change', () => {
  const value = getConfiguredSpacing();
  $('spacing').value = value;
  if (trees.length && value !== lastGeneratedSpacing) {
    if (!confirm('การเปลี่ยนระยะห่างจะล้างจุดปลูกเดิม เพื่อสร้างกริดใหม่ ต้องการดำเนินการต่อหรือไม่?')) {
      $('spacing').value = lastGeneratedSpacing;
      updateSpacingSummary();
      return;
    }
    clearGrid();
  }
  updateSpacingSummary();
  setStatus('ตั้งระยะห่างระหว่างต้นเป็น ' + value.toFixed(1) + ' เมตรแล้ว กรุณากดสร้างจุดปลูก', 'ok');
});

$('treePerRai').textContent = TREES_PER_RAI.toFixed(2) + ' (ปลูกได้ ' + Math.floor(TREES_PER_RAI) + ')';
$('rowSpacing').textContent = ROW_SPACING.toFixed(3) + ' ม.';

// ---------- ตัวแปรสถานะ ----------
let currentFeature = null;   // GeoJSON Feature ของ Polygon ที่วาด
let currentAreaM2 = 0;       // พื้นที่ (ตร.ม.)
let origin = null;           // {lng0, lat0, mLng, mLat} สำหรับแปลงองศา <-> เมตร
let trees = [];              // [{marker, x, y}]  x,y เป็นเมตรในระบบพิกัดท้องถิ่น
let hash = new Map();        // Spatial hash สำหรับหาเพื่อนบ้านเร็ว ๆ
let lastGeneratedSpacing = SPACING;

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
  $('btnGeoJSON').disabled = !has;
  $('btnCSV').disabled = !has;
  $('btnPDF').disabled = !has || !hasPlotName;
  $('btnPrint').disabled = !has || !hasPlotName;
  $('btnUndo').disabled = !removed.length;
  updateSeedlingCost();
}

function updateArea() {
  const layers = drawnItems.getLayers();
  if (!layers.length) {
    currentFeature = null; currentAreaM2 = 0;
    ['areaM2', 'areaRai', 'areaNgan', 'areaWa', 'treeEst'].forEach(id => $(id).textContent = '–');
    $('btnGenerate').disabled = true;
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
function generateGrid() {
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
      !confirm('จะสร้าง ' + pts.length.toLocaleString('th-TH') + ' จุด อาจทำให้เครื่องช้า ต้องการดำเนินการต่อหรือไม่?')) return;

  // ล้างจุดเดิมหลังตรวจสอบทุกเงื่อนไขผ่านแล้วเท่านั้น
  clearGrid();
  lastGeneratedSpacing = spacing;

  // สร้าง Marker (ลากได้) — เหตุการณ์ลาก/คลิกจัดการที่ gridLayer ครั้งเดียว
  const icon = L.divIcon({ className: '', html: '<div class="tree-dot"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
  pts.forEach(p => {
    const [lng, lat] = toLngLat(p.x, p.y);
    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(gridLayer);
    const t = { marker, x: p.x, y: p.y, bad: false };
    marker._tree = t;
    trees.push(t);
  });

  rebuildHash();
  updateCount();
  const price = getSeedlingPrice();
  const costText = price !== null ? ' ค่าต้นกล้าประมาณ ' + formatBaht(price * trees.length) : '';
  setStatus('✅ สร้างจุดปลูกสำเร็จทั้งหมด ' + trees.length.toLocaleString('th-TH') + ' ต้น (ระยะห่าง ' + spacing.toFixed(1) + ' เมตร).' + costText, 'ok');
}

function removeTree(t) {
  gridLayer.removeLayer(t.marker);
  trees = trees.filter(o => o !== t);
  removed.push(t);
  if (removed.length > 100) removed.shift();
  map.closePopup();
  rebuildHash(); updateCount(); recheckAll();
}
function undoRemove() {
  const t = removed.pop();
  if (!t) return;
  t.bad = false;                       // marker ถูกสร้างใหม่ จึงเริ่มเป็นสีเขียว
  gridLayer.addLayer(t.marker);
  trees.push(t);
  rebuildHash(); updateCount(); recheckAll();
}
function openDeletePopup(t) {
  const div = document.createElement('div');
  div.innerHTML = '<button type="button" style="margin:0;padding:6px 12px">🗑 ลบต้นนี้</button>';
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
    dragTip.setContent('ไม่มีต้นข้างเคียงในระยะ 18 ม.');
    guideLine.setLatLngs([]);
    return;
  }
  dragTip.setContent('ใกล้สุด ' + d.toFixed(2) + ' ม.' + (bad ? ' ⚠ น้อยกว่า 9 ม.!' : ' ✓'));
  guideLine.setStyle({ color: bad ? '#ff1744' : '#ffeb3b' });
  guideLine.setLatLngs([ll, other.marker.getLatLng()]);
  if (bad) setStatus('⚠ ต้นนี้อยู่ห่างจากต้นข้างเคียงเพียง ' + d.toFixed(2) + ' ม. (ต่ำกว่า 9 ม.)', 'warn');
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
  if (n) setStatus('⚠️ พบ ' + n + ' ต้นที่อยู่ใกล้กันเกินไป (น้อยกว่า 9 เมตร) จุดเหล่านี้จะแสดงเป็นสีแดง', 'warn');
  else setStatus('ทุกต้นห่างกันอย่างน้อย 9 ม. (รวม ' + trees.length.toLocaleString('th-TH') + ' ต้น)', 'ok');
}


// ---------- เหตุการณ์ ----------
map.on('click', e => {
  if (pickingPlotLocation) savePlotLocation(e.latlng);
});
map.on(L.Draw.Event.CREATED, e => {
  drawnItems.clearLayers();          // จำกัดให้มี 1 Polygon
  clearGrid();
  drawnItems.addLayer(e.layer);
  updateArea();
  setStatus('กดปุ่ม "🌴 สร้างจุดปลูกปาล์ม" เพื่อสร้างจุดปลูก');
});
map.on(L.Draw.Event.EDITED, () => {
  clearGrid(); updateArea();
  setStatus('แก้ไขขอบเขตแล้ว กรุณากด "🌴 สร้างจุดปลูกปาล์ม" ใหม่');
});
map.on(L.Draw.Event.DELETED, () => {
  clearGrid(); updateArea();
  setStatus('ลบขอบเขตแล้ว วาด Polygon ใหม่ได้เลย');
});

// [แก้ไข 2] เพิ่ม confirm ก่อนสร้างจุดปลูก (ถ้ากดยกเลิกจะไม่ทำงาน)
$('btnGenerate').addEventListener('click', () => {
  if (trees.length && !confirm('มีจุดปลูกเดิมอยู่แล้ว การสร้างใหม่จะแทนที่จุดที่คุณปรับไว้ ต้องการดำเนินการต่อหรือไม่?')) return;
  generateGrid();
});
// [แก้ไข 2] เพิ่ม confirm ก่อนล้างทั้งหมด (ถ้ากดยกเลิกให้ยกเลิกการล้าง)
$('btnClear').addEventListener('click', () => {
  if ((drawnItems.getLayers().length || trees.length) && !confirm('⚠️ คุณแน่ใจหรือไม่ที่จะล้างพื้นที่และจุดปลูกทั้งหมด? ข้อมูลจะหายไปและกู้คืนไม่ได้')) return;
  drawnItems.clearLayers(); clearGrid();
  plotLocation = null;
  plotAddress = null;
  pickingPlotLocation = false;
  $('map').classList.remove('is-picking-plot');
  if (plotLocationMarker) {
    map.removeLayer(plotLocationMarker);
    plotLocationMarker = null;
  }
  $('btnPickPlot').textContent = '📌 ชี้ตำแหน่งกึ่งกลางแปลง';
  updateLocationLabel();
  updateArea();
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
gridLayer.on('dragend',     () => { map.removeLayer(dragTip); guideLine.setLatLngs([]); rebuildHash(); recheckAll(); });
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
