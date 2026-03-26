// ════════════════════════════════════════════════════════════════════
// BIBLIOTECA GERAL DE VÍDEOS
// ════════════════════════════════════════════════════════════════════
const videoLibrarySection = document.getElementById('tool-video-library');
const videoLibraryGrid = document.getElementById('video-library-grid');
function renderVideoLibrary(items) {
  if (!videoLibraryGrid) return;
  if (!items.length) {
    videoLibraryGrid.innerHTML = '<div class="empty-msg">Nenhum vídeo encontrado ainda.</div>';
    return;
  }
  videoLibraryGrid.innerHTML = items.map(item => `
    <div class="video-card">
      <video src="${API + item.url}" controls muted playsinline></video>
      <div class="video-card-info">
        <div class="video-card-title">${item.url ? item.url.split('/').pop() : 'Vídeo'}</div>
        <div class="video-card-meta">${item.status === 'done' ? '✅ Pronto' : (item.status === 'processing' ? '⏳ Processando' : '❌ Erro')}</div>
        <div class="video-card-meta">${item.createdAt ? (new Date(item.createdAt)).toLocaleString('pt-BR') : ''}</div>
        <div class="video-card-actions">
          <a href="${API + item.url}" download class="video-card-dl">⬇ Baixar</a>
        </div>
      </div>
    </div>
  `).join('');
}

async function fetchVideoLibrary() {
  try {
    const resp = await fetch(API + '/api/video-library');
    const json = await resp.json();
    if (json.items) renderVideoLibrary(json.items);
  } catch (e) {
    if (videoLibraryGrid) videoLibraryGrid.innerHTML = '<div class="error-msg">Erro ao carregar biblioteca.</div>';
  }
}

// Atualiza biblioteca ao abrir a seção
const navVideoLib = document.querySelector('.nav-item[data-tool="video-library"]');
if (navVideoLib) {
  navVideoLib.addEventListener('click', () => {
    fetchVideoLibrary();
    // Atualiza a cada 10s enquanto estiver visível
    let interval = setInterval(() => {
      if (videoLibrarySection && videoLibrarySection.style.display !== 'none') fetchVideoLibrary();
      else clearInterval(interval);
    }, 10000);
  });
}
const API = '';

// ════════════════════════════════════════════════════════════════════
// BIBLIOTECA LIPSYNC
// ════════════════════════════════════════════════════════════════════
const lipsyncLibrarySection = document.getElementById('tool-lipsync-library');
const lipsyncLibraryList = document.getElementById('lipsync-library-list');
function renderLipsyncLibrary(items) {
  if (!lipsyncLibraryList) return;
  if (!items.length) {
    lipsyncLibraryList.innerHTML = '<div class="empty-msg">Nenhum vídeo lipsync gerado ainda.</div>';
    return;
  }
  lipsyncLibraryList.innerHTML = items.map(item => `
    <div class="library-item ${item.status}">
      <div class="lib-info">
        <span class="lib-status">${item.status === 'done' ? '✅' : (item.status === 'processing' ? '⏳' : '❌')}</span>
        <span class="lib-title">${item.url ? item.url.split('/').pop() : 'Vídeo em processamento'}</span>
        <span class="lib-progress">${item.status === 'done' ? '100%' : (item.progress + '%')}</span>
        <span class="lib-expiry">${item.expiresAt ? 'Expira em ' + Math.max(0, Math.floor((item.expiresAt - Date.now())/60000)) + ' min' : ''}</span>
      </div>
      <div class="lib-actions">
        ${item.url && item.status === 'done' ? `<a href="${API + item.url}" download class="download-btn">⬇ Baixar</a> <video src="${API + item.url}" controls style="max-width:120px;max-height:60px;"></video>` : ''}
        ${item.status === 'error' ? `<span class="lib-error">${item.error || 'Erro'}</span>` : ''}
      </div>
    </div>
  `).join('');
}

async function fetchLipsyncLibrary() {
  try {
    const resp = await fetch(API + '/api/lipsync-library');
    const json = await resp.json();
    if (json.items) renderLipsyncLibrary(json.items);
  } catch (e) {
    if (lipsyncLibraryList) lipsyncLibraryList.innerHTML = '<div class="error-msg">Erro ao carregar biblioteca.</div>';
  }
}

// Atualiza biblioteca ao abrir a seção
const navLipsyncLib = document.querySelector('.nav-item[data-tool="lipsync-library"]');
if (navLipsyncLib) {
  navLipsyncLib.addEventListener('click', () => {
    fetchLipsyncLibrary();
    // Atualiza a cada 10s enquanto estiver visível
    let interval = setInterval(() => {
      if (lipsyncLibrarySection && lipsyncLibrarySection.style.display !== 'none') fetchLipsyncLibrary();
      else clearInterval(interval);
    }, 10000);
  });
}
// ── TOOL NAVIGATION ────────────────────────────────────────────────────────
function showTool(name) {
  document.querySelectorAll('.tool-panel').forEach(p => {
    p.style.display = p.id === 'tool-' + name ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item[data-tool]').forEach(item => {
    item.classList.toggle('active', item.dataset.tool === name);
  });
}
document.querySelectorAll('.nav-item[data-tool]').forEach(item => {
  item.addEventListener('click', () => showTool(item.dataset.tool));
});

function formatTime(s) {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function makeDrop(zoneId, validator, onFile) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  let cnt = 0;
  zone.addEventListener('dragenter', e => { e.preventDefault(); cnt++; zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; zone.classList.remove('drag-over'); } });
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault(); cnt = 0; zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f && validator(f)) onFile(f);
  });
}

// ════════════════════════════════════════════════════════════════════
// WATERMARK TOOL
// ════════════════════════════════════════════════════════════════════
const dropZone     = document.getElementById('drop-zone');
const fileInput    = document.getElementById('file-input');
const fileNameEl   = document.getElementById('file-name');
const submitBtn    = document.getElementById('submit-btn');
const progressWrap = document.getElementById('progress-bar-wrap');
const statusText   = document.getElementById('status-text');
const resultCard   = document.getElementById('result-card');
const resultVideo  = document.getElementById('result-video');
const downloadBtn  = document.getElementById('download-btn');
const errorMsg     = document.getElementById('error-msg');
const previewSect  = document.getElementById('preview-section');
const canvas       = document.getElementById('preview-canvas');
const regionInfo   = document.getElementById('region-info');
const modeDescEl   = document.getElementById('mode-desc');
const ctx          = canvas.getContext('2d');
const vcPlay  = document.getElementById('vc-play');
const vcSeek  = document.getElementById('vc-seek');
const vcTime  = document.getElementById('vc-time');
const vcSpeed = document.getElementById('vc-speed');

let selectedFile = null, selectedMode = 'blur', videoEl = null;
let previewW = 0, previewH = 0, videoW = 0, videoH = 0;
let selRect = null, dragMode = null, activeHandle = null;
let dragStart = null, dragOrigRect = null;
const HANDLE_SIZE = 10, HANDLE_HALF = 5;
let animFrame = null;
let isPaused = false, isSeeking = false;

const modeDesc = {
  blur:   'Blur gaussiano com bordas suaves e degradê — rápido, funciona em qualquer fundo.',
  delogo: 'Reconstrói pixels da região usando arredores — ótimo para fundos uniformes.',
  ai:     'Inpainting com IA — em breve neste servidor.'
};

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    if (modeDescEl) modeDescEl.textContent = modeDesc[selectedMode] || '';
  });
});

function setFile(file) {
  if (!file || !file.type.startsWith('video/')) { showError('Arquivo inválido. Selecione um vídeo.'); return; }
  selectedFile = file;
  const name = file.name.length > 50 ? file.name.substring(0, 47) + '...' : file.name;
  fileNameEl.textContent = '✓ ' + name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  dropZone.classList.add('has-file');
  submitBtn.disabled = false;
  submitBtn.textContent = '▶ Processar Vídeo';
  clearError();
  loadVideoPreview(file);
}

