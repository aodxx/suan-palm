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
    '# แปลง: ' + metadata.plotName,
    '# ตำแหน่ง: ' + metadata.address,
    '# พิกัด: ' + coordinate,
    '# รหัสไปรษณีย์: ' + (metadata.postcode || 'ไม่ระบุ'),
    '# วันที่สร้าง: ' + metadata.createdAt
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
