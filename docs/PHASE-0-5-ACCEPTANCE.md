# สรุปการดำเนินงาน UI Phase 0–5

อัปเดต: 2026-10-23 · รีโพ `aodxx/suan-palm` · ฐานตรวจโค้ดก่อนแก้ `bf13c03`

## สถานะ

| Phase | ผล | หลักฐาน / ข้อจำกัด |
|---|---|---|
| 0 — สำรวจและล็อกพฤติกรรมเดิม | เสร็จ | ทำ inventory ด้านล่าง; คง IDs, event bindings, สูตร และโครงสร้างข้อมูล LocalStorage เดิม |
| 1 — จัดหมวดและสร้างแถบหมวด | เสร็จในโค้ด | 6 หมวดพร้อมชื่อไทย; ใช้ IDs เดิม; ทดสอบการสลับหมวดจริงใน browser |
| 2 — UX มือถือ/Desktop | ทำโค้ดแล้ว; ต้องยืนยันอุปกรณ์จริง | responsive sidebar/bottom sheet, safe-area, touch target และ keyboard focus; browser ที่ใช้ตรวจเป็น viewport 1280×1100 ไม่ใช่ Android จริง |
| 3 — ขั้นตอนและสถานะ | เสร็จในโค้ด | ขั้นตอนคำนวณจากชื่อแปลง, polygon และจำนวนจุดจริง; ปุ่มสร้างมี title อธิบายเหตุผลที่ disabled |
| 4 — ตั้งค่า/รายงาน/การบันทึก | เสร็จในโค้ด | ย้าย controls ไปหมวดเฉพาะ; คง LocalStorage key/schema; เพิ่มผลลัพธ์ CSV/GeoJSON และข้อความเมื่อ storage ถูกปิดกั้น |
| 5 — regression/device | regression automated ผ่าน; device acceptance ค้าง | `node --test tests/regression.test.cjs` ผ่าน 7 กรณี; ตรวจ browser สลับครบ 6 หมวดและค่าฟอร์มไม่หาย; สร้าง polygon สังเคราะห์ 45 จุด, ลบและ undo ผ่าน; ยังไม่ได้ยืนยัน Android จริง, GPS และดาวน์โหลดรายงานครบทุก format |

## Phase 0: element ID → พฤติกรรมเดิม → หมวด / ไอคอน

| Element ID / กลุ่ม | พฤติกรรมเดิมและ handler | หมวดใหม่ / asset |
|---|---|---|
| `plotName`, `btnPickPlot`, `plotLocationStatus` | เก็บชื่อ; กดเลือกแล้วคลิกแผนที่เพื่อบันทึกตำแหน่งแปลง; `saveDraft()` | แปลง; `plot.svg`, `locate.svg` |
| `btnLocate`, `locationStatus`, `btnCenter` | ขอ geolocation เมื่อผู้ใช้กด; marker มือถือและ reverse-geocode; จัดมุมมองแผนที่ | เพิ่มเติม; `locate.svg` |
| `.leaflet-draw-draw-polygon` | Leaflet.draw สร้าง polygon; `DRAW:CREATED` ล้าง grid เดิม, คำนวณพื้นที่, เก็บ draft | วาด/แก้ไข; `draw.svg`, `boundary.svg` |
| `.leaflet-draw-edit-edit`, `.leaflet-draw-edit-remove` | แก้/ลบขอบเขต; handler `EDITED`/`DELETED` ล้างจุดปลูกและอัปเดตพื้นที่ | วาด/แก้ไข; `select.svg`, `delete.svg` |
| `areaM2`, `areaRai`, `areaNgan`, `areaWa` | แสดงผล `turf.area()` และ `m2ToThaiArea()` | แปลง; `boundary.svg` |
| `spacing`, `rotation`, `margin`, `seedlingPrice`, `seedlingTotal` | ค่ากริด; การเปลี่ยน spacing ถามยืนยันและล้าง grid เมื่อจำเป็น; บันทึก LocalStorage | ตั้งค่า; `settings.svg`, `calculate.svg` |
| `btnGenerate`, `treeEst`, `treeActual`, `treeDensity`, `treePerRai`, `rowSpacing` | `generateGrid()`; สร้าง grid สามเหลี่ยมจาก polygon และค่าตั้ง; สรุปคำนวณ | ปุ่มหลักคงที่และหมวดปลูกปาล์ม; `plant.svg`, `calculate.svg` |
| `gridLayer` / markers | drag ใช้ `onDrag()` และ spatial hash เตือนระยะ; click เปิดปุ่มลบ; context menu ลบทันที | ปลูกปาล์ม; `measure.svg`, `select.svg`, `delete.svg` |
| `btnUndo` | เรียก `undoRemove()`; Ctrl/Cmd+Z เมื่อไม่ได้พิมพ์ใน input | ปลูกปาล์ม; `undo.svg` |
| `btnPDF`, `btnPrint`, `btnCSV`, `btnGeoJSON` | `exporter.js`; ต้องมีจุดปลูก; PDF/print ต้องมีชื่อแปลง; export metadata/พิกัดจาก state ปัจจุบัน | รายงาน; `pdf.svg`, `excel.svg`, `report.svg` |
| `btnClear` | ต้องยืนยันเมื่อล้างแผน; ล้าง polygon/grid/plot marker และ draft | เพิ่มเติม; `delete.svg` |
| `status`, `storageStatus` | ประกาศ status ผ่าน `aria-live`; auto-save/restore ใน LocalStorage | footer คงมองเห็นทุกหมวด |
| `sheetToggle`, `sidebarContent` | เปิด/ย่อ bottom sheet และบันทึกสถานะใน `suan-palm-sheet-collapsed` | header ของ panel มือถือ; คง IDs |