let dragCounter = 0;
dropZone.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dropZone.classList.remove('drag-over'); } });
dropZone.addEventListener('dragover', e => e.preventDefault());
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dragCounter = 0; dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function startVideoLoop(vEl, canvasEl, ctxEl, pw, ph, drawFn, vcPlayEl) {
  vEl.loop = true;
  vEl.play().catch(() => {});
  if (vcPlayEl) vcPlayEl.textContent = '\u23F8';
  function loop() { drawFn(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

function loadVideoPreview(file) {
  selRect = null; dragMode = null;
  regionInfo.innerHTML = 'Nenhuma região selecionada — arraste para marcar';
  videoEl = document.createElement('video');
  videoEl.muted = true; videoEl.playsInline = true; videoEl.preload = 'auto';
  videoEl.src = URL.createObjectURL(file); videoEl.currentTime = 0.1;
  videoEl.addEventListener('seeked', function onS() {
    videoEl.removeEventListener('seeked', onS);
    videoW = videoEl.videoWidth; videoH = videoEl.videoHeight;
    previewSect.style.display = 'block';
    requestAnimationFrame(() => { updateCanvasSize(); startWatermarkLoop(); });
  });
}

function startWatermarkLoop() {
  if (animFrame) cancelAnimationFrame(animFrame);
  isPaused = false; isSeeking = false;
  videoEl.loop = true;
  videoEl.playbackRate = vcSpeed ? parseFloat(vcSpeed.value) : 1;
  videoEl.play().catch(() => {});
  if (vcPlay) vcPlay.textContent = '\u23F8';
  function loop() { drawFrame(); animFrame = requestAnimationFrame(loop); }
  animFrame = requestAnimationFrame(loop);
}

// Draw rounded rectangle helper
function roundRect(c, x, y, w, h, r) {
  const R = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + R, y);
  c.lineTo(x + w - R, y); c.arcTo(x + w, y, x + w, y + R, R);
  c.lineTo(x + w, y + h - R); c.arcTo(x + w, y + h, x + w - R, y + h, R);
  c.lineTo(x + R, y + h); c.arcTo(x, y + h, x, y + h - R, R);
  c.lineTo(x, y + R); c.arcTo(x, y, x + R, y, R);
  c.closePath();
}

function drawFrame() {
  if (!videoEl) return;
  if (!isSeeking && vcSeek && vcTime) {
    const dur = videoEl.duration || 0;
    vcSeek.value = dur ? Math.round((videoEl.currentTime / dur) * 1000) : 0;
    vcTime.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(dur);
  }
  ctx.clearRect(0, 0, previewW, previewH);
  ctx.drawImage(videoEl, 0, 0, previewW, previewH);
  if (!selRect || selRect.w < 2 || selRect.h < 2) return;
  const { x, y, w, h } = selRect;
  // Dim outside selection
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, previewW, previewH);
  // Show selection (clip to rounded rect)
  ctx.save(); roundRect(ctx, x, y, w, h, 8); ctx.clip();
  ctx.drawImage(videoEl, 0, 0, previewW, previewH); ctx.restore();
  // Border with rounded corners
  ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
  roundRect(ctx, x, y, w, h, 8); ctx.stroke(); ctx.setLineDash([]);
  // Handles
  getSelHandles().forEach(hh => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(hh.x - HANDLE_HALF, hh.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(hh.x - HANDLE_HALF, hh.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
  });
  // Label
  const rW = Math.round(w * videoW / previewW), rH = Math.round(h * videoH / previewH);
  const label = rW + ' x ' + rH;
  ctx.font = 'bold 11px Segoe UI, system-ui, sans-serif';
  const lw = ctx.measureText(label).width + 12;
  ctx.fillStyle = '#6c63ff'; ctx.fillRect(x, Math.max(0, y - 22), lw, 20);
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 6, Math.max(14, y - 6));
}

function updateCanvasSize() {
  if (!videoW || !videoH) return;
  const wrap = document.getElementById('canvas-wrap');
  const maxW = 760, dW = Math.min(maxW, Math.max(200, wrap.clientWidth || maxW));
  const dH = Math.round(dW * videoH / videoW), dpr = window.devicePixelRatio || 1;
  canvas.style.width = dW + 'px'; canvas.style.height = dH + 'px';
  canvas.width = Math.max(1, Math.round(dW * dpr));
  canvas.height = Math.max(1, Math.round(dH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  previewW = dW; previewH = dH;
}
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (videoEl) { updateCanvasSize(); } }, 120);
});

// Video controls (watermark)
if (vcPlay) {
  vcPlay.addEventListener('click', () => {
    if (!videoEl) return;
    if (isPaused) { videoEl.play().catch(() => {}); isPaused = false; vcPlay.textContent = '\u23F8'; }
    else { videoEl.pause(); isPaused = true; vcPlay.textContent = '\u25B6'; }
  });
}
if (vcSeek) {
  vcSeek.addEventListener('mousedown', () => { isSeeking = true; });
  vcSeek.addEventListener('input', () => {
    if (!videoEl || !videoEl.duration) return;
    videoEl.currentTime = (vcSeek.value / 1000) * videoEl.duration;
    if (vcTime) vcTime.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(videoEl.duration);
    drawFrame();
  });
  vcSeek.addEventListener('mouseup', () => { isSeeking = false; });
}
if (vcSpeed) vcSpeed.addEventListener('change', () => { if (videoEl) videoEl.playbackRate = parseFloat(vcSpeed.value); });

function getSelHandles() {
  if (!selRect) return [];
  const { x, y, w, h } = selRect;
  return [
    { id: 'tl', x: x,       y: y,       cursor: 'nwse-resize' },
    { id: 'tr', x: x + w,   y: y,       cursor: 'nesw-resize' },
    { id: 'bl', x: x,       y: y + h,   cursor: 'nesw-resize' },
    { id: 'br', x: x + w,   y: y + h,   cursor: 'nwse-resize' },
    { id: 'tm', x: x + w/2, y: y,       cursor: 'ns-resize'   },
    { id: 'bm', x: x + w/2, y: y + h,   cursor: 'ns-resize'   },
    { id: 'ml', x: x,       y: y + h/2, cursor: 'ew-resize'   },
    { id: 'mr', x: x + w,   y: y + h/2, cursor: 'ew-resize'   },
  ];
}
function hitTestHandle(px, py) {
  for (const h of getSelHandles()) {
    if (Math.abs(px - h.x) <= HANDLE_HALF + 3 && Math.abs(py - h.y) <= HANDLE_HALF + 3) return h;
  }
  return null;
}
function isInsideRect(px, py) {
  if (!selRect) return false;
  return px >= selRect.x && px <= selRect.x + selRect.w && py >= selRect.y && py <= selRect.y + selRect.h;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
  return { x: Math.max(0, Math.min(previewW, src.clientX - rect.left)), y: Math.max(0, Math.min(previewH, src.clientY - rect.top)) };
}

canvas.addEventListener('mousedown', e => {
  const p = canvasPos(e);
  if (selRect && selRect.w > 4 && selRect.h > 4) {
    const handle = hitTestHandle(p.x, p.y);
    if (handle) { dragMode = 'resize'; activeHandle = handle.id; dragStart = p; dragOrigRect = { ...selRect }; return; }
    if (isInsideRect(p.x, p.y)) { dragMode = 'move'; dragStart = p; dragOrigRect = { ...selRect }; return; }
  }
  dragMode = 'new'; dragStart = p; selRect = { x: p.x, y: p.y, w: 0, h: 0 };
});
canvas.addEventListener('mousemove', e => {
  const p = canvasPos(e);
  if (!dragMode) {
    if (selRect && selRect.w > 4 && selRect.h > 4) {
      const handle = hitTestHandle(p.x, p.y);
      if (handle) canvas.style.cursor = handle.cursor;
      else if (isInsideRect(p.x, p.y)) canvas.style.cursor = 'move';
      else canvas.style.cursor = 'crosshair';
    } else canvas.style.cursor = 'crosshair';
    return;
  }
  handleDragWm(p);
});
canvas.addEventListener('mouseup', () => endDragWm());
canvas.addEventListener('mouseleave', () => { if (dragMode) endDragWm(); });
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const p = canvasPos(e);
  if (selRect && selRect.w > 4 && selRect.h > 4) {
    const handle = hitTestHandle(p.x, p.y);
    if (handle) { dragMode = 'resize'; activeHandle = handle.id; dragStart = p; dragOrigRect = { ...selRect }; return; }
    if (isInsideRect(p.x, p.y)) { dragMode = 'move'; dragStart = p; dragOrigRect = { ...selRect }; return; }
  }
  dragMode = 'new'; dragStart = p; selRect = { x: p.x, y: p.y, w: 0, h: 0 };
}, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!dragMode) return; handleDragWm(canvasPos(e)); }, { passive: false });
canvas.addEventListener('touchend', () => endDragWm());

