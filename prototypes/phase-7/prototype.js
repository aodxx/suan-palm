(function attachPhase7Prototype(root) {
  'use strict';

  const initialState = () => ({
    variant: 'a',
    destination: 'plot',
    drawing: false,
    vertexCount: 0,
    boundary: false,
    planted: false,
    selected: false,
    selectedIndex: null,
    moved: false,
    removed: false,
    removedIndex: null,
    markerPositions: {},
    treeCount: 0,
    reportOpen: false,
    exports: 0,
    collapsed: false,
    message: 'ต้นแบบ A: หมวดเดิมถูกรวมเป็นแถบนำทางหลักชุดเดียว'
  });
  let state = initialState();

  function getState() { return { ...state }; }
  function reset() { state = initialState(); return getState(); }
  function setVariant(variant) {
    if (variant !== 'a' && variant !== 'b') return false;
    state.variant = variant;
    state.destination = 'plot';
    state.message = variant === 'a'
      ? 'ต้นแบบ A: แถบนำทางหลัก 4 ปลายทางชุดเดียว'
      : 'ต้นแบบ B: แผนที่เต็มพื้นที่และคำสั่งเปลี่ยนตามสถานะ';
    return true;
  }
  function startDrawing() {
    if (state.boundary) {
      state.message = 'ต้นแบบเท่านั้น: เปลี่ยนขอบเขตจะต้องตรวจผลกระทบก่อนใช้จริง';
      return false;
    }
    state.drawing = true;
    state.vertexCount = 0;
    state.message = 'สร้างแปลงจำลองแล้ว · แตะพื้นที่แผนที่ 4 ครั้งเพื่อวางมุม';
    return true;
  }
  function addVertex() {
    if (!state.drawing || state.vertexCount >= 4) return false;
    state.vertexCount += 1;
    state.message = `วางมุมจำลอง ${state.vertexCount}/4 แล้ว`;
    return state.vertexCount;
  }
  function finishBoundary() {
    if (!state.drawing || state.vertexCount < 4) return false;
    state.drawing = false;
    state.boundary = true;
    state.message = 'วาดขอบเขตจำลองแล้ว · พื้นที่ตัวอย่าง 1.2 ไร่';
    return true;
  }
  function generate() {
    if (!state.boundary) return false;
    state.planted = true;
    state.treeCount = 187;
    state.selected = false;
    state.selectedIndex = null;
    state.removed = false;
    state.removedIndex = null;
    state.markerPositions = {};
    state.message = 'สร้างจุดปลูกจำลองแล้ว · 187 จุด';
    if (state.variant === 'a') state.destination = 'plants';
    return true;
  }
  function selectTree(index = 0) {
    if (!state.planted || state.removed) return false;
    state.selected = true;
    state.selectedIndex = index;
    state.message = 'เลือกจุดปลูกตัวอย่างแล้ว';
    return true;
  }
  function dragSelectedTree() {
    if (!state.selected || !state.planted) return false;
    state.moved = true;
    state.message = 'ย้ายตำแหน่งจุดตัวอย่างแล้ว · ไม่มีพิกัดจริง';
    return true;
  }
  function deleteSelectedTree() {
    if (!state.selected || !state.planted || state.removed) return false;
    state.treeCount -= 1;
    state.removedIndex = state.selectedIndex;
    state.selected = false;
    state.selectedIndex = null;
    state.removed = true;
    state.message = 'ลบจุดตัวอย่างแล้ว · กด Undo เพื่อคืนค่า';
    return true;
  }
  function undoDelete() {
    if (!state.removed) return false;
    state.treeCount += 1;
    state.removed = false;
    state.removedIndex = null;
    state.message = 'คืนจุดตัวอย่างแล้ว · 187 จุด';
    return true;
  }
  function openReports() {
    if (!state.planted) {
      state.message = 'สร้างจุดปลูกจำลองก่อนจึงจะดูตัวอย่างรายงานได้';
      return false;
    }
    state.destination = 'reports';
    state.reportOpen = true;
    state.message = 'เปิดพื้นที่รายงานของต้นแบบแล้ว';
    return true;
  }
  function exportCsv() {
    if (!state.reportOpen || !state.planted) return false;
    state.exports += 1;
    state.message = `ตัวอย่างการส่งออก CSV · ${state.treeCount} จุด · ไม่มีการสร้างไฟล์จริง`;
    return true;
  }
  function toggleCollapsed() {
    state.collapsed = !state.collapsed;
    return state.collapsed;
  }
  function setDestination(destination) {
    if (!['plot', 'plants', 'settings', 'reports'].includes(destination)) return false;
    state.destination = destination;
    if (destination === 'reports') return openReports();
    state.reportOpen = false;
    state.message = destination === 'settings'
      ? 'ตั้งค่าจำลอง · ไม่มีการเปลี่ยนสูตรหรือค่าจริง'
      : destination === 'plants' && !state.planted
        ? 'สร้างขอบเขตแล้วจึงสร้างจุดปลูกได้'
        : destination === 'plants'
          ? 'ตรวจจุดปลูกจำลองบนแผนที่'
          : 'หมวดแปลง · วาดขอบเขตจาก control จำลองด้านซ้าย';
    return true;
  }
  function primaryAction() {
    if (!state.boundary && !state.drawing) return startDrawing();
    if (state.drawing) {
      state.message = state.vertexCount < 4
        ? `แตะแผนที่อีก ${4 - state.vertexCount} ครั้งเพื่อวางมุมให้ครบ`
        : 'กด “ปิดขอบเขตจำลอง” เพื่อจบการวาด';
      return false;
    }
    if (state.boundary && !state.planted) return generate();
    state.message = 'แผนตัวอย่างพร้อมให้ตรวจจุดหรือเปิดรายงาน';
    return false;
  }

  const api = {
    getState, reset, setVariant, startDrawing, addVertex, finishBoundary,
    generate, selectTree, dragSelectedTree, deleteSelectedTree, undoDelete,
    openReports, exportCsv, toggleCollapsed, setDestination, primaryAction
  };
  root.Phase7Prototype = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (!root.document) return;
  const doc = root.document;
  const shell = doc.getElementById('p7Shell');
  const map = doc.getElementById('p7Map');
  const markers = doc.getElementById('p7Markers');
  const panel = doc.getElementById('p7ContextPanel');
  const primaryActionButton = doc.getElementById('p7PrimaryAction');
  const finishButton = doc.getElementById('p7FinishAction');
  const contextTitle = doc.getElementById('p7ContextTitle');
  const contextDescription = doc.getElementById('p7ContextDescription');
  const stepLabel = doc.getElementById('p7StepLabel');
  const stats = doc.getElementById('p7ContextStats');
  const reviewActions = doc.getElementById('p7ReviewActions');
  const reportActions = doc.getElementById('p7ReportActions');
  const announcement = doc.getElementById('p7Announcement');
  const mapHint = doc.getElementById('p7MapHint');
  const collapseButton = doc.getElementById('p7Collapse');
  let activePointerDrag = null;

  function announce() {
    const current = getState();
    announcement.textContent = current.message;
    announcement.classList.add('is-visible');
    root.clearTimeout(announce.timer);
    announce.timer = root.setTimeout(() => announcement.classList.remove('is-visible'), 2400);
  }

  function renderMarkers() {
    markers.hidden = !state.planted;
    markers.replaceChildren();
    if (!state.planted) return;
    for (let i = 0; i < 4; i += 1) {
      if (state.removed && i === state.removedIndex) continue;
      const marker = doc.createElement('button');
      marker.type = 'button';
      marker.dataset.index = String(i);
      marker.className = 'p7-marker' + (state.selected && i === state.selectedIndex ? ' is-selected' : '') + (state.markerPositions[i] ? ' is-moved' : '');
      marker.setAttribute('aria-label', `จุดปลูกตัวอย่าง ${i + 1} · แตะเพื่อเลือกและลาก`);
      if (state.markerPositions[i]) {
        marker.style.left = `${state.markerPositions[i].x}%`;
        marker.style.top = `${state.markerPositions[i].y}%`;
      }
      marker.addEventListener('click', event => {
        event.stopPropagation();
        selectTree(i);
        render();
        announce();
      });
      marker.addEventListener('pointerdown', event => {
        if (!state.planted || state.removed || (event.pointerType === 'mouse' && event.button !== 0)) return;
        selectTree(i);
        activePointerDrag = { pointerId: event.pointerId, index: i, mapRect: map.getBoundingClientRect(), moved: false, position: null };
        try { marker.setPointerCapture(event.pointerId); } catch (_) { /* Synthetic test events do not have a native pointer capture target. */ }
        marker.classList.add('is-selected');
        reviewActions.querySelector('[data-action="delete-tree"]').disabled = false;
        event.preventDefault();
      });
      marker.addEventListener('pointermove', event => {
        if (!activePointerDrag || activePointerDrag.pointerId !== event.pointerId) return;
        const drag = activePointerDrag;
        const x = Math.min(94, Math.max(6, ((event.clientX - drag.mapRect.left) / drag.mapRect.width) * 100));
        const y = Math.min(90, Math.max(12, ((event.clientY - drag.mapRect.top) / drag.mapRect.height) * 100));
        drag.moved = true;
        drag.position = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        marker.style.left = `${drag.position.x}%`;
        marker.style.top = `${drag.position.y}%`;
      });
      marker.addEventListener('pointerup', event => {
        if (!activePointerDrag || activePointerDrag.pointerId !== event.pointerId) return;
        const drag = activePointerDrag;
        if (drag.moved && drag.position) {
          state.markerPositions[drag.index] = drag.position;
          state.moved = true;
          state.message = 'ลากจุดตัวอย่างแล้ว · พิกัดสังเคราะห์เท่านั้น';
          marker.classList.add('is-moved');
        }
        activePointerDrag = null;
        announce();
      });
      marker.addEventListener('pointercancel', () => {
        activePointerDrag = null;
        render();
      });
      markers.appendChild(marker);
    }
  }

  function render() {
    const current = getState();
    shell.dataset.variant = current.variant;
    shell.classList.toggle('is-collapsed', current.collapsed);
    shell.classList.toggle('has-boundary', current.boundary);
    panel.classList.toggle('p7-context-panel', current.variant === 'a');
    panel.classList.toggle('p7-action-dock', current.variant === 'b');
    panel.setAttribute('aria-label', current.variant === 'a' ? 'แผงบริบทของต้นแบบ A' : 'Action Dock ของต้นแบบ B');
    doc.querySelectorAll('[data-variant]').forEach(button => {
      if (button.closest('.p7-variant-switch')) button.setAttribute('aria-pressed', String(button.dataset.variant === current.variant));
    });
    doc.querySelectorAll('.p7-primary-nav [data-destination]').forEach(button => {
      if (button.dataset.destination === current.destination) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    doc.querySelectorAll('.p7-primary-nav [data-destination="plants"]').forEach(button => {
      button.disabled = !current.planted && !current.boundary;
    });
    stepLabel.textContent = current.drawing ? `ขั้น 2 จาก 4 · วางมุม ${current.vertexCount}/4` :
      current.planted ? 'ขั้น 4 จาก 4 · ตรวจ/รายงาน' : current.boundary ? 'ขั้น 3 จาก 4 · สร้างจุดปลูก' : 'ขั้น 1 จาก 4 · แปลง';
    contextTitle.textContent = current.drawing ? 'วางมุมแปลงจำลอง' :
        current.planted ? current.reportOpen ? 'ตัวอย่างรายงาน' : 'ตรวจจุดปลูก' :
        current.boundary ? 'ขอบเขตพร้อมแล้ว' : 'สร้างแปลงและวาดขอบเขต';
    contextDescription.textContent = current.drawing
      ? `แตะบนแผนที่อีก ${Math.max(0, 4 - current.vertexCount)} ครั้ง แล้วปิดขอบเขต`
      : current.planted
        ? current.reportOpen ? 'เลือก CSV เพื่อจำลองการส่งออก · ไม่มีการสร้างไฟล์จริง' : 'แตะจุดสีเขียวเพื่อเลือก แล้วลากเพื่อย้าย หรือใช้ ลบ/Undo'
        : current.boundary ? 'พื้นที่ตัวอย่าง 1.2 ไร่ · สร้างจุดเพื่อดูสรุปจำลอง' : 'แตะปุ่มหลักเพื่อสร้างแปลงตัวอย่าง แล้วแตะพื้นที่ 4 มุมและปิดขอบเขต';
    stats.textContent = current.planted ? `พื้นที่ 1.2 ไร่ · ${current.treeCount} จุด` : current.boundary ? 'พื้นที่ 1.2 ไร่ · จุดปลูก —' : 'พื้นที่ — · จุดปลูก —';
    primaryActionButton.textContent = !current.boundary && !current.drawing ? 'สร้างแปลง + วาด' :
      current.drawing ? current.vertexCount < 4 ? `แตะแผนที่วางมุม ${current.vertexCount}/4` : 'ขอบเขตพร้อม' :
        current.boundary && !current.planted ? 'สร้างจุดปลูกจำลอง' : `สร้างแล้ว · ${current.treeCount} จุด`;
    primaryActionButton.disabled = current.drawing || current.planted;
    finishButton.hidden = !current.drawing || current.vertexCount < 4;
    reviewActions.hidden = !current.planted || current.reportOpen;
    reviewActions.querySelector('[data-action="delete-tree"]').disabled = !current.selected;
    reportActions.hidden = !current.reportOpen;
    const undoButton = reviewActions.querySelector('[data-action="undo"]');
    undoButton.disabled = !current.removed;
    mapHint.textContent = current.drawing
      ? `กำลังวาดจำลอง · วางมุม ${current.vertexCount}/4 · control จริงไม่ถูกเรียก`
      : 'แผนที่และ control ในหน้านี้เป็นภาพจำลอง ไม่มี Leaflet ทำงาน';
    collapseButton.setAttribute('aria-expanded', String(!current.collapsed));
    collapseButton.querySelector('span').textContent = current.collapsed ? 'ขยายรายละเอียด' : 'ย่อรายละเอียด';
    collapseButton.firstChild.textContent = current.collapsed ? '⌃ ' : '⌄ ';
    renderMarkers();
  }

  shell.addEventListener('click', event => {
    const variantButton = event.target.closest('.p7-variant-switch [data-variant]');
    if (variantButton) {
      setVariant(variantButton.dataset.variant);
      render();
      announce();
      return;
    }
    const destinationButton = event.target.closest('.p7-primary-nav [data-destination]');
    if (destinationButton) {
      setDestination(destinationButton.dataset.destination);
      render();
      announce();
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      switch (actionButton.dataset.action) {
        case 'map-draw': startDrawing(); break;
        case 'map-edit': state.message = 'แก้ไข boundary เป็นเพียงตัวอย่าง · ไม่มี geometry จริง'; break;
        case 'primary': primaryAction(); break;
        case 'finish-boundary': finishBoundary(); break;
        case 'drag-tree': dragSelectedTree(); break;
        case 'delete-tree': deleteSelectedTree(); break;
        case 'undo': undoDelete(); break;
        case 'open-reports': openReports(); break;
        case 'export-csv': exportCsv(); break;
        default: break;
      }
      render();
      announce();
      return;
    }
    if (event.target.closest('#p7Collapse')) {
      toggleCollapsed();
      render();
      return;
    }
  });

  map.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    if (state.drawing) {
      addVertex();
      render();
      announce();
    }
  });

  const params = new URLSearchParams(root.location.search);
  if (params.get('variant') === 'b') setVariant('b');
  if (params.get('demo') === 'planted') {
    state.boundary = true;
    state.planted = true;
    state.treeCount = 187;
    state.destination = state.variant === 'a' ? 'plants' : 'plot';
    state.message = 'ตัวอย่างภาพ: มีข้อมูลสังเคราะห์ 187 จุด · ไม่มีข้อมูลจริง';
  } else if (params.get('demo') === 'boundary') {
    state.boundary = true;
    state.message = 'ตัวอย่างภาพ: ขอบเขตจำลองพร้อมสร้างกริด';
  }
  render();
})(typeof window !== 'undefined' ? window : globalThis);
