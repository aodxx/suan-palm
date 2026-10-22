// ---------- ส่งออกไฟล์ ----------
function download(name, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function currentPoints() {
  return trees.map((t, i) => {
    const ll = t.marker.getLatLng();
    return { id: i + 1, lat: ll.lat, lng: ll.lng };
  });
}

function csvCell(value) {
  return '"' + String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

// [เพิ่ม] สร้างข้อมูลส่วนหัวร่วมสำหรับไฟล์ดาวน์โหลดทุกประเภท
function exportLocation() {
  if (plotLocation) return plotLocation;
  if (currentFeature) {
    const center = turf.centroid(currentFeature).geometry.coordinates;
    return { lat: center[1], lng: center[0] };
  }
  return null;
}

function exportMetadata() {
  const location = exportLocation();
  const seedlingPrice = getSeedlingPrice();
  const spacing = getSpacingMetrics(lastGeneratedSpacing);
  return {
    plotName: ($('plotName').value || '').trim() || 'ไม่ได้ระบุ',
    address: plotLocation ? formatUserAddress(plotAddress) : (userLocation ? formatUserAddress(userAddress) : 'ไม่ทราบตำแหน่ง'),
    location,
    plotLocation,
    plotAddress,
    userLocation,
    userAddress,
    postcode: userAddress && userAddress.postcode ? userAddress.postcode : '',
    seedlingPrice,
    seedlingTotal: seedlingPrice !== null ? seedlingPrice * trees.length : null,
    spacing: spacing.spacing,
    rowSpacing: spacing.rowSpacing,
    treesPerRai: spacing.treesPerRai,
    createdAt: new Date().toLocaleDateString('th-TH', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  };
}

function requirePlotName(actionText) {
  const input = $('plotName');
  const name = input ? input.value.trim() : '';
  if (name) return name;
  if (input) {
    input.focus();
    if (input.reportValidity) input.reportValidity();
  }
  setStatus('กรุณากรอกชื่อแปลง/เจ้าของแปลงก่อน' + actionText, 'warn');
  return null;
}

$('btnGeoJSON').addEventListener('click', () => {
  const metadata = exportMetadata();
  const fc = turf.featureCollection(currentPoints().map(p =>
    turf.point([p.lng, p.lat], { id: p.id })));
  fc.properties = {
    แปลง: metadata.plotName,
    ตำแหน่ง: metadata.address,
    พิกัด: metadata.location ? [metadata.location.lat, metadata.location.lng] : null,
    พิกัดตำแหน่งแปลง: metadata.plotLocation ? [metadata.plotLocation.lat, metadata.plotLocation.lng] : null,
    พิกัดมือถือ: metadata.userLocation ? [metadata.userLocation.lat, metadata.userLocation.lng] : null,
    รหัสไปรษณีย์: metadata.postcode,
    ราคาต้นกล้าต่อต้นบาท: metadata.seedlingPrice,
    ค่าต้นกล้ารวมบาท: metadata.seedlingTotal,
    ระยะห่างระหว่างต้นเมตร: metadata.spacing,
    ระยะห่างระหว่างแถวเมตร: metadata.rowSpacing,
    วันที่สร้าง: metadata.createdAt
  };
  download('palm-plan.geojson', 'application/geo+json', JSON.stringify(fc, null, 2));
});
$('btnCSV').addEventListener('click', () => {
  const metadata = exportMetadata();
  const coordinate = metadata.location ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6) : 'ไม่ทราบ';
  const header = [
    '# แปลง: ' + csvCell(metadata.plotName),
    '# ตำแหน่ง: ' + csvCell(metadata.address),
    '# พิกัดแปลง: ' + csvCell(coordinate),
    '# พิกัดมือถือ: ' + csvCell(metadata.userLocation ? metadata.userLocation.lat.toFixed(6) + ', ' + metadata.userLocation.lng.toFixed(6) : 'ไม่ได้อนุญาต'),
    '# รหัสไปรษณีย์: ' + csvCell(metadata.postcode || 'ไม่ระบุ'),
    '# ราคาต้นกล้า/ต้น: ' + csvCell(metadata.seedlingPrice !== null ? formatBaht(metadata.seedlingPrice) : 'ไม่ระบุ'),
    '# ค่าต้นกล้ารวม: ' + csvCell(metadata.seedlingTotal !== null ? formatBaht(metadata.seedlingTotal) : 'ไม่ระบุ'),
    '# ระยะห่างระหว่างต้น: ' + csvCell(metadata.spacing.toFixed(1) + ' เมตร'),
    '# ระยะห่างระหว่างแถว: ' + csvCell(metadata.rowSpacing.toFixed(3) + ' เมตร'),
    '# วันที่สร้าง: ' + csvCell(metadata.createdAt)
  ];
  const rows = ['id,lat,lng'].concat(currentPoints().map(p =>
    p.id + ',' + p.lat.toFixed(8) + ',' + p.lng.toFixed(8)));
  download('palm-plan.csv', 'text/csv;charset=utf-8', '﻿' + header.concat(rows).join('\n'));
});

// ---------- ส่งออก PDF (เพิ่มในขั้นตอน Export PDF) ----------
function waitForMapTiles() {
  const images = Array.from(document.querySelectorAll('#map .leaflet-tile'));
  return Promise.all(images.map(img => new Promise(resolve => {
    if (img.complete) { resolve(); return; }
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 5000);
  }))).then(() => new Promise(resolve => setTimeout(resolve, 350)));
}

async function renderPdfElement(element) {
  document.body.appendChild(element);
  try {
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(images.map(image => new Promise(resolve => {
      if (image.complete) { resolve(); return; }
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 5000);
    })));
    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false
    });
  } finally {
    element.remove();
  }
}