function handleDragWm(p) {
  const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
  if (dragMode === 'new') {
    selRect = { x: dx >= 0 ? dragStart.x : p.x, y: dy >= 0 ? dragStart.y : p.y, w: Math.abs(dx), h: Math.abs(dy) };
  } else if (dragMode === 'move') {
    selRect = { x: clamp(dragOrigRect.x + dx, 0, previewW - dragOrigRect.w), y: clamp(dragOrigRect.y + dy, 0, previewH - dragOrigRect.h), w: dragOrigRect.w, h: dragOrigRect.h };
  } else if (dragMode === 'resize') {
    let { x, y, w, h } = dragOrigRect;
    if (activeHandle.includes('l')) { x += dx; w -= dx; }
    if (activeHandle.includes('r')) { w += dx; }
    if (activeHandle.includes('t')) { y += dy; h -= dy; }
    if (activeHandle.includes('b')) { h += dy; }
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    x = Math.max(0, x); y = Math.max(0, y);
    w = Math.min(w, previewW - x); h = Math.min(h, previewH - y);
    selRect = { x, y, w, h };
  }
  drawFrame();
}
function endDragWm() {
  if (!dragMode) return;
  dragMode = null; activeHandle = null; dragStart = null; dragOrigRect = null;
  if (!selRect || selRect.w < 5 || selRect.h < 5) {
    selRect = null; drawFrame();
    regionInfo.innerHTML = 'Nenhuma região selecionada — arraste para marcar'; return;
  }
  const rx = Math.round(selRect.x * videoW / previewW), ry = Math.round(selRect.y * videoH / previewH);
  const rw = Math.round(selRect.w * videoW / previewW), rh = Math.round(selRect.h * videoH / previewH);
  regionInfo.innerHTML = 'Região: <span>' + rw + ' x ' + rh + ' px</span> em <span>(' + rx + ', ' + ry + ')</span>';
  drawFrame();
}

submitBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  const fd = new FormData();
  fd.append('video', selectedFile); fd.append('mode', selectedMode);
  if (selRect && selRect.w >= 5 && selRect.h >= 5) {
    fd.append('x', Math.round(selRect.x * videoW / previewW));
    fd.append('y', Math.round(selRect.y * videoH / previewH));
    fd.append('w', Math.round(selRect.w * videoW / previewW));
    fd.append('h', Math.round(selRect.h * videoH / previewH));
  }
  setLoadingWm(true); clearError(); resultCard.style.display = 'none';
  try {
    const resp = await fetch(API + '/api/process', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
    resultVideo.src = API + json.url; downloadBtn.href = API + json.url;
    downloadBtn.download = json.url.split('/').pop();
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) { showError(err.message); }
  finally { setLoadingWm(false); }
});
function setLoadingWm(on) {
  submitBtn.disabled = on;
  submitBtn.textContent = on ? '⏳ Processando...' : '▶ Processar Vídeo';
  progressWrap.style.display = on ? 'block' : 'none';
  statusText.textContent = on ? 'Aguarde — o ffmpeg está processando o vídeo...' : '';
}
function showError(msg) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Erro: ' + msg; }
function clearError() { errorMsg.style.display = 'none'; errorMsg.textContent = ''; }

// ════════════════════════════════════════════════════════════════════
// LEGENDAS TOOL (Auto + Manual + Canvas Position)
// ════════════════════════════════════════════════════════════════════
const subFileInput    = document.getElementById('sub-file-input');
const subDropZone     = document.getElementById('sub-drop-zone');
const subFileNameEl   = document.getElementById('sub-file-name');
const subPreviewSect  = document.getElementById('sub-preview-section');
const subCanvas       = document.getElementById('sub-preview-canvas');
const subCtx          = subCanvas ? subCanvas.getContext('2d') : null;
const subVcPlay       = document.getElementById('sub-vc-play');
const subVcSeek       = document.getElementById('sub-vc-seek');
const subVcTime       = document.getElementById('sub-vc-time');
const subVcSpeed      = document.getElementById('sub-vc-speed');
const subSubmitBtn    = document.getElementById('sub-submit-btn');
const subProgressWrap = document.getElementById('sub-progress-wrap');
const subStatusEl     = document.getElementById('sub-status');
const subErrorEl      = document.getElementById('sub-error');
const subResultCard   = document.getElementById('sub-result-card');
const subResultVideo  = document.getElementById('sub-result-video');
const subDownloadBtn  = document.getElementById('sub-download-btn');
const subFontSize     = document.getElementById('sub-fontsize');
const subFontSizeVal  = document.getElementById('sub-fontsize-val');
const subAddBtn       = document.getElementById('sub-add-btn');
const subEntriesEl    = document.getElementById('sub-entries');
const subEmptyEl      = document.getElementById('sub-empty');

let subFile = null, subEntries = [], subPreset = 'classico', subWordByWord = false;
let subSubMode = 'auto'; // 'auto' | 'manual'
let subNextId = 1;

// Canvas state for subtitle position
let subVideoEl = null;
let subPreviewW = 0, subPreviewH = 0, subVideoW = 0, subVideoH = 0;
let subAnimFrame = null, subIsPaused = false, subIsSeeking = false;
// Subtitle block position (fraction 0..1 of video)
let subBlockX = 0.5, subBlockY = 0.88;
let subBlockDragging = false;
const SUB_BLOCK_W_FRAC = 0.82; // block width as fraction of video width
const SUB_BLOCK_H_PX = 56;

// Mode switching
document.querySelectorAll('.sub-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-mode-btn').forEach(b => b.classList.remove('sm-active'));
    btn.classList.add('sm-active');
    subSubMode = btn.dataset.submode;
    document.getElementById('sub-auto-panel').style.display = subSubMode === 'auto' ? '' : 'none';
    document.getElementById('sub-manual-panel').style.display = subSubMode === 'manual' ? '' : 'none';
    updateSubSubmit();
  });
});

// File selection
function setSubFile(file) {
  if (!file || !file.type.startsWith('video/')) return;
  subFile = file;
  const name = file.name.length > 50 ? file.name.substring(0, 47) + '...' : file.name;
  subFileNameEl.textContent = '✓ ' + name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  subDropZone.classList.add('has-file');
  loadSubVideoPreview(file);
  updateSubSubmit();
}
subFileInput.addEventListener('change', () => { if (subFileInput.files[0]) setSubFile(subFileInput.files[0]); });
makeDrop('sub-drop-zone', f => f.type.startsWith('video/'), setSubFile);

function loadSubVideoPreview(file) {
  if (subAnimFrame) cancelAnimationFrame(subAnimFrame); subAnimFrame = null;
  subVideoEl = document.createElement('video');
  subVideoEl.muted = true; subVideoEl.playsInline = true; subVideoEl.preload = 'auto';
  subVideoEl.src = URL.createObjectURL(file); subVideoEl.currentTime = 0.1;
  subVideoEl.addEventListener('seeked', function onS() {
    subVideoEl.removeEventListener('seeked', onS);
    subVideoW = subVideoEl.videoWidth; subVideoH = subVideoEl.videoHeight;
    subPreviewSect.style.display = 'block';
    requestAnimationFrame(() => { updateSubCanvasSize(); startSubLoop(); });
  });
}

function updateSubCanvasSize() {
  if (!subVideoW || !subVideoH || !subCanvas) return;
  const wrap = document.getElementById('sub-canvas-wrap');
  const maxW = 760, dW = Math.min(maxW, Math.max(200, wrap.clientWidth || maxW));
  const dH = Math.round(dW * subVideoH / subVideoW), dpr = window.devicePixelRatio || 1;
  subCanvas.style.width = dW + 'px'; subCanvas.style.height = dH + 'px';
  subCanvas.width = Math.max(1, Math.round(dW * dpr));
  subCanvas.height = Math.max(1, Math.round(dH * dpr));
  subCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  subPreviewW = dW; subPreviewH = dH;
}

function startSubLoop() {
  subIsPaused = false; subIsSeeking = false;
  subVideoEl.loop = true; subVideoEl.play().catch(() => {});
  if (subVcPlay) subVcPlay.textContent = '\u23F8';
  function loop() { drawSubFrame(); subAnimFrame = requestAnimationFrame(loop); }
  subAnimFrame = requestAnimationFrame(loop);
}

