// ════════════════════════════════════════════════════════════════════
// BIBLIOTECA GERAL DE VÍDEOS
// ════════════════════════════════════════════════════════════════════
const videoLibrarySection = document.getElementById('tool-video-library');
const videoLibraryGrid = document.getElementById('video-library-grid');
const LIB_GROUPS = [
  { type: 'watermark',  icon: '🚫', title: 'Remoção de Marca d\'água' },
  { type: 'subtitle',   icon: '💬', title: 'Legendas' },
  { type: 'trim',       icon: '✂️',  title: 'Cortados' },
  { type: 'resize',     icon: '⬛',  title: 'Redimensionados' },
  { type: 'compress',   icon: '📦', title: 'Comprimidos' },
  { type: 'upscale',    icon: '🔷', title: 'Qualidade Aumentada' },
  { type: 'mirror',     icon: '↔️',  title: 'Espelhados' },
  { type: 'rembg',      icon: '🖼️',  title: 'Fundo Removido' },
  { type: 'video-gen',  icon: '🎬', title: 'Geração de Vídeo' },
  { type: 'lipsync',    icon: '💋', title: 'Lipsync' },
  { type: 'translate',  icon: '🌐', title: 'Tradução de Vídeo' },
];

function formatExpiry(expiresAt) {
  if (!expiresAt) return '';
  const ms = expiresAt - Date.now();
  if (ms <= 0) return '⏰ Expirado';
  const min = Math.floor(ms / 60000);
  const hr  = Math.floor(min / 60);
  if (hr > 0) return `⏰ Apaga em ${hr}h ${min % 60}m`;
  return `⏰ Apaga em ${min}m`;
}

function renderVideoCard(item) {
  const isReady  = !item.status || item.status === 'done';
  const isProc   = item.status === 'processing';
  const isErr    = item.status === 'error';
  const pct      = item.progress != null ? item.progress : (isReady ? 100 : 0);
  const expiry   = isReady ? formatExpiry(item.expiresAt) : '';
  const filename = item.url ? item.url.split('/').pop() : 'processando…';
  const displayName = item.friendlyName || filename;
  return `
    <div class="video-card" data-id="${item.id || ''}">
      ${isReady && item.url
        ? item.mediaType === 'image'
          ? `<img src="${API + item.url}" class="lib-img" alt="${item.label || 'imagem'}">`
          : `<video src="${API + item.url}" controls muted playsinline preload="metadata"></video>`
        : `<div class="video-card-placeholder">${isProc ? '⏳' : '❌'}</div>`
      }
      <div class="video-card-info">
        <div class="video-card-label">${item.label || ''}</div>
        <div class="video-card-title">${displayName}</div>
        ${isProc ? `
          <div class="lib-progress-bar"><div class="lib-progress-fill" style="width:${pct}%"></div></div>
          <div class="video-card-meta">⏳ ${pct}% — processando…</div>` : ''}
        ${isReady ? `<div class="video-card-meta">${expiry}</div>` : ''}
        ${isErr   ? `<div class="video-card-meta" style="color:#f87171">❌ Erro no processamento</div>` : ''}
        <div class="video-card-actions">
          ${isReady && item.url ? `<a href="${API + item.url}" download="${displayName}" class="video-card-dl">⬇ Baixar</a>` : ''}
        </div>
      </div>
    </div>`;
}

function renderVideoLibrary(items) {
  if (!videoLibraryGrid) return;
  if (!items.length) {
    videoLibraryGrid.innerHTML = '<div class="empty-msg">Nenhum vídeo na biblioteca ainda.</div>';
    return;
  }
  let html = '';
  LIB_GROUPS.forEach(group => {
    const groupItems = items.filter(i => i.type === group.type);
    if (!groupItems.length) return;
    html += `<div class="lib-section">
      <div class="lib-section-title">${group.icon} ${group.title}</div>
      <div class="lib-cards-row">${groupItems.map(renderVideoCard).join('')}</div>
    </div>`;
  });
  // Items sem tipo conhecido
  const knownTypes = LIB_GROUPS.map(g => g.type);
  const others = items.filter(i => !knownTypes.includes(i.type));
  if (others.length) {
    html += `<div class="lib-section">
      <div class="lib-section-title">📁 Outros</div>
      <div class="lib-cards-row">${others.map(renderVideoCard).join('')}</div>
    </div>`;
  }
  videoLibraryGrid.innerHTML = html;
}

let _libRefreshTimer = null;
async function fetchVideoLibrary() {
  try {
    const resp = await fetch(API + '/api/video-library');
    const json = await resp.json();
    if (!json.items) return;
    renderVideoLibrary(json.items);
    // Refresh mais rápido se há itens processando
    const hasProcessing = json.items.some(i => i.status === 'processing');
    const delay = hasProcessing ? 3000 : 8000;
    clearTimeout(_libRefreshTimer);
    if (videoLibrarySection && videoLibrarySection.style.display !== 'none') {
      _libRefreshTimer = setTimeout(fetchVideoLibrary, delay);
    }
  } catch (e) {
    if (videoLibraryGrid) videoLibraryGrid.innerHTML = '<div class="error-msg">Erro ao carregar biblioteca.</div>';
  }
}

const API = '';

// ── TOOL NAVIGATION ────────────────────────────────────────────────────────
const CAT_MAP = {
  watermark: 'video', subtitle: 'video', trim: 'video', resize: 'video',
  compress: 'video', upscale: 'video', mirror: 'video', extrair: 'video', combine: 'video',
  translate: 'video', autotr: 'video', autohook: 'video', autocorpo: 'video', automontador: 'video', ferramentas: 'video', swapfala: 'video',
  'video-library': null
};

const FERR_TOOLS = new Set(['watermark','cortes','resize','compress','upscale','mirror','extrair','combine','translate','swapfala','gencenas']);

function showTool(name) {
  if (name === 'ferramentas') name = 'watermark';
  document.querySelectorAll('.tool-panel').forEach(p => {
    p.style.display = p.id === 'tool-' + name ? 'block' : 'none';
  });
  // ferramentas tab strip
  const tabStrip = document.getElementById('ftools-tab-strip');
  if (tabStrip) {
    tabStrip.style.display = FERR_TOOLS.has(name) ? '' : 'none';
    tabStrip.querySelectorAll('.ftab').forEach(b => {
      b.classList.toggle('active', b.dataset.ftool === name);
    });
  }
  // nav item active state
  const activeNavTool = FERR_TOOLS.has(name) ? 'ferramentas' : name;
  document.querySelectorAll('.nav-item[data-tool], .nav-direct[data-tool]').forEach(item => {
    item.classList.toggle('active', item.dataset.tool === activeNavTool);
  });
  // auto-open the category group that contains this tool
  const cat = CAT_MAP[name];
  if (cat) {
    const group = document.getElementById('cat-' + cat);
    if (group && !group.classList.contains('open')) group.classList.add('open');
  }
}

// ── accordion: toggle group open/close on header click ──
document.querySelectorAll('.nav-group-header').forEach(header => {
  header.addEventListener('click', () => {
    const group = header.closest('.nav-group');
    group.classList.toggle('open');
  });
});

// ── nav item clicks ──
document.querySelectorAll('.nav-item[data-tool]').forEach(item => {
  item.addEventListener('click', () => showTool(item.dataset.tool));
});
document.querySelectorAll('.nav-direct[data-tool]').forEach(item => {
  item.addEventListener('click', () => {
    showTool(item.dataset.tool);
    if (item.dataset.tool === 'video-library') {
      clearTimeout(_libRefreshTimer); fetchVideoLibrary();
    }
  });
});
document.querySelectorAll('.ftab').forEach(btn => {
  btn.addEventListener('click', () => showTool(btn.dataset.ftool));
});
// Initialize: show tab strip for default tool (watermark)
showTool('watermark');

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
  simple: '⚡ Remoção rápida via FFmpeg — ideal para testes. Pode deixar leve artefato na borda.',
  delogo: '✨ Reconstrução avançada de pixels com OpenCV — mais lento, resultado muito mais realista.',
  sora:   '🎵 Detecta automaticamente onde a marca d\'água do Sora está em cada frame e reconstrói apenas ali — sem apagar área fixa.',
  heygen: '🤖 Remove automaticamente a marca d\'água do HeyGen (canto inferior direito). Sem precisar selecionar região.',
  ai:     'Inpainting com IA — em breve neste servidor.'
};

const autoModes = new Set(['sora', 'heygen']);

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    if (modeDescEl) modeDescEl.textContent = modeDesc[selectedMode] || '';
    // Modos automáticos não precisam de seleção de região
    if (previewSect) previewSect.style.display = autoModes.has(selectedMode) ? 'none' : (selectedFile ? '' : 'none');
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

const ASYNC_MODES = new Set(['delogo', 'sora']);

// ── OpenRouter watermark detect (main WM tool) ──
let detectedTimeRanges = null; // set by AI analyze, used in submit
(function() {
  const orKeyInput   = document.getElementById('wm-or-key');
  const orSaveBtn    = document.getElementById('wm-or-save-btn');
  const orDetectBtn  = document.getElementById('wm-or-detect-btn');
  const orStatus     = document.getElementById('wm-or-status');
  const orError      = document.getElementById('wm-or-error');
  const detectedInfo = document.getElementById('wm-detected-info');
  const detectedRangesEl = document.getElementById('wm-detected-ranges');
  if (!orDetectBtn) return;
  const saved = localStorage.getItem('wm_or_key');
  if (saved && orKeyInput) orKeyInput.value = saved;
  if (orSaveBtn && orKeyInput) {
    orSaveBtn.addEventListener('click', () => {
      const v = orKeyInput.value.trim();
      if (v) { localStorage.setItem('wm_or_key', v); orSaveBtn.textContent = '✅'; setTimeout(() => orSaveBtn.textContent = '💾', 2000); }
    });
  }
  orDetectBtn.addEventListener('click', async () => {
    if (!selectedFile) { if (orError) { orError.textContent = 'Selecione um vídeo primeiro.'; orError.style.display = ''; } return; }
    const key = (orKeyInput && orKeyInput.value.trim()) || localStorage.getItem('wm_or_key') || '';
    if (!key) { if (orError) { orError.textContent = 'Informe a OpenRouter API Key.'; orError.style.display = ''; } return; }
    if (!selRect || selRect.w < 5 || selRect.h < 5) {
      if (orError) { orError.textContent = 'Marque a região aproximada da marca d\'água no vídeo primeiro.'; orError.style.display = ''; }
      return;
    }
    orDetectBtn.disabled = true;
    if (orError) { orError.textContent = ''; orError.style.display = 'none'; }
    if (detectedInfo) detectedInfo.style.display = 'none';
    detectedTimeRanges = null;
    if (orStatus) orStatus.textContent = '🔍 Analisando frames com IA…';
    try {
      const fd = new FormData();
      fd.append('video', selectedFile);
      fd.append('orKey', key);
      fd.append('x', Math.round(selRect.x * videoW / previewW));
      fd.append('y', Math.round(selRect.y * videoH / previewH));
      fd.append('w', Math.round(selRect.w * videoW / previewW));
      fd.append('h', Math.round(selRect.h * videoH / previewH));
      const r = await fetch(API + '/api/watermark/analyze', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro');
      // Update canvas rect to tight bbox if returned
      if (j.tight_bbox && j.tight_bbox.w > 0) {
        selRect = {
          x: j.tight_bbox.x * previewW / videoW,
          y: j.tight_bbox.y * previewH / videoH,
          w: j.tight_bbox.w * previewW / videoW,
          h: j.tight_bbox.h * previewH / videoH
        };
        drawFrame();
      }
      // Display detected ranges
      if (j.detected_ranges && j.detected_ranges.length > 0) {
        detectedTimeRanges = j.detected_ranges;
        const rangeText = j.detected_ranges.map(r => {
          const fmt = s => { const m = Math.floor(s/60); return m > 0 ? `${m}m${Math.round(s%60)}s` : `${Math.round(s)}s`; };
          return `${fmt(r.start)} – ${fmt(r.end)}`;
        }).join(',  ');
        if (detectedRangesEl) detectedRangesEl.textContent = rangeText;
        if (detectedInfo) detectedInfo.style.display = '';
        if (orStatus) orStatus.textContent = `✓ Detectado em ${j.detected_ranges.length} trecho(s) — ${j.frame_count || ''} frames analisados`;
      } else {
        if (orStatus) orStatus.textContent = '⚠️ Nenhuma marca d\'água detectada nos frames analisados.';
        if (j.tight_bbox) {
          if (orStatus) orStatus.textContent += ` Bbox ajustado: ${j.tight_bbox.w}×${j.tight_bbox.h}px`;
        }
      }
      submitBtn.disabled = false;
    } catch(e) {
      if (orError) { orError.textContent = e.message; orError.style.display = ''; }
      if (orStatus) orStatus.textContent = '';
    } finally {
      orDetectBtn.disabled = false;
    }
  });
})();

submitBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  if (!autoModes.has(selectedMode) && (!selRect || selRect.w < 5 || selRect.h < 5)) {
    showError('Selecione a região da marca d\'água no vídeo antes de processar.'); return;
  }
  const fd = new FormData();
  fd.append('video', selectedFile); fd.append('mode', selectedMode);
  if (!autoModes.has(selectedMode) && selRect && selRect.w >= 5 && selRect.h >= 5) {
    fd.append('x', Math.round(selRect.x * videoW / previewW));
    fd.append('y', Math.round(selRect.y * videoH / previewH));
    fd.append('w', Math.round(selRect.w * videoW / previewW));
    fd.append('h', Math.round(selRect.h * videoH / previewH));
  }
  // Pass AI-detected time ranges if available
  if (detectedTimeRanges && detectedTimeRanges.length > 0) {
    fd.append('time_ranges', JSON.stringify(detectedTimeRanges));
  }
  setLoadingWm(true, 0); clearError(); resultCard.style.display = 'none';
  try {
    const resp = await fetch(API + '/api/process', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
    if (json.status === 'processing' && json.id) {
      await pollProcessJob(json.id);
    } else {
      showWmResult(json.url, json.friendlyName);
    }
  } catch (err) { showError(err.message); }
  finally { setLoadingWm(false, 0); }
});

async function pollProcessJob(jobId) {
  while (true) {
    await new Promise(r => setTimeout(r, 2500));
    const resp = await fetch(API + `/api/process-status/${jobId}`);
    const job  = await resp.json();
    if (job.status === 'done')  { showWmResult(job.url, job.friendlyName); return; }
    if (job.status === 'error') throw new Error(job.error || 'Processamento falhou');
    setLoadingWm(true, job.progress || 0);
  }
}

function showWmResult(url, friendlyName) {
  resultVideo.src = API + url; downloadBtn.href = API + url;
  downloadBtn.download = friendlyName || url.split('/').pop();
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setLoadingWm(on, pct) {
  submitBtn.disabled = on;
  const bar = progressWrap ? progressWrap.querySelector('.progress-bar') : null;
  if (bar) {
    if (pct > 0) {
      bar.style.width = pct + '%'; bar.style.animation = 'none';
      bar.style.background = 'linear-gradient(90deg,var(--accent),#a78bfa)';
    } else {
      bar.style.width = ''; bar.style.animation = ''; bar.style.background = '';
    }
  }
  submitBtn.textContent = on ? (pct > 0 ? `⏳ ${pct}%...` : '⏳ Enviando...') : '▶ Processar Vídeo';
  progressWrap.style.display = on ? 'block' : 'none';
  statusText.textContent = on
    ? (pct > 0 ? `Processando… ${pct}% — isso pode levar alguns minutos` : 'Iniciando — aguarde…')
    : '';
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
const subUppercaseBtn = document.getElementById('sub-uppercase-btn');
const subAddBtn       = document.getElementById('sub-add-btn');
const subEntriesEl    = document.getElementById('sub-entries');
const subEmptyEl      = document.getElementById('sub-empty');

// Restore/save OpenRouter key for subtitles
(function() {
  const keyEl  = document.getElementById('sub-openrouter-key');
  const saveEl = document.getElementById('sub-or-save-btn');
  if (!keyEl || !saveEl) return;
  const saved = localStorage.getItem('sub_or_key');
  if (saved) { keyEl.value = saved; saveEl.textContent = '✅'; }
  saveEl.addEventListener('click', () => { localStorage.setItem('sub_or_key', keyEl.value.trim()); saveEl.textContent = '✅'; });
  keyEl.addEventListener('input', () => { saveEl.textContent = '💾'; });
})();

let subFile = null, subEntries = [], subPreset = 'classico', subWordByWord = false, subEntryAnim = 'none', subUppercase = false;
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

  // Compute font size scaled to preview (video is 1920px wide, fontsize is in that space)
  const fsRaw = subFontSize ? parseInt(subFontSize.value) || 72 : 72;
  // scale font proportionally to preview width (video reference = 1920px)
  const scaleFactor = subPreviewW / 1920;
  const fs = Math.max(8, Math.round(fsRaw * scaleFactor));

  // Draw subtitle block — height adapts to font size
  const lineH = fs * 1.5;
  // karaoke shows 2 lines, others 1 line
  const lines = subPreset === 'karaoke' ? 2 : 1;
  const bPad = fs * 0.4;
  const bW = subPreviewW * SUB_BLOCK_W_FRAC;
  const bH = lineH * lines + bPad * 2;
  const bX = subBlockX * subPreviewW - bW / 2;
  const bY = subBlockY * subPreviewH - bH / 2;

  subCtx.fillStyle = 'rgba(108,99,255,0.18)';
  roundRect(subCtx, bX, bY, bW, bH, 8);
  subCtx.fill();
  subCtx.strokeStyle = subBlockDragging ? '#ffffff' : '#6c63ff';
  subCtx.lineWidth = 2; subCtx.setLineDash([5, 3]);
  roundRect(subCtx, bX, bY, bW, bH, 8); subCtx.stroke(); subCtx.setLineDash([]);

  subCtx.textAlign = 'center';
  subCtx.textBaseline = 'middle';

  const sampleText = subUppercase ? 'LEGENDA MODELO' : 'Legenda Modelo';

  if (subPreset === 'karaoke') {
    // Show two rows — simulate karaoke: previous white, current yellow
    const row1 = subUppercase ? 'TEXTO ANTERIOR' : 'texto anterior';
    const row2Parts = [
      { text: subUppercase ? 'PALAVRA ' : 'palavra ', color: '#fff' },
      { text: subUppercase ? 'DESTAQUE' : 'destaque', color: '#FFFF00' }
    ];
    const y1 = bY + bPad + lineH * 0.5;
    const y2 = bY + bPad + lineH * 1.5;

    // Row 1 (white)
    subCtx.font = `bold ${fs}px Arial Black, Arial, sans-serif`;
    subCtx.lineWidth = Math.max(2, fs * 0.08);
    subCtx.strokeStyle = '#000'; subCtx.fillStyle = '#fff';
    subCtx.strokeText(row1, bX + bW / 2, y1);
    subCtx.fillText(row1, bX + bW / 2, y1);

    // Row 2 (word by word colored) — approximate positioning
    const word1W = subCtx.measureText(row2Parts[0].text).width;
    const word2W = subCtx.measureText(row2Parts[1].text).width;
    const totalW = word1W + word2W;
    let cx = bX + bW / 2 - totalW / 2;
    row2Parts.forEach(part => {
      const w = subCtx.measureText(part.text).width;
      subCtx.strokeStyle = '#000'; subCtx.fillStyle = part.color;
      subCtx.strokeText(part.text, cx + w / 2, y2);
      subCtx.fillText(part.text, cx + w / 2, y2);
      cx += w;
    });
  } else {
    // Normal single-line preview
    subCtx.font = `bold ${fs}px Arial, sans-serif`;
    subCtx.lineWidth = Math.max(2, fs * 0.06);
    subCtx.strokeStyle = '#000'; subCtx.fillStyle = '#fff';
    const cy = bY + bH / 2;
    subCtx.strokeText(sampleText, bX + bW / 2, cy);
    subCtx.fillText(sampleText, bX + bW / 2, cy);
  }

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
  const fsRaw = subFontSize ? parseInt(subFontSize.value) || 72 : 72;
  const scaleFactor = subPreviewW / 1920;
  const fs = Math.max(8, Math.round(fsRaw * scaleFactor));
  const lineH = fs * 1.5;
  const lines = subPreset === 'karaoke' ? 2 : 1;
  const bPad = fs * 0.4;
  const bW = subPreviewW * SUB_BLOCK_W_FRAC;
  const bH = lineH * lines + bPad * 2;
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
    // karaoke forces word-by-word mode visually (handled in backend)
  });
});

// Entry animation (fade/pop/slide_up)
document.querySelectorAll('#entry-anim-btns .anim-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#entry-anim-btns .anim-btn').forEach(b => b.classList.remove('ea-active'));
    btn.classList.add('ea-active');
    subEntryAnim = btn.dataset.entry || 'none';
  });
});

// Animation mode
document.querySelectorAll('.anim-btn:not(#entry-anim-btns .anim-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.anim-btn:not(#entry-anim-btns .anim-btn)').forEach(b => b.classList.remove('pa-active'));
    btn.classList.add('pa-active');
    subWordByWord = btn.dataset.anim === 'word';
  });
});

// Font size
if (subFontSize) subFontSize.addEventListener('input', () => { subFontSizeVal.textContent = subFontSize.value; });