function createPdfPage(content) {
  const page = document.createElement('div');
  page.style.cssText = [
    'position:absolute', 'left:-10000px', 'top:0', 'width:794px',
    'min-height:1123px', 'padding:42px', 'background:#ffffff',
    'color:#1f2937', 'font-family:Arial,"Noto Sans Thai","Sarabun",sans-serif',
    'box-sizing:border-box'
  ].join(';');
  page.appendChild(content);
  return page;
}

function pdfText(text, style) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = style;
  return el;
}

function createMapReportPage(mapCanvas, metadata) {
  const content = document.createElement('div');
  content.appendChild(pdfText('แผนที่วางแผนปลูกปาล์ม', 'font-size:30px;font-weight:700;color:#1b5e20;margin-bottom:12px'));
  content.appendChild(pdfText('แปลง: ' + metadata.plotName, 'font-size:20px;margin-bottom:6px'));
  content.appendChild(pdfText('ตำแหน่ง: ' + metadata.address, 'font-size:16px;color:#4b5563;margin-bottom:4px'));
  content.appendChild(pdfText('พิกัด: ' + (metadata.location ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6) : 'ไม่ทราบ'), 'font-size:16px;color:#4b5563;margin-bottom:4px'));
  content.appendChild(pdfText('วันที่สร้าง: ' + metadata.createdAt, 'font-size:16px;color:#4b5563;margin-bottom:20px'));

  const image = document.createElement('img');
  image.src = mapCanvas.toDataURL('image/png');
  image.style.cssText = 'display:block;width:100%;height:auto;border:1px solid #cbd5e1;object-fit:contain';
  content.appendChild(image);
  content.appendChild(pdfText('แผนที่และจุดปลูกสร้างจากข้อมูลในเบราว์เซอร์ของผู้ใช้', 'font-size:13px;color:#6b7280;margin-top:12px'));
  return createPdfPage(content);
}