function drawSubFrame() {
  if (!subVideoEl || !subCtx) return;
  if (!subIsSeeking && subVcSeek && subVcTime) {
    const dur = subVideoEl.duration || 0;
    subVcSeek.value = dur ? Math.round((subVideoEl.currentTime / dur) * 1000) : 0;
    subVcTime.textContent = formatTime(subVideoEl.currentTime) + ' / ' + formatTime(dur);
  }
  subCtx.clearRect(0, 0, subPreviewW, subPreviewH);
  subCtx.drawImage(subVideoEl, 0, 0, subPreviewW, subPreviewH);

  // Draw subtitle block
  const bW = subPreviewW * SUB_BLOCK_W_FRAC;
  const bH = SUB_BLOCK_H_PX * (subPreviewH / 400);
  const bX = subBlockX * subPreviewW - bW / 2;
  const bY = subBlockY * subPreviewH - bH / 2;

  subCtx.fillStyle = 'rgba(108,99,255,0.22)';
  roundRect(subCtx, bX, bY, bW, bH, 8);
  subCtx.fill();
  subCtx.strokeStyle = subBlockDragging ? '#ffffff' : '#6c63ff';
  subCtx.lineWidth = 2; subCtx.setLineDash([5, 3]);
  roundRect(subCtx, bX, bY, bW, bH, 8); subCtx.stroke(); subCtx.setLineDash([]);

  // Sample text
  const fs = Math.max(10, Math.round(15 * subPreviewH / 360));
  subCtx.font = `bold ${fs}px Arial, sans-serif`;
  subCtx.fillStyle = '#ffffff';
  subCtx.strokeStyle = '#000';
  subCtx.lineWidth = 3;
  subCtx.textAlign = 'center';
  subCtx.textBaseline = 'middle';
  subCtx.strokeText('Legenda Modelo', bX + bW / 2, bY + bH / 2);
  subCtx.fillText('Legenda Modelo', bX + bW / 2, bY + bH / 2);

  // Drag hint
  subCtx.font = `${Math.max(9, Math.round(11 * subPreviewH / 360))}px Arial`;
  subCtx.fillStyle = 'rgba(255,255,255,0.55)';
  subCtx.textAlign = 'center';
  subCtx.fillText('↕ arraste', bX + bW / 2, bY + bH + 14);
}

function subCanvasPos(e) {
  if (!subCanvas) return { x: 0, y: 0 };
  const rect = subCanvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function isNearSubBlock(px, py) {
  const bW = subPreviewW * SUB_BLOCK_W_FRAC;
  const bH = SUB_BLOCK_H_PX * (subPreviewH / 400);
  const bX = subBlockX * subPreviewW - bW / 2;
  const bY = subBlockY * subPreviewH - bH / 2;
  return px >= bX - 8 && px <= bX + bW + 8 && py >= bY - 8 && py <= bY + bH + 8;
}

if (subCanvas) {
  subCanvas.style.cursor = 'default';
  subCanvas.addEventListener('mousedown', e => {
    const p = subCanvasPos(e);
    if (isNearSubBlock(p.x, p.y)) { subBlockDragging = true; subCanvas.style.cursor = 'grabbing'; }
  });
  subCanvas.addEventListener('mousemove', e => {
    const p = subCanvasPos(e);
    if (subBlockDragging) {
      subBlockX = Math.max(0.1, Math.min(0.9, p.x / subPreviewW));
      subBlockY = Math.max(0.05, Math.min(0.97, p.y / subPreviewH));
    } else {
      subCanvas.style.cursor = isNearSubBlock(p.x, p.y) ? 'grab' : 'default';
    }
  });
  subCanvas.addEventListener('mouseup', () => { subBlockDragging = false; subCanvas.style.cursor = 'default'; });
  subCanvas.addEventListener('mouseleave', () => { subBlockDragging = false; });
  subCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const p = subCanvasPos(e);
    if (isNearSubBlock(p.x, p.y)) subBlockDragging = true;
  }, { passive: false });
  subCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!subBlockDragging) return;
    const p = subCanvasPos(e);
    subBlockX = Math.max(0.1, Math.min(0.9, p.x / subPreviewW));
    subBlockY = Math.max(0.05, Math.min(0.97, p.y / subPreviewH));
  }, { passive: false });
  subCanvas.addEventListener('touchend', () => { subBlockDragging = false; });
}

// Sub video controls
if (subVcPlay) {
  subVcPlay.addEventListener('click', () => {
    if (!subVideoEl) return;
    if (subIsPaused) { subVideoEl.play().catch(() => {}); subIsPaused = false; subVcPlay.textContent = '\u23F8'; }
    else { subVideoEl.pause(); subIsPaused = true; subVcPlay.textContent = '\u25B6'; }
  });
}
if (subVcSeek) {
  subVcSeek.addEventListener('mousedown', () => { subIsSeeking = true; });
  subVcSeek.addEventListener('input', () => {
    if (!subVideoEl || !subVideoEl.duration) return;
    subVideoEl.currentTime = (subVcSeek.value / 1000) * subVideoEl.duration;
    if (subVcTime) subVcTime.textContent = formatTime(subVideoEl.currentTime) + ' / ' + formatTime(subVideoEl.duration);
  });
  subVcSeek.addEventListener('mouseup', () => { subIsSeeking = false; });
}
if (subVcSpeed) subVcSpeed.addEventListener('change', () => { if (subVideoEl) subVideoEl.playbackRate = parseFloat(subVcSpeed.value); });

// Presets
document.querySelectorAll('.preset-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('sp-active'));
    card.classList.add('sp-active');
    subPreset = card.dataset.preset;
  });
});

// Animation mode
document.querySelectorAll('.anim-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('pa-active'));
    btn.classList.add('pa-active');
    subWordByWord = btn.dataset.anim === 'word';
  });
});

// Font size
if (subFontSize) subFontSize.addEventListener('input', () => { subFontSizeVal.textContent = subFontSize.value; });

// Manual entries
function advanceTime(t, secs) {
  const parts = String(t).split(':').map(Number);
  let total = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] || 0);
  total += secs;
  const m = Math.floor(total / 60), s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function getLastEndTime() { return subEntries.length ? subEntries[subEntries.length - 1].end : '0:00'; }

function renderEntries() {
  if (!subEntriesEl) return;
  subEntriesEl.innerHTML = '';
  if (subEmptyEl) subEmptyEl.style.display = subEntries.length === 0 ? 'block' : 'none';
  subEntries.forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'sub-entry';
    div.innerHTML =
      '<span class="sub-num">' + (i + 1) + '</span>' +
      '<input class="sub-time" type="text" value="' + entry.start + '" placeholder="0:00" data-field="start">' +
      '<span class="sub-arrow">→</span>' +
      '<input class="sub-time" type="text" value="' + entry.end + '" placeholder="0:05" data-field="end">' +
      '<input class="sub-text-input" type="text" value="' + entry.text.replace(/"/g, '&quot;') + '" placeholder="Texto da legenda..." data-field="text">' +
      '<button class="sub-remove" title="Remover">\u2715</button>';
    div.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = subEntries.findIndex(e => e.id === entry.id);
        if (idx !== -1) subEntries[idx][inp.dataset.field] = inp.value;
        updateSubSubmit();
      });
    });
    div.querySelector('.sub-remove').addEventListener('click', () => {
      subEntries = subEntries.filter(e => e.id !== entry.id);
      renderEntries(); updateSubSubmit();
    });
    subEntriesEl.appendChild(div);
  });
}

