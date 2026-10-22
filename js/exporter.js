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
  if (userLocation) return userLocation;
  if (currentFeature) {
    const center = turf.centroid(currentFeature).geometry.coordinates;
    return { lat: center[1], lng: center[0] };
  }
  return null;
}

function exportMetadata() {
  const location = exportLocation();
  return {
    plotName: ($('plotName').value || '').trim() || 'ไม่ได้ระบุ',
    address: userLocation ? formatUserAddress(userAddress) : 'ไม่ทราบตำแหน่ง',
    location,
    postcode: userAddress && userAddress.postcode ? userAddress.postcode : '',
    createdAt: new Date().toLocaleDateString('th-TH', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  };
}

$('btnGeoJSON').addEventListener('click', () => {
  const metadata = exportMetadata();
  const fc = turf.featureCollection(currentPoints().map(p =>
    turf.point([p.lng, p.lat], { id: p.id })));
  fc.properties = {
    แปลง: metadata.plotName,
    ตำแหน่ง: metadata.address,
    พิกัด: metadata.location ? [metadata.location.lat, metadata.location.lng] : null,
    รหัสไปรษณีย์: metadata.postcode,
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
    '# พิกัด: ' + csvCell(coordinate),
    '# รหัสไปรษณีย์: ' + csvCell(metadata.postcode || 'ไม่ระบุ'),
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
    ['จำนวนต้นต่อไร่ (ทฤษฎี)', TREES_PER_RAI.toFixed(2) + ' (ปลูกได้ ' + Math.floor(TREES_PER_RAI) + ')'],
    ['ระยะห่างระหว่างแถว', ROW_SPACING.toFixed(3) + ' เมตร'],
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

async function exportPdf() {
  if (!trees.length || !currentFeature) {
    setStatus('กรุณาวาดพื้นที่และสร้างจุดปลูกก่อนดาวน์โหลด PDF', 'warn');
    return;
  }
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

    const metadata = exportMetadata();
    const mapReport = await renderPdfElement(createMapReportPage(mapCanvas, metadata));
    const summaryReport = await renderPdfElement(createSummaryReportPage(metadata));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    pdf.addImage(mapReport.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.addPage();
    pdf.addImage(summaryReport.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
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
    center: metadata.location
      ? metadata.location.lat.toFixed(6) + ', ' + metadata.location.lng.toFixed(6)
      : 'ไม่ทราบ'
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
    ['จำนวนต้นต่อไร่ (ทฤษฎี)', TREES_PER_RAI.toFixed(2) + ' (ปลูกได้ ' + Math.floor(TREES_PER_RAI) + ')'],
    ['ระยะห่างระหว่างแถว', ROW_SPACING.toFixed(3) + ' เมตร'],
    ['พิกัดที่ใช้ส่งออก', data.center]
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
