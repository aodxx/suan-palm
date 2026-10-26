// ลงทะเบียน service worker เพื่อให้เปิดแอปออฟไลน์ได้ และแจ้งผู้ใช้เมื่อสัญญาณหาย/กลับมา
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker register failed:', error));
    });
  }
  window.addEventListener('offline', () => {
    if (typeof showMapToast === 'function') showMapToast('ไม่มีสัญญาณ: แผนที่อาจไม่โหลดภาพใหม่ แต่แปลงที่ทำไว้ยังบันทึกอยู่ในเครื่อง', 'warn', { force: true, ms: 5000 });
  });
  window.addEventListener('online', () => {
    if (typeof showMapToast === 'function') showMapToast('กลับมาออนไลน์แล้ว', 'ok', { force: true, ms: 2500 });
  });
})();