if (subAddBtn) {
  subAddBtn.addEventListener('click', () => {
    const lastEnd = getLastEndTime();
    const newEnd = advanceTime(lastEnd, 3);
    subEntries.push({ id: subNextId++, start: lastEnd, end: newEnd, text: '' });
    renderEntries();
    const inputs = subEntriesEl.querySelectorAll('.sub-text-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
    updateSubSubmit();
  });
}

function updateSubSubmit() {
  if (!subSubmitBtn) return;
  if (!subFile) { subSubmitBtn.disabled = true; subSubmitBtn.textContent = 'Selecione um vídeo'; return; }
  if (subSubMode === 'manual') {
    const hasText = subEntries.some(e => e.text.trim().length > 0);
    if (!subEntries.length || !hasText) { subSubmitBtn.disabled = true; subSubmitBtn.textContent = 'Adicione ao menos uma legenda'; return; }
  }
  subSubmitBtn.disabled = false;
  subSubmitBtn.textContent = subSubMode === 'auto' ? '🤖 Gerar AutoCaption' : '💬 Gravar Legendas no Vídeo';
}

// Submit
if (subSubmitBtn) {
  subSubmitBtn.addEventListener('click', async () => {
    if (!subFile) return;
    if (subSubMode === 'manual' && !subEntries.some(e => e.text.trim())) return;

    subSubmitBtn.disabled = true; subSubmitBtn.textContent = '⏳ Processando...';
    subProgressWrap.style.display = 'block';
    subStatusEl.textContent = subSubMode === 'auto'
      ? '⏳ Transcrevendo com faster-whisper… pode levar alguns minutos'
      : 'Gerando arquivo de legendas...';
    subErrorEl.style.display = 'none'; subResultCard.style.display = 'none';

    // Convert canvas block position to ASS coordinates (1920x1080 space)
    const posX = Math.round(subBlockX * 1920);
    const posY = Math.round(subBlockY * 1080);

    const fd = new FormData();
    fd.append('video', subFile);
    fd.append('preset', subPreset);
    fd.append('fontsize', subFontSize ? subFontSize.value : '72');
    fd.append('wordbyword', subWordByWord ? '1' : '0');
    fd.append('posX', posX);
    fd.append('posY', posY);

    let endpoint;
    if (subSubMode === 'auto') {
      endpoint = '/api/subtitle/auto';
      fd.append('lang', document.getElementById('sub-auto-lang').value);
      fd.append('model', document.getElementById('sub-auto-model').value);
    } else {
      endpoint = '/api/subtitle';
      const valid = subEntries.filter(e => e.text.trim());
      fd.append('subs', JSON.stringify(valid.map(e => ({ start: e.start, end: e.end, text: e.text.trim() }))));
    }

    try {
      const resp = await fetch(API + endpoint, { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
      subResultVideo.src = API + json.url;
      subDownloadBtn.href = API + json.url;
      subDownloadBtn.download = json.url.split('/').pop();
      subResultCard.style.display = 'block';
      subResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      subErrorEl.style.display = 'block'; subErrorEl.textContent = 'Erro: ' + err.message;
    } finally {
      subSubmitBtn.disabled = false;
      subProgressWrap.style.display = 'none'; subStatusEl.textContent = '';
      updateSubSubmit();
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// COMBINADOR
// ════════════════════════════════════════════════════════════════════
const hookInput        = document.getElementById('hook-input');
const bodyInput        = document.getElementById('body-input');
const hookListEl       = document.getElementById('hook-list');
const bodyListEl       = document.getElementById('body-list');
const combineBtn       = document.getElementById('combine-btn');
const combineProgEl    = document.getElementById('combine-prog');
const combineStatusEl  = document.getElementById('combine-status');
const combineDetEl     = document.getElementById('combine-det');
const combineErrorEl   = document.getElementById('combine-error');
const combineResultsEl = document.getElementById('combine-results');
const combineGridEl    = document.getElementById('combine-result-grid');
const combineDoneN     = document.getElementById('combine-done-n');

let hookFiles = [], bodyFiles = [];

function makeMultiDrop(zoneId, onFiles) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  let cnt = 0;
  zone.addEventListener('dragenter', e => { e.preventDefault(); cnt++; zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; zone.classList.remove('drag-over'); } });
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault(); cnt = 0; zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length) onFiles(files);
  });
}

function renderClipList(files, listEl, countId, onRemove) {
  if (!listEl) return;
  const countEl = document.getElementById(countId);
  listEl.innerHTML = '';
  if (countEl) countEl.textContent = files.length;
  if (files.length === 0) {
    listEl.innerHTML = '<span class="clip-empty">Nenhum arquivo adicionado</span>';
    return;
  }
  files.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'clip-item';
    const sz = f.size < 1024 * 1024 ? (f.size / 1024).toFixed(0) + ' KB' : (f.size / 1024 / 1024).toFixed(1) + ' MB';
    div.innerHTML =
      '<span class="clip-num">' + (i + 1) + '</span>' +
      '<span class="clip-name" title="' + f.name + '">' + f.name + '</span>' +
      '<span class="clip-sz">' + sz + '</span>' +
      '<button class="clip-rm" title="Remover">\u2715</button>';
    div.querySelector('.clip-rm').addEventListener('click', () => onRemove(i));
    listEl.appendChild(div);
  });
}

function renderHookList() {
  renderClipList(hookFiles, hookListEl, 'hook-count', i => {
    hookFiles.splice(i, 1); renderHookList(); updateCombinePreview();
  });
}
function renderBodyList() {
  renderClipList(bodyFiles, bodyListEl, 'body-count', i => {
    bodyFiles.splice(i, 1); renderBodyList(); updateCombinePreview();
  });
}

function updateCombinePreview() {
  const nH = hookFiles.length, nB = bodyFiles.length, total = nH * nB;
  const previewCard = document.getElementById('combine-preview');
  if (previewCard) previewCard.style.display = (nH > 0 || nB > 0) ? 'block' : 'none';
  const formulaEl = document.getElementById('combine-formula');
  if (formulaEl) {
    formulaEl.innerHTML = '<span class="cn">' + nH + '</span> hooks × <span class="cn">' + nB + '</span> corpos = <span class="cn">' + total + '</span> vídeo' + (total !== 1 ? 's' : '');
  }
  const matrixEl = document.getElementById('combine-matrix');
  if (matrixEl) {
    matrixEl.innerHTML = '';
    if (total > 0 && total <= 50) {
      hookFiles.forEach((h, hi) => {
        bodyFiles.forEach((b, bi) => {
          const tag = document.createElement('span');
          tag.className = 'combo-tag';
          tag.textContent = 'H' + (hi + 1) + '+C' + (bi + 1);
          matrixEl.appendChild(tag);
        });
      });
    } else if (total > 50) {
      matrixEl.textContent = total + ' combinações';
    }
  }
  if (combineBtn) combineBtn.disabled = (nH === 0 || nB === 0);
}

// Click to open file input from clip-dz divs
const hookDz = document.getElementById('hook-dz');
const bodyDz = document.getElementById('body-dz');
if (hookDz && hookInput) {
  hookDz.addEventListener('click', () => hookInput.click());
  hookDz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') hookInput.click(); });
}
if (bodyDz && bodyInput) {
  bodyDz.addEventListener('click', () => bodyInput.click());
  bodyDz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') bodyInput.click(); });
}

if (hookInput) {
  hookInput.addEventListener('change', () => {
    hookFiles = hookFiles.concat(Array.from(hookInput.files).filter(f => f.type.startsWith('video/')));
    hookInput.value = '';
    renderHookList(); updateCombinePreview();
  });
}
if (bodyInput) {
  bodyInput.addEventListener('change', () => {
    bodyFiles = bodyFiles.concat(Array.from(bodyInput.files).filter(f => f.type.startsWith('video/')));
    bodyInput.value = '';
    renderBodyList(); updateCombinePreview();
  });
}

makeMultiDrop('hook-dz', files => { hookFiles = hookFiles.concat(files); renderHookList(); updateCombinePreview(); });
makeMultiDrop('body-dz', files => { bodyFiles = bodyFiles.concat(files); renderBodyList(); updateCombinePreview(); });

updateCombinePreview();

if (combineBtn) {
  combineBtn.addEventListener('click', async () => {
    if (!hookFiles.length || !bodyFiles.length) return;
    combineBtn.disabled = true;
    combineErrorEl.style.display = 'none';
    combineResultsEl.style.display = 'none';
    combineGridEl.innerHTML = '';
    combineProgEl.style.display = 'block';
    combineStatusEl.textContent = 'Enviando arquivos para o servidor...';
    combineDetEl.textContent = '';

    let hookIds, hookNames, bodyIds, bodyNames;
    try {
      const fd = new FormData();
      hookFiles.forEach(f => fd.append('hooks', f));
      bodyFiles.forEach(f => fd.append('bodies', f));
      const resp = await fetch(API + '/api/combine/stage', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
      hookIds = json.hookIds; hookNames = json.hookNames;
      bodyIds = json.bodyIds; bodyNames = json.bodyNames;
    } catch (err) {
      combineProgEl.style.display = 'none';
      combineErrorEl.style.display = 'block';
      combineErrorEl.textContent = 'Erro ao enviar: ' + err.message;
      combineBtn.disabled = false; return;
    }

    const total = hookIds.length * bodyIds.length;
    combineResultsEl.style.display = 'block';
    if (combineDoneN) combineDoneN.textContent = '0 / ' + total;
    const cards = [];
    hookIds.forEach((hId, hi) => {
      bodyIds.forEach((bId, bi) => {
        const card = document.createElement('div');
        card.className = 'combo-card combo-processing';
        card.innerHTML = '<div class="combo-card-info"><span class="combo-card-label">H' + (hi + 1) + ' + C' + (bi + 1) + '</span><span style="opacity:.5">⏳ gerando...</span></div>';
        combineGridEl.appendChild(card);
        cards.push({ card, hId, bId, hi, bi });
      });
    });

    let done = 0;
    for (const { card, hId, bId, hi, bi } of cards) {
      combineStatusEl.textContent = 'Gerando vídeo ' + (done + 1) + ' de ' + total + '...';
      combineDetEl.textContent = 'H' + (hi + 1) + ' + C' + (bi + 1);
      try {
        const resp = await fetch(API + '/api/concat/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookId: hId, bodyId: bId })
        });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        const url = API + json.url;
        card.className = 'combo-card';
        card.innerHTML =
          '<video src="' + url + '" controls muted playsinline></video>' +
          '<div class="combo-card-info"><span class="combo-card-label">H' + (hi + 1) + '+C' + (bi + 1) + '</span>' +
          '<a class="combo-dl" href="' + url + '" download="combo-h' + (hi + 1) + '-c' + (bi + 1) + '.mp4">⬇ Baixar</a></div>';
      } catch (err) {
        card.className = 'combo-card combo-err';
        card.innerHTML = '<div class="combo-card-info" style="padding:1rem"><span class="combo-card-label">H' + (hi + 1) + '+C' + (bi + 1) + ' — Erro</span><span style="font-size:12px;opacity:.7">' + err.message + '</span></div>';
      }
      done++;
      if (combineDoneN) combineDoneN.textContent = done + ' / ' + total;
    }

    combineProgEl.style.display = 'none'; combineStatusEl.textContent = ''; combineDetEl.textContent = '';
    combineBtn.disabled = false;
  });
}

