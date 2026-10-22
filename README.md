# 🌴 สวนปาล์ม — Palm Planting Planner

เว็บวางแผนการปลูกปาล์มแบบสามเหลี่ยมด้านเท่า ระยะ 9 × 9 × 9 เมตร ทำงานฝั่งผู้ใช้ทั้งหมดด้วย Leaflet.js และ Turf.js ไม่ใช้ Backend ไม่ต้องล็อกอิน และไม่ส่งข้อมูลพื้นที่ขึ้นเซิร์ฟเวอร์

## วิธีใช้งาน

1. เปิดเว็บ แล้วกดเครื่องมือรูปหลายเหลี่ยมที่มุมซ้ายบนของแผนที่เพื่อวาดขอบเขตแปลง
2. กด **🌴 สร้างจุดปลูกปาล์ม** เพื่อคำนวณและวางจุดปลูกอัตโนมัติ
3. ลากจุดสีเขียวเพื่อปรับตำแหน่งได้ จุดที่ใกล้กันน้อยกว่า 9 เมตรจะแสดงเป็นสีแดง และสามารถแตะจุดเพื่อเลือกคำสั่งลบได้
4. ดาวน์โหลดข้อมูลต่อได้ด้วยปุ่ม **GeoJSON** หรือ **CSV**; ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของผู้ใช้

## วิธีนำขึ้น GitHub Pages

1. สร้างหรือใช้ GitHub repository แล้วอัปโหลดไฟล์ทั้งหมดตามโครงสร้างนี้ โดยให้ `index.html` อยู่ที่ root
2. ไปที่ **Settings → Pages** ใน repository
3. เลือก **Deploy from a branch**, branch `main`, folder `/ (root)` แล้วกด Save
4. รอ GitHub สร้างเว็บไซต์ แล้วเปิดลิงก์ที่ GitHub Pages แสดงให้

## โครงสร้างไฟล์

```text
suan-palm/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── calculator.js
│   ├── app.js
│   └── exporter.js
└── README.md
```

## เครดิตไลบรารี

- [Leaflet](https://leafletjs.com/) และ [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) สำหรับแผนที่และการวาดพื้นที่
- [Turf.js](https://turfjs.org/) สำหรับคำนวณพื้นที่และจุดศูนย์กลาง
- แผนที่ดาวเทียมจาก [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) และแผนที่ถนนจาก [OpenStreetMap](https://www.openstreetmap.org/)