// Uppercase toggle
if (subUppercaseBtn) {
  subUppercaseBtn.addEventListener('click', () => {
    subUppercase = !subUppercase;
    subUppercaseBtn.classList.toggle('uc-active', subUppercase);
  });
}

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
    fd.append('animation', subEntryAnim);
    fd.append('uppercase', subUppercase ? '1' : '0');
    fd.append('posX', posX);
    fd.append('posY', posY);

    let endpoint;
    if (subSubMode === 'auto') {
      endpoint = '/api/subtitle/auto';
      fd.append('lang', document.getElementById('sub-auto-lang').value);
      fd.append('model', document.getElementById('sub-auto-model').value);
      const orKey = document.getElementById('sub-openrouter-key')?.value.trim();
      const orModel = document.getElementById('sub-openrouter-model')?.value;
      if (orKey) { fd.append('openrouter_key', orKey); fd.append('openrouter_model', orModel || 'openai/gpt-4o-mini'); }
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
      subDownloadBtn.download = json.friendlyName || json.url.split('/').pop();
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
    combineStatusEl.textContent = 'Gerando ' + total + ' vídeos em paralelo…';
    await Promise.all(cards.map(async ({ card, hId, bId, hi, bi }) => {
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
      combineStatusEl.textContent = done + ' de ' + total + ' concluídos…';
    }));

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
const extrResultAudio = document.getElementById('extr-result-audio');

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
  const labels = { video: '🎬 Extrair Vídeo Sem Áudio', audio: '🎵 Extrair Áudio MP3', transcribe: '📝 Transcrever Vídeo', merge: '🔗 Juntar Vídeo + Áudio' };
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
      video:      'Removendo áudio do vídeo...',
      audio:      'Extraindo trilha de áudio como MP3...',
      transcribe: 'Transcrevendo com faster-whisper — pode levar alguns instantes...',
      merge:      'Juntando vídeo com o novo áudio...'
    };
    extrStatusEl.textContent = statusMap[extrMode] || 'Processando...';
    const fd = new FormData();
    fd.append('video', extrVideoFile);
    if (extrMode === 'merge') fd.append('audio', extrAudioFile);
    if (extrMode === 'transcribe') {
      fd.append('lang', document.getElementById('extr-lang').value);
      fd.append('model', document.getElementById('extr-model').value);
    }
    const endpointMap = { video: '/api/extract/video', audio: '/api/extract/audio', transcribe: '/api/extract/transcribe', merge: '/api/extract/merge' };
    try {
      const resp = await fetch(API + endpointMap[extrMode], { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
      if (extrMode === 'transcribe') {
        extrTransText.textContent = json.text || '(sem resultado)';
        extrTransWrap.style.display = 'block';
        extrTransWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (extrMode === 'audio') {
        const url = API + json.url;
        if (extrResultAudio) { extrResultAudio.src = url; extrResultAudio.style.display = 'block'; }
        extrResultVideo.style.display = 'none';
        extrDownloadBtn.href = url; extrDownloadBtn.download = json.friendlyName || json.url.split('/').pop();
        extrDownloadBtn.textContent = '⬇ Baixar MP3';
        extrResultCard.style.display = 'block';
        extrResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        const url = API + json.url;
        if (extrResultAudio) { extrResultAudio.style.display = 'none'; extrResultAudio.src = ''; }
        extrResultVideo.style.display = ''; extrResultVideo.src = url;
        extrDownloadBtn.href = url; extrDownloadBtn.download = json.friendlyName || json.url.split('/').pop();
        extrDownloadBtn.textContent = '⬇ Baixar Vídeo';
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
          lipDownloadBtn.download = statusJson.friendlyName || statusJson.url.split('/').pop();
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
// NOVAS FERRAMENTAS — helpers genéricos
// ════════════════════════════════════════════════════════════════════
function fmtBytes(b) {
  if (!b) return '?';
  if (b >= 1073741824) return (b/1073741824).toFixed(2) + ' GB';
  if (b >= 1048576) return (b/1048576).toFixed(1) + ' MB';
  return (b/1024).toFixed(0) + ' KB';
}

function makeSimpleTool({ fileInputId, dropZoneId, fileNameId, submitBtnId,
    progressId, statusId, errorId, resultCardId, resultVideoId, downloadBtnId,
    endpoint, buildFormData, onResult }) {
  const fi   = document.getElementById(fileInputId);
  const dz   = document.getElementById(dropZoneId);
  const fn   = document.getElementById(fileNameId);
  const sub  = document.getElementById(submitBtnId);
  const prog = document.getElementById(progressId);
  const stat = document.getElementById(statusId);
  const err  = document.getElementById(errorId);
  const rc   = document.getElementById(resultCardId);
  const rv   = document.getElementById(resultVideoId);
  const dl   = document.getElementById(downloadBtnId);
  if (!fi || !sub) return;
  let file = null;

  function setFile(f) {
    if (!f) return;
    file = f;
    if (fn) fn.textContent = '✓ ' + f.name + ' (' + fmtBytes(f.size) + ')';
    if (dz) dz.classList.add('has-file');
    sub.disabled = false; sub.textContent = '▶ Processar';
    if (err) err.style.display = 'none';
  }
  fi.addEventListener('change', () => { if (fi.files[0]) setFile(fi.files[0]); });
  if (dz) {
    let cnt = 0;
    dz.addEventListener('dragenter', e => { e.preventDefault(); cnt++; dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; dz.classList.remove('drag-over'); } });
    dz.addEventListener('dragover', e => e.preventDefault());
    dz.addEventListener('drop', e => {
      e.preventDefault(); cnt = 0; dz.classList.remove('drag-over');
      const f = e.dataTransfer.files[0]; if (f) setFile(f);
    });
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fi.click(); });
  }

  function applyResult(json) {
    if (rv) rv.src = API + json.url;
    if (dl) { dl.href = API + json.url; dl.download = json.friendlyName || json.url.split('/').pop(); }
    if (onResult) onResult(json, file);
    if (rc) { rc.style.display = 'block'; rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    sub.disabled = false; sub.textContent = '▶ Processar';
    const bar = prog?.querySelector('.progress-bar');
    if (bar) { bar.style.width = ''; bar.style.animation = ''; }
    if (prog) prog.style.display = 'none';
    if (stat) stat.textContent = '';
  }

  function setError(msg) {
    if (err) { err.style.display = 'block'; err.textContent = 'Erro: ' + msg; }
    sub.disabled = false; sub.textContent = '▶ Processar';
    const bar = prog?.querySelector('.progress-bar');
    if (bar) { bar.style.width = ''; bar.style.animation = ''; }
    if (prog) prog.style.display = 'none';
    if (stat) stat.textContent = '';
  }

  sub.addEventListener('click', async () => {
    if (!file) return;
    sub.disabled = true; sub.textContent = '⏳ Enviando…';
    if (prog) prog.style.display = 'block';
    if (stat) stat.textContent = 'Processando…';
    if (err) err.style.display = 'none';
    if (rc) rc.style.display = 'none';
    try {
      const fd = buildFormData(file);
      const resp = await fetch(API + endpoint, { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Erro ' + resp.status);

      if (json.id) {
        // Job-based: poll /api/job/:id for progress
        const bar = prog?.querySelector('.progress-bar');
        const poll = async () => {
          try {
            const pr = await fetch(API + '/api/job/' + json.id);
            const job = await pr.json();
            if (stat) stat.textContent = 'Processando… ' + job.progress + '%';
            if (bar) { bar.style.animation = 'none'; bar.style.width = job.progress + '%'; }
            if (job.status === 'error') { setError(job.error || 'Erro no processamento'); return; }
            if (job.status === 'done') { applyResult(job); return; }
            setTimeout(poll, 800);
          } catch (e) { setError(e.message); }
        };
        setTimeout(poll, 600);
      } else {
        applyResult(json);
      }
    } catch (e) { setError(e.message); }
  });
}

// ── CORTAR VÍDEO (timeline customizada) ──────────────────────────────────────
(function() {
  const fileInput  = document.getElementById('trim-file-input');
  const dropZone   = document.getElementById('trim-dz');
  const fileNameEl = document.getElementById('trim-file-name');
  const editor     = document.getElementById('trim-editor');
  const previewVid = document.getElementById('trim-preview-video');
  const timeline   = document.getElementById('trim-timeline');
  const thumbsEl   = document.getElementById('trim-thumbs');
  const rangeEl    = document.getElementById('trim-range');
  const hleft      = document.getElementById('trim-hleft');
  const hright     = document.getElementById('trim-hright');
  const playheadEl = document.getElementById('trim-playhead');
  const startInput = document.getElementById('trim-start');
  const endInput   = document.getElementById('trim-end');
  const durLabel   = document.getElementById('trim-dur-label');
  const addSegBtn  = document.getElementById('trim-add-segment');
  const segsEl     = document.getElementById('trim-segments');
  const submitBtn  = document.getElementById('trim-submit-btn');
  const progressEl = document.getElementById('trim-progress');
  const statusEl   = document.getElementById('trim-status');
  const errorEl    = document.getElementById('trim-error');
  const resultCard = document.getElementById('trim-result-card');
  const resultVid  = document.getElementById('trim-result-video');
  const dlBtn      = document.getElementById('trim-download-btn');
  if (!fileInput || !submitBtn) return;

  let currentFile = null, duration = 0;
  let trimStart = 0, trimEnd = 0;
  let segments = [];

  function ts(s) { // seconds → H:MM:SS
    s = Math.max(0, s);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }
  function st(str) { // H:MM:SS / MM:SS → seconds
    if (!str) return 0;
    const parts = String(str).split(':').map(Number);
    if (parts.length === 3) return (parts[0]||0)*3600+(parts[1]||0)*60+(parts[2]||0);
    if (parts.length === 2) return (parts[0]||0)*60+(parts[1]||0);
    return parseFloat(str)||0;
  }

  function loadFile(f) {
    currentFile = f;
    fileNameEl.textContent = '✓ ' + f.name + ' (' + fmtBytes(f.size) + ')';
    dropZone.classList.add('has-file');
    previewVid.src = URL.createObjectURL(f);
    previewVid.onloadedmetadata = () => {
      duration = previewVid.duration;
      trimStart = 0; trimEnd = duration;
      startInput.value = ts(trimStart); endInput.value = ts(trimEnd);
      if (durLabel) durLabel.textContent = ts(duration);
      editor.style.display = '';
      submitBtn.disabled = false; submitBtn.textContent = '✂ Cortar';
      errorEl.style.display = 'none';
      extractThumbs();
      updateHandles();
    };
  }

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => e.preventDefault());
    let cnt = 0;
    dropZone.addEventListener('dragenter', e => { e.preventDefault(); cnt++; dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { cnt--; if (cnt<=0){cnt=0;dropZone.classList.remove('drag-over');} });
    dropZone.addEventListener('drop', e => { e.preventDefault(); cnt=0; dropZone.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f) loadFile(f); });
  }

  // ── Thumbnails ──
  async function extractThumbs() {
    thumbsEl.innerHTML = '';
    const COLS = 20;
    const tl_w = timeline.clientWidth || 600;
    const tl_h = 68;
    const thumb_w = Math.floor(tl_w / COLS);
    const vid = document.createElement('video');
    vid.muted = true; vid.preload = 'metadata';
    vid.src = URL.createObjectURL(currentFile);
    await new Promise(r => { vid.onloadeddata = r; vid.onerror = r; });
    const frag = document.createDocumentFragment();
    for (let i = 0; i < COLS; i++) {
      const t = (i / (COLS - 1)) * duration;
      vid.currentTime = t;
      await new Promise(r => { vid.onseeked = r; vid.onerror = r; });
      const c = document.createElement('canvas');
      c.width = thumb_w; c.height = tl_h;
      c.getContext('2d').drawImage(vid, 0, 0, thumb_w, tl_h);
      const img = document.createElement('img');
      img.src = c.toDataURL('image/jpeg', 0.6);
      img.className = 'trim-thumb-img';
      img.style.width = thumb_w + 'px';
      frag.appendChild(img);
    }
    thumbsEl.appendChild(frag);
    URL.revokeObjectURL(vid.src);
  }

  // ── Handles ──
  function posToTime(x) { const w=timeline.clientWidth||1; return Math.max(0,Math.min(duration,(x/w)*duration)); }
  function updateHandles() {
    if (!duration) return;
    const lp = (trimStart/duration)*100, rp = (trimEnd/duration)*100;
    hleft.style.left = lp + '%';
    hright.style.left = rp + '%';
    rangeEl.style.left = lp + '%';
    rangeEl.style.width = (rp - lp) + '%';
  }
  function makeDragHandle(handle, isLeft) {
    let dragging = false;
    const move = ex => {
      if (!dragging || !duration) return;
      const rect = timeline.getBoundingClientRect();
      const t = posToTime(ex - rect.left);
      if (isLeft) { trimStart = Math.max(0, Math.min(t, trimEnd - 0.1)); startInput.value = ts(trimStart); previewVid.currentTime = trimStart; }
      else        { trimEnd = Math.max(trimStart + 0.1, Math.min(t, duration)); endInput.value = ts(trimEnd); previewVid.currentTime = trimEnd; }
      updateHandles();
    };
    handle.addEventListener('mousedown', e => { dragging=true; e.stopPropagation(); e.preventDefault(); });
    window.addEventListener('mousemove', e => move(e.clientX));
    window.addEventListener('mouseup', () => { dragging=false; });
    handle.addEventListener('touchstart', e => { dragging=true; e.stopPropagation(); e.preventDefault(); }, {passive:false});
    window.addEventListener('touchmove', e => { if(dragging) move(e.touches[0].clientX); }, {passive:false});
    window.addEventListener('touchend', () => { dragging=false; });
  }
  makeDragHandle(hleft, true);
  makeDragHandle(hright, false);

  // Click timeline to seek
  timeline.addEventListener('click', e => {
    const rect = timeline.getBoundingClientRect();
    previewVid.currentTime = posToTime(e.clientX - rect.left);
  });

  // Playhead sync
  previewVid?.addEventListener('timeupdate', () => {
    if (duration && playheadEl) playheadEl.style.left = (previewVid.currentTime/duration*100) + '%';
  });

  // Time inputs → update
  startInput?.addEventListener('change', () => { trimStart = Math.max(0,Math.min(st(startInput.value),trimEnd-0.1)); startInput.value=ts(trimStart); updateHandles(); });
  endInput?.addEventListener('change', () => { trimEnd = Math.max(trimStart+0.1,Math.min(st(endInput.value),duration)); endInput.value=ts(trimEnd); updateHandles(); });

  // ── Segment queue ──
  addSegBtn?.addEventListener('click', () => { segments.push({start:ts(trimStart),end:ts(trimEnd)}); renderSegs(); });
  function renderSegs() {
    if (!segments.length) { segsEl.innerHTML=''; return; }
    segsEl.innerHTML = segments.map((s,i) => `
      <div class="trim-segment-item">
        <span>Corte ${i+1}</span>
        <strong>${s.start} → ${s.end}</strong>
        <button class="trim-segment-del" data-i="${i}">✕</button>
      </div>`).join('');
    segsEl.querySelectorAll('.trim-segment-del').forEach(b => b.addEventListener('click', () => { segments.splice(+b.dataset.i,1); renderSegs(); }));
  }

  // ── Submit ──
  submitBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    const toProcess = segments.length ? segments : [{start: startInput.value, end: endInput.value}];
    submitBtn.disabled = true; submitBtn.textContent = '⏳ Cortando…';
    progressEl.style.display = 'block'; statusEl.textContent = '';
    errorEl.style.display = 'none'; resultCard.style.display = 'none';
    const bar = progressEl.querySelector('.progress-bar');
    let lastUrl = null, lastFriendlyName = null;
    for (let i = 0; i < toProcess.length; i++) {
      const seg = toProcess[i];
      statusEl.textContent = 'Cortando ' + (i+1) + ' / ' + toProcess.length + '…';
      if (bar) { bar.style.animation='none'; bar.style.width = Math.round((i/toProcess.length)*100) + '%'; }
      const fd = new FormData();
      fd.append('video', currentFile); fd.append('start', seg.start); fd.append('end', seg.end);
      try {
        const r = await fetch(API + '/api/trim', { method:'POST', body:fd });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || 'Erro ' + r.status);
        lastUrl = j.url; lastFriendlyName = j.friendlyName;
      } catch (e) { errorEl.style.display='block'; errorEl.textContent='Erro no corte '+(i+1)+': '+e.message; }
    }
    if (lastUrl) {
      resultVid.src = API + lastUrl; dlBtn.href = API + lastUrl; dlBtn.download = lastFriendlyName || lastUrl.split('/').pop();
      resultCard.style.display = 'block'; resultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    submitBtn.disabled = false; submitBtn.textContent = '✂ Cortar';
    progressEl.style.display = 'none'; statusEl.textContent = '';
    if (bar) { bar.style.width=''; bar.style.animation=''; }
  });
})();

// ── DIVIDIR VÍDEO ─────────────────────────────────────────────────────────
;(function() {
  // These elements are inside tool-trim (same video file)
  const splitAddBtn    = document.getElementById('split-add-btn');
  const splitNewPoint  = document.getElementById('split-new-point');
  const splitPointsList= document.getElementById('split-points-list');
  const splitPreviewInfo=document.getElementById('split-preview-info');
  const splitSubmitBtn = document.getElementById('split-submit-btn');
  const splitProgress  = document.getElementById('split-progress');
  const splitStatus    = document.getElementById('split-status');
  const splitError     = document.getElementById('split-error');
  const splitResults   = document.getElementById('split-results');
  const splitResultsList=document.getElementById('split-results-list');
  if (!splitAddBtn) return;

  let splitPoints = []; // seconds

  function parseTime(str) {
    str = str.trim();
    if (!str) return NaN;
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0]*60 + parts[1];
    return parts[0]*3600 + parts[1]*60 + parts[2];
  }

  function fmtTime(s) {
    s = Math.round(s);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  function renderPoints(videoDuration) {
    splitPointsList.innerHTML = '';
    if (!splitPoints.length) {
      splitPointsList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Nenhum ponto de corte adicionado ainda.</div>';
      updateSubmitState(videoDuration);
      return;
    }
    const sorted = [...splitPoints].sort((a,b) => a-b);
    sorted.forEach((t, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px';
      row.innerHTML = `<span style="flex:1">Corte ${i+1}: <strong>${fmtTime(t)}</strong></span>`;
      const rm = document.createElement('button');
      rm.textContent = '✕'; rm.className = 'submit-btn';
      rm.style.cssText = 'width:28px;height:28px;padding:0;font-size:12px;background:none;border:1px solid var(--border);color:var(--text)';
      rm.addEventListener('click', () => { splitPoints.splice(splitPoints.indexOf(t), 1); renderPoints(videoDuration); });
      row.appendChild(rm);
      splitPointsList.appendChild(row);
    });
    updatePreviewInfo(videoDuration);
    updateSubmitState(videoDuration);
  }

  function updatePreviewInfo(dur) {
    if (!dur || !splitPoints.length) { splitPreviewInfo.textContent = ''; return; }
    const pts = [...splitPoints].sort((a,b)=>a-b);
    const segs = [];
    let prev = 0;
    for (const t of pts) { segs.push([prev, t]); prev = t; }
    segs.push([prev, dur]);
    splitPreviewInfo.textContent = `Resultado: ${segs.length} partes — ` + segs.map((s,i) => `P${i+1}: ${fmtTime(s[0])}→${fmtTime(s[1])}`).join(', ');
  }

  function updateSubmitState(dur) {
    // Get the trim tool's selected file (shared)
    const trimInput = document.getElementById('trim-file-input');
    const hasFile = trimInput && trimInput.files.length > 0;
    if (hasFile && splitPoints.length > 0) {
      splitSubmitBtn.disabled = false;
      splitSubmitBtn.textContent = `✂️ Dividir em ${splitPoints.length + 1} partes`;
    } else if (!hasFile) {
      splitSubmitBtn.disabled = true;
      splitSubmitBtn.textContent = 'Selecione um vídeo na área acima';
    } else {
      splitSubmitBtn.disabled = true;
      splitSubmitBtn.textContent = 'Adicione ao menos um ponto de corte';
    }
  }

  // Keep submit btn in sync when trim file changes
  const trimInput = document.getElementById('trim-file-input');
  if (trimInput) {
    trimInput.addEventListener('change', () => {
      const v = trimInput.files[0];
      if (v) {
        const tmpVid = document.createElement('video');
        tmpVid.preload = 'metadata';
        tmpVid.src = URL.createObjectURL(v);
        tmpVid.onloadedmetadata = () => { renderPoints(tmpVid.duration); URL.revokeObjectURL(tmpVid.src); };
      }
    });
  }

  splitAddBtn.addEventListener('click', () => {
    const t = parseTime(splitNewPoint.value);
    if (isNaN(t) || t <= 0) { splitError.textContent = 'Tempo inválido. Use H:MM:SS, MM:SS ou segundos.'; splitError.style.display = ''; return; }
    splitError.style.display = 'none';
    if (splitPoints.includes(t)) { splitError.textContent = 'Esse ponto já foi adicionado.'; splitError.style.display = ''; return; }
    splitPoints.push(t);
    splitNewPoint.value = '';
    const vid = document.getElementById('trim-preview-video');
    renderPoints(vid && vid.duration ? vid.duration : null);
  });

  // Allow Enter key in input
  splitNewPoint.addEventListener('keydown', e => { if (e.key === 'Enter') splitAddBtn.click(); });

  splitSubmitBtn.addEventListener('click', async () => {
    if (!splitPoints.length) return;
    const trimInput = document.getElementById('trim-file-input');
    if (!trimInput || !trimInput.files.length) { splitError.textContent = 'Selecione um vídeo acima.'; splitError.style.display = ''; return; }
    splitSubmitBtn.disabled = true;
    splitError.style.display = 'none';
    splitResults.style.display = 'none';
    splitProgress.style.display = '';
    splitStatus.textContent = '⏳ Enviando vídeo…';
    try {
      const fd = new FormData();
      fd.append('video', trimInput.files[0]);
      fd.append('points', JSON.stringify(splitPoints));
      const r = await fetch(API + '/api/split', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro no servidor');
      const jobId = j.id;
      // Poll
      while (true) {
        await new Promise(res => setTimeout(res, 2500));
        const pr = await fetch(API + `/api/job/${jobId}`);
        const pj = await pr.json();
        if (pj.status === 'done') {
          splitProgress.style.display = 'none';
          splitStatus.textContent = `✓ Dividido em ${pj.parts.length} partes!`;
          splitResultsList.innerHTML = '';
          pj.parts.forEach((part, i) => {
            const url = API + part.url;
            const card = document.createElement('div');
            card.style.cssText = 'padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px';
            card.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:6px">Parte ${i+1} — ${part.label}</div>
              <video controls class="result-video" src="${url}" style="margin-bottom:8px"></video>
              <a href="${url}" download="${part.label}" class="download-btn">⬇ Baixar parte ${i+1}</a>`;
            splitResultsList.appendChild(card);
          });
          splitResults.style.display = '';
          splitResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
        if (pj.status === 'error') throw new Error(pj.error || 'Falhou');
        splitStatus.textContent = `⏳ Processando… ${pj.progress || 0}%`;
      }
    } catch(e) {
      splitProgress.style.display = 'none';
      splitError.textContent = e.message; splitError.style.display = '';
    } finally {
      splitSubmitBtn.disabled = false;
    }
  });
})();

// ── REDIMENSIONAR ──
// ── RESIZE ──────────────────────────────────────────────────────────────────
let resizeRatioW = 1080, resizeRatioH = 1920;
let resizePad = 'black', resizeMode = 'fit';
let resizeCropX = 0, resizeCropY = 0;
let resizeSrcImg = null, resizeVidW = 0, resizeVidH = 0;

document.querySelectorAll('.resize-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.resize-preset').forEach(b => b.classList.remove('rp-active'));
    btn.classList.add('rp-active');
    resizeRatioW = parseInt(btn.dataset.w);
    resizeRatioH = parseInt(btn.dataset.h);
    resizeCropX = 0; resizeCropY = 0;
    if (resizeSrcImg) drawResizeCrop();
  });
});
document.querySelectorAll('#resize-pad-toggle .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#resize-pad-toggle .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); resizePad = btn.dataset.pad;
  });
});
document.querySelectorAll('#resize-mode-toggle .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#resize-mode-toggle .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); resizeMode = btn.dataset.mode;
    document.getElementById('resize-pad-section').style.display = resizeMode === 'fit' ? '' : 'none';
    const cropSec = document.getElementById('resize-crop-section');
    cropSec.style.display = (resizeMode === 'crop' && resizeSrcImg) ? '' : 'none';
    if (resizeMode === 'crop' && resizeSrcImg) drawResizeCrop();
  });
});

// Extract first frame from video file → store as Image for crop preview
function loadResizeFrame(file) {
  const vid = document.createElement('video');
  vid.muted = true; vid.preload = 'metadata';
  vid.src = URL.createObjectURL(file);
  vid.addEventListener('loadeddata', () => { vid.currentTime = 0.01; });
  vid.addEventListener('seeked', () => {
    resizeVidW = vid.videoWidth; resizeVidH = vid.videoHeight;
    const tmp = document.createElement('canvas');
    tmp.width = resizeVidW; tmp.height = resizeVidH;
    tmp.getContext('2d').drawImage(vid, 0, 0);
    resizeSrcImg = new Image();
    resizeSrcImg.onload = () => {
      resizeCropX = 0; resizeCropY = 0;
      if (resizeMode === 'crop') {
        document.getElementById('resize-crop-section').style.display = '';
        drawResizeCrop();
      }
    };
    resizeSrcImg.src = tmp.toDataURL('image/jpeg', 0.85);
    URL.revokeObjectURL(vid.src);
  });
}

// ════════════════════════════════════════════════════════════════════
// TRADUÇÃO DE VÍDEO
// ════════════════════════════════════════════════════════════════════
(function () {
  const trVideoInput    = document.getElementById('tr-video-input');
  const trDropZone      = document.getElementById('tr-drop-zone');
  const trFileName      = document.getElementById('tr-file-name');
  const trFromLang      = document.getElementById('tr-from-lang');
  const trToLang        = document.getElementById('tr-to-lang');
  const trApiKey        = document.getElementById('tr-api-key');
  const trApiSaveBtn    = document.getElementById('tr-api-save-btn');
  const trApiModel      = document.getElementById('tr-api-model');
  const trAnalyzeBtn    = document.getElementById('tr-analyze-btn');
  const trAnalyzeProgress = document.getElementById('tr-analyze-progress');
  const trAnalyzeStatus   = document.getElementById('tr-analyze-status');
  const trAnalyzeError    = document.getElementById('tr-analyze-error');
  const trStep1         = document.getElementById('tr-step1');
  const trStep2         = document.getElementById('tr-step2');
  const trBackBtn       = document.getElementById('tr-back-btn');
  const trSegContainer  = document.getElementById('tr-segments-container');
  const trElKey         = document.getElementById('tr-el-key');
  const trElSaveBtn     = document.getElementById('tr-el-save-btn');
  const trLoadVoicesBtn = document.getElementById('tr-load-voices-btn');
  const trVoiceSelect   = document.getElementById('tr-voice-select');
  const trVoicesError   = document.getElementById('tr-voices-error');
  const trGenerateBtn   = document.getElementById('tr-generate-btn');
  const trGenerateProgress = document.getElementById('tr-generate-progress');
  const trGenerateStatus   = document.getElementById('tr-generate-status');
  const trGenerateError    = document.getElementById('tr-generate-error');
  const trResultCard    = document.getElementById('tr-result-card');
  const trResultVideo   = document.getElementById('tr-result-video');
  const trDownloadBtn   = document.getElementById('tr-download-btn');
  const trNewBtn        = document.getElementById('tr-new-btn');
  const trTrimVideo     = document.getElementById('tr-trim-video');
  const trMaxTempo      = document.getElementById('tr-max-tempo');
  const trMaxTempoVal   = document.getElementById('tr-max-tempo-val');

  if (!trVideoInput) return;

  // ── Slider velocidade ──
  if (trMaxTempo && trMaxTempoVal) {
    trMaxTempo.addEventListener('input', () => { trMaxTempoVal.textContent = parseFloat(trMaxTempo.value).toFixed(1) + '×'; });
  }

  // ── Radio mode toggle visual ──
  document.querySelectorAll('input[name="tr-audio-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('tr-mode-normal-lbl').style.border  = radio.value === 'normal'  ? '2px solid var(--accent)' : '1px solid var(--border)';
      document.getElementById('tr-mode-normal-lbl').style.background  = radio.value === 'normal'  ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
      document.getElementById('tr-mode-dynamic-lbl').style.border = radio.value === 'dynamic' ? '2px solid var(--accent)' : '1px solid var(--border)';
      document.getElementById('tr-mode-dynamic-lbl').style.background = radio.value === 'dynamic' ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
    });
  });

  // ── Music mode toggle visual ──
  document.querySelectorAll('input[name="tr-music-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ['tr-music-recreate-lbl','tr-music-none-lbl','tr-music-keep-lbl'].forEach(id => {
        const lbl = document.getElementById(id);
        if (!lbl) return;
        const isActive = lbl.querySelector('input')?.value === radio.value;
        lbl.style.border     = isActive ? '2px solid var(--accent)' : '1px solid var(--border)';
        lbl.style.background = isActive ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
      });
    });
  });

  // ── Restore saved keys ──
  const savedApiKey = localStorage.getItem('tr_api_key');
  const savedElKey  = localStorage.getItem('tr_el_key');
  if (savedApiKey) { trApiKey.value = savedApiKey; if (trApiSaveBtn) trApiSaveBtn.textContent = '✅ Salvo'; }
  if (savedElKey)  { trElKey.value  = savedElKey;  if (trElSaveBtn)  trElSaveBtn.textContent  = '✅'; }

  // ── Save buttons ──
  function makeSaveBtn(btn, input, storageKey) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const val = input.value.trim();
      if (val) {
        localStorage.setItem(storageKey, val);
        btn.textContent = btn.textContent.includes('💾') ? '✅ Salvo' : '✅';
        setTimeout(() => { btn.textContent = btn.textContent.includes('Salvo') ? '💾 Salvar' : '💾'; }, 2000);
      } else {
        localStorage.removeItem(storageKey);
        btn.textContent = btn.textContent.includes('Salvo') ? '💾 Salvar' : '💾';
      }
    });
    // Marcar como não salvo quando o usuário edita o campo
    input.addEventListener('input', () => {
      if (btn.textContent.includes('✅')) {
        btn.textContent = btn.textContent.includes('Salvo') ? '💾 Salvar' : '💾';
      }
    });
  }
  makeSaveBtn(trApiSaveBtn, trApiKey, 'tr_api_key');
  makeSaveBtn(trElSaveBtn,  trElKey,  'tr_el_key');

  let trFile = null;
  let trTempId = null;
  let trSegments = [];

  // ── Drag & drop ──
  trDropZone.addEventListener('click', () => trVideoInput.click());
  trDropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') trVideoInput.click(); });
  trDropZone.addEventListener('dragover', e => { e.preventDefault(); trDropZone.classList.add('dz-over'); });
  trDropZone.addEventListener('dragleave', () => trDropZone.classList.remove('dz-over'));
  trDropZone.addEventListener('drop', e => {
    e.preventDefault(); trDropZone.classList.remove('dz-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) setTrFile(f);
  });
  trVideoInput.addEventListener('change', () => { if (trVideoInput.files[0]) setTrFile(trVideoInput.files[0]); });

  function setTrFile(f) {
    trFile = f;
    trFileName.textContent = f.name;
    trAnalyzeBtn.disabled = false;
    trAnalyzeBtn.textContent = '🔍 Transcrever e Traduzir';
  }

  // ── Passo 1: Analisar ──
  trAnalyzeBtn.addEventListener('click', async () => {
    if (!trFile) return;
    const apiKey = trApiKey.value.trim();
    if (!apiKey) { trAnalyzeError.style.display = 'block'; trAnalyzeError.textContent = 'Informe a chave da API de tradução.'; return; }

    // Salvar chaves
    localStorage.setItem('tr_api_key', apiKey);

    trAnalyzeBtn.disabled = true;
    trAnalyzeError.style.display = 'none';
    trAnalyzeProgress.style.display = '';
    trAnalyzeStatus.textContent = 'Transcrevendo... pode levar alguns minutos.';

    const fd = new FormData();
    fd.append('video', trFile);
    fd.append('from_lang', trFromLang.value);
    fd.append('to_lang', trToLang.value);
    fd.append('api_key', apiKey);
    fd.append('api_model', trApiModel.value);
    const customInstr = document.getElementById('tr-custom-instructions').value.trim();
    if (customInstr) fd.append('custom_instructions', customInstr);
    // Detectar se OpenRouter pela chave
    if (apiKey.startsWith('sk-or')) fd.append('api_base', 'https://openrouter.ai');

    try {
      const resp = await fetch(API + '/api/translate/analyze', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Erro desconhecido');

      trTempId   = json.tempId;
      trSegments = json.segments;
      renderSegments();
      trStep1.style.display = 'none';
      trStep2.style.display = '';
      trResultCard.style.display = 'none';
    } catch (e) {
      trAnalyzeError.style.display = 'block';
      trAnalyzeError.textContent = 'Erro: ' + e.message;
    } finally {
      trAnalyzeBtn.disabled = false;
      trAnalyzeProgress.style.display = 'none';
      trAnalyzeStatus.textContent = '';
    }
  });

  // ── Renderizar segmentos editáveis ──
  function renderSegments() {
    trSegContainer.innerHTML = '';
    trSegments.forEach((seg, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:90px 1fr 1fr;gap:6px;align-items:start';
      row.innerHTML = `
        <div style="font-size:11px;color:var(--text-muted);padding-top:6px">${seg.start.slice(0,8)}<br>${seg.end.slice(0,8)}</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <textarea data-orig="${i}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:6px;font-size:12px;color:var(--text-muted);resize:vertical;min-height:52px;font-family:inherit">${escHtml(seg.original)}</textarea>
          <button data-retranslate="${i}" style="font-size:11px;padding:3px 8px;background:none;border:1px solid var(--border);border-radius:5px;color:var(--text-muted);cursor:pointer">🔄 Traduzir</button>
        </div>
        <textarea data-idx="${i}" style="background:var(--bg-input,#1a1a2e);border:1px solid var(--accent);border-radius:6px;padding:6px;font-size:12px;color:var(--text);resize:vertical;min-height:52px;font-family:inherit">${escHtml(seg.translated || seg.original)}</textarea>
      `;
      trSegContainer.appendChild(row);
    });
    // Sync changes back to segments array
    trSegContainer.querySelectorAll('textarea[data-idx]').forEach(ta => {
      ta.addEventListener('input', () => { trSegments[parseInt(ta.dataset.idx)].translated = ta.value; });
    });
    trSegContainer.querySelectorAll('textarea[data-orig]').forEach(ta => {
      ta.addEventListener('input', () => { trSegments[parseInt(ta.dataset.orig)].original = ta.value; });
    });
    // Re-translate single block
    trSegContainer.querySelectorAll('button[data-retranslate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.retranslate);
        const apiKey = document.getElementById('tr-api-key').value.trim();
        const apiModel = document.getElementById('tr-api-model').value;
        const apiBase = apiKey.startsWith('sk-or') ? 'https://openrouter.ai' : 'https://api.anthropic.com';
        const customInstr = document.getElementById('tr-custom-instructions').value.trim();
        if (!apiKey) { alert('Informe a API key de tradução na etapa 1.'); return; }
        btn.disabled = true; btn.textContent = '...';
        try {
          const resp = await fetch(API + '/api/translate/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trSegments[idx].original, api_key: apiKey, api_base: apiBase, api_model: apiModel, to_lang: trToLang.value, custom_instructions: customInstr })
          });
          const json = await resp.json();
          if (!resp.ok) throw new Error(json.error || 'Erro');
          trSegments[idx].translated = json.translated;
          const ta = trSegContainer.querySelector(`textarea[data-idx="${idx}"]`);
          if (ta) ta.value = json.translated;
        } catch (e) {
          alert('Erro ao re-traduzir: ' + e.message);
        } finally {
          btn.disabled = false; btn.textContent = '🔄 Traduzir';
        }
      });
    });
  }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Voltar ──
  trBackBtn.addEventListener('click', () => {
    trStep2.style.display = 'none';
    trStep1.style.display = '';
  });

  // ── Carregar vozes ElevenLabs ──
  trLoadVoicesBtn.addEventListener('click', async () => {
    const key = trElKey.value.trim();
    if (!key) { trVoicesError.style.display = 'block'; trVoicesError.textContent = 'Informe a chave do ElevenLabs.'; return; }
    localStorage.setItem('tr_el_key', key);
    trVoicesError.style.display = 'none';
    trLoadVoicesBtn.disabled = true;
    trLoadVoicesBtn.textContent = 'Carregando...';
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      if (!resp.ok) throw new Error('Chave inválida ou erro na API');
      const data = await resp.json();
      trVoiceSelect.innerHTML = '<option value="">Selecione uma voz...</option><option value="__clone__">🎤 Clonar voz do vídeo (temporário, não salva)</option><optgroup label="── Sua biblioteca ──"></optgroup>';
      const group = trVoiceSelect.querySelector('optgroup');
      (data.voices || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voice_id;
        opt.textContent = v.name + (v.labels?.accent ? ` (${v.labels.accent})` : '');
        group.appendChild(opt);
      });
      trVoiceSelect.style.display = '';
    } catch (e) {
      trVoicesError.style.display = 'block';
      trVoicesError.textContent = 'Erro: ' + e.message;
    } finally {
      trLoadVoicesBtn.disabled = false;
      trLoadVoicesBtn.textContent = 'Carregar vozes';
    }
  });

  trVoiceSelect.addEventListener('change', () => {
    trGenerateBtn.disabled = !trVoiceSelect.value;
    trGenerateBtn.textContent = trVoiceSelect.value ? '🌐 Gerar Vídeo Traduzido' : 'Configure a voz para gerar';
  });

  // ── Passo 2: Gerar ──
  trGenerateBtn.addEventListener('click', async () => {
    if (!trVoiceSelect.value || !trTempId) return;
    const elKey = trElKey.value.trim();
    if (!elKey) { trGenerateError.style.display = 'block'; trGenerateError.textContent = 'Informe a chave do ElevenLabs.'; return; }

    trGenerateBtn.disabled = true;
    trGenerateError.style.display = 'none';
    trGenerateProgress.style.display = '';
    trGenerateStatus.textContent = 'Separando vozes e gerando áudio... pode levar alguns minutos.';

    try {
      const resp = await fetch(API + '/api/translate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempId: trTempId,
          segments: trSegments,
          elevenlabs_key: elKey,
          voice_id: trVoiceSelect.value,
          trim_to_audio: trTrimVideo && trTrimVideo.checked,
          max_tempo: trMaxTempo ? parseFloat(trMaxTempo.value) : 1.8,
          dynamic_mode: (document.querySelector('input[name="tr-audio-mode"]:checked')?.value === 'dynamic'),
          music_mode: document.querySelector('input[name="tr-music-mode"]:checked')?.value || 'recriar',
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Erro desconhecido');

      trResultVideo.src = API + json.url;
      trDownloadBtn.href = API + json.url;
      trDownloadBtn.download = json.friendlyName || 'video-traduzido.mp4';
      trResultCard.style.display = '';
      trStep2.style.display = 'none';
      addToLocalLibrary({ ...json, type: 'translate' });
    } catch (e) {
      trGenerateError.style.display = 'block';
      trGenerateError.textContent = 'Erro: ' + e.message;
    } finally {
      trGenerateBtn.disabled = false;
      trGenerateProgress.style.display = 'none';
      trGenerateStatus.textContent = '';
    }
  });

  function addToLocalLibrary(item) {
    try {
      const lib = JSON.parse(localStorage.getItem('video_library') || '[]');
      lib.unshift(item);
      localStorage.setItem('video_library', JSON.stringify(lib.slice(0, 50)));
    } catch {}
  }

  // ── Traduzir novo vídeo ──
  if (trNewBtn) {
    trNewBtn.addEventListener('click', () => {
      trResultCard.style.display = 'none';
      trStep2.style.display = 'none';
      trStep1.style.display = '';
      trFile = null; trTempId = null; trSegments = [];
      document.getElementById('tr-file-name').textContent = '';
      document.getElementById('tr-analyze-btn').disabled = true;
      document.getElementById('tr-analyze-btn').textContent = 'Selecione um vídeo';
      document.getElementById('tr-analyze-error').style.display = 'none';
    });
  }
})();

// ════════════════════════════════════════════════════════════════════
// AUTO TRADUTOR PIPELINE
// ════════════════════════════════════════════════════════════════════
;(function() {
  const atrPhaseConfig   = document.getElementById('atr-phase-config');
  const atrPhaseSegments = document.getElementById('atr-phase-segments');
  const atrPhaseWm       = document.getElementById('atr-phase-watermark');
  const atrPhaseSub      = document.getElementById('atr-phase-subtitle');
  const atrPhaseUpscale  = document.getElementById('atr-phase-upscale');
  const atrPhaseDone     = document.getElementById('atr-phase-done');
  if (!atrPhaseConfig) return;

  // ── State ──
  let atrFile = null, atrTempId = null, atrSegments = [];
  let atrTranslatedUrl = null, atrWmUrl = null, atrFinalUrl = null;
  let atrWmVideoEl = null, atrWmPreviewW = 0, atrWmPreviewH = 0;
  let atrWmVideoW = 0, atrWmVideoH = 0;
  let atrWmSelRect = null, atrWmDragMode = null, atrWmActiveHandle = null;
  let atrWmDragStart = null, atrWmDragOrigRect = null;
  let atrWmAnimFrame = null, atrWmIsPaused = false, atrWmIsSeeking = false;
  let atrWmMode = 'blur';
  const ATR_HANDLE_SIZE = 10, ATR_HANDLE_HALF = 5;
  const ATR_AUTO_MODES = new Set(['sora', 'heygen']);

  // Subtitle canvas state
  let atrSubVideoEl = null, atrSubPreviewW = 0, atrSubPreviewH = 0;
  let atrSubVideoW = 0, atrSubVideoH = 0, atrSubAnimFrame = null;
  let atrSubIsPaused = false, atrSubIsSeeking = false;
  let atrSubBlockX = 0.5, atrSubBlockY = 0.88, atrSubBlockDragging = false;
  let atrSubPreset = 'classico', atrSubWordByWord = false, atrSubEntryAnim = 'none', atrSubUppercase = false;
  const ATR_SUB_BLOCK_W_FRAC = 0.82;

  // ── Stepper ──
  function atrSetStep(n) {
    for (let i = 1; i <= 5; i++) {
      const s = document.getElementById('atr-s' + i);
      if (!s) continue;
      s.classList.remove('atr-s-active', 'atr-s-done');
      if (i < n) s.classList.add('atr-s-done');
      else if (i === n) s.classList.add('atr-s-active');
    }
    for (let i = 1; i <= 4; i++) {
      const l = document.getElementById('atr-line' + i);
      if (l) l.classList.toggle('atr-line-done', i < n);
    }
  }

  // ── Phase visibility ──
  function atrShowPhase(phase) {
    [atrPhaseConfig, atrPhaseSegments, atrPhaseWm, atrPhaseSub, atrPhaseUpscale, atrPhaseDone].forEach(p => { if (p) p.style.display = 'none'; });
    phase.style.display = '';
    phase.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Element refs ──
  const atrApiKey      = document.getElementById('atr-api-key');
  const atrApiSaveBtn  = document.getElementById('atr-api-save-btn');
  const atrApiModel    = document.getElementById('atr-api-model');
  const atrElKey       = document.getElementById('atr-el-key');
  const atrElSaveBtn   = document.getElementById('atr-el-save-btn');
  const atrLoadVBtn    = document.getElementById('atr-load-voices-btn');
  const atrVoiceSel    = document.getElementById('atr-voice-select');
  const atrVoicesErr   = document.getElementById('atr-voices-error');
  const atrAnalyzeBtn  = document.getElementById('atr-analyze-btn');
  const atrAnalyzeProg = document.getElementById('atr-analyze-progress');
  const atrAnalyzeStat = document.getElementById('atr-analyze-status');
  const atrAnalyzeErr  = document.getElementById('atr-analyze-error');
  const atrMaxTempo    = document.getElementById('atr-max-tempo');
  const atrMaxTempoVal = document.getElementById('atr-max-tempo-val');

  // Pre-fill saved keys (shared with translate tool)
  const _savedApiKey = localStorage.getItem('tr_api_key');
  const _savedElKey  = localStorage.getItem('tr_el_key');
  if (_savedApiKey && atrApiKey) { atrApiKey.value = _savedApiKey; if (atrApiSaveBtn) atrApiSaveBtn.textContent = '✅ Salvo'; }
  if (_savedElKey  && atrElKey)  { atrElKey.value  = _savedElKey;  if (atrElSaveBtn)  atrElSaveBtn.textContent  = '✅'; }

  function makeSaveBtnAtr(btn, input, key) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const v = input.value.trim();
      if (v) {
        localStorage.setItem(key, v);
        btn.textContent = btn.textContent.includes('Salvar') ? '✅ Salvo' : '✅';
        setTimeout(() => { btn.textContent = btn.textContent.includes('Salvo') ? '💾 Salvar' : '💾'; }, 2000);
      } else { localStorage.removeItem(key); }
    });
    input.addEventListener('input', () => { if (btn.textContent.includes('✅')) btn.textContent = btn.textContent.includes('Salvo') ? '💾 Salvar' : '💾'; });
  }
  makeSaveBtnAtr(atrApiSaveBtn, atrApiKey, 'tr_api_key');
  makeSaveBtnAtr(atrElSaveBtn,  atrElKey,  'tr_el_key');

  if (atrMaxTempo && atrMaxTempoVal) {
    atrMaxTempo.addEventListener('input', () => { atrMaxTempoVal.textContent = parseFloat(atrMaxTempo.value).toFixed(1) + '×'; });
  }

  // ── File drop ──
  const atrDropZone   = document.getElementById('atr-drop-zone');
  const atrVideoInput = document.getElementById('atr-video-input');
  const atrFileName   = document.getElementById('atr-file-name');
  if (atrDropZone) {
    atrDropZone.addEventListener('click', () => atrVideoInput.click());
    atrDropZone.addEventListener('dragover', e => e.preventDefault());
    atrDropZone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('video/')) atrSetFile(f); });
  }
  if (atrVideoInput) atrVideoInput.addEventListener('change', () => { if (atrVideoInput.files[0]) atrSetFile(atrVideoInput.files[0]); });

  function atrSetFile(f) {
    atrFile = f;
    atrFileName.textContent = f.name;
    atrAnalyzeBtn.disabled = false;
    atrAnalyzeBtn.textContent = '🔍 Transcrever e Traduzir';
  }

  // ── Load voices ──
  if (atrLoadVBtn) {
    atrLoadVBtn.addEventListener('click', async () => {
      const key = atrElKey.value.trim();
      if (!key) { atrVoicesErr.style.display = 'block'; atrVoicesErr.textContent = 'Informe a chave do ElevenLabs.'; return; }
      localStorage.setItem('tr_el_key', key);
      atrVoicesErr.style.display = 'none';
      atrLoadVBtn.disabled = true; atrLoadVBtn.textContent = 'Carregando...';
      try {
        const resp = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
        if (!resp.ok) throw new Error('Chave inválida');
        const data = await resp.json();
        atrVoiceSel.innerHTML = '<option value="">Selecione uma voz...</option><option value="__clone__">🎤 Clonar voz do vídeo</option><optgroup label="── Biblioteca ──"></optgroup>';
        const grp = atrVoiceSel.querySelector('optgroup');
        (data.voices || []).forEach(v => {
          const o = document.createElement('option');
          o.value = v.voice_id; o.textContent = v.name + (v.labels?.accent ? ` (${v.labels.accent})` : '');
          grp.appendChild(o);
        });
        atrVoiceSel.style.display = '';
      } catch (e) { atrVoicesErr.style.display = 'block'; atrVoicesErr.textContent = 'Erro: ' + e.message; }
      finally { atrLoadVBtn.disabled = false; atrLoadVBtn.textContent = 'Carregar vozes'; }
    });
  }

  // Update generate button when voice changes
  if (atrVoiceSel) {
    atrVoiceSel.addEventListener('change', () => {
      const btn = document.getElementById('atr-generate-btn');
      if (btn && atrPhaseSegments.style.display !== 'none') {
        btn.disabled = !atrVoiceSel.value;
        btn.textContent = atrVoiceSel.value ? '🌐 Gerar Vídeo Traduzido' : 'Configure a voz para gerar';
      }
    });
  }

  // ── Radio mode toggle visual (atr) ──
  document.querySelectorAll('input[name="atr-audio-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const nLbl = document.getElementById('atr-mode-normal-lbl');
      const dLbl = document.getElementById('atr-mode-dynamic-lbl');
      if (nLbl) {
        nLbl.style.border      = radio.value === 'normal'  ? '2px solid var(--accent)' : '1px solid var(--border)';
        nLbl.style.background  = radio.value === 'normal'  ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
      }
      if (dLbl) {
        dLbl.style.border      = radio.value === 'dynamic' ? '2px solid var(--accent)' : '1px solid var(--border)';
        dLbl.style.background  = radio.value === 'dynamic' ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
      }
    });
  });

  // ── Music mode toggle visual (atr) ──
  document.querySelectorAll('input[name="atr-music-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ['atr-music-recreate-lbl','atr-music-none-lbl','atr-music-keep-lbl'].forEach(id => {
        const lbl = document.getElementById(id);
        if (!lbl) return;
        const isActive = lbl.querySelector('input')?.value === radio.value;
        lbl.style.border     = isActive ? '2px solid var(--accent)' : '1px solid var(--border)';
        lbl.style.background = isActive ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : '';
      });
    });
  });

  // ── Phase 1a: Analyze ──
  if (atrAnalyzeBtn) {
    atrAnalyzeBtn.addEventListener('click', async () => {
      if (!atrFile) return;
      const apiKey = atrApiKey.value.trim();
      if (!apiKey) { atrAnalyzeErr.style.display = 'block'; atrAnalyzeErr.textContent = 'Informe a chave da API.'; return; }
      localStorage.setItem('tr_api_key', apiKey);
      atrAnalyzeBtn.disabled = true;
      atrAnalyzeErr.style.display = 'none';
      atrAnalyzeProg.style.display = '';
      atrAnalyzeStat.textContent = 'Transcrevendo e traduzindo...';

      const fd = new FormData();
      fd.append('video', atrFile);
      fd.append('from_lang', document.getElementById('atr-from-lang').value);
      fd.append('to_lang',   document.getElementById('atr-to-lang').value);
      fd.append('api_key',   apiKey);
      fd.append('api_model', atrApiModel.value);
      const ci = document.getElementById('atr-custom-instructions').value.trim();
      if (ci) fd.append('custom_instructions', ci);
      if (apiKey.startsWith('sk-or')) fd.append('api_base', 'https://openrouter.ai');

      try {
        const resp = await fetch(API + '/api/translate/analyze', { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Erro');
        atrTempId = json.tempId;
        atrSegments = json.segments;
        atrRenderSegments();
        // Pre-fill ElevenLabs key when entering segments phase
        const _elSaved = localStorage.getItem('tr_el_key');
        if (_elSaved && atrElKey && !atrElKey.value) {
          atrElKey.value = _elSaved;
          if (atrElSaveBtn) atrElSaveBtn.textContent = '✅';
        }
        const hasVoice = atrVoiceSel && atrVoiceSel.value;
        const genBtn = document.getElementById('atr-generate-btn');
        genBtn.disabled = !hasVoice;
        genBtn.textContent = hasVoice ? '🌐 Gerar Vídeo Traduzido' : 'Configure a voz para gerar';
        atrShowPhase(atrPhaseSegments);
      } catch (e) {
        atrAnalyzeErr.style.display = 'block';
        atrAnalyzeErr.textContent = 'Erro: ' + e.message;
      } finally {
        atrAnalyzeBtn.disabled = false;
        atrAnalyzeProg.style.display = 'none';
        atrAnalyzeStat.textContent = '';
      }
    });
  }

  // Back to config
  const atrBackBtn = document.getElementById('atr-back-btn');
  if (atrBackBtn) atrBackBtn.addEventListener('click', () => atrShowPhase(atrPhaseConfig));

  // ── Render segments ──
  function atrRenderSegments() {
    const container = document.getElementById('atr-segments-container');
    if (!container) return;
    container.innerHTML = '';
    atrSegments.forEach((seg, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:80px 1fr 1fr;gap:6px;align-items:start';
      row.innerHTML = `
        <div style="font-size:11px;color:var(--text-muted);padding-top:6px">${seg.start.slice(0,8)}<br>${seg.end.slice(0,8)}</div>
        <textarea data-ao="${i}" style="background:var(--bg-card,#16162a);border:1px solid var(--border);border-radius:6px;padding:6px;font-size:12px;color:var(--text-muted);resize:vertical;min-height:44px;font-family:inherit">${atrEsc(seg.original)}</textarea>
        <textarea data-at="${i}" style="background:var(--bg-input,#1a1a2e);border:1px solid var(--accent);border-radius:6px;padding:6px;font-size:12px;color:var(--text);resize:vertical;min-height:44px;font-family:inherit">${atrEsc(seg.translated || seg.original)}</textarea>`;
      container.appendChild(row);
    });
    container.querySelectorAll('textarea[data-at]').forEach(ta => {
      ta.addEventListener('input', () => { atrSegments[+ta.dataset.at].translated = ta.value; });
    });
    container.querySelectorAll('textarea[data-ao]').forEach(ta => {
      ta.addEventListener('input', () => { atrSegments[+ta.dataset.ao].original = ta.value; });
    });
  }
  function atrEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Phase 1b: Generate translation ──
  const atrGenerateBtn = document.getElementById('atr-generate-btn');
  if (atrGenerateBtn) {
    atrGenerateBtn.addEventListener('click', async () => {
      if (!atrVoiceSel?.value || !atrTempId) return;
      const elKey = atrElKey.value.trim();
      if (!elKey) { document.getElementById('atr-generate-error').style.display = 'block'; document.getElementById('atr-generate-error').textContent = 'Informe a chave do ElevenLabs.'; return; }
      atrGenerateBtn.disabled = true;
      document.getElementById('atr-generate-error').style.display = 'none';
      document.getElementById('atr-generate-progress').style.display = '';
      document.getElementById('atr-generate-status').textContent = 'Separando vozes e gerando áudio traduzido…';

      try {
        const resp = await fetch(API + '/api/translate/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempId: atrTempId, segments: atrSegments,
            elevenlabs_key: elKey, voice_id: atrVoiceSel.value,
            trim_to_audio: document.getElementById('atr-trim-video')?.checked,
            max_tempo: parseFloat(atrMaxTempo?.value || 1.8),
            dynamic_mode: (document.querySelector('input[name="atr-audio-mode"]:checked')?.value === 'dynamic'),
            music_mode: document.querySelector('input[name="atr-music-mode"]:checked')?.value || 'recriar'
          })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Erro');
        atrTranslatedUrl = API + json.url;
        // Sync subtitle language to translation target lang
        const toLang = document.getElementById('atr-to-lang')?.value || 'en';
        const subLang = document.getElementById('atr-sub-lang');
        if (subLang) {
          const match = Array.from(subLang.options).find(o => o.value === toLang || o.value === toLang.split('-')[0]);
          if (match) subLang.value = match.value;
        }
        atrSetStep(2);
        atrShowPhase(atrPhaseWm);
        atrWmLoadVideoFromUrl(atrTranslatedUrl);
      } catch (e) {
        document.getElementById('atr-generate-error').style.display = 'block';
        document.getElementById('atr-generate-error').textContent = 'Erro: ' + e.message;
      } finally {
        atrGenerateBtn.disabled = false;
        document.getElementById('atr-generate-progress').style.display = 'none';
        document.getElementById('atr-generate-status').textContent = '';
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // WATERMARK CANVAS
  // ══════════════════════════════════════════════════════════════
  const atrWmCanvas = document.getElementById('atr-wm-canvas');
  const atrWmCtx    = atrWmCanvas ? atrWmCanvas.getContext('2d') : null;
  const atrWmRegInf = document.getElementById('atr-wm-region-info');

  const atrModeDescs = {
    blur:   'Blur gaussiano com bordas suaves e degradê — rápido, funciona em qualquer fundo.',
    simple: '⚡ Remoção rápida via FFmpeg — ideal para testes.',
    delogo: '✨ Reconstrução avançada de pixels com OpenCV — melhor resultado.',
    sora:   '🎵 Detecta automaticamente a marca d\'água do Sora em cada frame.',
    heygen: '🤖 Remove automaticamente a marca d\'água do HeyGen (canto inferior direito).',
  };
  document.querySelectorAll('[data-atr-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-atr-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      atrWmMode = btn.dataset.atrMode;
      const d = document.getElementById('atr-mode-desc');
      if (d) d.textContent = atrModeDescs[atrWmMode] || '';
    });
  });

  function atrWmLoadVideoFromUrl(url) {
    atrWmSelRect = null; atrWmDragMode = null;
    if (atrWmRegInf) atrWmRegInf.textContent = 'Nenhuma região selecionada — arraste para marcar';
    if (atrWmAnimFrame) { cancelAnimationFrame(atrWmAnimFrame); atrWmAnimFrame = null; }
    atrWmVideoEl = document.createElement('video');
    atrWmVideoEl.muted = true; atrWmVideoEl.playsInline = true; atrWmVideoEl.loop = true;
    atrWmVideoEl.crossOrigin = 'anonymous';
    atrWmVideoEl.src = url; atrWmVideoEl.currentTime = 0.5;
    atrWmVideoEl.addEventListener('seeked', function onS() {
      atrWmVideoEl.removeEventListener('seeked', onS);
      atrWmVideoW = atrWmVideoEl.videoWidth; atrWmVideoH = atrWmVideoEl.videoHeight;
      atrWmUpdateCanvasSize();
      atrWmStartLoop();
    });
    atrWmVideoEl.load();
  }

  function atrWmUpdateCanvasSize() {
    if (!atrWmCanvas || !atrWmVideoW || !atrWmVideoH) return;
    const wrap = document.getElementById('atr-wm-canvas-wrap');
    const maxW = 760, dW = Math.min(maxW, Math.max(200, (wrap ? wrap.clientWidth : maxW) || maxW));
    const dH = Math.round(dW * atrWmVideoH / atrWmVideoW);
    const dpr = window.devicePixelRatio || 1;
    atrWmCanvas.style.width = dW + 'px'; atrWmCanvas.style.height = dH + 'px';
    atrWmCanvas.width = Math.round(dW * dpr); atrWmCanvas.height = Math.round(dH * dpr);
    atrWmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    atrWmPreviewW = dW; atrWmPreviewH = dH;
  }

  function atrWmStartLoop() {
    if (atrWmAnimFrame) cancelAnimationFrame(atrWmAnimFrame);
    atrWmIsPaused = false;
    atrWmVideoEl.play().catch(() => {});
    const pb = document.getElementById('atr-wm-play');
    if (pb) pb.textContent = '⏸';
    function loop() { atrWmDrawFrame(); atrWmAnimFrame = requestAnimationFrame(loop); }
    atrWmAnimFrame = requestAnimationFrame(loop);
  }

  function atrRoundRect(c, x, y, w, h, r) {
    const R = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
    c.beginPath();
    c.moveTo(x+R,y); c.lineTo(x+w-R,y); c.arcTo(x+w,y,x+w,y+R,R);
    c.lineTo(x+w,y+h-R); c.arcTo(x+w,y+h,x+w-R,y+h,R);
    c.lineTo(x+R,y+h); c.arcTo(x,y+h,x,y+h-R,R);
    c.lineTo(x,y+R); c.arcTo(x,y,x+R,y,R);
    c.closePath();
  }

  function atrWmDrawFrame() {
    if (!atrWmVideoEl || !atrWmCtx) return;
    const seekEl = document.getElementById('atr-wm-seek');
    const timeEl = document.getElementById('atr-wm-time');
    if (!atrWmIsSeeking && seekEl && timeEl) {
      const dur = atrWmVideoEl.duration || 0;
      seekEl.value = dur ? Math.round((atrWmVideoEl.currentTime / dur) * 1000) : 0;
      timeEl.textContent = formatTime(atrWmVideoEl.currentTime) + ' / ' + formatTime(dur);
    }
    atrWmCtx.clearRect(0, 0, atrWmPreviewW, atrWmPreviewH);
    atrWmCtx.drawImage(atrWmVideoEl, 0, 0, atrWmPreviewW, atrWmPreviewH);
    if (!atrWmSelRect || atrWmSelRect.w < 2 || atrWmSelRect.h < 2) return;
    const { x, y, w, h } = atrWmSelRect;
    atrWmCtx.fillStyle = 'rgba(0,0,0,0.45)'; atrWmCtx.fillRect(0, 0, atrWmPreviewW, atrWmPreviewH);
    atrWmCtx.save(); atrRoundRect(atrWmCtx, x, y, w, h, 8); atrWmCtx.clip();
    atrWmCtx.drawImage(atrWmVideoEl, 0, 0, atrWmPreviewW, atrWmPreviewH); atrWmCtx.restore();
    atrWmCtx.strokeStyle = '#6c63ff'; atrWmCtx.lineWidth = 2; atrWmCtx.setLineDash([6,3]);
    atrRoundRect(atrWmCtx, x, y, w, h, 8); atrWmCtx.stroke(); atrWmCtx.setLineDash([]);
    atrWmGetHandles().forEach(hh => {
      atrWmCtx.fillStyle = '#fff'; atrWmCtx.fillRect(hh.x-ATR_HANDLE_HALF, hh.y-ATR_HANDLE_HALF, ATR_HANDLE_SIZE, ATR_HANDLE_SIZE);
      atrWmCtx.strokeStyle = '#6c63ff'; atrWmCtx.lineWidth = 1.5;
      atrWmCtx.strokeRect(hh.x-ATR_HANDLE_HALF, hh.y-ATR_HANDLE_HALF, ATR_HANDLE_SIZE, ATR_HANDLE_SIZE);
    });
    const rW = Math.round(w * atrWmVideoW / atrWmPreviewW), rH = Math.round(h * atrWmVideoH / atrWmPreviewH);
    atrWmCtx.font = 'bold 11px Segoe UI,system-ui,sans-serif';
    const lw = atrWmCtx.measureText(rW + 'x' + rH).width + 12;
    atrWmCtx.fillStyle = '#6c63ff'; atrWmCtx.fillRect(x, Math.max(0, y-22), lw, 20);
    atrWmCtx.fillStyle = '#fff'; atrWmCtx.fillText(rW + 'x' + rH, x+6, Math.max(14, y-6));
  }

  function atrWmGetHandles() {
    if (!atrWmSelRect) return [];
    const {x,y,w,h} = atrWmSelRect;
    return [
      {id:'tl',x,y,cursor:'nwse-resize'},{id:'tr',x:x+w,y,cursor:'nesw-resize'},
      {id:'bl',x,y:y+h,cursor:'nesw-resize'},{id:'br',x:x+w,y:y+h,cursor:'nwse-resize'},
      {id:'tm',x:x+w/2,y,cursor:'ns-resize'},{id:'bm',x:x+w/2,y:y+h,cursor:'ns-resize'},
      {id:'ml',x,y:y+h/2,cursor:'ew-resize'},{id:'mr',x:x+w,y:y+h/2,cursor:'ew-resize'},
    ];
  }
  function atrWmHitHandle(px,py) {
    for (const h of atrWmGetHandles()) if (Math.abs(px-h.x)<=ATR_HANDLE_HALF+3 && Math.abs(py-h.y)<=ATR_HANDLE_HALF+3) return h;
    return null;
  }
  function atrWmIsInside(px,py) {
    if (!atrWmSelRect) return false;
    return px>=atrWmSelRect.x && px<=atrWmSelRect.x+atrWmSelRect.w && py>=atrWmSelRect.y && py<=atrWmSelRect.y+atrWmSelRect.h;
  }
  function atrWmCanvasPos(e) {
    const rect = atrWmCanvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
    return { x: Math.max(0, Math.min(atrWmPreviewW, src.clientX - rect.left)), y: Math.max(0, Math.min(atrWmPreviewH, src.clientY - rect.top)) };
  }

  if (atrWmCanvas) {
    atrWmCanvas.addEventListener('mousedown', e => {
      const p = atrWmCanvasPos(e);
      if (atrWmSelRect && atrWmSelRect.w > 4 && atrWmSelRect.h > 4) {
        const handle = atrWmHitHandle(p.x, p.y);
        if (handle) { atrWmDragMode='resize'; atrWmActiveHandle=handle.id; atrWmDragStart=p; atrWmDragOrigRect={...atrWmSelRect}; return; }
        if (atrWmIsInside(p.x,p.y)) { atrWmDragMode='move'; atrWmDragStart=p; atrWmDragOrigRect={...atrWmSelRect}; return; }
      }
      atrWmDragMode='new'; atrWmDragStart=p; atrWmSelRect={x:p.x,y:p.y,w:0,h:0};
    });
    atrWmCanvas.addEventListener('mousemove', e => {
      const p = atrWmCanvasPos(e);
      if (!atrWmDragMode) {
        if (atrWmSelRect && atrWmSelRect.w > 4 && atrWmSelRect.h > 4) {
          const h = atrWmHitHandle(p.x,p.y);
          atrWmCanvas.style.cursor = h ? h.cursor : (atrWmIsInside(p.x,p.y) ? 'move' : 'crosshair');
        } else atrWmCanvas.style.cursor = 'crosshair';
        return;
      }
      atrWmHandleDrag(p);
    });
    atrWmCanvas.addEventListener('mouseup', () => atrWmEndDrag());
    atrWmCanvas.addEventListener('mouseleave', () => { if (atrWmDragMode) atrWmEndDrag(); });
    atrWmCanvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const p = atrWmCanvasPos(e);
      if (atrWmSelRect && atrWmSelRect.w > 4 && atrWmSelRect.h > 4) {
        const handle = atrWmHitHandle(p.x,p.y);
        if (handle) { atrWmDragMode='resize'; atrWmActiveHandle=handle.id; atrWmDragStart=p; atrWmDragOrigRect={...atrWmSelRect}; return; }
        if (atrWmIsInside(p.x,p.y)) { atrWmDragMode='move'; atrWmDragStart=p; atrWmDragOrigRect={...atrWmSelRect}; return; }
      }
      atrWmDragMode='new'; atrWmDragStart=p; atrWmSelRect={x:p.x,y:p.y,w:0,h:0};
    }, {passive:false});
    atrWmCanvas.addEventListener('touchmove', e => { e.preventDefault(); if (!atrWmDragMode) return; atrWmHandleDrag(atrWmCanvasPos(e)); }, {passive:false});
    atrWmCanvas.addEventListener('touchend', () => atrWmEndDrag());
  }

  function atrWmHandleDrag(p) {
    const dx = p.x - atrWmDragStart.x, dy = p.y - atrWmDragStart.y;
    if (atrWmDragMode === 'new') {
      atrWmSelRect = {x:dx>=0?atrWmDragStart.x:p.x, y:dy>=0?atrWmDragStart.y:p.y, w:Math.abs(dx), h:Math.abs(dy)};
    } else if (atrWmDragMode === 'move') {
      atrWmSelRect = {x:Math.max(0,Math.min(atrWmDragOrigRect.x+dx,atrWmPreviewW-atrWmDragOrigRect.w)), y:Math.max(0,Math.min(atrWmDragOrigRect.y+dy,atrWmPreviewH-atrWmDragOrigRect.h)), w:atrWmDragOrigRect.w, h:atrWmDragOrigRect.h};
    } else if (atrWmDragMode === 'resize') {
      let {x,y,w,h} = atrWmDragOrigRect;
      if (atrWmActiveHandle.includes('l')) { x+=dx; w-=dx; } if (atrWmActiveHandle.includes('r')) { w+=dx; }
      if (atrWmActiveHandle.includes('t')) { y+=dy; h-=dy; } if (atrWmActiveHandle.includes('b')) { h+=dy; }
      if (w<0){x+=w;w=-w;} if (h<0){y+=h;h=-h;}
      x=Math.max(0,x); y=Math.max(0,y); w=Math.min(w,atrWmPreviewW-x); h=Math.min(h,atrWmPreviewH-y);
      atrWmSelRect={x,y,w,h};
    }
    atrWmDrawFrame();
  }

  function atrWmEndDrag() {
    if (!atrWmDragMode) return;
    atrWmDragMode=null; atrWmActiveHandle=null; atrWmDragStart=null; atrWmDragOrigRect=null;
    if (!atrWmSelRect || atrWmSelRect.w < 5 || atrWmSelRect.h < 5) {
      atrWmSelRect=null; atrWmDrawFrame();
      if (atrWmRegInf) atrWmRegInf.textContent='Nenhuma região selecionada — arraste para marcar'; return;
    }
    const rx=Math.round(atrWmSelRect.x*atrWmVideoW/atrWmPreviewW), ry=Math.round(atrWmSelRect.y*atrWmVideoH/atrWmPreviewH);
    const rw=Math.round(atrWmSelRect.w*atrWmVideoW/atrWmPreviewW), rh=Math.round(atrWmSelRect.h*atrWmVideoH/atrWmPreviewH);
    if (atrWmRegInf) atrWmRegInf.innerHTML='Região: <span>'+rw+' × '+rh+' px</span> em <span>('+rx+', '+ry+')</span>';
    atrWmDrawFrame();
  }

  // Video controls
  const atrWmPlayBtn = document.getElementById('atr-wm-play');
  const atrWmSeekEl  = document.getElementById('atr-wm-seek');
  if (atrWmPlayBtn) {
    atrWmPlayBtn.addEventListener('click', () => {
      if (!atrWmVideoEl) return;
      if (atrWmIsPaused) { atrWmVideoEl.play(); atrWmIsPaused=false; atrWmPlayBtn.textContent='⏸'; }
      else { atrWmVideoEl.pause(); atrWmIsPaused=true; atrWmPlayBtn.textContent='▶'; }
    });
  }
  if (atrWmSeekEl) {
    atrWmSeekEl.addEventListener('mousedown', () => { atrWmIsSeeking=true; });
    atrWmSeekEl.addEventListener('input', () => {
      if (!atrWmVideoEl || !atrWmVideoEl.duration) return;
      atrWmVideoEl.currentTime = (atrWmSeekEl.value/1000)*atrWmVideoEl.duration;
    });
    atrWmSeekEl.addEventListener('mouseup', () => { atrWmIsSeeking=false; });
  }

  // ── Gemini detect for ATR watermark ──
  (function() {
    const keyInput  = document.getElementById('atr-wm-or-key');
    const saveBtn   = document.getElementById('atr-wm-or-save-btn');
    const detectBtn = document.getElementById('atr-wm-or-detect-btn');
    const status    = document.getElementById('atr-wm-or-status');
    const error     = document.getElementById('atr-wm-or-error');
    if (!detectBtn) return;
    const saved = localStorage.getItem('wm_or_key');
    if (saved && keyInput) keyInput.value = saved;
    if (saveBtn && keyInput) {
      saveBtn.addEventListener('click', () => {
        const v = keyInput.value.trim();
        if (v) { localStorage.setItem('wm_or_key', v); saveBtn.textContent = '✅'; setTimeout(() => saveBtn.textContent = '💾', 2000); }
      });
    }
    detectBtn.addEventListener('click', async () => {
      if (!atrTranslatedUrl) { if (error) { error.textContent = 'Processe a tradução primeiro para ter um vídeo.'; error.style.display = ''; } return; }
      const key = (keyInput && keyInput.value.trim()) || localStorage.getItem('wm_or_key') || '';
      if (!key) { if (error) { error.textContent = 'Informe a OpenRouter API Key.'; error.style.display = ''; } return; }
      detectBtn.disabled = true;
      if (error) { error.textContent = ''; error.style.display = 'none'; }
      if (status) status.textContent = 'Analisando com IA…';
      try {
        const blob = await fetch(atrTranslatedUrl).then(r => r.blob());
        const fd = new FormData();
        fd.append('video', blob, 'video.mp4');
        fd.append('orKey', key);
        const r = await fetch(API + '/api/watermark/detect-gemini', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Erro');
        atrWmSelRect = { x: j.x * atrWmPreviewW / atrWmVideoW, y: j.y * atrWmPreviewH / atrWmVideoH, w: j.w * atrWmPreviewW / atrWmVideoW, h: j.h * atrWmPreviewH / atrWmVideoH };
        atrWmDrawFrame();
        if (status) status.textContent = `✓ Detectado: ${j.w}×${j.h}px em (${j.x}, ${j.y})`;
      } catch(e) {
        if (error) { error.textContent = e.message; error.style.display = ''; }
        if (status) status.textContent = '';
      } finally {
        detectBtn.disabled = false;
      }
    });
  })();

  // ── Process watermark ──
  const atrWmProcessBtn = document.getElementById('atr-wm-process-btn');
  if (atrWmProcessBtn) {
    atrWmProcessBtn.addEventListener('click', async () => {
      if (!atrTranslatedUrl) return;
      if (!ATR_AUTO_MODES.has(atrWmMode) && (!atrWmSelRect || atrWmSelRect.w < 5 || atrWmSelRect.h < 5)) {
        document.getElementById('atr-wm-error').style.display = 'block';
        document.getElementById('atr-wm-error').textContent = 'Selecione a região da marca d\'água antes de processar.';
        return;
      }
      document.getElementById('atr-wm-error').style.display = 'none';
      document.getElementById('atr-wm-result').style.display = 'none';
      atrWmProcessBtn.disabled = true; atrWmProcessBtn.textContent = '⏳ Processando...';
      document.getElementById('atr-wm-progress').style.display = '';
      document.getElementById('atr-wm-status').textContent = 'Removendo marca d\'água…';
      try {
        const blob = await fetch(atrTranslatedUrl).then(r => { if (!r.ok) throw new Error('Erro ao carregar vídeo'); return r.blob(); });
        const file = new File([blob], 'translated.mp4', { type: 'video/mp4' });
        const fd = new FormData();
        fd.append('video', file); fd.append('mode', atrWmMode);
        if (!ATR_AUTO_MODES.has(atrWmMode) && atrWmSelRect) {
          fd.append('x', Math.round(atrWmSelRect.x * atrWmVideoW / atrWmPreviewW));
          fd.append('y', Math.round(atrWmSelRect.y * atrWmVideoH / atrWmPreviewH));
          fd.append('w', Math.round(atrWmSelRect.w * atrWmVideoW / atrWmPreviewW));
          fd.append('h', Math.round(atrWmSelRect.h * atrWmVideoH / atrWmPreviewH));
        }
        const resp = await fetch(API + '/api/process', { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        let url;
        const ASYNC_WM = new Set(['delogo', 'sora']);
        if (ASYNC_WM.has(atrWmMode) && json.status === 'processing' && json.id) {
          url = await atrPollJob(json.id, txt => { document.getElementById('atr-wm-status').textContent = txt; });
        } else { url = API + json.url; }
        atrWmUrl = url;
        document.getElementById('atr-wm-result-video').src = atrWmUrl;
        document.getElementById('atr-wm-result').style.display = '';
        document.getElementById('atr-wm-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        document.getElementById('atr-wm-error').style.display = 'block';
        document.getElementById('atr-wm-error').textContent = 'Erro: ' + e.message;
      } finally {
        atrWmProcessBtn.disabled = false; atrWmProcessBtn.textContent = '▶ Remover Marca d\'Água';
        document.getElementById('atr-wm-progress').style.display = 'none';
        document.getElementById('atr-wm-status').textContent = '';
      }
    });
  }

  // Regerar watermark — hide result, reset selection
  const atrWmRegerarBtn = document.getElementById('atr-wm-regerar-btn');
  if (atrWmRegerarBtn) {
    atrWmRegerarBtn.addEventListener('click', () => {
      document.getElementById('atr-wm-result').style.display = 'none';
      atrWmSelRect = null;
      if (atrWmRegInf) atrWmRegInf.textContent = 'Nenhuma região selecionada — arraste para marcar';
      atrWmDrawFrame();
    });
  }

  // ════ SUBTITLE CANVAS ════
  const atrSubCanvas    = document.getElementById('atr-sub-canvas');
  const atrSubCtx       = atrSubCanvas ? atrSubCanvas.getContext('2d') : null;
  const atrSubVcPlay    = document.getElementById('atr-sub-vc-play');
  const atrSubVcTime    = document.getElementById('atr-sub-vc-time');
  const atrSubVcSeek    = document.getElementById('atr-sub-vc-seek');
  const atrSubFontSizeEl  = document.getElementById('atr-sub-fontsize');
  const atrSubFontSizeVal = document.getElementById('atr-sub-fontsize-val');
  const atrSubUppercaseBtn = document.getElementById('atr-sub-uppercase-btn');

  function updateAtrSubCanvasSize() {
    if (!atrSubVideoW || !atrSubVideoH || !atrSubCanvas) return;
    const wrap = document.getElementById('atr-sub-canvas-wrap');
    const maxW = 760, dW = Math.min(maxW, Math.max(200, (wrap && wrap.clientWidth) || maxW));
    const dH = Math.round(dW * atrSubVideoH / atrSubVideoW), dpr = window.devicePixelRatio || 1;
    atrSubCanvas.style.width = dW + 'px'; atrSubCanvas.style.height = dH + 'px';
    atrSubCanvas.width  = Math.max(1, Math.round(dW * dpr));
    atrSubCanvas.height = Math.max(1, Math.round(dH * dpr));
    atrSubCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    atrSubPreviewW = dW; atrSubPreviewH = dH;
  }

  function startAtrSubLoop() {
    atrSubIsPaused = false; atrSubIsSeeking = false;
    atrSubVideoEl.loop = true; atrSubVideoEl.play().catch(() => {});
    if (atrSubVcPlay) atrSubVcPlay.textContent = '\u23F8';
    function loop() { drawAtrSubFrame(); atrSubAnimFrame = requestAnimationFrame(loop); }
    atrSubAnimFrame = requestAnimationFrame(loop);
  }

  function drawAtrSubFrame() {
    if (!atrSubVideoEl || !atrSubCtx) return;
    if (!atrSubIsSeeking && atrSubVcSeek && atrSubVcTime) {
      const dur = atrSubVideoEl.duration || 0;
      atrSubVcSeek.value = dur ? Math.round((atrSubVideoEl.currentTime / dur) * 1000) : 0;
      atrSubVcTime.textContent = formatTime(atrSubVideoEl.currentTime) + ' / ' + formatTime(dur);
    }
    atrSubCtx.clearRect(0, 0, atrSubPreviewW, atrSubPreviewH);
    atrSubCtx.drawImage(atrSubVideoEl, 0, 0, atrSubPreviewW, atrSubPreviewH);
    const fsRaw = atrSubFontSizeEl ? parseInt(atrSubFontSizeEl.value) || 72 : 72;
    const scaleFactor = atrSubPreviewW / 1920;
    const fs = Math.max(8, Math.round(fsRaw * scaleFactor));
    const lineH = fs * 1.5, lines = atrSubPreset === 'karaoke' ? 2 : 1, bPad = fs * 0.4;
    const bW = atrSubPreviewW * ATR_SUB_BLOCK_W_FRAC, bH = lineH * lines + bPad * 2;
    const bX = atrSubBlockX * atrSubPreviewW - bW / 2;
    const bY = atrSubBlockY * atrSubPreviewH - bH / 2;
    atrSubCtx.fillStyle = 'rgba(108,99,255,0.18)';
    roundRect(atrSubCtx, bX, bY, bW, bH, 8); atrSubCtx.fill();
    atrSubCtx.strokeStyle = atrSubBlockDragging ? '#ffffff' : '#6c63ff';
    atrSubCtx.lineWidth = 2; atrSubCtx.setLineDash([5, 3]);
    roundRect(atrSubCtx, bX, bY, bW, bH, 8); atrSubCtx.stroke(); atrSubCtx.setLineDash([]);
    atrSubCtx.textAlign = 'center'; atrSubCtx.textBaseline = 'middle';
    const sampleText = atrSubUppercase ? 'LEGENDA MODELO' : 'Legenda Modelo';
    if (atrSubPreset === 'karaoke') {
      const row1 = atrSubUppercase ? 'TEXTO ANTERIOR' : 'texto anterior';
      const row2Parts = [
        { text: atrSubUppercase ? 'PALAVRA ' : 'palavra ', color: '#fff' },
        { text: atrSubUppercase ? 'DESTAQUE' : 'destaque', color: '#FFFF00' }
      ];
      const y1 = bY + bPad + lineH * 0.5, y2 = bY + bPad + lineH * 1.5;
      atrSubCtx.font = `bold ${fs}px Arial Black, Arial, sans-serif`;
      atrSubCtx.lineWidth = Math.max(2, fs * 0.08);
      atrSubCtx.strokeStyle = '#000'; atrSubCtx.fillStyle = '#fff';
      atrSubCtx.strokeText(row1, bX + bW / 2, y1); atrSubCtx.fillText(row1, bX + bW / 2, y1);
      const word1W = atrSubCtx.measureText(row2Parts[0].text).width;
      const word2W = atrSubCtx.measureText(row2Parts[1].text).width;
      let cx = bX + bW / 2 - (word1W + word2W) / 2;
      row2Parts.forEach(part => {
        const w = atrSubCtx.measureText(part.text).width;
        atrSubCtx.strokeStyle = '#000'; atrSubCtx.fillStyle = part.color;
        atrSubCtx.strokeText(part.text, cx + w / 2, y2); atrSubCtx.fillText(part.text, cx + w / 2, y2);
        cx += w;
      });
    } else {
      atrSubCtx.font = `bold ${fs}px Arial, sans-serif`;
      atrSubCtx.lineWidth = Math.max(2, fs * 0.06);
      atrSubCtx.strokeStyle = '#000'; atrSubCtx.fillStyle = '#fff';
      atrSubCtx.strokeText(sampleText, bX + bW / 2, bY + bH / 2);
      atrSubCtx.fillText(sampleText, bX + bW / 2, bY + bH / 2);
    }
    atrSubCtx.font = `${Math.max(9, Math.round(11 * atrSubPreviewH / 360))}px Arial`;
    atrSubCtx.fillStyle = 'rgba(255,255,255,0.55)';
    atrSubCtx.textAlign = 'center';
    atrSubCtx.fillText('\u2195 arraste', bX + bW / 2, bY + bH + 14);
  }

  function atrSubCanvasPos(e) {
    if (!atrSubCanvas) return { x: 0, y: 0 };
    const rect = atrSubCanvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function isNearAtrSubBlock(px, py) {
    const fsRaw = atrSubFontSizeEl ? parseInt(atrSubFontSizeEl.value) || 72 : 72;
    const fs = Math.max(8, Math.round(fsRaw * (atrSubPreviewW / 1920)));
    const lineH = fs * 1.5, lines = atrSubPreset === 'karaoke' ? 2 : 1, bPad = fs * 0.4;
    const bW = atrSubPreviewW * ATR_SUB_BLOCK_W_FRAC, bH = lineH * lines + bPad * 2;
    const bX = atrSubBlockX * atrSubPreviewW - bW / 2, bY = atrSubBlockY * atrSubPreviewH - bH / 2;
    return px >= bX - 8 && px <= bX + bW + 8 && py >= bY - 8 && py <= bY + bH + 8;
  }

  function atrSubLoadVideo(url) {
    if (atrSubAnimFrame) { cancelAnimationFrame(atrSubAnimFrame); atrSubAnimFrame = null; }
    atrSubVideoEl = document.createElement('video');
    atrSubVideoEl.muted = true; atrSubVideoEl.playsInline = true; atrSubVideoEl.preload = 'auto';
    atrSubVideoEl.crossOrigin = 'anonymous';
    atrSubVideoEl.src = url; atrSubVideoEl.currentTime = 0.1;
    atrSubVideoEl.addEventListener('seeked', function onS() {
      atrSubVideoEl.removeEventListener('seeked', onS);
      atrSubVideoW = atrSubVideoEl.videoWidth; atrSubVideoH = atrSubVideoEl.videoHeight;
      const wrap = document.getElementById('atr-sub-canvas-wrap');
      if (wrap) wrap.style.display = '';
      requestAnimationFrame(() => { updateAtrSubCanvasSize(); startAtrSubLoop(); });
    });
  }

  if (atrSubCanvas) {
    atrSubCanvas.style.cursor = 'default';
    atrSubCanvas.addEventListener('mousedown', e => {
      const p = atrSubCanvasPos(e);
      if (isNearAtrSubBlock(p.x, p.y)) { atrSubBlockDragging = true; atrSubCanvas.style.cursor = 'grabbing'; }
    });
    atrSubCanvas.addEventListener('mousemove', e => {
      const p = atrSubCanvasPos(e);
      if (atrSubBlockDragging) {
        atrSubBlockX = Math.max(0.1, Math.min(0.9, p.x / atrSubPreviewW));
        atrSubBlockY = Math.max(0.05, Math.min(0.97, p.y / atrSubPreviewH));
      } else {
        atrSubCanvas.style.cursor = isNearAtrSubBlock(p.x, p.y) ? 'grab' : 'default';
      }
    });
    atrSubCanvas.addEventListener('mouseup', () => { atrSubBlockDragging = false; atrSubCanvas.style.cursor = 'default'; });
    atrSubCanvas.addEventListener('mouseleave', () => { atrSubBlockDragging = false; });
    atrSubCanvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const p = atrSubCanvasPos(e);
      if (isNearAtrSubBlock(p.x, p.y)) atrSubBlockDragging = true;
    }, { passive: false });
    atrSubCanvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!atrSubBlockDragging) return;
      const p = atrSubCanvasPos(e);
      atrSubBlockX = Math.max(0.1, Math.min(0.9, p.x / atrSubPreviewW));
      atrSubBlockY = Math.max(0.05, Math.min(0.97, p.y / atrSubPreviewH));
    }, { passive: false });
    atrSubCanvas.addEventListener('touchend', () => { atrSubBlockDragging = false; });
  }

  // Subtitle video controls
  if (atrSubVcPlay) {
    atrSubVcPlay.addEventListener('click', () => {
      if (!atrSubVideoEl) return;
      if (atrSubIsPaused) { atrSubVideoEl.play().catch(() => {}); atrSubIsPaused = false; atrSubVcPlay.textContent = '\u23F8'; }
      else { atrSubVideoEl.pause(); atrSubIsPaused = true; atrSubVcPlay.textContent = '\u25B6'; }
    });
  }
  if (atrSubVcSeek) {
    atrSubVcSeek.addEventListener('mousedown', () => { atrSubIsSeeking = true; });
    atrSubVcSeek.addEventListener('input', () => {
      if (!atrSubVideoEl || !atrSubVideoEl.duration) return;
      atrSubVideoEl.currentTime = (atrSubVcSeek.value / 1000) * atrSubVideoEl.duration;
      if (atrSubVcTime) atrSubVcTime.textContent = formatTime(atrSubVideoEl.currentTime) + ' / ' + formatTime(atrSubVideoEl.duration);
    });
    atrSubVcSeek.addEventListener('mouseup', () => { atrSubIsSeeking = false; });
  }

  // Subtitle presets
  document.querySelectorAll('[data-atr-preset]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-atr-preset]').forEach(c => c.classList.remove('atr-sp-active'));
      card.classList.add('atr-sp-active');
      atrSubPreset = card.dataset.atrPreset;
    });
  });

  // Subtitle animation mode (word / block)
  document.querySelectorAll('[data-atr-anim]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-atr-anim]').forEach(b => b.classList.remove('pa-active'));
      btn.classList.add('pa-active');
      atrSubWordByWord = btn.dataset.atrAnim === 'word';
    });
  });

  // Subtitle entry animation
  document.querySelectorAll('#atr-entry-anim-btns [data-atr-entry]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#atr-entry-anim-btns [data-atr-entry]').forEach(b => b.classList.remove('ea-active'));
      btn.classList.add('ea-active');
      atrSubEntryAnim = btn.dataset.atrEntry || 'none';
    });
  });

  // Font size
  if (atrSubFontSizeEl && atrSubFontSizeVal) {
    atrSubFontSizeEl.addEventListener('input', () => { atrSubFontSizeVal.textContent = atrSubFontSizeEl.value; });
  }

  // Uppercase
  if (atrSubUppercaseBtn) {
    atrSubUppercaseBtn.addEventListener('click', () => {
      atrSubUppercase = !atrSubUppercase;
      atrSubUppercaseBtn.classList.toggle('uc-active', atrSubUppercase);
    });
  }

  // Aprovar watermark → legendas
  const atrWmAprovarBtn = document.getElementById('atr-wm-aprovar-btn');
  if (atrWmAprovarBtn) {
    atrWmAprovarBtn.addEventListener('click', () => {
      if (!atrWmUrl) return;
      atrSetStep(3);
      atrShowPhase(atrPhaseSub);
      atrSubLoadVideo(atrWmUrl);
    });
  }

  // ── Process subtitles ──
  const atrSubProcessBtn = document.getElementById('atr-sub-process-btn');
  if (atrSubProcessBtn) {
    atrSubProcessBtn.addEventListener('click', async () => {
      if (!atrWmUrl) return;
      document.getElementById('atr-sub-error').style.display = 'none';
      document.getElementById('atr-sub-result').style.display = 'none';
      atrSubProcessBtn.disabled = true; atrSubProcessBtn.textContent = '⏳ Processando...';
      document.getElementById('atr-sub-progress').style.display = '';
      document.getElementById('atr-sub-status').textContent = '⏳ Transcrevendo com faster-whisper…';
      try {
        const blob = await fetch(atrWmUrl).then(r => { if (!r.ok) throw new Error('Erro ao carregar vídeo'); return r.blob(); });
        const file = new File([blob], 'wm_removed.mp4', { type: 'video/mp4' });
        const fd = new FormData();
        fd.append('video', file);
        fd.append('lang',      document.getElementById('atr-sub-lang').value);
        fd.append('model',     document.getElementById('atr-sub-model').value);
        fd.append('preset',    atrSubPreset);
        fd.append('fontsize',  atrSubFontSizeEl ? (atrSubFontSizeEl.value || '72') : '72');
        fd.append('wordbyword', atrSubWordByWord ? '1' : '0');
        fd.append('uppercase',  atrSubUppercase ? '1' : '0');
        fd.append('animation', atrSubEntryAnim);
        fd.append('posX', Math.round(atrSubBlockX * 1920));
        fd.append('posY', Math.round(atrSubBlockY * 1080));
        const resp = await fetch(API + '/api/subtitle/auto', { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        atrFinalUrl = API + json.url;
        document.getElementById('atr-sub-result-video').src = atrFinalUrl;
        document.getElementById('atr-sub-result').style.display = '';
        document.getElementById('atr-sub-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        document.getElementById('atr-sub-error').style.display = 'block';
        document.getElementById('atr-sub-error').textContent = 'Erro: ' + e.message;
      } finally {
        atrSubProcessBtn.disabled = false; atrSubProcessBtn.textContent = '🤖 Gerar AutoCaption';
        document.getElementById('atr-sub-progress').style.display = 'none';
        document.getElementById('atr-sub-status').textContent = '';
      }
    });
  }

  // Regerar subtitles
  const atrSubRegerarBtn = document.getElementById('atr-sub-regerar-btn');
  if (atrSubRegerarBtn) {
    atrSubRegerarBtn.addEventListener('click', () => { document.getElementById('atr-sub-result').style.display = 'none'; });
  }

  // Aprovar subtitles → upscale phase
  const atrSubAprovarBtn = document.getElementById('atr-sub-aprovar-btn');
  if (atrSubAprovarBtn) {
    atrSubAprovarBtn.addEventListener('click', () => {
      if (!atrFinalUrl) return;
      atrSetStep(4);
      atrShowPhase(atrPhaseUpscale);
      // Pre-select 1080 by default for upscale phase
      document.querySelectorAll('[data-atr-res]').forEach(b => {
        b.style.border = b.dataset.atrRes === '1080' ? '2px solid var(--accent)' : '2px solid var(--border)';
      });
      atrUpscaleTargetH = 1080;
    });
  }

  // ── ATR Upscale phase vars ──
  let atrUpscaleTargetH = 1080;
  document.querySelectorAll('[data-atr-res]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-atr-res]').forEach(b => b.style.border = '2px solid var(--border)');
      btn.style.border = '2px solid var(--accent)';
      const r = btn.dataset.atrRes;
      atrUpscaleTargetH = r === '4k' ? 2160 : r === '1080' ? 1080 : 720;
    });
  });

  const atrUpscaleBtn       = document.getElementById('atr-upscale-btn');
  const atrUpscaleSkipBtn   = document.getElementById('atr-upscale-skip-btn');
  const atrUpscaleAprovarBtn= document.getElementById('atr-upscale-aprovar-btn');
  const atrUpscaleProgress  = document.getElementById('atr-upscale-progress');
  const atrUpscaleStatus    = document.getElementById('atr-upscale-status');
  const atrUpscaleError     = document.getElementById('atr-upscale-error');
  const atrUpscaleResult    = document.getElementById('atr-upscale-result');
  const atrUpscaleVideo     = document.getElementById('atr-upscale-video');
  let   atrUpscaledUrl      = null;

  function atrFinishDone(url) {
    atrSetStep(5);
    atrShowPhase(atrPhaseDone);
    const finalVid = document.getElementById('atr-final-video');
    const dlBtn    = document.getElementById('atr-download-btn');
    if (finalVid) finalVid.src = url;
    if (dlBtn) { dlBtn.href = url; dlBtn.download = 'video-final.mp4'; }
  }

  if (atrUpscaleBtn) {
    atrUpscaleBtn.addEventListener('click', async () => {
      if (!atrFinalUrl) return;
      atrUpscaleBtn.disabled = true;
      if (atrUpscaleError) { atrUpscaleError.textContent = ''; atrUpscaleError.style.display = 'none'; }
      if (atrUpscaleResult) atrUpscaleResult.style.display = 'none';
      if (atrUpscaleProgress) atrUpscaleProgress.style.display = '';
      if (atrUpscaleStatus) atrUpscaleStatus.textContent = 'Upscalando vídeo…';
      try {
        // Fetch the video blob from atrFinalUrl and upload to /api/upscale
        const videoResp = await fetch(atrFinalUrl);
        const blob = await videoResp.blob();
        const fd = new FormData();
        fd.append('video', blob, 'video.mp4');
        fd.append('h', String(atrUpscaleTargetH));
        const r = await fetch(API + '/api/upscale', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Erro upscale');
        const url = await atrPollJob(j.id, s => { if (atrUpscaleStatus) atrUpscaleStatus.textContent = s; });
        atrUpscaledUrl = url;
        if (atrUpscaleProgress) atrUpscaleProgress.style.display = 'none';
        if (atrUpscaleStatus) atrUpscaleStatus.textContent = '✓ Pronto!';
        if (atrUpscaleVideo) atrUpscaleVideo.src = url;
        if (atrUpscaleResult) atrUpscaleResult.style.display = '';
      } catch(e) {
        if (atrUpscaleProgress) atrUpscaleProgress.style.display = 'none';
        if (atrUpscaleError) { atrUpscaleError.textContent = e.message; atrUpscaleError.style.display = ''; }
      } finally {
        atrUpscaleBtn.disabled = false;
      }
    });
  }

  if (atrUpscaleSkipBtn) {
    atrUpscaleSkipBtn.addEventListener('click', () => {
      if (!atrFinalUrl) return;
      atrFinishDone(atrFinalUrl);
    });
  }

  if (atrUpscaleAprovarBtn) {
    atrUpscaleAprovarBtn.addEventListener('click', () => {
      if (!atrUpscaledUrl) return;
      atrFinishDone(atrUpscaledUrl);
    });
  }

  // Restart
  const atrRestartBtn = document.getElementById('atr-restart-btn');
  if (atrRestartBtn) {
    atrRestartBtn.addEventListener('click', () => {
      atrFile=null; atrTempId=null; atrSegments=[];
      atrTranslatedUrl=null; atrWmUrl=null; atrFinalUrl=null; atrUpscaledUrl=null;
      atrWmSelRect=null;
      if (atrWmAnimFrame) { cancelAnimationFrame(atrWmAnimFrame); atrWmAnimFrame=null; }
      atrWmVideoEl=null;
      if (atrSubAnimFrame) { cancelAnimationFrame(atrSubAnimFrame); atrSubAnimFrame=null; }
      atrSubVideoEl=null;
      atrSubBlockX=0.5; atrSubBlockY=0.88;
      atrSubPreset='classico'; atrSubWordByWord=false; atrSubEntryAnim='none'; atrSubUppercase=false;
      if (atrSubUppercaseBtn) atrSubUppercaseBtn.classList.remove('uc-active');
      document.querySelectorAll('[data-atr-preset]').forEach(c => c.classList.remove('atr-sp-active'));
      const defaultAtrPreset = document.querySelector('[data-atr-preset="classico"]');
      if (defaultAtrPreset) defaultAtrPreset.classList.add('atr-sp-active');
      if (atrFileName) atrFileName.textContent='';
      atrAnalyzeBtn.disabled=true; atrAnalyzeBtn.textContent='Selecione um vídeo';
      atrAnalyzeErr.style.display='none';
      document.getElementById('atr-wm-result').style.display='none';
      document.getElementById('atr-sub-result').style.display='none';
      atrSetStep(1);
      atrShowPhase(atrPhaseConfig);
    });
  }

  // ── Poll job helper ──
  async function atrPollJob(jobId, onStatus) {
    while (true) {
      await new Promise(r => setTimeout(r, 2500));
      const resp = await fetch(API + `/api/process-status/${jobId}`);
      const job  = await resp.json();
      if (job.status === 'done') return API + job.url;
      if (job.status === 'error') throw new Error(job.error || 'Falhou');
      if (onStatus) onStatus('Processando… ' + (job.progress || 0) + '%');
    }
  }

})();

// ════════════════════════════════════════════════════════════════════
// AUTO MONTADOR IA
// ════════════════════════════════════════════════════════════════════
;(function() {
  const panel = document.getElementById('tool-automontador');
  if (!panel) return;

  let amAudioFile  = null;
  let amVideoFiles = [];
  let amJobId      = null;
  let amPollTimer  = null;

  const amOrKey     = document.getElementById('am-or-key');
  const amOrSave    = document.getElementById('am-or-save-btn');
  const amAudioDrop = document.getElementById('am-audio-drop');
  const amAudioIn   = document.getElementById('am-audio-input');
  const amAudioName = document.getElementById('am-audio-name');
  const amVideosDrop= document.getElementById('am-videos-drop');
  const amVideosIn  = document.getElementById('am-videos-input');
  const amVideosList= document.getElementById('am-videos-list');
  const amVideosCount=document.getElementById('am-videos-count');
  const amStartBtn  = document.getElementById('am-start-btn');
  const amProgWrap  = document.getElementById('am-progress-wrap');
  const amProgBar   = document.getElementById('am-progress-bar');
  const amProgLabel = document.getElementById('am-progress-label');
  const amStatus    = document.getElementById('am-status');
  const amError     = document.getElementById('am-error');
  const amResultCard= document.getElementById('am-result-card');
  const amResultVid = document.getElementById('am-result-video');
  const amDownBtn   = document.getElementById('am-download-btn');

  // Save key
  const savedOrKey = localStorage.getItem('ah_or_key');
  if (savedOrKey && amOrKey) { amOrKey.value = savedOrKey; if (amOrSave) amOrSave.textContent = '✅'; }
  amOrSave && amOrSave.addEventListener('click', () => {
    const v = amOrKey.value.trim();
    if (v) { localStorage.setItem('ah_or_key', v); amOrSave.textContent = '✅'; setTimeout(() => amOrSave.textContent = '💾', 2000); }
  });
  amOrKey && amOrKey.addEventListener('input', () => { if (amOrSave && amOrSave.textContent === '✅') amOrSave.textContent = '💾'; });

  // Audio upload
  amAudioDrop && amAudioDrop.addEventListener('click', () => amAudioIn && amAudioIn.click());
  amAudioDrop && amAudioDrop.addEventListener('dragover', e => e.preventDefault());
  amAudioDrop && amAudioDrop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setAmAudio(f); });
  amAudioIn   && amAudioIn.addEventListener('change', () => { if (amAudioIn.files[0]) setAmAudio(amAudioIn.files[0]); });
  function setAmAudio(f) { amAudioFile = f; if (amAudioName) amAudioName.textContent = f.name; if (amAudioDrop) amAudioDrop.classList.add('has-file'); amCheckReady(); }

  // Videos upload
  amVideosDrop && amVideosDrop.addEventListener('click', () => amVideosIn && amVideosIn.click());
  amVideosDrop && amVideosDrop.addEventListener('dragover', e => e.preventDefault());
  amVideosDrop && amVideosDrop.addEventListener('drop', e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('video/')) addAmVideo(f); }); });
  amVideosIn   && amVideosIn.addEventListener('change', () => { Array.from(amVideosIn.files).forEach(f => addAmVideo(f)); amVideosIn.value = ''; });

  function addAmVideo(f) {
    const idx = amVideoFiles.length;
    amVideoFiles.push(f);
    if (amVideosCount) amVideosCount.textContent = '(' + amVideoFiles.length + ')';
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-secondary);border-radius:6px;margin-top:4px;font-size:12px';
    d.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🎬 ${f.name}</span><button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0">&times;</button>`;
    d.querySelector('button').addEventListener('click', () => { amVideoFiles.splice(idx, 1, null); d.remove(); if (amVideosCount) amVideosCount.textContent = '(' + amVideoFiles.filter(Boolean).length + ')'; amCheckReady(); });
    if (amVideosList) amVideosList.appendChild(d);
    amCheckReady();
  }

  function amCheckReady() {
    if (!amStartBtn) return;
    const ok = amAudioFile && amVideoFiles.filter(Boolean).length > 0 && amOrKey && amOrKey.value.trim();
    amStartBtn.disabled = !ok;
    amStartBtn.textContent = ok ? '🎬 Iniciar montagem automática' : 'Adicione o áudio e pelo menos 1 vídeo';
  }

  function setAmProgress(pct, label) {
    if (amProgBar) amProgBar.style.width = pct + '%';
    if (amProgLabel) amProgLabel.textContent = label || (pct + '%');
  }

  amStartBtn && amStartBtn.addEventListener('click', async () => {
    const orKey = amOrKey && amOrKey.value.trim();
    if (!orKey || !amAudioFile || !amVideoFiles.filter(Boolean).length) return;

    // Reset UI
    amStartBtn.disabled = true;
    if (amError) amError.style.display = 'none';
    if (amResultCard) amResultCard.style.display = 'none';
    if (amProgWrap) amProgWrap.style.display = '';
    if (amStatus) amStatus.textContent = '📤 Enviando arquivos…';
    setAmProgress(0, '0% — enviando…');

    try {
      const fd = new FormData();
      fd.append('audio', amAudioFile);
      amVideoFiles.filter(Boolean).forEach((f, i) => fd.append('videos', f));
      fd.append('or_key', orKey);

      const r = await fetch(API + '/api/automontador/start', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
      amJobId = j.id;

      // Poll
      if (amPollTimer) clearInterval(amPollTimer);
      amPollTimer = setInterval(async () => {
        try {
          const pr = await fetch(API + '/api/job/' + amJobId);
          const pj = await pr.json();

          if (pj.progress !== undefined) setAmProgress(pj.progress, pj.label || pj.progress + '%');
          if (pj.status_label && amStatus) amStatus.textContent = pj.status_label;

          if (pj.status === 'done') {
            clearInterval(amPollTimer);
            setAmProgress(100, '100% — concluído!');
            if (amStatus) amStatus.textContent = '✓ Montagem concluída!';
            if (amResultCard) amResultCard.style.display = '';
            if (amResultVid) amResultVid.src = API + pj.url;
            if (amDownBtn) { amDownBtn.href = API + pj.url; amDownBtn.download = 'montagem.mp4'; }
            amStartBtn.disabled = false;
          } else if (pj.status === 'error') {
            clearInterval(amPollTimer);
            if (amError) { amError.style.display = 'block'; amError.textContent = pj.error || 'Erro desconhecido'; }
            if (amProgWrap) amProgWrap.style.display = 'none';
            if (amStatus) amStatus.textContent = '';
            amStartBtn.disabled = false;
          }
        } catch {}
      }, 3000);

    } catch(e) {
      if (amError) { amError.style.display = 'block'; amError.textContent = e.message; }
      if (amProgWrap) amProgWrap.style.display = 'none';
      if (amStatus) amStatus.textContent = '';
      amStartBtn.disabled = false;
    }
  });
})();

// ════════════════════════════════════════════════════════════════════
// AUTO LEGENDA
// ════════════════════════════════════════════════════════════════════
;(function() {
  const alPanel = document.getElementById('tool-autolegenda');
  if (!alPanel) return;

  // ── Elements ──
  const alOrKey       = document.getElementById('al-or-key');
  const alOrSave      = document.getElementById('al-or-save-btn');
  const alProductDesc = document.getElementById('al-product-desc');
  const alImgDrop     = document.getElementById('al-img-drop');
  const alImgInput    = document.getElementById('al-img-input');
  const alImgName     = document.getElementById('al-img-name');
  const alImgPreviewW = document.getElementById('al-img-preview-wrap');
  const alImgPreview  = document.getElementById('al-img-preview');
  const alImgClear    = document.getElementById('al-img-clear');
  const alExtraPrompt = document.getElementById('al-extra-prompt');
  const alGenCount    = document.getElementById('al-gen-count');
  const alGenBtn      = document.getElementById('al-gen-btn');
  const alGenProgress = document.getElementById('al-gen-progress');
  const alGenError    = document.getElementById('al-gen-error');
  const alResultsList = document.getElementById('al-results-list');
  const alResultsEmpty= document.getElementById('al-results-empty');
  const alResultsCount= document.getElementById('al-results-count');
  const alCopyAllBtn  = document.getElementById('al-copy-all-btn');

  let alImageBase64 = null; // { data: base64str, type: 'image/jpeg' }
  let alVariations  = [];   // [{ primary_text, headline, description }]

  function alEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Save key ──
  const alSavedKey = localStorage.getItem('al_or_key');
  if (alSavedKey) { alOrKey.value = alSavedKey; alOrSave.textContent = '✅'; }
  alOrSave.addEventListener('click', () => {
    const v = alOrKey.value.trim();
    if (!v) return;
    localStorage.setItem('al_or_key', v);
    alOrSave.textContent = '✅';
    setTimeout(() => alOrSave.textContent = '💾', 1500);
  });

  // ── Image upload ──
  function setImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      alImageBase64 = { data: dataUrl.split(',')[1], type: file.type };
      alImgPreview.src = dataUrl;
      alImgPreviewW.style.display = '';
      alImgName.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  alImgDrop.addEventListener('click', () => alImgInput.click());
  alImgDrop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') alImgInput.click(); });
  alImgDrop.addEventListener('dragover', e => { e.preventDefault(); alImgDrop.classList.add('drag-over'); });
  alImgDrop.addEventListener('dragleave', () => alImgDrop.classList.remove('drag-over'));
  alImgDrop.addEventListener('drop', e => {
    e.preventDefault(); alImgDrop.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setImage(e.dataTransfer.files[0]);
  });
  alImgInput.addEventListener('change', () => { if (alImgInput.files[0]) setImage(alImgInput.files[0]); });
  alImgClear.addEventListener('click', () => {
    alImageBase64 = null; alImgInput.value = ''; alImgPreviewW.style.display = 'none'; alImgName.textContent = '';
  });

  // ── Render results ──
  function renderResults() {
    alResultsCount.textContent = `(${alVariations.length})`;
    alCopyAllBtn.style.display = alVariations.length ? '' : 'none';
    alResultsEmpty.style.display = alVariations.length ? 'none' : '';
    alResultsList.innerHTML = alVariations.map((v, i) => `
      <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;background:var(--bg-card2,rgba(255,255,255,0.03))">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:600;color:var(--accent)">Variação ${i+1}</div>
          <button class="al-copy-var-btn submit-btn" data-idx="${i}" style="width:auto;padding:0 10px;font-size:11px">📋 Copiar tudo</button>
        </div>
        <div style="margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">📄 Texto Principal (Legenda)</div>
          <div style="display:flex;gap:6px;align-items:flex-start">
            <div class="tool-input" style="flex:1;padding:8px;font-size:13px;white-space:pre-wrap;min-height:48px;cursor:text" contenteditable="true" data-field="primary_text" data-idx="${i}">${alEsc(v.primary_text)}</div>
            <button class="al-copy-field submit-btn" data-field="primary_text" data-idx="${i}" style="width:auto;padding:0 8px;font-size:11px;align-self:flex-start;margin-top:0">📋</button>
          </div>
        </div>
        <div style="margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">🔤 Título (Headline)</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="tool-input" style="flex:1;padding:8px;font-size:13px;cursor:text" contenteditable="true" data-field="headline" data-idx="${i}">${alEsc(v.headline)}</div>
            <button class="al-copy-field submit-btn" data-field="headline" data-idx="${i}" style="width:auto;padding:0 8px;font-size:11px">📋</button>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">📝 Descrição</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="tool-input" style="flex:1;padding:8px;font-size:13px;cursor:text" contenteditable="true" data-field="description" data-idx="${i}">${alEsc(v.description)}</div>
            <button class="al-copy-field submit-btn" data-field="description" data-idx="${i}" style="width:auto;padding:0 8px;font-size:11px">📋</button>
          </div>
        </div>
      </div>
    `).join('');

    // copy single field
    alResultsList.querySelectorAll('.al-copy-field').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        const field = btn.dataset.field;
        const text = alVariations[idx]?.[field] || '';
        navigator.clipboard.writeText(text).then(() => { btn.textContent = '✅'; setTimeout(() => btn.textContent = '📋', 1400); });
      });
    });

    // copy entire variation
    alResultsList.querySelectorAll('.al-copy-var-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = alVariations[+btn.dataset.idx];
        if (!v) return;
        const text = `Texto Principal:\n${v.primary_text}\n\nTítulo:\n${v.headline}\n\nDescrição:\n${v.description}`;
        navigator.clipboard.writeText(text).then(() => { btn.textContent = '✅'; setTimeout(() => btn.textContent = '📋 Copiar tudo', 1400); });
      });
    });
  }

  // ── Copy all ──
  alCopyAllBtn.addEventListener('click', () => {
    const text = alVariations.map((v, i) =>
      `=== Variação ${i+1} ===\nTexto Principal:\n${v.primary_text}\n\nTítulo:\n${v.headline}\n\nDescrição:\n${v.description}`
    ).join('\n\n');
    navigator.clipboard.writeText(text).then(() => { alCopyAllBtn.textContent = '✅'; setTimeout(() => alCopyAllBtn.textContent = '📋 Copiar tudo', 1500); });
  });

  // ── Generate ──
  alGenBtn.addEventListener('click', async () => {
    const orKey = alOrKey.value.trim() || localStorage.getItem('al_or_key') || '';
    if (!orKey) { alGenError.textContent = 'Cole sua OpenRouter Key primeiro.'; return; }
    const productDesc = alProductDesc.value.trim();
    const extraPrompt = alExtraPrompt.value.trim();
    if (!productDesc && !alImageBase64) { alGenError.textContent = 'Descreva o produto ou envie uma imagem criativa.'; return; }
    alGenError.textContent = '';
    alGenBtn.disabled = true;
    alGenProgress.style.display = '';

    const payload = {
      or_key: orKey,
      product_desc: productDesc,
      extra_prompt: extraPrompt,
      count: parseInt(alGenCount.value, 10) || 3,
      image: alImageBase64 || null
    };

    try {
      const resp = await fetch('/api/autolegenda/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao gerar');
      alVariations = data.variations;
      renderResults();
    } catch(e) {
      alGenError.textContent = e.message;
    } finally {
      alGenBtn.disabled = false;
      alGenProgress.style.display = 'none';
    }
  });

  renderResults();
})();

// ════════════════════════════════════════════════════════════════════
// AUTO CORPO
// ════════════════════════════════════════════════════════════════════
;(function() {
  const acPanel = document.getElementById('tool-autocorpo');
  if (!acPanel) return;

  // ── State ──
  let acExamples  = []; // { id, text }
  let acBodies    = []; // { id, text, approved, resultUrl, _removed }
  let acBodyFiles = []; // base video files for "com vídeo" mode
  let acMode      = 'audio';
  let acNextId    = 1;

  // ── Elements ──
  const acOrKey         = document.getElementById('ac-or-key');
  const acOrSave        = document.getElementById('ac-or-save-btn');
  const acElKey         = document.getElementById('ac-el-key');
  const acElSave        = document.getElementById('ac-el-save-btn');
  const acLoadVoices    = document.getElementById('ac-load-voices-btn');
  const acVoiceSel      = document.getElementById('ac-voice-select');
  const acVoicesErr     = document.getElementById('ac-voices-error');
  const acExamplesList  = document.getElementById('ac-examples-list');
  const acExamplesCount = document.getElementById('ac-examples-count');
  const acExampleInput  = document.getElementById('ac-example-input');
  const acAddExampleBtn = document.getElementById('ac-add-example-btn');
  const acGenPrompt     = document.getElementById('ac-gen-prompt');
  const acGenCount      = document.getElementById('ac-gen-count');
  const acGenBtn        = document.getElementById('ac-gen-btn');
  const acGenProgress   = document.getElementById('ac-gen-progress');
  const acGenError      = document.getElementById('ac-gen-error');
  const acBodiesList    = document.getElementById('ac-bodies-list');
  const acBodiesEmpty   = document.getElementById('ac-bodies-empty');
  const acBodiesCount   = document.getElementById('ac-bodies-count');
  const acAddManualBtn  = document.getElementById('ac-add-manual-btn');
  const acModeBtns      = document.querySelectorAll('.ac-mode-btn');
  const acVideoWrap     = document.getElementById('ac-video-upload-wrap');
  const acBodyDrop      = document.getElementById('ac-body-drop');
  const acBodyInput     = document.getElementById('ac-body-input');
  const acBodyNames     = document.getElementById('ac-body-names');
  const acProduceStat   = document.getElementById('ac-produce-status');
  const acProduceErr    = document.getElementById('ac-produce-error');
  const acProduceBtn    = document.getElementById('ac-produce-btn');
  const acProduceProg   = document.getElementById('ac-produce-progress');
  const acResults       = document.getElementById('ac-results');
  const acResultsList   = document.getElementById('ac-results-list');

  function acEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Saved keys (share storage with Auto Hook) ──
  function makeSaveBtnAc(btn, input, storageKey) {
    if (!btn || !input) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) { input.value = saved; btn.textContent = '✅'; }
    btn.addEventListener('click', () => {
      const v = input.value.trim();
      if (v) { localStorage.setItem(storageKey, v); btn.textContent = '✅'; setTimeout(() => btn.textContent = '💾', 2000); }
      else { localStorage.removeItem(storageKey); }
    });
    input.addEventListener('input', () => { if (btn.textContent === '✅') btn.textContent = '💾'; });
  }
  makeSaveBtnAc(acOrSave, acOrKey, 'ah_or_key');
  makeSaveBtnAc(acElSave, acElKey, 'tr_el_key');

  // ── Load voices ──
  acLoadVoices && acLoadVoices.addEventListener('click', async () => {
    const key = acElKey && acElKey.value.trim();
    if (!key) { acVoicesErr.style.display = 'block'; acVoicesErr.textContent = 'Informe a chave ElevenLabs.'; return; }
    acVoicesErr.style.display = 'none'; acLoadVoices.disabled = true; acLoadVoices.textContent = '⏳';
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail?.message || 'Erro ElevenLabs');
      acVoiceSel.innerHTML = '<option value="">Selecione uma voz...</option>' +
        j.voices.map(v => `<option value="${v.voice_id}">${acEsc(v.name)}</option>`).join('');
      acVoiceSel.style.display = '';
      acUpdateProduce();
    } catch(e) { acVoicesErr.style.display = 'block'; acVoicesErr.textContent = e.message; }
    finally { acLoadVoices.disabled = false; acLoadVoices.textContent = 'Vozes'; }
  });
  acVoiceSel && acVoiceSel.addEventListener('change', acUpdateProduce);

  // ── Mode buttons ──
  acModeBtns.forEach(btn => btn.addEventListener('click', () => {
    acMode = btn.dataset.mode;
    acModeBtns.forEach(b => {
      const active = b.dataset.mode === acMode;
      b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
      b.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
    });
    if (acVideoWrap) acVideoWrap.style.display = acMode === 'video' ? '' : 'none';
    acUpdateProduce();
  }));

  // ── Body video upload ──
  acBodyDrop && acBodyDrop.addEventListener('click', () => acBodyInput && acBodyInput.click());
  acBodyDrop && acBodyDrop.addEventListener('dragover', e => e.preventDefault());
  acBodyDrop && acBodyDrop.addEventListener('drop', e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('video/')) addAcBodyFile(f); }); });
  acBodyInput && acBodyInput.addEventListener('change', () => { Array.from(acBodyInput.files).forEach(f => addAcBodyFile(f)); acBodyInput.value = ''; });

  function addAcBodyFile(f) {
    acBodyFiles.push(f);
    if (acBodyNames) acBodyNames.textContent = acBodyFiles.map(f => f.name).join(', ');
    if (acBodyDrop) acBodyDrop.classList.add('has-file');
    acUpdateProduce();
  }

  // ── Examples ──
  acAddExampleBtn && acAddExampleBtn.addEventListener('click', () => {
    const txt = acExampleInput && acExampleInput.value.trim();
    if (!txt) return;
    acExamples.push({ id: acNextId++, text: txt });
    acExampleInput.value = '';
    renderAcExamples();
  });

  function renderAcExamples() {
    if (!acExamplesList) return;
    acExamplesList.innerHTML = '';
    acExamples.forEach(ex => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;padding:8px;background:var(--bg-secondary);border-radius:6px;margin-bottom:6px;align-items:flex-start';
      d.innerHTML = `<div style="flex:1;font-size:13px;white-space:pre-wrap;word-break:break-word">${acEsc(ex.text)}</div><button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:0;flex-shrink:0">&times;</button>`;
      d.querySelector('button').addEventListener('click', () => { acExamples = acExamples.filter(e => e.id !== ex.id); renderAcExamples(); });
      acExamplesList.appendChild(d);
    });
    if (acExamplesCount) acExamplesCount.textContent = '(' + acExamples.length + ')';
  }

  // ── Generate ──
  acGenBtn && acGenBtn.addEventListener('click', async () => {
    const orKey = acOrKey && acOrKey.value.trim();
    if (!orKey) { acGenError.style.display = 'block'; acGenError.textContent = 'Informe a OpenRouter API Key.'; return; }
    if (!acExamples.length) { acGenError.style.display = 'block'; acGenError.textContent = 'Adicione pelo menos 1 corpo validado.'; return; }
    acGenError.style.display = 'none'; acGenBtn.disabled = true; acGenProgress.style.display = '';
    try {
      const count = parseInt(acGenCount && acGenCount.value) || 5;
      const r = await fetch(API + '/api/autocorpo/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ or_key: orKey, examples: acExamples.map(e => e.text), prompt: acGenPrompt && acGenPrompt.value.trim(), count })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
      j.bodies.forEach(text => addAcBody(text));
    } catch(e) { acGenError.style.display = 'block'; acGenError.textContent = e.message; }
    finally { acGenBtn.disabled = false; acGenProgress.style.display = 'none'; }
  });

  // ── Bodies list ──
  function addAcBody(text, approved) {
    acBodies.push({ id: acNextId++, text: text || '', approved: !!approved, resultUrl: null });
    renderAcBodies();
    acUpdateProduce();
  }

  function renderAcBodies() {
    if (!acBodiesList) return;
    const active = acBodies.filter(b => !b._removed);
    if (acBodiesEmpty) acBodiesEmpty.style.display = active.length ? 'none' : '';
    if (acBodiesCount) acBodiesCount.textContent = '(' + active.length + ')';
    acBodiesList.innerHTML = '';
    active.forEach(body => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'margin-bottom:10px';
      div.innerHTML = `
        <textarea class="tool-input ac-body-text" rows="3" style="width:100%;resize:vertical;margin-bottom:8px">${acEsc(body.text)}</textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="ac-approve-btn submit-btn" style="width:auto;padding:6px 14px;font-size:12px;${body.approved ? '' : 'background:none;border:1px solid var(--accent);color:var(--accent)'}">
            ${body.approved ? '✅ Aprovado' : '☐ Aprovar'}
          </button>
          <button class="ac-remove-btn" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:0 4px;line-height:1">&times;</button>
        </div>
        ${body.resultUrl ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          ${body.resultUrl.endsWith('.mp3')
            ? `<audio controls style="width:100%;margin-bottom:6px" src="${API}${body.resultUrl}"></audio>`
            : `<video class="result-video" controls style="max-height:180px;margin-bottom:6px" src="${API}${body.resultUrl}"></video>`}
          <a class="download-btn" href="${API}${body.resultUrl}" download style="width:auto;display:inline-block;padding:8px 16px;font-size:12px">⬇ Baixar</a>
        </div>` : ''}
      `;
      div.querySelector('.ac-body-text').addEventListener('input', e => { body.text = e.target.value; });
      div.querySelector('.ac-approve-btn').addEventListener('click', () => { body.approved = !body.approved; renderAcBodies(); acUpdateProduce(); });
      div.querySelector('.ac-remove-btn').addEventListener('click', () => { body._removed = true; renderAcBodies(); acUpdateProduce(); });
      acBodiesList.appendChild(div);
    });
  }

  acAddManualBtn && acAddManualBtn.addEventListener('click', () => {
    addAcBody('');
    setTimeout(() => { const txts = acBodiesList.querySelectorAll('.ac-body-text'); if (txts.length) txts[txts.length-1].focus(); }, 50);
  });

  // ── Produce state ──
  function acUpdateProduce() {
    if (!acProduceBtn) return;
    const approved = acBodies.filter(b => !b._removed && b.approved);
    const hasVoice = acVoiceSel && acVoiceSel.value;
    const hasElKey = acElKey && acElKey.value.trim();
    const videoOk  = acMode !== 'video' || acBodyFiles.length > 0;
    const ok = approved.length > 0 && hasVoice && hasElKey && videoOk;
    acProduceBtn.disabled = !ok;
    acProduceBtn.textContent = ok
      ? `🎙 Produzir ${approved.length} corpo(s) aprovado(s)`
      : (acMode === 'video' && !acBodyFiles.length ? 'Adicione vídeos de base' : 'Aprove pelo menos um corpo para produzir');
  }

  // ── Produce ──
  acProduceBtn && acProduceBtn.addEventListener('click', async () => {
    const approved = acBodies.filter(b => !b._removed && b.approved);
    if (!approved.length) return;
    const elKey   = acElKey.value.trim();
    const voiceId = acVoiceSel.value;
    acProduceBtn.disabled = true;
    acProduceErr.style.display = 'none';
    acProduceProg.style.display = '';
    if (acResults) acResults.style.display = 'none';
    let anyError = null;

    for (let i = 0; i < approved.length; i++) {
      const body = approved[i];
      if (acProduceStat) acProduceStat.textContent = `Produzindo ${i+1}/${approved.length}…`;
      try {
        const fd = new FormData();
        fd.append('corpo_text', body.text);
        fd.append('el_key', elKey);
        fd.append('voice_id', voiceId);
        if (acMode === 'video' && acBodyFiles.length) {
          fd.append('body_video', acBodyFiles[i % acBodyFiles.length]);
        }
        const r = await fetch(API + '/api/autocorpo/produce', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
        body.resultUrl = j.url;
        renderAcBodies();
      } catch(e) { anyError = e.message; }
    }

    if (acProduceStat) acProduceStat.textContent = anyError ? '' : '✓ Concluído!';
    if (anyError) { acProduceErr.style.display = 'block'; acProduceErr.textContent = anyError; }
    acProduceProg.style.display = 'none';
    acProduceBtn.disabled = false;
    acUpdateProduce();

    const withResults = acBodies.filter(b => b.resultUrl);
    if (withResults.length && acResults && acResultsList) {
      acResults.style.display = '';
      acResultsList.innerHTML = '';
      withResults.forEach((body, i) => {
        const isAudio = body.resultUrl.endsWith('.mp3');
        const d = document.createElement('div');
        d.className = 'card'; d.style.marginBottom = '12px';
        d.innerHTML = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Corpo ${i+1}</div>
          <div style="font-size:13px;margin-bottom:10px;white-space:pre-wrap">${acEsc(body.text)}</div>
          ${isAudio
            ? `<audio controls style="width:100%;margin-bottom:8px" src="${API}${body.resultUrl}"></audio>`
            : `<video class="result-video" controls style="max-height:200px;margin-bottom:8px" src="${API}${body.resultUrl}"></video>`}
          <a class="download-btn" href="${API}${body.resultUrl}" download style="width:auto;display:inline-block;padding:8px 16px">⬇ Baixar</a>`;
        acResultsList.appendChild(d);
      });
    }
  });
})();