## Baseline ที่ล็อกไว้

- สูตรเดิมใน `js/calculator.js` ไม่ถูกแก้: `ROW_SPACING = spacing × sin(π/3)`, ค่าเริ่มต้น 9 เมตร ให้ระยะระหว่างแถวประมาณ 7.794 ม., พื้นที่ต่อจุดประมาณ 70.148 ตร.ม. และประมาณ 22.81 ต้น/ไร่ (แสดงจำนวนเต็มโดยปัดลงเมื่อต้องแสดงต้นต่อไร่)
- ช่วงระยะที่ UI รองรับ 3–20 เมตร; ค่าหมุน -90 ถึง 90 องศา; ระยะขอบมีค่าต่ำสุด 0 เมตร
- ข้อมูล draft ใช้ `suan-palm-draft-v1` version 1; ค่าแปลง, polygon, locations, settings และรายการ marker ยังคงถูก serialize/restore แบบเดิม
- IDs เดิมที่ JavaScript ผูกไว้ยังคงอยู่ใน `index.html` อย่างละหนึ่งครั้ง; event listeners ของคำนวณ/วาด/ส่งออกยังเรียกฟังก์ชันเดิม ไม่มีการเพิ่ม handler ให้ SVG แยกจากปุ่ม
- ไม่มีการเปลี่ยน backend, สูตรคำนวณ, รูปแบบ export หรือข้อมูลที่ persist

## ผลการตรวจ

- Automated: `node --test tests/regression.test.cjs` — **7 ผ่าน, 0 ไม่ผ่าน** (IDs, tabs/panels, disabled explanations, SVG paths/viewBox, responsive/accessibility affordances, formula baselines, shared icon styles)
- Syntax: `node --check js/app.js`, `node --check js/calculator.js`, `node --check js/exporter.js` — ผ่าน
- Browser desktop: เปิด `http://127.0.0.1:8765/`; Leaflet โหลดและแสดงแผนที่; กดสลับทุกหมวด 6 แท็บ; ทุก panel แสดงตามแท็บ, `aria-selected` ตรงสถานะ, ค่า input ยังอยู่; viewport 1280×1100 และ document ไม่มี horizontal overflow; ไอคอน SVG ที่ใช้ในหน้าโหลดครบ (naturalWidth > 0)
- Browser synthetic workflow: ส่ง polygon สี่เหลี่ยมขนาดเล็กผ่าน Leaflet `DRAW:CREATED`; ปุ่มสร้างปลูกเปิดใช้งาน; สร้างกริดได้ **45 จุด**, สรุปพื้นที่แสดง **5,898 ตร.ม.**, ลบหนึ่งจุดเหลือ 44 และ Undo คืนเป็น 45; หลังสร้าง ระบบเปิดหมวดปลูกปาล์ม
- Manual browser test ใช้ชื่อ “Browser UI check” และระยะ 12 เมตรเฉพาะ local browser storage; ไม่ได้ส่งออก/ส่งข้อมูลให้บริการภายนอก
- ยังต้องตรวจบน Android จริงและทดสอบวาด/แก้/ลบ/undo/GPS/การดาวน์โหลด PDF, Print, CSV, GeoJSON ก่อนปิด Phase 5 ตามเกณฑ์ทั้งหมด

## ขอบเขตที่ไม่ได้ทำ / ความเสี่ยงคงเหลือ

- ยังไม่มีผลตรวจ Android จริงหรือการทดสอบ GPS ที่อนุญาต/ปฏิเสธ เพราะต้องใช้ device/browser permission จริง
- synthetic polygon integration ครอบคลุม create/grid/delete/undo แล้ว แต่ยังไม่ได้จำลองการวาดด้วย mouse/touch ผ่าน toolbar ของ Leaflet.draw, การแก้/ลบ polygon, การลากจุด/near-distance warning, GPS และการดาวน์โหลด artifacts PDF/Print/CSV/GeoJSON
- แผนที่และ PDF ยังคงพึ่ง external tile/CDN services ตามเดิม