// ════════════════════════════════════════════════════════════════════
// EXTRAIR TOOL
// ════════════════════════════════════════════════════════════════════
const extrVideoInput  = document.getElementById('extr-video-input');
const extrAudioInput  = document.getElementById('extr-audio-input');
const extrDz          = document.getElementById('extr-dz');
const extrAdz         = document.getElementById('extr-adz');
const extrFileNameEl  = document.getElementById('extr-file-name');
const extrAudioNameEl = document.getElementById('extr-audio-name');
const extrAudioZone   = document.getElementById('extr-audio-zone');
const extrLangRow     = document.getElementById('extr-lang-row');
const extrSubmitBtn   = document.getElementById('extr-submit-btn');
const extrProgress    = document.getElementById('extr-progress');
const extrStatusEl    = document.getElementById('extr-status');
const extrErrorEl     = document.getElementById('extr-error');
const extrResultCard  = document.getElementById('extr-result-card');
const extrResultVideo = document.getElementById('extr-result-video');
const extrDownloadBtn = document.getElementById('extr-download-btn');
const extrTransWrap   = document.getElementById('extr-transcript-wrap');
const extrTransText   = document.getElementById('extr-transcript-text');
const extrCopyBtn     = document.getElementById('extr-copy-btn');

let extrMode = 'video', extrVideoFile = null, extrAudioFile = null;

document.querySelectorAll('.extr-mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.extr-mode-card').forEach(c => c.classList.remove('em-active'));
    card.classList.add('em-active');
    extrMode = card.dataset.mode;
    if (extrAudioZone) extrAudioZone.classList.toggle('show', extrMode === 'merge');
    if (extrLangRow) extrLangRow.style.display = extrMode === 'transcribe' ? '' : 'none';
    updateExtrSubmit();
  });
});

if (extrVideoInput) {
  extrVideoInput.addEventListener('change', () => {
    if (!extrVideoInput.files[0]) return;
    extrVideoFile = extrVideoInput.files[0];
    extrFileNameEl.textContent = '✓ ' + extrVideoFile.name;
    extrDz.classList.add('has-file');
    updateExtrSubmit();
  });
}
if (extrAudioInput) {
  extrAudioInput.addEventListener('change', () => {
    if (!extrAudioInput.files[0]) return;
    extrAudioFile = extrAudioInput.files[0];
    extrAudioNameEl.textContent = '✓ ' + extrAudioFile.name;
    if (extrAdz) extrAdz.classList.add('has-file');
    updateExtrSubmit();
  });
}

makeDrop('extr-dz', f => f.type.startsWith('video/'), f => {
  extrVideoFile = f;
  extrFileNameEl.textContent = '✓ ' + f.name;
  if (extrDz) extrDz.classList.add('has-file');
  updateExtrSubmit();
});
makeDrop('extr-adz', f => f.type.startsWith('audio/') || f.type.startsWith('video/'), f => {
  extrAudioFile = f;
  extrAudioNameEl.textContent = '✓ ' + f.name;
  if (extrAdz) extrAdz.classList.add('has-file');
  updateExtrSubmit();
});

function updateExtrSubmit() {
  if (!extrSubmitBtn) return;
  if (!extrVideoFile) { extrSubmitBtn.disabled = true; extrSubmitBtn.textContent = 'Selecione um vídeo'; return; }
  if (extrMode === 'merge' && !extrAudioFile) { extrSubmitBtn.disabled = true; extrSubmitBtn.textContent = 'Selecione o áudio também'; return; }
  extrSubmitBtn.disabled = false;
  const labels = { video: '🎬 Extrair Vídeo Sem Áudio', transcribe: '📝 Transcrever Vídeo', merge: '🔗 Juntar Vídeo + Áudio' };
  extrSubmitBtn.textContent = labels[extrMode] || 'Processar';
}