// ════════════════════════════════════════════════════════════════════
// AUTO HOOK
// ════════════════════════════════════════════════════════════════════
;(function() {
  const ahPanel = document.getElementById('tool-autohook');
  if (!ahPanel) return;

  // ── State ──
  let ahBodyFile = null;
  let ahSrcFiles = []; // { file, tempId }
  let ahHooks = []; // { id, text, approved, clipTempIdx, clipStart, clipEnd, clipReason, resultUrl }
  let ahNextId = 1;

  // ── Elements ──
  const ahBodyDrop     = document.getElementById('ah-body-drop');
  const ahBodyInput    = document.getElementById('ah-body-input');
  const ahBodyName     = document.getElementById('ah-body-name');
  const ahSrcDrop      = document.getElementById('ah-src-drop');
  const ahSrcInput     = document.getElementById('ah-src-input');
  const ahSrcList      = document.getElementById('ah-src-list');
  const ahOrKey       = document.getElementById('ah-or-key');
  const ahOrSave       = document.getElementById('ah-or-save-btn');
  const ahGeminiKey    = document.getElementById('ah-gemini-key');
  const ahGeminiSave   = document.getElementById('ah-gemini-save-btn');
  const ahElKey        = document.getElementById('ah-el-key');
  const ahElSave       = document.getElementById('ah-el-save-btn');
  const ahLoadVoices   = document.getElementById('ah-load-voices-btn');
  const ahVoiceSel     = document.getElementById('ah-voice-select');
  const ahVoicesErr    = document.getElementById('ah-voices-error');
  const ahDesc         = document.getElementById('ah-description');
  const ahPrompt       = document.getElementById('ah-hook-prompt');
  const ahGenBtn       = document.getElementById('ah-gen-hooks-btn');
  const ahGenProg      = document.getElementById('ah-gen-hooks-progress');
  const ahGenErr       = document.getElementById('ah-gen-hooks-error');
  const ahAnalyzeBtn   = document.getElementById('ah-analyze-clips-btn');
  const ahAnalyzeProg  = document.getElementById('ah-analyze-progress');
  const ahAnalyzeStat  = document.getElementById('ah-analyze-status');
  const ahAnalyzeErr   = document.getElementById('ah-analyze-error');
  const ahHooksList    = document.getElementById('ah-hooks-list');
  const ahHooksEmpty   = document.getElementById('ah-hooks-empty');
  const ahHooksCount   = document.getElementById('ah-hooks-count');
  const ahAddBtn       = document.getElementById('ah-add-hook-btn');
  const ahComposeBtn   = document.getElementById('ah-compose-btn');
  const ahComposeProg  = document.getElementById('ah-compose-progress');
  const ahComposeStat  = document.getElementById('ah-compose-status');
  const ahComposeErr   = document.getElementById('ah-compose-error');
  const ahResults      = document.getElementById('ah-results');
  const ahResultsList  = document.getElementById('ah-results-list');

  // ── Saved keys ──
  function makeSaveBtnAh(btn, input, key) {
    if (!btn || !input) return;
    const saved = localStorage.getItem(key);
    if (saved) { input.value = saved; btn.textContent = '✅'; }
    btn.addEventListener('click', () => {
      const v = input.value.trim();
      if (v) { localStorage.setItem(key, v); btn.textContent = '✅'; setTimeout(() => btn.textContent = '💾', 2000); }
      else { localStorage.removeItem(key); }
    });
    input.addEventListener('input', () => { if (btn.textContent === '✅') btn.textContent = '💾'; });
  }
  makeSaveBtnAh(ahOrSave, ahOrKey, 'ah_or_key');
  makeSaveBtnAh(ahGeminiSave, ahGeminiKey, 'ah_gemini_key');
  makeSaveBtnAh(ahElSave, ahElKey, 'tr_el_key');

  // ── Load ElevenLabs voices ──
  if (ahLoadVoices) {
    ahLoadVoices.addEventListener('click', async () => {
      const key = ahElKey.value.trim();
      if (!key) { ahVoicesErr.style.display = 'block'; ahVoicesErr.textContent = 'Informe a chave ElevenLabs.'; return; }
      ahVoicesErr.style.display = 'none';
      ahLoadVoices.disabled = true; ahLoadVoices.textContent = '⏳';
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail?.message || 'Erro ElevenLabs');
        ahVoiceSel.innerHTML = '<option value="">Selecione uma voz...</option>' +
          j.voices.map(v => `<option value="${v.voice_id}">${v.name}</option>`).join('');
        ahVoiceSel.style.display = '';
        ahUpdateCompose();
      } catch(e) { ahVoicesErr.style.display = 'block'; ahVoicesErr.textContent = e.message; }
      finally { ahLoadVoices.disabled = false; ahLoadVoices.textContent = 'Vozes'; }
    });
  }

  // ── Body video ──
  if (ahBodyDrop) {
    ahBodyDrop.addEventListener('click', () => ahBodyInput.click());
    ahBodyDrop.addEventListener('dragover', e => e.preventDefault());
    ahBodyDrop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('video/')) setAhBody(f); });
  }
  if (ahBodyInput) ahBodyInput.addEventListener('change', () => { if (ahBodyInput.files[0]) setAhBody(ahBodyInput.files[0]); });

  function setAhBody(f) {
    ahBodyFile = f;
    if (ahBodyName) ahBodyName.textContent = f.name.length > 40 ? f.name.slice(0,37)+'...' : f.name;
    ahBodyDrop.classList.add('has-file');
    ahUpdateCompose();
  }

  // ── Source videos ──
  if (ahSrcDrop) {
    ahSrcDrop.addEventListener('click', () => ahSrcInput.click());
    ahSrcDrop.addEventListener('dragover', e => e.preventDefault());
    ahSrcDrop.addEventListener('drop', e => {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('video/')) addAhSrc(f); });
    });
  }
  if (ahSrcInput) ahSrcInput.addEventListener('change', () => {
    Array.from(ahSrcInput.files).forEach(f => addAhSrc(f));
    ahSrcInput.value = '';
  });

  function addAhSrc(f) {
    const idx = ahSrcFiles.length;
    ahSrcFiles.push({ file: f, tempId: null });
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-secondary);border-radius:6px;margin-top:4px;font-size:12px';
    item.dataset.srcIdx = idx;
    item.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🎬 ${ahEsc(f.name)}</span><button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0">&times;</button>`;
    item.querySelector('button').addEventListener('click', () => {
      ahSrcFiles.splice(parseInt(item.dataset.srcIdx), 1, { file: null, tempId: null });
      item.remove();
    });
    if (ahSrcList) ahSrcList.appendChild(item);
  }

  // ── Hook helpers ──
  function ahEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function secToStr(s) {
    s = Math.round(s || 0);
    const m = Math.floor(s/60), ss = s%60;
    return m + ':' + String(ss).padStart(2,'0');
  }

  function ahRenderHooks() {
    if (!ahHooksList) return;
    const active = ahHooks.filter(h => !h._removed);
    ahHooksEmpty.style.display = active.length ? 'none' : '';
    ahHooksCount.textContent = '(' + active.length + ')';
    ahHooksList.innerHTML = '';
    active.forEach(hook => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'margin-bottom:10px;position:relative';
      div.dataset.ahId = hook.id;
      const hasClip = hook.clipTempIdx != null && hook.clipTempIdx >= 0;
      const srcName = hasClip ? (ahSrcFiles[hook.clipTempIdx]?.file?.name || 'vídeo') : '';
      div.innerHTML = `
        ${hasClip ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:5px 8px;background:var(--bg-secondary);border-radius:5px">
          🎬 <strong>${ahEsc(srcName)}</strong> · ${secToStr(hook.clipStart)} → ${secToStr(hook.clipEnd)}
          ${hook.clipReason ? ` · <em>${ahEsc(hook.clipReason)}</em>` : ''}
        </div>` : ''}
        <textarea class="tool-input ah-hook-text" rows="2" style="width:100%;resize:vertical;margin-bottom:8px">${ahEsc(hook.text)}</textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="ah-approve-btn submit-btn" style="width:auto;padding:6px 14px;font-size:12px;${hook.approved ? '' : 'background:none;border:1px solid var(--accent);color:var(--accent)'}">
            ${hook.approved ? '✅ Aprovado' : '☐ Aprovar'}
          </button>
          <button class="ah-regen-btn submit-btn" style="width:auto;padding:6px 14px;font-size:12px;background:none;border:1px solid var(--border);color:var(--text)">🔄 Regenerar</button>
          <button class="ah-remove-btn" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:0 4px;line-height:1">&times;</button>
        </div>
        ${hook.resultUrl ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          <video class="result-video" controls style="max-height:180px;margin-bottom:6px" src="${hook.resultUrl}"></video>
          <a class="download-btn" href="${hook.resultUrl}" download style="width:auto;display:inline-block;padding:8px 16px;font-size:12px">⬇ Baixar</a>
        </div>` : ''}
      `;
      // Wire textarea
      div.querySelector('.ah-hook-text').addEventListener('input', e => { hook.text = e.target.value; });
      // Wire approve
      div.querySelector('.ah-approve-btn').addEventListener('click', () => {
        hook.approved = !hook.approved;
        ahRenderHooks();
        ahUpdateCompose();
      });
      // Wire regen
      div.querySelector('.ah-regen-btn').addEventListener('click', async () => {
        const key = ahOrKey.value.trim();
        if (!key) { ahGenErr.textContent = 'Informe a OpenRouter API Key.'; ahGenErr.style.display = 'block'; return; }
        const btn = div.querySelector('.ah-regen-btn');
        btn.disabled = true; btn.textContent = '⏳';
        try {
          const r = await fetch(API + '/api/autohook/generate-hooks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: ahDesc.value.trim(), prompt: 'Gere 1 hook alternativo.', or_key: key, count: 1 })
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          if (j.hooks && j.hooks[0]) { hook.text = j.hooks[0]; ahRenderHooks(); }
        } catch(e) { ahGenErr.textContent = 'Erro: '+e.message; ahGenErr.style.display = 'block'; }
        finally { btn.disabled = false; btn.textContent = '🔄 Regenerar'; }
      });
      // Wire remove
      div.querySelector('.ah-remove-btn').addEventListener('click', () => {
        hook._removed = true;
        ahRenderHooks();
        ahUpdateCompose();
      });
      ahHooksList.appendChild(div);
    });
    ahUpdateCompose();
  }

  function ahAddHook(text, clipTempIdx = null, clipStart = 0, clipEnd = 0, clipReason = '') {
    ahHooks.push({ id: ahNextId++, text, approved: false, clipTempIdx, clipStart, clipEnd, clipReason, resultUrl: null, _removed: false });
    ahRenderHooks();
  }

  function ahUpdateCompose() {
    const approvedCount = ahHooks.filter(h => h.approved && !h._removed).length;
    const hasVoice = ahVoiceSel.value;
    const hasElKey = ahElKey.value.trim();
    if (ahBodyFile && approvedCount > 0 && hasVoice && hasElKey) {
      ahComposeBtn.disabled = false;
      ahComposeBtn.textContent = `🚀 Gerar ${approvedCount} vídeo${approvedCount !== 1 ? 's' : ''}`;
    } else {
      ahComposeBtn.disabled = true;
      if (!ahBodyFile) ahComposeBtn.textContent = 'Selecione o corpo do vídeo';
      else if (!hasElKey) ahComposeBtn.textContent = 'Informe a chave ElevenLabs';
      else if (!hasVoice) ahComposeBtn.textContent = 'Selecione uma voz';
      else ahComposeBtn.textContent = 'Aprove ao menos 1 hook';
    }
  }

  // ── Add manual hook ──
  if (ahAddBtn) {
    ahAddBtn.addEventListener('click', () => { ahAddHook(''); ahRenderHooks(); });
  }

  // ── Generate hooks with Gemini (or OpenRouter GPT-4o Mini fallback) ──
  if (ahGenBtn) {
    ahGenBtn.addEventListener('click', async () => {
      const gemKey = ahGeminiKey && ahGeminiKey.value.trim();
      const orKey  = ahOrKey && ahOrKey.value.trim();
      if (!gemKey && !orKey) { ahGenErr.textContent = 'Informe a Gemini API Key ou a OpenRouter Key.'; ahGenErr.style.display = 'block'; return; }
      ahGenErr.style.display = 'none';
      ahGenBtn.disabled = true; ahGenBtn.textContent = '⏳';
      ahGenProg.style.display = '';
      try {
        const r = await fetch(API + '/api/autohook/generate-hooks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: ahDesc.value.trim(),
            prompt: ahPrompt.value.trim(),
            gemini_key: gemKey || undefined,
            or_key: orKey || undefined,
            count: 5
          })
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        (j.hooks || []).forEach(t => ahAddHook(t));
        ahRenderHooks();
      } catch(e) { ahGenErr.textContent = 'Erro: ' + e.message; ahGenErr.style.display = 'block'; }
      finally { ahGenBtn.disabled = false; ahGenBtn.textContent = '🤖 Gerar hooks'; ahGenProg.style.display = 'none'; }
    });
  }

  // ── Analyze source videos with OpenRouter GPT-4o Vision ──
  if (ahAnalyzeBtn) {
    ahAnalyzeBtn.addEventListener('click', async () => {
      const key = ahOrKey.value.trim();
      const validSrcs = ahSrcFiles.filter(s => s.file);
      if (!key) { ahAnalyzeErr.textContent = 'Informe a OpenRouter API Key.'; ahAnalyzeErr.style.display = 'block'; return; }
      if (!validSrcs.length) { ahAnalyzeErr.textContent = 'Adicione ao menos 1 vídeo fonte.'; ahAnalyzeErr.style.display = 'block'; return; }
      ahAnalyzeErr.style.display = 'none';
      ahAnalyzeBtn.disabled = true;
      ahAnalyzeProg.style.display = '';
      ahAnalyzeStat.textContent = '⏳ Enviando vídeos e analisando com GPT-4o Mini…';
      try {
        const fd = new FormData();
        validSrcs.forEach((s, i) => fd.append('videos', s.file));
        fd.append('or_key', key);
        fd.append('description', ahDesc.value.trim());
        const r = await fetch(API + '/api/autohook/analyze-clips', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        (j.clips || []).forEach(clip => {
          // Map clip.videoIdx to the right ahSrcFiles index
          ahAddHook(clip.hookText || '', clip.videoIdx, clip.start, clip.end, clip.reason || '');
          // Store tempId in the src file entry
          if (j.tempIds && j.tempIds[clip.videoIdx]) {
            ahSrcFiles[clip.videoIdx] = { ...ahSrcFiles[clip.videoIdx], tempId: j.tempIds[clip.videoIdx] };
          }
        });
        ahAnalyzeStat.textContent = `✅ ${j.clips?.length || 0} clipes sugeridos`;
        ahRenderHooks();
      } catch(e) { ahAnalyzeErr.textContent = 'Erro: ' + e.message; ahAnalyzeErr.style.display = 'block'; ahAnalyzeStat.textContent = ''; }
      finally { ahAnalyzeBtn.disabled = false; ahAnalyzeProg.style.display = 'none'; }
    });
  }

  // ── Compose all approved hooks ──
  if (ahComposeBtn) {
    ahComposeBtn.addEventListener('click', async () => {
      const approved = ahHooks.filter(h => h.approved && !h._removed);
      if (!approved.length || !ahBodyFile) return;
      const elKey   = ahElKey.value.trim();
      const voiceId = ahVoiceSel.value;
      ahComposeBtn.disabled = true;
      ahComposeStat.textContent = `⏳ Gerando vídeos (0/${approved.length})…`;
      ahComposeErr.style.display = 'none';
      ahComposeProg.style.display = '';
      ahResults.style.display = 'none';
      ahResultsList.innerHTML = '';
      let doneCount = 0;
      for (const hook of approved) {
        try {
          const fd = new FormData();
          fd.append('body_video', ahBodyFile);
          fd.append('hook_text', hook.text);
          fd.append('el_key', elKey);
          fd.append('voice_id', voiceId);
          if (hook.clipTempIdx != null && hook.clipTempIdx >= 0) {
            const srcEntry = ahSrcFiles[hook.clipTempIdx];
            if (srcEntry?.file) fd.append('clip_video', srcEntry.file);
            if (srcEntry?.tempId) fd.append('clip_temp_id', srcEntry.tempId);
            fd.append('clip_start', String(hook.clipStart || 0));
            fd.append('clip_end',   String(hook.clipEnd   || 0));
          }
          const r = await fetch(API + '/api/autohook/compose', { method: 'POST', body: fd });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Erro ao gerar vídeo');
          hook.resultUrl = API + j.url;
          doneCount++;
          ahComposeStat.textContent = `⏳ Gerando vídeos (${doneCount}/${approved.length})…`;
          // Show result
          const resDiv = document.createElement('div');
          resDiv.className = 'card';
          resDiv.style.marginBottom = '10px';
          resDiv.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:8px">Hook ${doneCount}: "${ahEsc(hook.text.slice(0,60))}${hook.text.length>60?'…':''}"</div>
            <video class="result-video" controls style="margin-bottom:6px" src="${hook.resultUrl}"></video>
            <a class="download-btn" href="${hook.resultUrl}" download style="width:auto;display:inline-block;padding:8px 16px;font-size:12px">⬇ Baixar</a>`;
          ahResultsList.appendChild(resDiv);
          ahResults.style.display = '';
        } catch(e) {
          ahComposeErr.textContent = `Erro no hook "${hook.text.slice(0,40)}": ${e.message}`;
          ahComposeErr.style.display = 'block';
        }
      }
      ahComposeStat.textContent = doneCount === approved.length ? `✅ ${doneCount} vídeo${doneCount!==1?'s':''} gerado${doneCount!==1?'s':''}!` : `⚠️ ${doneCount}/${approved.length} gerados.`;
      ahComposeProg.style.display = 'none';
      ahComposeBtn.disabled = false;
      ahRenderHooks();
    });
  }

  ahRenderHooks();
  ahUpdateCompose();
})();

function drawResizeCrop() {
  const canvas = document.getElementById('resize-crop-canvas');
  if (!canvas || !resizeSrcImg || !resizeVidW) return;
  const DISP_W = Math.min(280, canvas.parentElement.clientWidth - 20 || 280);
  const DISP_H = Math.round(DISP_W * resizeRatioH / resizeRatioW);
  canvas.width = DISP_W; canvas.height = DISP_H;
  canvas.style.width = DISP_W + 'px'; canvas.style.height = DISP_H + 'px';

  const scale = Math.max(DISP_W / resizeVidW, DISP_H / resizeVidH);
  const scaledW = resizeVidW * scale, scaledH = resizeVidH * scale;
  const maxX = Math.max(0, scaledW - DISP_W), maxY = Math.max(0, scaledH - DISP_H);
  resizeCropX = Math.max(0, Math.min(resizeCropX, maxX));
  resizeCropY = Math.max(0, Math.min(resizeCropY, maxY));

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, DISP_W, DISP_H);
  ctx.drawImage(resizeSrcImg, -resizeCropX, -resizeCropY, scaledW, scaledH);
  // rule-of-thirds grid
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  [DISP_W/3, DISP_W*2/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,DISP_H); ctx.stroke(); });
  [DISP_H/3, DISP_H*2/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(DISP_W,y); ctx.stroke(); });
  // border accent
  ctx.strokeStyle = 'rgba(124,113,255,0.7)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, DISP_W-2, DISP_H-2);

  // store normalized offset for backend
  canvas._normX = maxX > 0 ? resizeCropX / maxX : 0;
  canvas._normY = maxY > 0 ? resizeCropY / maxY : 0;
}

// Drag logic for crop canvas
(function initCropDrag() {
  const canvas = document.getElementById('resize-crop-canvas');
  if (!canvas) return;
  let dragging = false, startX = 0, startY = 0, startCX = 0, startCY = 0;

  function onMove(ex, ey) {
    if (!dragging || !resizeSrcImg) return;
    const DISP_W = canvas.width, DISP_H = canvas.height;
    const scale = Math.max(DISP_W / resizeVidW, DISP_H / resizeVidH);
    const maxX = Math.max(0, resizeVidW * scale - DISP_W);
    const maxY = Math.max(0, resizeVidH * scale - DISP_H);
    resizeCropX = Math.max(0, Math.min(startCX - (ex - startX), maxX));
    resizeCropY = Math.max(0, Math.min(startCY - (ey - startY), maxY));
    drawResizeCrop();
  }

  canvas.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX; startY = e.clientY;
    startCX = resizeCropX; startCY = resizeCropY; e.preventDefault();
  });
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => { dragging = false; });

  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0]; dragging = true;
    startX = t.clientX; startY = t.clientY;
    startCX = resizeCropX; startCY = resizeCropY; e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', e => {
    if (!dragging) return;
    onMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', () => { dragging = false; });
})();

// Load frame on both file input and drag-drop
function _onResizeFile(f) { if (f) loadResizeFrame(f); }
document.getElementById('resize-file-input').addEventListener('change', e => _onResizeFile(e.target.files[0]));
document.getElementById('resize-dz').addEventListener('drop', e => _onResizeFile(e.dataTransfer.files[0]));

makeSimpleTool({
  fileInputId: 'resize-file-input', dropZoneId: 'resize-dz', fileNameId: 'resize-file-name',
  submitBtnId: 'resize-submit-btn', progressId: 'resize-progress', statusId: 'resize-status',
  errorId: 'resize-error', resultCardId: 'resize-result-card', resultVideoId: 'resize-result-video',
  downloadBtnId: 'resize-download-btn', endpoint: '/api/resize',
  buildFormData: (file) => {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('w', resizeRatioW); fd.append('h', resizeRatioH);
    fd.append('mode', resizeMode); fd.append('pad', resizePad);
    const canvas = document.getElementById('resize-crop-canvas');
    fd.append('cropX', canvas ? (canvas._normX || 0) : 0);
    fd.append('cropY', canvas ? (canvas._normY || 0) : 0);
    return fd;
  }
});

// ── COMPRIMIR ──
const crfInput = document.getElementById('compress-crf');
const crfVal   = document.getElementById('compress-crf-val');
if (crfInput && crfVal) crfInput.addEventListener('input', () => { crfVal.textContent = 'CRF ' + crfInput.value; });
makeSimpleTool({
  fileInputId: 'compress-file-input', dropZoneId: 'compress-dz', fileNameId: 'compress-file-name',
  submitBtnId: 'compress-submit-btn', progressId: 'compress-progress', statusId: 'compress-status',
  errorId: 'compress-error', resultCardId: 'compress-result-card', resultVideoId: 'compress-result-video',
  downloadBtnId: 'compress-download-btn', endpoint: '/api/compress',
  buildFormData: (file) => {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('crf', crfInput ? crfInput.value : '26');
    return fd;
  },
  onResult: (job, file) => {
    const el = document.getElementById('compress-sizes');
    if (!el) return;
    const orig = job.inputSize || file.size || 0;
    const out  = job.outputSize || 0;
    const saved = orig > 0 ? Math.round((1 - out/orig)*100) : 0;
    el.innerHTML = `<span class="size-orig">Original: ${fmtBytes(orig)}</span>` +
      `<span class="size-arrow">→</span>` +
      `<span class="size-new">Comprimido: ${fmtBytes(out)}</span>` +
      (saved > 0 ? `<span class="size-saved">(−${saved}% menor)</span>` : '');
  }
});

// ── AUMENTAR QUALIDADE (multi-file queue) ──
;(function() {
  const fileInput   = document.getElementById('upscale-file-input');
  const dropZone    = document.getElementById('upscale-dz');
  const fileNameEl  = document.getElementById('upscale-file-name');
  const submitBtn   = document.getElementById('upscale-submit-btn');
  const progressEl  = document.getElementById('upscale-progress');
  const statusEl    = document.getElementById('upscale-status');
  const errorEl     = document.getElementById('upscale-error');
  const queueList   = document.getElementById('upscale-queue-list');
  const resultsContainer = document.getElementById('upscale-results-container');
  if (!fileInput) return;

  let upscaleH = 720;
  let upscaleFiles = [];

  // res-btn clicks (standalone tool uses data-res/data-h)
  document.querySelectorAll('#tool-upscale .res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tool-upscale .res-btn').forEach(b => b.classList.remove('rb-active'));
      btn.classList.add('rb-active');
      upscaleH = parseInt(btn.dataset.h) || 720;
    });
  });

  function setFiles(files) {
    upscaleFiles = Array.from(files);
    if (upscaleFiles.length === 0) {
      fileNameEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Selecione um vídeo';
      queueList.style.display = 'none';
      return;
    }
    fileNameEl.textContent = upscaleFiles.length === 1 ? upscaleFiles[0].name : `${upscaleFiles.length} vídeos selecionados`;
    submitBtn.disabled = false;
    submitBtn.textContent = upscaleFiles.length === 1 ? '⬆ Aumentar Qualidade' : `⬆ Processar ${upscaleFiles.length} vídeos`;
    // Show queue list
    queueList.style.display = '';
    queueList.innerHTML = upscaleFiles.map((f, i) =>
      `<div id="upscale-qi-${i}" style="padding:6px 10px;margin-bottom:4px;border:1px solid var(--border);border-radius:6px;font-size:13px;display:flex;align-items:center;gap:8px">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
        <span id="upscale-qs-${i}" style="color:var(--text-muted);font-size:12px">aguardando…</span>
      </div>`
    ).join('');
  }

  fileInput.addEventListener('change', () => setFiles(fileInput.files));
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
      if (files.length) setFiles(files);
    });
  }

  async function pollJob(jobId, onStatus) {
    while (true) {
      await new Promise(r => setTimeout(r, 2500));
      const resp = await fetch(API + `/api/process-status/${jobId}`);
      const job  = await resp.json();
      if (job.status === 'done') return { url: API + job.url, job };
      if (job.status === 'error') throw new Error(job.error || 'Falhou');
      if (onStatus) onStatus('Processando… ' + (job.progress || 0) + '%');
    }
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!upscaleFiles.length) return;
      submitBtn.disabled = true;
      errorEl.textContent = ''; errorEl.style.display = 'none';
      resultsContainer.innerHTML = '';

      for (let i = 0; i < upscaleFiles.length; i++) {
        const file = upscaleFiles[i];
        const qStatus = document.getElementById(`upscale-qs-${i}`);
        const qItem   = document.getElementById(`upscale-qi-${i}`);
        if (qStatus) qStatus.textContent = '⏳ processando…';
        if (qItem) qItem.style.borderColor = 'var(--accent)';

        progressEl.style.display = '';
        statusEl.textContent = `[${i+1}/${upscaleFiles.length}] ${file.name}…`;

        try {
          const fd = new FormData();
          fd.append('video', file); fd.append('h', upscaleH);
          const r = await fetch(API + '/api/upscale', { method: 'POST', body: fd });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Erro');
          const { url, job } = await pollJob(j.id, s => {
            statusEl.textContent = `[${i+1}/${upscaleFiles.length}] ${file.name}: ${s}`;
            if (qStatus) qStatus.textContent = s;
          });

          if (qStatus) qStatus.textContent = '✓ pronto';
          if (qItem) qItem.style.borderColor = '#22c55e';

          const card = document.createElement('div');
          card.className = 'result-card';
          card.style.display = 'block';
          card.style.marginBottom = '12px';
          card.innerHTML = `<h3 style="font-size:14px;margin-bottom:8px">✓ ${file.name}</h3>
            <video class="result-video" controls src="${url}" style="margin-bottom:8px"></video>
            <a class="download-btn" href="${url}" download="${file.name.replace(/\.[^.]+$/, '')}_upscale.mp4">⬇ Baixar</a>`;
          resultsContainer.appendChild(card);
        } catch(e) {
          if (qStatus) qStatus.textContent = '✗ erro';
          if (qItem) qItem.style.borderColor = '#ef4444';
          const errDiv = document.createElement('div');
          errDiv.className = 'error-msg';
          errDiv.style.display = '';
          errDiv.textContent = `${file.name}: ${e.message}`;
          resultsContainer.appendChild(errDiv);
        }
      }
      progressEl.style.display = 'none';
      statusEl.textContent = `✓ Concluído (${upscaleFiles.length} vídeo${upscaleFiles.length > 1 ? 's' : ''})`;
      submitBtn.disabled = false;
    });
  }
})();

// ── ESPELHAR ──
let mirrorFlip = 'hflip';
document.querySelectorAll('.mirror-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mirror-opt').forEach(b => b.classList.remove('mo-active'));
    btn.classList.add('mo-active'); mirrorFlip = btn.dataset.flip;
  });
});
makeSimpleTool({
  fileInputId: 'mirror-file-input', dropZoneId: 'mirror-dz', fileNameId: 'mirror-file-name',
  submitBtnId: 'mirror-submit-btn', progressId: 'mirror-progress', statusId: 'mirror-status',
  errorId: 'mirror-error', resultCardId: 'mirror-result-card', resultVideoId: 'mirror-result-video',
  downloadBtnId: 'mirror-download-btn', endpoint: '/api/mirror',
  buildFormData: (file) => {
    const fd = new FormData(); fd.append('video', file); fd.append('flip', mirrorFlip); return fd;
  }
});

// ══════════════════════════════════════════════════════════════════
// SUBSTITUIR FALA
// ══════════════════════════════════════════════════════════════════
(function() {
  const fi       = document.getElementById('sf-file-input');
  const dz       = document.getElementById('sf-drop-zone');
  const fnLabel  = document.getElementById('sf-file-name');
  const startEl  = document.getElementById('sf-start-time');
  const endEl    = document.getElementById('sf-end-time');
  const textEl   = document.getElementById('sf-new-text');
  const elKeyEl  = document.getElementById('sf-el-key');
  const elSaveEl = document.getElementById('sf-el-save-btn');
  const loadVoEl = document.getElementById('sf-load-voices-btn');
  const voiceSel = document.getElementById('sf-voice-select');
  const voiceErr = document.getElementById('sf-voices-error');
  const sub      = document.getElementById('sf-submit-btn');
  const prog     = document.getElementById('sf-progress');
  const stat     = document.getElementById('sf-status');
  const errEl    = document.getElementById('sf-error');
  const rc       = document.getElementById('sf-result-card');
  const rv       = document.getElementById('sf-result-video');
  const dl       = document.getElementById('sf-download-btn');
  // AI detect elements
  const orKeyEl    = document.getElementById('sf-or-key');
  const orSaveEl   = document.getElementById('sf-or-save-btn');
  const searchText = document.getElementById('sf-search-text');
  const detectBtn  = document.getElementById('sf-detect-btn');
  const detectStat = document.getElementById('sf-detect-status');
  const detectErr  = document.getElementById('sf-detect-error');
  // Clone voice elements
  const cloneBtn  = document.getElementById('sf-clone-btn');
  const cloneStat = document.getElementById('sf-clone-status');
  const cloneErr  = document.getElementById('sf-clone-error');
  // AI rewrite elements
  const rewriteCmd = document.getElementById('sf-rewrite-cmd');
  const rewriteBtn = document.getElementById('sf-rewrite-btn');
  const rewriteStat = document.getElementById('sf-rewrite-status');
  const rewriteErr  = document.getElementById('sf-rewrite-error');
  if (!sub) return;

  // Restore keys
  const savedKey = localStorage.getItem('sf_el_key');
  if (savedKey && elKeyEl) elKeyEl.value = savedKey;
  const savedOrKey = localStorage.getItem('wm_or_key');
  if (savedOrKey && orKeyEl) orKeyEl.value = savedOrKey;

  elSaveEl && elSaveEl.addEventListener('click', () => {
    const v = elKeyEl.value.trim();
    if (v) { localStorage.setItem('sf_el_key', v); elSaveEl.textContent = '✅'; setTimeout(() => elSaveEl.textContent = '💾', 2000); }
  });

  orSaveEl && orSaveEl.addEventListener('click', () => {
    const v = orKeyEl.value.trim();
    if (v) { localStorage.setItem('wm_or_key', v); orSaveEl.textContent = '✅'; setTimeout(() => orSaveEl.textContent = '💾', 2000); }
  });

  let sfFile = null;
  function setFile(f) {
    sfFile = f;
    if (fnLabel) fnLabel.textContent = f.name;
    checkReady();
  }
  fi && fi.addEventListener('change', () => { if (fi.files[0]) setFile(fi.files[0]); });
  if (dz) {
    dz.addEventListener('click', () => fi && fi.click());
    dz.addEventListener('dragover', e => e.preventDefault());
    dz.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  }

  function checkReady() {
    if (!sub) return;
    const ok = sfFile && startEl.value !== '' && endEl.value !== '' && textEl.value.trim() && voiceSel.value;
    sub.disabled = !ok;
    sub.textContent = ok ? '▶ Substituir Fala' : 'Selecione vídeo e configure';
  }
  [startEl, endEl, textEl].forEach(el => el && el.addEventListener('input', checkReady));
  voiceSel && voiceSel.addEventListener('change', checkReady);

  // ── AI segment detection ──────────────────────────────────────────────
  detectBtn && detectBtn.addEventListener('click', async () => {
    if (!sfFile) {
      if (detectErr) { detectErr.style.display = 'block'; detectErr.textContent = 'Selecione o vídeo primeiro.'; } return;
    }
    const query = searchText && searchText.value.trim();
    if (!query) {
      if (detectErr) { detectErr.style.display = 'block'; detectErr.textContent = 'Descreva o trecho que quer encontrar.'; } return;
    }
    const key = (orKeyEl && orKeyEl.value.trim()) || localStorage.getItem('wm_or_key') || '';
    if (!key) {
      if (detectErr) { detectErr.style.display = 'block'; detectErr.textContent = 'Informe a OpenRouter API Key.'; } return;
    }
    detectBtn.disabled = true;
    if (detectErr) detectErr.style.display = 'none';
    if (detectStat) detectStat.textContent = '🎙 Transcrevendo com Whisper…';
    try {
      const fd = new FormData();
      fd.append('video', sfFile);
      fd.append('search_text', query);
      fd.append('orKey', key);
      const r = await fetch(API + '/api/speech/find-segment', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
      // Auto-fill start/end time and original text
      if (startEl) { startEl.value = j.start.toFixed(1); }
      if (endEl)   { endEl.value   = j.end.toFixed(1);   }
      if (textEl && j.text) { textEl.value = j.text; }
      checkReady();
      if (detectStat) detectStat.textContent = `✓ Encontrado: ${j.start.toFixed(1)}s – ${j.end.toFixed(1)}s  "${j.text}"`;
    } catch(e) {
      if (detectErr) { detectErr.style.display = 'block'; detectErr.textContent = e.message; }
      if (detectStat) detectStat.textContent = '';
    } finally {
      detectBtn.disabled = false;
    }
  });

  // ── Clone voice from video ───────────────────────────────────────────
  cloneBtn && cloneBtn.addEventListener('click', async () => {
    if (!sfFile) { if (cloneErr) { cloneErr.style.display = 'block'; cloneErr.textContent = 'Selecione o vídeo primeiro.'; } return; }
    const key = (elKeyEl.value.trim()) || localStorage.getItem('sf_el_key') || '';
    if (!key) { if (cloneErr) { cloneErr.style.display = 'block'; cloneErr.textContent = 'Informe a ElevenLabs API Key abaixo.'; } return; }
    cloneBtn.disabled = true;
    if (cloneErr) cloneErr.style.display = 'none';
    if (cloneStat) cloneStat.textContent = '🎙 Extraindo e clonando voz…';
    try {
      const fd = new FormData();
      fd.append('video', sfFile);
      fd.append('el_key', key);
      if (startEl && startEl.value) fd.append('exclude_start', startEl.value);
      if (endEl && endEl.value)     fd.append('exclude_end',   endEl.value);
      const r = await fetch(API + '/api/speech/clone-voice', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
      const existing = voiceSel.querySelector('[data-cloned]');
      if (existing) existing.remove();
      const opt = document.createElement('option');
      opt.value = j.voice_id; opt.textContent = '🧬 Voz clonada do vídeo'; opt.dataset.cloned = 'true';
      voiceSel.insertBefore(opt, voiceSel.firstChild);
      voiceSel.value = j.voice_id; voiceSel.style.display = '';
      checkReady();
      if (cloneStat) cloneStat.textContent = `✓ Voz clonada! ID: ${j.voice_id.slice(0,10)}…`;
    } catch(e) {
      if (cloneErr) { cloneErr.style.display = 'block'; cloneErr.textContent = e.message; }
      if (cloneStat) cloneStat.textContent = '';
    } finally { cloneBtn.disabled = false; }
  });

  // ── AI rewrite ────────────────────────────────────────────────────────
  rewriteBtn && rewriteBtn.addEventListener('click', async () => {
    const curText = textEl && textEl.value.trim();
    if (!curText) { if (rewriteErr) { rewriteErr.style.display = 'block'; rewriteErr.textContent = 'Escreva o texto no card "Novo texto" primeiro.'; } return; }
    const key = (orKeyEl && orKeyEl.value.trim()) || localStorage.getItem('wm_or_key') || '';
    if (!key) { if (rewriteErr) { rewriteErr.style.display = 'block'; rewriteErr.textContent = 'Informe a OpenRouter API Key no card acima.'; } return; }
    const cmd = rewriteCmd && rewriteCmd.value.trim();
    rewriteBtn.disabled = true;
    if (rewriteErr) rewriteErr.style.display = 'none';
    if (rewriteStat) rewriteStat.textContent = '✍️ Reescrevendo…';
    try {
      const prompt = cmd
        ? `Reescreva o texto conforme o comando.\nComando: ${cmd}\nTexto: "${curText}"\nRetorne APENAS o texto reescrito, sem aspas ou comentários.`
        : `Melhore o texto para soar mais natural e impactante: "${curText}"\nRetorne APENAS o texto melhorado.`;
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 512 })
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error?.message || 'Erro OpenRouter');
      const newText = j.choices?.[0]?.message?.content?.trim() || '';
      if (newText && textEl) { textEl.value = newText; checkReady(); }
      if (rewriteStat) rewriteStat.textContent = '✓ Texto reescrito!';
    } catch(e) {
      if (rewriteErr) { rewriteErr.style.display = 'block'; rewriteErr.textContent = e.message; }
      if (rewriteStat) rewriteStat.textContent = '';
    } finally { rewriteBtn.disabled = false; }
  });

  // Load voices
  loadVoEl && loadVoEl.addEventListener('click', async () => {
    const key = (elKeyEl.value.trim()) || localStorage.getItem('sf_el_key') || '';
    if (!key) { if (voiceErr) { voiceErr.style.display = 'block'; voiceErr.textContent = 'Informe a ElevenLabs API Key.'; } return; }
    loadVoEl.disabled = true; loadVoEl.textContent = '⏳';
    if (voiceErr) voiceErr.style.display = 'none';
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.detail || 'Erro ao carregar vozes');
      voiceSel.innerHTML = '<option value="">Selecione uma voz...</option>';
      (json.voices || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voice_id; opt.textContent = v.name;
        voiceSel.appendChild(opt);
      });
      voiceSel.style.display = '';
      localStorage.setItem('sf_el_key', key);
    } catch(e) {
      if (voiceErr) { voiceErr.style.display = 'block'; voiceErr.textContent = e.message; }
    } finally {
      loadVoEl.disabled = false; loadVoEl.textContent = 'Carregar vozes';
    }
  });

  sub.addEventListener('click', async () => {
    if (!sfFile) return;
    const startSec = parseFloat(startEl.value);
    const endSec   = parseFloat(endEl.value);
    const newText  = textEl.value.trim();
    const elKey    = (elKeyEl.value.trim()) || localStorage.getItem('sf_el_key') || '';
    const voiceId  = voiceSel.value;
    if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Tempos inválidos: fim deve ser maior que início.'; } return;
    }
    sub.disabled = true; sub.textContent = '⏳ Processando…';
    if (prog) prog.style.display = 'block';
    if (errEl) errEl.style.display = 'none';
    if (rc) rc.style.display = 'none';
    if (stat) stat.textContent = 'Gerando TTS e substituindo áudio…';
    try {
      const fd = new FormData();
      fd.append('video', sfFile);
      fd.append('start_time', startSec.toString());
      fd.append('end_time', endSec.toString());
      fd.append('new_text', newText);
      fd.append('el_key', elKey);
      fd.append('voice_id', voiceId);
      const resp = await fetch(API + '/api/replace-segment', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Erro ' + resp.status);
      // Poll job
      const jobId = json.id;
      let url;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const jr = await fetch(API + '/api/job/' + jobId);
        const jj = await jr.json();
        if (jj.status === 'done') { url = API + jj.url; break; }
        if (jj.status === 'error') throw new Error(jj.error || 'Erro no processamento');
        if (stat) stat.textContent = `Processando… ${jj.progress || 0}%`;
      }
      if (rv) rv.src = url;
      if (dl) { dl.href = url; dl.download = 'fala-substituida.mp4'; }
      if (rc) { rc.style.display = 'block'; rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      if (stat) stat.textContent = '';
      // Auto-delete cloned voice after use to avoid accumulating in ElevenLabs
      const selOpt = voiceSel.selectedOptions && voiceSel.selectedOptions[0];
      if (selOpt && selOpt.dataset.cloned === 'true' && elKey) {
        fetch('https://api.elevenlabs.io/v1/voices/' + voiceId, {
          method: 'DELETE', headers: { 'xi-api-key': elKey }
        }).catch(()=>{});
        selOpt.remove();
        voiceSel.value = '';
        checkReady();
      }
    } catch(e) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro: ' + e.message; }
      if (stat) stat.textContent = '';
    } finally {
      sub.disabled = false; sub.textContent = '▶ Substituir Fala';
      if (prog) prog.style.display = 'none';
// ── CORTES: mode tab switcher ─────────────────────────────────────────────
(function() {
  const tabs = document.querySelectorAll('.cortes-tab');
  const panels = { vid: document.getElementById('cortes-vid'), audio: document.getElementById('cortes-audio'), dyn: document.getElementById('cortes-dyn') };
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.cmode;
      tabs.forEach(b => b.classList.toggle('active', b.dataset.cmode === mode));
      Object.entries(panels).forEach(([k, el]) => { if (el) el.style.display = k === mode ? '' : 'none'; });
    });
  });
})();

// ── DIVIDIR DINÂMICO ─────────────────────────────────────────────────────────
(function() {
  const fileInput  = document.getElementById('dyn-file-input');
  const dropZone   = document.getElementById('dyn-dz');
  const fileNameEl = document.getElementById('dyn-file-name');
  const minEl      = document.getElementById('dyn-seg-min');
  const secEl      = document.getElementById('dyn-seg-sec');
  const previewEl  = document.getElementById('dyn-preview');
  const submitBtn  = document.getElementById('dyn-submit-btn');
  const progWrap   = document.getElementById('dyn-progress-wrap');
  const progBar    = document.getElementById('dyn-progress-bar');
  const statusEl   = document.getElementById('dyn-status');
  const errEl      = document.getElementById('dyn-error');
  const resultCard = document.getElementById('dyn-result-card');
  const infoEl     = document.getElementById('dyn-info');
  const dlZip      = document.getElementById('dyn-download-zip');
  const partsList  = document.getElementById('dyn-parts-list');
  if (!submitBtn) return;

  let dynFile = null, dynDur = 0;

  function segDurSec() {
    return (parseInt(minEl.value)||0)*60 + (parseInt(secEl.value)||0);
  }

  function fmtTime(s) {
    s = Math.round(s);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  function updatePreview() {
    if (!dynFile || !dynDur) { if (previewEl) previewEl.textContent = ''; return; }
    const seg = segDurSec();
    if (!seg) { if (previewEl) previewEl.textContent = '⚠ Defina uma duração maior que zero.'; return; }
    const count = Math.ceil(dynDur / seg);
    const lastSec = dynDur % seg || seg;
    let txt = `📹 Duração total: ${fmtTime(dynDur)} · ⏱ Cada parte: ${fmtTime(seg)}\n`;
    txt += `🔢 Resultado: ${count} parte${count > 1 ? 's' : ''}`;
    if (count > 1) txt += ` (${count-1} × ${fmtTime(seg)} + 1 × ${fmtTime(lastSec)})`;
    if (previewEl) previewEl.textContent = txt;
    submitBtn.disabled = false;
    submitBtn.textContent = `⚡ Dividir em ${count} ${count>1?'partes':'parte'}`;
  }

  function setFile(f) {
    dynFile = f;
    if (fileNameEl) fileNameEl.textContent = f.name;
    // Get duration
    const tmp = document.createElement('video');
    tmp.preload = 'metadata';
    tmp.src = URL.createObjectURL(f);
    tmp.onloadedmetadata = () => { dynDur = tmp.duration; URL.revokeObjectURL(tmp.src); updatePreview(); };
  }

  fileInput && fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  }
  [minEl, secEl].forEach(el => el && el.addEventListener('input', updatePreview));

  submitBtn.addEventListener('click', async () => {
    if (!dynFile) return;
    const seg = segDurSec();
    if (!seg) { if (errEl) { errEl.style.display = ''; errEl.textContent = 'Defina uma duração maior que zero.'; } return; }
    submitBtn.disabled = true; submitBtn.textContent = '⏳ Processando…';
    if (errEl) errEl.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';
    if (progWrap) progWrap.style.display = '';
    if (progBar) progBar.style.width = '5%';
    if (statusEl) statusEl.textContent = '📤 Enviando vídeo…';

    try {
      const fd = new FormData();
      fd.append('video', dynFile);
      fd.append('seg_dur', seg);

      const r = await fetch(API + '/api/split-dynamic', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);

      const jobId = j.id;
      let done;
      while (true) {
        await new Promise(res => setTimeout(res, 2500));
        const jr = await fetch(API + '/api/job/' + jobId);
        const jj = await jr.json();
        if (jj.status === 'done') { done = jj; break; }
        if (jj.status === 'error') throw new Error(jj.error || 'Falhou');
        if (progBar) progBar.style.width = (jj.progress || 0) + '%';
        if (statusEl) statusEl.textContent = jj.status_label || `Processando… ${jj.progress||0}%`;
      }

      if (progBar) progBar.style.width = '100%';
      if (statusEl) statusEl.textContent = '✓ Concluído!';

      // ZIP download
      if (dlZip && done.zip_url) { dlZip.href = API + done.zip_url; dlZip.download = 'partes.zip'; dlZip.style.display = ''; }
      else if (dlZip) dlZip.style.display = 'none';

      // Parts list
      if (partsList && done.parts) {
        partsList.innerHTML = done.parts.map((p, i) => {
          const url = API + p.url;
          return `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px">Parte ${i+1} — ${p.label}</div>
            <video controls class="result-video" src="${url}" style="margin-bottom:8px"></video>
            <a href="${url}" download="${p.label}" class="download-btn">⬇ Baixar parte ${i+1}</a>
          </div>`;
        }).join('');
      }

      if (infoEl && done.parts) {
        infoEl.textContent = `${done.parts.length} parte${done.parts.length>1?'s':''} · ${fmtTime(dynDur)} dividido em ${fmtTime(seg)} cada`;
      }
      if (resultCard) { resultCard.style.display = 'block'; resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    } catch(e) {
      if (errEl) { errEl.style.display = ''; errEl.textContent = 'Erro: ' + e.message; }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = dynFile && dynDur ? `⚡ Dividir em ${Math.ceil(dynDur/segDurSec())} partes` : 'Selecione um vídeo';
      setTimeout(() => { if (progWrap) progWrap.style.display = 'none'; }, 1500);
    }
  });
})();
// ══════════════════════════════════════════════════════════════════
(function() {
  const fileInput  = document.getElementById('ca-file-input');
  const dropZone   = document.getElementById('ca-drop-zone');
  const fileNameEl = document.getElementById('ca-file-name');
  const submitBtn  = document.getElementById('ca-submit-btn');
  const orKeyEl    = document.getElementById('ca-or-key');
  const orSaveBtn  = document.getElementById('ca-or-save-btn');
  const minSilEl   = document.getElementById('ca-min-silence');
  const bufferEl   = document.getElementById('ca-buffer');
  const smartEl    = document.getElementById('ca-smart-mode');
  const progWrap   = document.getElementById('ca-progress-wrap');
  const progBar    = document.getElementById('ca-progress-bar');
  const progLabel  = document.getElementById('ca-progress-label');
  const errEl      = document.getElementById('ca-error');
  const resultCard = document.getElementById('ca-result-card');
  const statsEl    = document.getElementById('ca-stats');
  const audioEl    = document.getElementById('ca-result-audio');
  const dlBtn      = document.getElementById('ca-download-btn');
  if (!submitBtn) return;

  // Restore key
  const saved = localStorage.getItem('ah_or_key');
  if (saved && orKeyEl) orKeyEl.value = saved;

  orSaveBtn && orSaveBtn.addEventListener('click', () => {
    const v = orKeyEl.value.trim();
    if (v) { localStorage.setItem('ah_or_key', v); orSaveBtn.textContent = '✅'; setTimeout(() => orSaveBtn.textContent = '💾', 2000); }
  });

  let caFile = null;
  function setFile(f) {
    caFile = f;
    if (fileNameEl) fileNameEl.textContent = f.name;
    submitBtn.disabled = false;
    submitBtn.textContent = '✂️ Cortar silêncios';
  }
  fileInput && fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  }

  submitBtn.addEventListener('click', async () => {
    if (!caFile) return;
    const orKey = (orKeyEl && orKeyEl.value.trim()) || localStorage.getItem('ah_or_key') || '';
    submitBtn.disabled = true; submitBtn.textContent = '⏳ Processando…';
    if (errEl) errEl.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';
    if (progWrap) progWrap.style.display = '';
    if (progBar) progBar.style.width = '5%';
    if (progLabel) progLabel.textContent = 'Enviando arquivo…';

    try {
      const fd = new FormData();
      fd.append('audio', caFile);
      fd.append('min_silence', minSilEl ? minSilEl.value : '0.4');
      fd.append('buffer', bufferEl ? bufferEl.value : '0.05');
      fd.append('smart', smartEl && smartEl.checked ? '1' : '0');
      if (orKey) fd.append('orKey', orKey);

      const r = await fetch(API + '/api/cutaudio', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);

      const jobId = j.id;
      let url, job;
      while (true) {
        await new Promise(res => setTimeout(res, 2500));
        const jr = await fetch(API + '/api/job/' + jobId);
        const jj = await jr.json();
        if (jj.status === 'done') { url = API + jj.url; job = jj; break; }
        if (jj.status === 'error') throw new Error(jj.error || 'Erro no processamento');
        const pct = jj.progress || 0;
        if (progBar) progBar.style.width = pct + '%';
        if (progLabel) progLabel.textContent = jj.status_label || `Processando… ${pct}%`;
      }

      if (progBar) progBar.style.width = '100%';
      if (progLabel) progLabel.textContent = '✓ Concluído!';
      if (audioEl) audioEl.src = url;
      if (dlBtn) { dlBtn.href = url; dlBtn.download = 'audio-cortado.mp3'; }
      if (statsEl && job.stats) {
        const s = job.stats;
        statsEl.innerHTML = `⏱ Original: <b>${s.original_s}s</b> → <b>${s.result_s}s</b> · `+
          `${s.cuts} cortes · economizado: <b>${s.saved_s}s</b> (${Math.round(s.saved_s/s.original_s*100)}%)`;
      }
      if (resultCard) { resultCard.style.display = 'block'; resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    } catch(e) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro: ' + e.message; }
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = '✂️ Cortar silêncios';
      setTimeout(() => { if (progWrap) progWrap.style.display = 'none'; }, 1500);
    }
  });
})();

// ══════════════════════════════════════════════════════════════════
// GERADOR DE CENAS IA
// ══════════════════════════════════════════════════════════════════
(function() {
  const orKeyEl    = document.getElementById('gc-or-key');
  const orSaveBtn  = document.getElementById('gc-or-save-btn');
  const modeBtns   = document.querySelectorAll('.gc-mode-btn');
  // Text mode
  const textPanel  = document.getElementById('gc-text-panel');
  const promptEl   = document.getElementById('gc-text-prompt');
  const formatSel  = document.getElementById('gc-format');
  const numScenes  = document.getElementById('gc-num-scenes');
  const genTextBtn = document.getElementById('gc-gen-text-btn');
  // Video mode
  const videoPanel   = document.getElementById('gc-video-panel');
  const videoInput   = document.getElementById('gc-video-input');
  const videoDropEl  = document.getElementById('gc-video-drop');
  const videoNameEl  = document.getElementById('gc-video-name');
  const analyzeBtn   = document.getElementById('gc-analyze-btn');
  // Shared
  const progWrap    = document.getElementById('gc-progress-wrap');
  const progBar     = document.getElementById('gc-progress-bar');
  const progStatus  = document.getElementById('gc-status');
  const errEl       = document.getElementById('gc-error');
  const scenesPanel = document.getElementById('gc-scenes-panel');
  const scenesCount = document.getElementById('gc-scenes-count');
  const scenesList  = document.getElementById('gc-scenes-list');
  const addSceneBtn = document.getElementById('gc-add-scene-btn');
  const placementPanel = document.getElementById('gc-placement-panel');
  const placeBtns   = document.querySelectorAll('.gc-place-btn');
  const renderBtn   = document.getElementById('gc-render-btn');
  const resultCard  = document.getElementById('gc-result-card');
  const resultVideo = document.getElementById('gc-result-video');
  const dlBtn       = document.getElementById('gc-download-btn');
  if (!orKeyEl) return;

  // Restore key
  const saved = localStorage.getItem('ah_or_key');
  if (saved && orKeyEl) orKeyEl.value = saved;

  orSaveBtn && orSaveBtn.addEventListener('click', () => {
    const v = orKeyEl.value.trim();
    if (v) { localStorage.setItem('ah_or_key', v); orSaveBtn.textContent = '✅'; setTimeout(() => orSaveBtn.textContent = '💾', 2000); }
  });

  let gcMode = 'text';
  let gcVideoFile = null;
  let gcVideoAnalysis = null;   // {ideas, transcript}
  let gcPlacement = 'prepend';
  let gcScenes = [];            // current scenes array

  // ── Mode toggle ─────────────────────────────────────────────────
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gcMode = btn.dataset.mode;
      modeBtns.forEach(b => {
        const on = b.dataset.mode === gcMode;
        b.style.background = on ? '' : 'none';
        b.style.border = on ? '' : '1px solid var(--border)';
        b.style.color = on ? '' : 'var(--text-muted)';
      });
      textPanel.style.display = gcMode === 'text' ? '' : 'none';
      videoPanel.style.display = gcMode === 'video' ? '' : 'none';
      scenesPanel.style.display = 'none';
    });
  });

  // ── Text mode: enable button when prompt filled ──────────────────
  promptEl && promptEl.addEventListener('input', () => {
    if (genTextBtn) genTextBtn.disabled = !promptEl.value.trim();
  });
  // init state
  if (genTextBtn) genTextBtn.disabled = true;

  // ── Video mode setup ─────────────────────────────────────────────
  function setVideoFile(f) {
    gcVideoFile = f;
    if (videoNameEl) videoNameEl.textContent = f.name;
    if (analyzeBtn) { analyzeBtn.disabled = false; analyzeBtn.textContent = '🔍 Analisar vídeo com IA'; }
  }
  videoInput && videoInput.addEventListener('change', () => { if (videoInput.files[0]) setVideoFile(videoInput.files[0]); });
  if (videoDropEl) {
    videoDropEl.addEventListener('click', () => videoInput && videoInput.click());
    videoDropEl.addEventListener('dragover', e => e.preventDefault());
    videoDropEl.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setVideoFile(f); });
  }

  // ── Render scenes list ───────────────────────────────────────────
  const STAGE_COLORS = { hook:'#f59e0b', problem:'#ef4444', solution:'#22c55e', proof:'#3b82f6', cta:'#a855f7', result:'#06b6d4', outro:'#6b7280' };
  function renderScenes() {
    if (!scenesList) return;
    scenesCount.textContent = `(${gcScenes.length})`;
    scenesList.innerHTML = gcScenes.map((sc, i) => {
      const col = STAGE_COLORS[sc.stage] || '#6b7280';
      return `<div data-idx="${i}" style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;position:relative">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="background:${col};color:#fff;font-size:11px;border-radius:4px;padding:2px 7px;font-weight:600">${sc.stage || 'scene'}</span>
          <span style="font-size:11px;color:var(--text-muted)">${sc.duration_s || 3}s</span>
          ${sc.emoji ? `<span>${sc.emoji}</span>` : ''}
          <button data-del="${i}" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1" title="Remover">×</button>
        </div>
        <textarea data-text="${i}" class="tool-input" rows="2" style="width:100%;font-size:13px;resize:vertical">${escHtml(sc.text || '')}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px">
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Duração (s)</div>
            <input data-dur="${i}" type="number" class="tool-input" value="${sc.duration_s || 3}" min="1" max="30" step="0.5" style="font-size:12px"/>
          </div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Stage</div>
            <select data-stage="${i}" class="tool-select" style="font-size:12px">
              ${['hook','problem','solution','proof','cta','result','outro'].map(s => `<option value="${s}"${s===sc.stage?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;
    }).join('');

    // Events
    scenesList.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => { gcScenes.splice(+btn.dataset.del, 1); renderScenes(); });
    });
    scenesList.querySelectorAll('[data-text]').forEach(ta => {
      ta.addEventListener('input', () => { gcScenes[+ta.dataset.text].text = ta.value; });
    });
    scenesList.querySelectorAll('[data-dur]').forEach(inp => {
      inp.addEventListener('change', () => { gcScenes[+inp.dataset.dur].duration_s = parseFloat(inp.value) || 3; });
    });
    scenesList.querySelectorAll('[data-stage]').forEach(sel => {
      sel.addEventListener('change', () => { gcScenes[+sel.dataset.stage].stage = sel.value; renderScenes(); });
    });
  }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function showScenes(scenes, showPlacement) {
    gcScenes = scenes;
    renderScenes();
    if (scenesPanel) scenesPanel.style.display = '';
    if (placementPanel) placementPanel.style.display = showPlacement ? '' : 'none';
    if (renderBtn) renderBtn.textContent = showPlacement ? '🚀 Renderizar vídeo' : '🎨 Renderizar cenas';
    scenesPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  addSceneBtn && addSceneBtn.addEventListener('click', () => {
    gcScenes.push({ duration_s: 3, text: '', stage: 'hook', emoji: '', bg_color: '#1a1a2e', text_color: '#ffffff', font_size: 72, bg_color2: '#16213e', accent_color: '#7c71ff' });
    renderScenes();
  });

  // ── Placement ────────────────────────────────────────────────────
  placeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gcPlacement = btn.dataset.place;
      placeBtns.forEach(b => {
        const on = b.dataset.place === gcPlacement;
        b.style.background = on ? '' : 'none';
        b.style.border = on ? '' : '1px solid var(--border)';
        b.style.color = on ? '' : 'var(--text-muted)';
      });
    });
  });

  // ── Progress helpers ─────────────────────────────────────────────
  function showProg(msg) { if (progWrap) progWrap.style.display = ''; if (progBar) progBar.style.width = '5%'; if (progStatus) progStatus.textContent = msg; if (errEl) errEl.style.display = 'none'; }
  function updProg(pct, msg) { if (progBar) progBar.style.width = pct + '%'; if (progStatus) progStatus.textContent = msg; }
  function hideProg() { setTimeout(() => { if (progWrap) progWrap.style.display = 'none'; }, 1500); }
  function showErr(msg) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; } }

  async function pollGcJob(jobId) {
    while (true) {
      await new Promise(res => setTimeout(res, 2500));
      const jr = await fetch(API + '/api/job/' + jobId);
      const jj = await jr.json();
      if (jj.status === 'done') return API + jj.url;
      if (jj.status === 'error') throw new Error(jj.error || 'Falhou');
      updProg(jj.progress || 0, jj.status_label || `Renderizando… ${jj.progress || 0}%`);
    }
  }

  // ── TEXT MODE Generate ───────────────────────────────────────────
  genTextBtn && genTextBtn.addEventListener('click', async () => {
    const orKey = (orKeyEl.value.trim()) || localStorage.getItem('ah_or_key') || '';
    if (!orKey) { showErr('Informe a OpenRouter Key.'); return; }
    const prompt = promptEl.value.trim();
    if (!prompt) return;
    genTextBtn.disabled = true; genTextBtn.textContent = '⏳ Aguarde…';
    showProg('🤖 GPT-4o mini gerando roteiro de cenas…');
    try {
      const r = await fetch(API + '/api/gencenas/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ or_key: orKey, description: prompt, num_scenes: +(numScenes && numScenes.value || 5), format: formatSel && formatSel.value || '9:16' })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);

      updProg(15, '🎨 Renderizando cenas…');
      const url = await pollGcJob(j.id);
      updProg(100, '✓ Pronto!');

      if (resultVideo) resultVideo.src = url;
      if (dlBtn) { dlBtn.href = url; dlBtn.download = 'cenas-geradas.mp4'; }
      if (resultCard) { resultCard.style.display = 'block'; resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      hideProg();
    } catch(e) {
      showErr('Erro: ' + e.message);
      updProg(0, '');
    } finally {
      genTextBtn.disabled = false; genTextBtn.textContent = '🤖 Gerar cenas';
    }
  });

  // ── VIDEO MODE Analyze ───────────────────────────────────────────
  analyzeBtn && analyzeBtn.addEventListener('click', async () => {
    if (!gcVideoFile) return;
    const orKey = (orKeyEl.value.trim()) || localStorage.getItem('ah_or_key') || '';
    if (!orKey) { showErr('Informe a OpenRouter Key.'); return; }
    analyzeBtn.disabled = true; analyzeBtn.textContent = '⏳ Analisando…';
    showProg('🎙 Transcrevendo vídeo com Whisper…');
    try {
      const fd = new FormData();
      fd.append('video', gcVideoFile);
      fd.append('orKey', orKey);
      const r = await fetch(API + '/api/gencenas/analyze-video', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
      gcVideoAnalysis = j;
      updProg(100, '✓ Análise concluída!');
      hideProg();
      showScenes(j.ideas.map(idea => ({
        duration_s: Math.round(idea.end - idea.start),
        start: idea.start, end: idea.end,
        text: idea.text, stage: idea.stage || 'hook',
        emoji: '', bg_color: '#1a1a2e', text_color: '#ffffff', font_size: 64, bg_color2: '#16213e', accent_color: '#7c71ff'
      })), true);
    } catch(e) {
      showErr('Erro: ' + e.message);
    } finally {
      analyzeBtn.disabled = false; analyzeBtn.textContent = '🔍 Analisar vídeo com IA';
    }
  });

  // ── RENDER ───────────────────────────────────────────────────────
  renderBtn && renderBtn.addEventListener('click', async () => {
    if (!gcScenes.length) return;
    const orKey = (orKeyEl.value.trim()) || localStorage.getItem('ah_or_key') || '';
    if (!orKey) { showErr('Informe a OpenRouter Key.'); return; }
    renderBtn.disabled = true; renderBtn.textContent = '⏳ Renderizando…';
    showProg('🎨 Iniciando renderização…');
    if (resultCard) resultCard.style.display = 'none';
    try {
      const fd = new FormData();
      fd.append('scenes', JSON.stringify(gcScenes));
      fd.append('format', formatSel ? formatSel.value : '9:16');
      fd.append('mode', gcMode);
      fd.append('placement', gcPlacement);
      fd.append('orKey', orKey);
      if (gcMode === 'video' && gcVideoFile) fd.append('video', gcVideoFile);

      const r = await fetch(API + '/api/gencenas/render-video', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);

      updProg(10, '🎬 Renderizando…');
      const url = await pollGcJob(j.id);
      updProg(100, '✓ Pronto!');

      if (resultVideo) resultVideo.src = url;
      if (dlBtn) { dlBtn.href = url; dlBtn.download = 'video-cenas.mp4'; }
      if (resultCard) { resultCard.style.display = 'block'; resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      hideProg();
    } catch(e) {
      showErr('Erro: ' + e.message);
      updProg(0, '');
    } finally {
      renderBtn.disabled = false; renderBtn.textContent = '🚀 Renderizar vídeo';
    }
  });
})();


