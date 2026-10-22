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
$('btnGeoJSON').addEventListener('click', () => {
  const fc = turf.featureCollection(currentPoints().map(p =>
    turf.point([p.lng, p.lat], { id: p.id })));
  download('palm-plan.geojson', 'application/geo+json', JSON.stringify(fc, null, 2));
});
$('btnCSV').addEventListener('click', () => {
  const rows = ['id,lat,lng'].concat(currentPoints().map(p =>
    p.id + ',' + p.lat.toFixed(8) + ',' + p.lng.toFixed(8)));
  download('palm-plan.csv', 'text/csv;charset=utf-8', '﻿' + rows.join('\n'));
});