function createSummaryReportPage(metadata) {
  const content = document.createElement('div');
  content.appendChild(pdfText('สรุปข้อมูลการวางแผนปลูกปาล์ม', 'font-size:30px;font-weight:700;color:#1b5e20;margin-bottom:12px'));
  content.appendChild(pdfText('แปลง: ' + metadata.plotName, 'font-size:20px;margin-bottom:6px'));
  content.appendChild(pdfText('ตำแหน่ง: ' + metadata.address, 'font-size:16px;color:#4b5563;margin-bottom:4px'));
  content.appendChild(pdfText('วันที่สร้าง: ' + metadata.createdAt, 'font-size:16px;color:#4b5563;margin-bottom:24px'));

  const area = m2ToThaiArea(currentAreaM2);
  const rows = [
    ['พื้นที่ (ตารางเมตร)', currentAreaM2.toLocaleString('th-TH', { maximumFractionDigits: 1 })],
    ['พื้นที่ (ไร่)', String(area.rai)],
    ['พื้นที่ (งาน)', String(area.ngan)],
    ['พื้นที่ (ตารางวา)', area.wa.toFixed(2)],
    ['จำนวนต้นทั้งหมด', trees.length.toLocaleString('th-TH') + ' ต้น'],
    ['จำนวนต้นต่อไร่ (จริง)', (currentAreaM2 > 0 ? (trees.length / (currentAreaM2 / RAI_M2)).toFixed(2) : '–')],
    ['จำนวนต้นต่อไร่ (ทฤษฎี)', metadata.treesPerRai.toFixed(2) + ' (ปลูกได้ ' + Math.floor(metadata.treesPerRai) + ')'],
    ['ระยะห่างระหว่างต้น', metadata.spacing.toFixed(1) + ' เมตร'],
    ['ระยะห่างระหว่างแถว', metadata.rowSpacing.toFixed(3) + ' เมตร'],
    ['พิกัดที่ใช้ส่งออก', metadata.location ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6) : 'ไม่ทราบ']
  ];

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:19px';
  rows.forEach(([label, value], index) => {
    const tr = document.createElement('tr');
    tr.style.background = index % 2 ? '#f0f7f0' : '#ffffff';
    [label, value].forEach((text, cellIndex) => {
      const td = document.createElement('td');
      td.textContent = text;
      td.style.cssText = 'padding:15px 16px;border:1px solid #cbd5e1;' + (cellIndex ? 'text-align:right;font-weight:700' : 'font-weight:600');
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  content.appendChild(table);
  content.appendChild(pdfText('หมายเหตุ: ข้อมูลนี้เป็นผลคำนวณจากจุดปลูกที่สร้างและปรับตำแหน่งล่าสุด', 'font-size:14px;color:#6b7280;margin-top:22px'));
  return createPdfPage(content);
}

function safePdfName(value) {
  return (value || 'ไม่มีชื่อแปลง').replace(/[\\/:*?"<>|\n\r]+/g, '-').trim().slice(0, 80) || 'ไม่มีชื่อแปลง';
}

// ฝังฟอนต์ Sarabun ลงใน PDF โดยตรง เพื่อให้ภาษาไทยแสดงผลได้สม่ำเสมอบนมือถือ
let pdfFontPromise = null;
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadPdfFonts(pdf) {
  if (!pdfFontPromise) {
    pdfFontPromise = Promise.all([
      fetch('assets/fonts/Sarabun-Regular.ttf').then(response => {
        if (!response.ok) throw new Error('โหลด Sarabun Regular ไม่สำเร็จ');
        return response.arrayBuffer();
      }),
      fetch('assets/fonts/Sarabun-Bold.ttf').then(response => {
        if (!response.ok) throw new Error('โหลด Sarabun Bold ไม่สำเร็จ');
        return response.arrayBuffer();
      })
    ]).then(([regular, bold]) => ({
      regular: arrayBufferToBase64(regular),
      bold: arrayBufferToBase64(bold)
    }));
  }
  const fonts = await pdfFontPromise;
  pdf.addFileToVFS('Sarabun-Regular.ttf', fonts.regular);
  pdf.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  pdf.addFileToVFS('Sarabun-Bold.ttf', fonts.bold);
  pdf.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  pdf.setFont('Sarabun', 'normal');
}

function drawPdfText(pdf, text, x, y, options = {}) {
  const size = options.size || 12;
  const maxWidth = options.maxWidth;
  pdf.setFont('Sarabun', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
  pdf.setTextColor(...(options.color || [31, 41, 55]));
  const lines = maxWidth ? pdf.splitTextToSize(String(text), maxWidth) : [String(text)];
  pdf.text(lines, x, y);
  return y + lines.length * (options.lineHeight || size * 0.45);
}

function pdfFooter(pdf, pageNumber) {
  pdf.setFont('Sarabun', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text('สวนปาล์ม • สร้างจากข้อมูลในเบราว์เซอร์ของผู้ใช้', 15, 288);
  pdf.text('หน้า ' + pageNumber + '/2', 195, 288, { align: 'right' });
}

function addPdfSummaryTable(pdf, rows, startY) {
  const x = 15;
  const width = 180;
  const labelWidth = 105;
  const valueWidth = width - labelWidth;
  let y = startY;
  rows.forEach(([label, value], index) => {
    const labelLines = pdf.splitTextToSize(String(label), labelWidth - 8);
    const valueLines = pdf.splitTextToSize(String(value), valueWidth - 8);
    const lineCount = Math.max(labelLines.length, valueLines.length);
    const rowHeight = Math.max(11, lineCount * 6 + 5);
    pdf.setFillColor(...(index % 2 ? [240, 247, 240] : [255, 255, 255]));
    pdf.rect(x, y, width, rowHeight, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(x, y, labelWidth, rowHeight);
    pdf.rect(x + labelWidth, y, valueWidth, rowHeight);
    drawPdfText(pdf, labelLines.join('\n'), x + 4, y + 7, { size: 11, bold: true, maxWidth: labelWidth - 8 });
    drawPdfText(pdf, valueLines.join('\n'), x + labelWidth + 4, y + 7, { size: 11, bold: true, maxWidth: valueWidth - 8 });
    y += rowHeight;
  });
  return y;
}

async function exportPdf() {
  if (!trees.length || !currentFeature) {
    setStatus('กรุณาวาดพื้นที่และสร้างจุดปลูกก่อนดาวน์โหลด PDF', 'warn');
    return;
  }
  if (!requirePlotName('ดาวน์โหลด PDF')) return;
  if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
    setStatus('ไม่สามารถโหลดไลบรารี PDF ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'warn');
    return;
  }

  const button = $('btnPDF');
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'กำลังสร้าง PDF...';
  try {
    map.invalidateSize();
    await waitForMapTiles();
    const mapCanvas = await html2canvas($('map'), {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: clonedDocument => {
        clonedDocument.querySelectorAll('.leaflet-control-container').forEach(el => {
          el.style.display = 'none';
        });
      }
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await loadPdfFonts(pdf);
    const metadata = exportMetadata();
    const pageWidth = 210;
    pdf.setFillColor(27, 94, 32);
    pdf.rect(0, 0, pageWidth, 9, 'F');
    drawPdfText(pdf, 'แผนที่วางแผนปลูกปาล์ม', 15, 23, { size: 22, bold: true, color: [27, 94, 32] });
    drawPdfText(pdf, 'แปลง: ' + metadata.plotName, 15, 32, { size: 14, bold: true, maxWidth: 180 });
    drawPdfText(pdf, 'ตำแหน่ง: ' + metadata.address, 15, 40, { size: 11, color: [75, 85, 99], maxWidth: 180 });
    drawPdfText(pdf, 'พิกัด: ' + (metadata.location ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6) : 'ไม่ทราบ'), 15, 47, { size: 11, color: [75, 85, 99] });
    drawPdfText(pdf, 'วันที่สร้าง: ' + metadata.createdAt, 15, 54, { size: 11, color: [75, 85, 99] });
    const mapWidth = 180;
    const mapHeight = Math.min(190, mapWidth * mapCanvas.height / mapCanvas.width);
    const mapY = 62;
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(15, mapY, mapWidth, mapHeight);
    pdf.addImage(mapCanvas.toDataURL('image/png'), 'PNG', 15, mapY, mapWidth, mapHeight, undefined, 'FAST');
    drawPdfText(pdf, 'แผนที่และจุดปลูกสร้างจากข้อมูลในเบราว์เซอร์ของผู้ใช้', 15, mapY + mapHeight + 8, { size: 9, color: [107, 114, 128] });
    pdfFooter(pdf, 1);
    pdf.addPage();
    pdf.setFillColor(27, 94, 32);
    pdf.rect(0, 0, pageWidth, 9, 'F');
    drawPdfText(pdf, 'สรุปข้อมูลการวางแผนปลูกปาล์ม', 15, 24, { size: 22, bold: true, color: [27, 94, 32] });
    drawPdfText(pdf, 'แปลง: ' + metadata.plotName, 15, 34, { size: 14, bold: true, maxWidth: 180 });
    drawPdfText(pdf, 'ตำแหน่ง: ' + metadata.address, 15, 42, { size: 11, color: [75, 85, 99], maxWidth: 180 });
    drawPdfText(pdf, 'วันที่สร้าง: ' + metadata.createdAt, 15, 49, { size: 11, color: [75, 85, 99] });
    const area = m2ToThaiArea(currentAreaM2);
    const rows = [
      ['พื้นที่ (ตารางเมตร)', currentAreaM2.toLocaleString('th-TH', { maximumFractionDigits: 1 })],
      ['พื้นที่ (ไร่)', String(area.rai)],
      ['พื้นที่ (งาน)', String(area.ngan)],
      ['พื้นที่ (ตารางวา)', area.wa.toFixed(2)],
      ['จำนวนต้นทั้งหมด', trees.length.toLocaleString('th-TH') + ' ต้น'],
      ['จำนวนต้นต่อไร่ (จริง)', (currentAreaM2 > 0 ? (trees.length / (currentAreaM2 / RAI_M2)).toFixed(2) : '–')],
      ['จำนวนต้นต่อไร่ (ทฤษฎี)', metadata.treesPerRai.toFixed(2) + ' (ปลูกได้ ' + Math.floor(metadata.treesPerRai) + ')'],
      ['ระยะห่างระหว่างต้น', metadata.spacing.toFixed(1) + ' เมตร'],
      ['ระยะห่างระหว่างแถว', metadata.rowSpacing.toFixed(3) + ' เมตร'],
      ['ราคาต้นกล้า/ต้น', metadata.seedlingPrice !== null ? formatBaht(metadata.seedlingPrice) : 'ไม่ระบุ'],
      ['ค่าต้นกล้ารวม', metadata.seedlingTotal !== null ? formatBaht(metadata.seedlingTotal) : 'ไม่ระบุ'],
      ['พิกัดแปลงที่ใช้ส่งออก', metadata.location ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6) : 'ไม่ทราบ'],
      ['พิกัดมือถือ', metadata.userLocation ? metadata.userLocation.lat.toFixed(6) + ', ' + metadata.userLocation.lng.toFixed(6) : 'ไม่ได้อนุญาต']
    ];
    addPdfSummaryTable(pdf, rows, 60);
    drawPdfText(pdf, 'หมายเหตุ: ข้อมูลนี้เป็นผลคำนวณจากจุดปลูกที่สร้างและปรับตำแหน่งล่าสุด', 15, 245, { size: 10, color: [107, 114, 128], maxWidth: 180 });
    pdfFooter(pdf, 2);
    const datePart = new Date().toISOString().slice(0, 10);
    pdf.save('palm-plan-' + safePdfName(metadata.plotName) + '-' + datePart + '.pdf');
    setStatus('✅ ดาวน์โหลดไฟล์เรียบร้อยแล้ว กรุณาตรวจสอบในโฟลเดอร์ Downloads', 'ok');
  } catch (error) {
    console.error('PDF export failed:', error);
    setStatus('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง', 'warn');
  } finally {
    button.textContent = oldText;
    updateCount();
  }
}

$('btnPDF').addEventListener('click', exportPdf);

// ---------- พิมพ์รายงานผ่าน Browser (ทางเลือกสำรองสำหรับมือถือ) ----------
function reportValue(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printReportData(metadata) {
  const area = m2ToThaiArea(currentAreaM2);
  const rai = currentAreaM2 / RAI_M2;
  return {
    area,
    treeCount: trees.length.toLocaleString('th-TH'),
    density: rai > 0 ? (trees.length / rai).toFixed(2) : '–',
    seedlingPrice: metadata.seedlingPrice !== null ? formatBaht(metadata.seedlingPrice) : 'ไม่ระบุ',
    seedlingTotal: metadata.seedlingTotal !== null ? formatBaht(metadata.seedlingTotal) : 'ไม่ระบุ',
    center: metadata.location
      ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6)
      : 'ไม่ทราบ',
    userCenter: metadata.userLocation
      ? metadata.userLocation.lat.toFixed(6) + ', ' + metadata.userLocation.lng.toFixed(6)
      : 'ไม่ได้อนุญาต'
  };
}

function printReportTemplate(metadata, data, mapImage) {
  const rows = [
    ['พื้นที่ (ตารางเมตร)', currentAreaM2.toLocaleString('th-TH', { maximumFractionDigits: 1 })],
    ['พื้นที่ (ไร่)', String(data.area.rai)],
    ['พื้นที่ (งาน)', String(data.area.ngan)],
    ['พื้นที่ (ตารางวา)', data.area.wa.toFixed(2)],
    ['จำนวนต้นทั้งหมด', data.treeCount + ' ต้น'],
    ['จำนวนต้นต่อไร่ (จริง)', data.density],
    ['จำนวนต้นต่อไร่ (ทฤษฎี)', metadata.treesPerRai.toFixed(2) + ' (ปลูกได้ ' + Math.floor(metadata.treesPerRai) + ')'],
    ['ระยะห่างระหว่างต้น', metadata.spacing.toFixed(1) + ' เมตร'],
    ['ระยะห่างระหว่างแถว', metadata.rowSpacing.toFixed(3) + ' เมตร'],
    ['ราคาต้นกล้า/ต้น', data.seedlingPrice],
    ['ค่าต้นกล้ารวม', data.seedlingTotal],
    ['พิกัดแปลงที่ใช้ส่งออก', data.center],
    ['พิกัดมือถือ', data.userCenter]
  ];
  return '<main class="print-report">' +
    '<h1>แผนที่วางแผนปลูกปาล์ม</h1>' +
    '<div class="meta">' +
      '<div><strong>แปลง:</strong> ' + reportValue(metadata.plotName) + '</div>' +
      '<div><strong>ตำแหน่ง:</strong> ' + reportValue(metadata.address) + '</div>' +
      '<div><strong>พิกัด:</strong> ' + reportValue(data.center) + '</div>' +
      '<div><strong>วันที่สร้าง:</strong> ' + reportValue(metadata.createdAt) + '</div>' +
    '</div>' +
    '<img class="map-image" src="' + mapImage + '" alt="แผนที่แปลงปลูกปาล์ม">' +
    '<div class="page-break"></div>' +
    '<h2>สรุปข้อมูลการวางแผน</h2>' +
    '<table><tbody>' + rows.map(row =>
      '<tr><th>' + reportValue(row[0]) + '</th><td>' + reportValue(row[1]) + '</td></tr>'
    ).join('') + '</tbody></table>' +
    '<p class="note">หมายเหตุ: ข้อมูลนี้เป็นผลคำนวณจากจุดปลูกที่สร้างและปรับตำแหน่งล่าสุด</p>' +
  '</main>';
}

function printReportStyles() {
  return '<style>' +
    '*{box-sizing:border-box}body{margin:0;background:#fff;color:#263238;font-family:"Noto Sans Thai","Sarabun",Tahoma,sans-serif}' +
    '.print-report{max-width:900px;margin:0 auto;padding:32px}.print-report h1{color:#14532d;font-size:28px;margin:0 0 10px}.print-report h2{color:#14532d;font-size:22px;margin:26px 0 12px}.meta{font-size:16px;line-height:1.8;margin-bottom:20px}.map-image{display:block;width:100%;height:auto;border:1px solid #cbd5e1;margin:18px 0 24px}.print-report table{width:100%;border-collapse:collapse;font-size:16px}.print-report th,.print-report td{border:1px solid #cbd5e1;padding:10px 12px}.print-report th{width:42%;text-align:left;background:#eaf4ea}.print-report td{text-align:right;font-weight:600}.page-break{break-before:page;page-break-before:always}.note{color:#6b7280;font-size:14px;margin-top:22px}@page{size:A4 portrait;margin:12mm}@media print{.print-report{padding:0}}' +
  '</style>';
}

async function printReport() {
  if (!trees.length || !currentFeature) {
    setStatus('กรุณาวาดพื้นที่และสร้างจุดปลูกก่อนพิมพ์รายงาน', 'warn');
    return;
  }
  if (!requirePlotName('พิมพ์รายงาน')) return;
  const button = $('btnPrint');
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'กำลังเตรียมรายงาน...';
  let printSheet = null;
  const restorePage = () => {
    document.body.classList.remove('is-printing');
    if (printSheet) printSheet.remove();
    button.disabled = false;
    button.textContent = oldText;
  };
  try {
    map.invalidateSize();
    await waitForMapTiles();
    const mapCanvas = await html2canvas($('map'), {
      scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false,
      onclone: clonedDocument => clonedDocument.querySelectorAll('.leaflet-control-container').forEach(el => { el.style.display = 'none'; })
    });
    const metadata = exportMetadata();
    const data = printReportData(metadata);
    printSheet = document.createElement('div');
    printSheet.id = 'printSheet';
    printSheet.innerHTML = printReportStyles() + printReportTemplate(metadata, data, mapCanvas.toDataURL('image/png'));
    document.body.appendChild(printSheet);
    document.body.classList.add('is-printing');
    const image = printSheet.querySelector('.map-image');
    if (image && !image.complete) await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
    await new Promise(resolve => setTimeout(resolve, 300));
    window.onafterprint = () => {
      window.onafterprint = null;
      restorePage();
      setStatus('ปิดหน้าพิมพ์แล้ว หากต้องการไฟล์ให้เลือก “บันทึกเป็น PDF”', 'ok');
    };
    window.print();
    setStatus('เปิดหน้าพิมพ์แล้ว กรุณาเลือก “บันทึกเป็น PDF” หากต้องการไฟล์ PDF', 'ok');
  } catch (error) {
    console.error('Print report failed:', error);
    restorePage();
    setStatus('ไม่สามารถเตรียมรายงานสำหรับพิมพ์ได้ กรุณาลองใหม่อีกครั้ง', 'warn');
  }
}

$('btnPrint').addEventListener('click', printReport);