if (extrSubmitBtn) {
  extrSubmitBtn.addEventListener('click', async () => {
    if (!extrVideoFile) return;
    if (extrMode === 'merge' && !extrAudioFile) return;
    extrSubmitBtn.disabled = true; extrSubmitBtn.textContent = '⏳ Processando...';
    extrProgress.style.display = 'block';
    extrErrorEl.style.display = 'none';
    extrResultCard.style.display = 'none';
    extrTransWrap.style.display = 'none';
    const statusMap = {
      video: 'Removendo áudio do vídeo...',
      transcribe: 'Transcrevendo com faster-whisper — pode levar alguns instantes...',
      merge: 'Juntando vídeo com o novo áudio...'
    };
    extrStatusEl.textContent = statusMap[extrMode] || 'Processando...';
    const fd = new FormData();
    fd.append('video', extrVideoFile);
    if (extrMode === 'merge') fd.append('audio', extrAudioFile);
    if (extrMode === 'transcribe') {
      fd.append('lang', document.getElementById('extr-lang').value);
      fd.append('model', document.getElementById('extr-model').value);
    }
    const endpointMap = { video: '/api/extract/video', transcribe: '/api/extract/transcribe', merge: '/api/extract/merge' };
    try {
      const resp = await fetch(API + endpointMap[extrMode], { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
      if (extrMode === 'transcribe') {
        extrTransText.textContent = json.text || '(sem resultado)';
        extrTransWrap.style.display = 'block';
        extrTransWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        const url = API + json.url;
        extrResultVideo.src = url; extrDownloadBtn.href = url;
        extrDownloadBtn.download = json.url.split('/').pop();
        extrResultCard.style.display = 'block';
        extrResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      extrErrorEl.style.display = 'block'; extrErrorEl.textContent = 'Erro: ' + err.message;
    } finally {
      extrSubmitBtn.disabled = false; extrProgress.style.display = 'none'; extrStatusEl.textContent = '';
      updateExtrSubmit();
    }
  });
}

if (extrCopyBtn) {
  extrCopyBtn.addEventListener('click', () => {
    const text = extrTransText.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      extrCopyBtn.textContent = '✓ Copiado!';
      setTimeout(() => { extrCopyBtn.textContent = '📋 Copiar texto'; }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      extrCopyBtn.textContent = '✓ Copiado!';
      setTimeout(() => { extrCopyBtn.textContent = '📋 Copiar texto'; }, 2000);
    });
  });
}

// ════════════════════════════════════════════════════════════════════
// LIPSYNC TOOL
// ════════════════════════════════════════════════════════════════════
const lipVideoInput   = document.getElementById('lip-video-input');
const lipAudioInput   = document.getElementById('lip-audio-input');
const lipFileNameEl   = document.getElementById('lip-file-name');
const lipAudioNameEl  = document.getElementById('lip-audio-name');
const lipSubmitBtn    = document.getElementById('lip-submit-btn');
const lipProgressWrap = document.getElementById('lip-progress-wrap');
const lipStatus       = document.getElementById('lip-status');
const lipResultCard   = document.getElementById('lip-result-card');
const lipResultVideo  = document.getElementById('lip-result-video');
const lipDownloadBtn  = document.getElementById('lip-download-btn');
const lipErrorMsg     = document.getElementById('lip-error-msg');
let lipVideoFile = null, lipAudioFile = null;

if (lipVideoInput) lipVideoInput.addEventListener('change', () => {
  if (!lipVideoInput.files[0]) return;
  lipVideoFile = lipVideoInput.files[0];
  lipFileNameEl.textContent = '✓ ' + lipVideoFile.name;
  document.getElementById('lip-drop-zone').classList.add('has-file');
  updateLipSubmit();
});
if (lipAudioInput) lipAudioInput.addEventListener('change', () => {
  if (!lipAudioInput.files[0]) return;
  lipAudioFile = lipAudioInput.files[0];
  lipAudioNameEl.textContent = '✓ ' + lipAudioFile.name;
  document.getElementById('lip-audio-drop-zone').classList.add('has-file');
  updateLipSubmit();
});
makeDrop('lip-drop-zone', f => f.type.startsWith('video/'), f => {
  lipVideoFile = f; lipFileNameEl.textContent = '✓ ' + f.name;
  document.getElementById('lip-drop-zone').classList.add('has-file'); updateLipSubmit();
});
makeDrop('lip-audio-drop-zone', f => f.type.startsWith('audio/'), f => {
  lipAudioFile = f; lipAudioNameEl.textContent = '✓ ' + f.name;
  document.getElementById('lip-audio-drop-zone').classList.add('has-file'); updateLipSubmit();
});
function updateLipSubmit() {
  if (lipVideoFile && lipAudioFile) { lipSubmitBtn.disabled = false; lipSubmitBtn.textContent = '💋 Sincronizar Lábios'; }
  else { lipSubmitBtn.disabled = true; lipSubmitBtn.textContent = 'Selecione o vídeo e o áudio'; }
}
if (lipSubmitBtn) {
  lipSubmitBtn.addEventListener('click', async () => {
    if (!lipVideoFile || !lipAudioFile) return;
    lipSubmitBtn.disabled = true; lipSubmitBtn.textContent = '⏳ Processando...';
    lipProgressWrap.style.display = 'block'; lipStatus.textContent = 'Enviando...';
    lipErrorMsg.style.display = 'none'; lipResultCard.style.display = 'none';
    const fd = new FormData(); fd.append('video', lipVideoFile); fd.append('audio', lipAudioFile);
    try {
      const resp = await fetch(API + '/api/lipsync', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
      if (!json.id) throw new Error('Resposta inválida do backend (sem id)');
      // Polling de progresso
      let done = false;
      let errored = false;
      let lastProgress = 0;
      while (!done && !errored) {
        await new Promise(r => setTimeout(r, 1200));
        let statusResp;
        try {
          statusResp = await fetch(API + '/api/lipsync-status/' + json.id);
        } catch (e) {
          lipStatus.textContent = 'Erro ao consultar status...';
          break;
        }
        const statusJson = await statusResp.json();
        if (!statusResp.ok || statusJson.error) {
          lipStatus.textContent = 'Erro: ' + (statusJson.error || statusResp.status);
          errored = true;
          break;
        }
        // Atualiza barra de progresso
        const pct = Math.max(0, Math.min(100, statusJson.progress || 0));
        lipStatus.textContent = statusJson.status === 'processing' ? `Processando... (${pct}%)` : (statusJson.status === 'done' ? 'Concluído!' : (statusJson.error || 'Erro'));
        lipProgressWrap.querySelector('.progress-bar').style.width = pct + '%';
        if (statusJson.status === 'done' && statusJson.url) {
          lipResultVideo.src = API + statusJson.url; lipDownloadBtn.href = API + statusJson.url;
          lipDownloadBtn.download = statusJson.url.split('/').pop();
          lipResultCard.style.display = 'block';
          lipResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          done = true;
        } else if (statusJson.status === 'error') {
          lipErrorMsg.style.display = 'block'; lipErrorMsg.textContent = 'Erro: ' + (statusJson.error || 'Falha desconhecida');
          errored = true;
        }
        lastProgress = pct;
      }
    } catch (err) {
      lipErrorMsg.style.display = 'block'; lipErrorMsg.textContent = 'Erro: ' + err.message;
    } finally {
      lipSubmitBtn.disabled = false; lipSubmitBtn.textContent = '💋 Sincronizar Lábios';
      lipProgressWrap.style.display = 'none'; lipStatus.textContent = '';
      lipProgressWrap.querySelector('.progress-bar').style.width = '0%';
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// GERAR VÍDEO COM HOOK
// ════════════════════════════════════════════════════════════════════
(function () {
  const vgApiKey    = document.getElementById('vg-apikey');
  const vgPrompt    = document.getElementById('vg-prompt');

  // Restore saved key
  const savedKey = localStorage.getItem('or_api_key');
  if (savedKey && vgApiKey) vgApiKey.value = savedKey;

  // Save key button
  const vgSaveKey = document.getElementById('vg-save-key');
  if (vgSaveKey) vgSaveKey.addEventListener('click', () => {
    if (vgApiKey && vgApiKey.value.trim()) {
      localStorage.setItem('or_api_key', vgApiKey.value.trim());
      vgSaveKey.textContent = '✅ Salvo!';
      setTimeout(() => { vgSaveKey.textContent = '💾 Salvar'; }, 1500);
    } else {
      localStorage.removeItem('or_api_key');
    }
  });
  const vgDuration  = document.getElementById('vg-duration');
  const vgDurVal    = document.getElementById('vg-duration-val');
  const vgCostEst   = document.getElementById('vg-cost-est');
  const vgSubmit    = document.getElementById('vg-submit-btn');
  const vgProgress  = document.getElementById('vg-progress');
  const vgStatus    = document.getElementById('vg-status');
  const vgError     = document.getElementById('vg-error');
  const vgRefined   = document.getElementById('vg-refined-prompt');
  const vgRefinedTx = document.getElementById('vg-refined-text');
  const vgResultCard= document.getElementById('vg-result-card');
  const vgResultVid = document.getElementById('vg-result-video');
  const vgDownBtn   = document.getElementById('vg-download-btn');
  if (!vgSubmit) return;

  let selectedVideoModel = 'google/veo-3.1';
  let selectedModelCost  = 0.40;

  // Model dropdown
  const vgSelectTrigger  = document.getElementById('vg-select-trigger');
  const vgSelectDropdown = document.getElementById('vg-select-dropdown');
  const vgSelectName     = document.getElementById('vg-select-name');
  const vgSelectDesc     = document.getElementById('vg-select-desc');
  const vgSelectPrice    = document.getElementById('vg-select-price');

  if (vgSelectTrigger && vgSelectDropdown) {
    vgSelectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = vgSelectDropdown.classList.contains('open');
      vgSelectDropdown.classList.toggle('open', !isOpen);
      vgSelectTrigger.classList.toggle('open', !isOpen);
    });

    vgSelectDropdown.querySelectorAll('.vg-option').forEach(opt => {
      opt.addEventListener('click', () => {
        vgSelectDropdown.querySelectorAll('.vg-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedVideoModel = opt.dataset.model;
        selectedModelCost  = parseFloat(opt.dataset.cost) || 0.10;
        if (vgSelectName)  vgSelectName.textContent  = opt.dataset.name;
        if (vgSelectDesc)  vgSelectDesc.textContent  = opt.dataset.desc;
        if (vgSelectPrice) vgSelectPrice.textContent = '$' + opt.dataset.cost + '/s';
        vgSelectDropdown.classList.remove('open');
        vgSelectTrigger.classList.remove('open');
        updateCostEst();
      });
    });

    document.addEventListener('click', () => {
      vgSelectDropdown.classList.remove('open');
      vgSelectTrigger.classList.remove('open');
    });
  }

  function updateCostEst() {
    if (!vgDuration || !vgCostEst) return;
    const dur = parseInt(vgDuration.value) || 8;
    if (vgDurVal) vgDurVal.textContent = dur + 's';
    const cost = (dur * selectedModelCost).toFixed(2);
    vgCostEst.textContent = '$' + cost;
  }

  if (vgDuration) {
    vgDuration.addEventListener('input', updateCostEst);
    updateCostEst();
  }

  vgSubmit.addEventListener('click', async () => {
    const apiKey = vgApiKey ? vgApiKey.value.trim() : '';
    const prompt = vgPrompt ? vgPrompt.value.trim() : '';
    if (!apiKey) { alert('Informe sua API key da OpenRouter'); return; }
    if (!prompt) { alert('Escreva sua ideia no campo de comando'); return; }

    vgSubmit.disabled = true; vgSubmit.textContent = '⏳ Gerando...';
    vgProgress.style.display = 'block'; vgStatus.textContent = '🎬 Enviando para ' + selectedVideoModel + '...';
    vgError.style.display = 'none'; vgRefined.style.display = 'none'; vgResultCard.style.display = 'none';

    try {
      const resp = await fetch(API + '/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          videoModel: selectedVideoModel,
          duration: vgDuration ? parseInt(vgDuration.value) : 8,
          apiKey
        })
      });

      vgStatus.textContent = '🎬 Aguardando resposta de ' + selectedVideoModel + '...';
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);

      if (json.url) {
        vgResultVid.src = json.url;
        vgDownBtn.href = json.url;
        vgResultCard.style.display = 'block';
        vgResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      vgError.style.display = 'block'; vgError.textContent = 'Erro: ' + err.message;
    } finally {
      vgSubmit.disabled = false; vgSubmit.textContent = '🎬 Gerar Vídeo';
      vgProgress.style.display = 'none'; vgStatus.textContent = '';
    }
  });

  // ─── IMAGE GENERATION ─────────────────────────────────────────────────────
  (function initImageGen() {
    const igSubmit = document.getElementById('ig-submit-btn');
    if (!igSubmit) return;

    let currentProvider = localStorage.getItem('ig_provider') || 'vertex';
    let selectedModel = 'imagen-3.0-generate-001';
    let selectedModelName = 'Imagen 3';

    // Restore saved keys
    const igApikeyOR     = document.getElementById('ig-apikey');
    const igApikeyGoogle = document.getElementById('ig-google-apikey');
    const savedOR     = localStorage.getItem('or_api_key');
    const savedGoogle = localStorage.getItem('google_api_key');
    if (igApikeyOR && savedOR)         igApikeyOR.value = savedOR;
    if (igApikeyGoogle && savedGoogle) igApikeyGoogle.value = savedGoogle;
    const savedVertexProject = localStorage.getItem('vertex_project_id');
    const savedVertexToken   = localStorage.getItem('vertex_access_token');
    const elVProj  = document.getElementById('ig-vertex-project');
    const elVToken = document.getElementById('ig-vertex-token');
    if (elVProj  && savedVertexProject) elVProj.value  = savedVertexProject;
    if (elVToken && savedVertexToken)   elVToken.value = savedVertexToken;

    // Provider toggle
    const igTrigger  = document.getElementById('ig-select-trigger');
    const igDropdown = document.getElementById('ig-select-dropdown');
    const igSelName  = document.getElementById('ig-select-name');
    const igSelDesc  = document.getElementById('ig-select-desc');

    function setProvider(p) {
      currentProvider = p;
      localStorage.setItem('ig_provider', p);
      document.querySelectorAll('.ig-provider-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.provider === p);
      });
      const orWrap     = document.getElementById('ig-or-key-wrap');
      const googleWrap = document.getElementById('ig-google-key-wrap');
      const vertexWrap = document.getElementById('ig-vertex-key-wrap');
      if (orWrap)     orWrap.style.display     = p === 'openrouter' ? '' : 'none';
      if (googleWrap) googleWrap.style.display = p === 'google'     ? '' : 'none';
      if (vertexWrap) vertexWrap.style.display = p === 'vertex'     ? '' : 'none';
      // Show/hide model options by provider
      if (igDropdown) {
        igDropdown.querySelectorAll('.vg-option').forEach(opt => {
          opt.style.display = opt.dataset.provider === p ? '' : 'none';
        });
        // Auto-select first visible option for the new provider
        const first = igDropdown.querySelector(`.vg-option[data-provider="${p}"]`);
        if (first) {
          igDropdown.querySelectorAll('.vg-option').forEach(o => o.classList.remove('active'));
          first.classList.add('active');
          selectedModel     = first.dataset.model;
          selectedModelName = first.dataset.name;
          if (igSelName) igSelName.textContent = first.dataset.name;
          if (igSelDesc) igSelDesc.textContent = first.dataset.desc;
        }
      }
    }

    document.querySelectorAll('.ig-provider-btn').forEach(btn => {
      btn.addEventListener('click', () => setProvider(btn.dataset.provider));
    });
    setProvider(currentProvider);

    // Save keys
    const igSaveKey = document.getElementById('ig-save-key');
    if (igSaveKey) igSaveKey.addEventListener('click', () => {
      if (igApikeyOR && igApikeyOR.value.trim()) {
        localStorage.setItem('or_api_key', igApikeyOR.value.trim());
        igSaveKey.textContent = '✅ Salvo!';
        setTimeout(() => { igSaveKey.textContent = '💾 Salvar'; }, 1500);
      }
    });
    const igGoogleSaveKey = document.getElementById('ig-google-save-key');
    if (igGoogleSaveKey) igGoogleSaveKey.addEventListener('click', () => {
      if (igApikeyGoogle && igApikeyGoogle.value.trim()) {
        localStorage.setItem('google_api_key', igApikeyGoogle.value.trim());
        igGoogleSaveKey.textContent = '✅ Salvo!';
        setTimeout(() => { igGoogleSaveKey.textContent = '💾 Salvar'; }, 1500);
      }
    });
    const igVertexSaveKey = document.getElementById('ig-vertex-save-token');
    if (igVertexSaveKey) igVertexSaveKey.addEventListener('click', () => {
      const proj  = document.getElementById('ig-vertex-project')?.value.trim();
      const token = document.getElementById('ig-vertex-token')?.value.trim();
      if (proj)  localStorage.setItem('vertex_project_id', proj);
      if (token) localStorage.setItem('vertex_access_token', token);
      igVertexSaveKey.textContent = '✅ Salvo!';
      setTimeout(() => { igVertexSaveKey.textContent = '💾 Salvar'; }, 1500);
    });

    // Tabs
    let currentMode = 'clone';
    document.querySelectorAll('.ig-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ig-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ig-mode-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.mode;
        const panel = document.getElementById('ig-panel-' + currentMode);
        if (panel) panel.classList.add('active');
      });
    });

    // Upload previews
    function setupUpload(inputId, previewId, boxId) {
      const input   = document.getElementById(inputId);
      const preview = document.getElementById(previewId);
      const box     = document.getElementById(boxId);
      if (!input || !preview) return;
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          preview.src = e.target.result;
          preview.classList.add('visible');
          if (box) box.classList.add('has-file');
          box.querySelectorAll('.ig-upload-icon, .ig-upload-hint').forEach(el => el.style.display = 'none');
        };
        reader.readAsDataURL(file);
      });
    }
    setupUpload('ig-ref-input',  'ig-ref-preview',  'ig-ref-box');
    setupUpload('ig-prod-input', 'ig-prod-preview', 'ig-prod-box');

    // Model dropdown
    if (igTrigger) igTrigger.addEventListener('click', e => {
      e.stopPropagation();
      igTrigger.classList.toggle('open');
      igDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      if (igTrigger)  igTrigger.classList.remove('open');
      if (igDropdown) igDropdown.classList.remove('open');
    });
    if (igDropdown) igDropdown.addEventListener('click', e => {
      const opt = e.target.closest('.vg-option');
      if (!opt) return;
      igDropdown.querySelectorAll('.vg-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedModel     = opt.dataset.model;
      selectedModelName = opt.dataset.name;
      if (igSelName) igSelName.textContent = opt.dataset.name;
      if (igSelDesc) igSelDesc.textContent = opt.dataset.desc;
      igTrigger.classList.remove('open');
      igDropdown.classList.remove('open');
    });

    // Submit
    const igProgress = document.getElementById('ig-progress');
    const igStatus   = document.getElementById('ig-status');
    const igError    = document.getElementById('ig-error');
    const igResult   = document.getElementById('ig-result-card');
    const igImg      = document.getElementById('ig-result-img');
    const igDown     = document.getElementById('ig-download-btn');

    igSubmit.addEventListener('click', async () => {
      // Só AI Studio
      const accessToken = elVToken ? elVToken.value.trim() : '';
      const projectId  = elVProj  ? elVProj.value.trim()  : '';
      if (!accessToken) { alert('Informe seu Access Token OAuth2 do Vertex AI'); return; }
      if (!projectId)   { alert('Informe o Project ID do Google Cloud'); return; }

      const prompt = currentMode === 'clone'
        ? (document.getElementById('ig-clone-prompt')?.value.trim() || '')
        : (document.getElementById('ig-create-prompt')?.value.trim() || '');
      if (!prompt) { alert('Escreva um prompt'); return; }

      let referenceBase64 = null;
      let productBase64   = null;
      if (currentMode === 'clone') {
        const refInput  = document.getElementById('ig-ref-input');
        const prodInput = document.getElementById('ig-prod-input');
        if (refInput?.files?.[0])  referenceBase64 = await fileToDataUrl(refInput.files[0]);
        if (prodInput?.files?.[0]) productBase64   = await fileToDataUrl(prodInput.files[0]);
      }

      igSubmit.disabled = true; igSubmit.textContent = '⏳ Gerando...';
      igProgress.style.display = 'block';
      igStatus.textContent = '🖼️ Enviando para ' + selectedModelName + '...';
      igError.style.display = 'none'; igResult.style.display = 'none';

      try {
        const resp = await fetch(API + '/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
          body: JSON.stringify({ prompt, imageModel: selectedModel, projectId, mode: currentMode, referenceBase64, productBase64 })
        });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        if (json.url) {
          igImg.src = json.url;
          igDown.href = json.url;
          igDown.download = 'imagem-gerada.png';
          igResult.style.display = 'block';
          igResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (err) {
        igError.style.display = 'block';
        igError.style.whiteSpace = 'pre-line';
        igError.textContent = err.message;
      } finally {
        igSubmit.disabled = false; igSubmit.textContent = '🖼️ Gerar Imagem';
        igProgress.style.display = 'none'; igStatus.textContent = '';
      }
    });

    function fileToDataUrl(file) {
      return new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(file);
      });
    }
  })();
})();
