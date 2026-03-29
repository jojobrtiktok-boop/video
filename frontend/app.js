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
  const filename = item.url ? item.url.split('/').pop() : 'processando…';
  const isReady  = !item.status || item.status === 'done';
  const isProc   = item.status === 'processing';
  const isErr    = item.status === 'error';
  const pct      = item.progress != null ? item.progress : (isReady ? 100 : 0);
  const expiry   = isReady ? formatExpiry(item.expiresAt) : '';
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
        <div class="video-card-title">${filename}</div>
        ${isProc ? `
          <div class="lib-progress-bar"><div class="lib-progress-fill" style="width:${pct}%"></div></div>
          <div class="video-card-meta">⏳ ${pct}% — processando…</div>` : ''}
        ${isReady ? `<div class="video-card-meta">${expiry}</div>` : ''}
        ${isErr   ? `<div class="video-card-meta" style="color:#f87171">❌ Erro no processamento</div>` : ''}
        <div class="video-card-actions">
          ${isReady && item.url ? `<a href="${API + item.url}" download class="video-card-dl">⬇ Baixar</a>` : ''}
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
  rembg: 'imagem',
  imagegen: 'ia', videogen: 'ia',
  'video-library': null
};

function showTool(name) {
  document.querySelectorAll('.tool-panel').forEach(p => {
    p.style.display = p.id === 'tool-' + name ? 'block' : 'none';
  });
  // nav item active state
  document.querySelectorAll('.nav-item[data-tool], .nav-direct[data-tool]').forEach(item => {
    item.classList.toggle('active', item.dataset.tool === name);
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
  setLoadingWm(true, 0); clearError(); resultCard.style.display = 'none';
  try {
    const resp = await fetch(API + '/api/process', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
    if (json.status === 'processing' && json.id) {
      await pollProcessJob(json.id);
    } else {
      showWmResult(json.url);
    }
  } catch (err) { showError(err.message); }
  finally { setLoadingWm(false, 0); }
});

async function pollProcessJob(jobId) {
  while (true) {
    await new Promise(r => setTimeout(r, 2500));
    const resp = await fetch(API + `/api/process-status/${jobId}`);
    const job  = await resp.json();
    if (job.status === 'done')  { showWmResult(job.url); return; }
    if (job.status === 'error') throw new Error(job.error || 'Processamento falhou');
    setLoadingWm(true, job.progress || 0);
  }
}

function showWmResult(url) {
  resultVideo.src = API + url; downloadBtn.href = API + url;
  downloadBtn.download = url.split('/').pop();
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
const subAddBtn       = document.getElementById('sub-add-btn');
const subEntriesEl    = document.getElementById('sub-entries');
const subEmptyEl      = document.getElementById('sub-empty');

let subFile = null, subEntries = [], subPreset = 'classico', subWordByWord = false, subEntryAnim = 'none';
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
        extrDownloadBtn.href = url; extrDownloadBtn.download = json.url.split('/').pop();
        extrDownloadBtn.textContent = '⬇ Baixar MP3';
        extrResultCard.style.display = 'block';
        extrResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        const url = API + json.url;
        if (extrResultAudio) { extrResultAudio.style.display = 'none'; extrResultAudio.src = ''; }
        extrResultVideo.style.display = ''; extrResultVideo.src = url;
        extrDownloadBtn.href = url; extrDownloadBtn.download = json.url.split('/').pop();
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

    // Restore saved key
    const igApikeyGoogle = document.getElementById('ig-google-apikey');
    const savedGoogle = localStorage.getItem('google_api_key');
    if (igApikeyGoogle && savedGoogle) igApikeyGoogle.value = savedGoogle;

    // Save key
    const igGoogleSaveKey = document.getElementById('ig-google-save-key');
    if (igGoogleSaveKey) igGoogleSaveKey.addEventListener('click', () => {
      const val = igApikeyGoogle?.value.trim();
      if (val) { localStorage.setItem('google_api_key', val); }
      igGoogleSaveKey.textContent = '✅ Salvo!';
      setTimeout(() => { igGoogleSaveKey.textContent = '💾 Salvar'; }, 1500);
    });

    // Model dropdown vars
    const igTrigger  = document.getElementById('ig-select-trigger');
    const igDropdown = document.getElementById('ig-select-dropdown');
    const igSelName  = document.getElementById('ig-select-name');
    const igSelDesc  = document.getElementById('ig-select-desc');

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

    // Esconde seletor de modelo e botão de gerar quando na aba de tradução
    const igModelCard = document.getElementById('ig-model-card');
    document.querySelectorAll('.ig-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const isTranslate = tab.dataset.mode === 'translate';
        if (igModelCard) igModelCard.style.display = isTranslate ? 'none' : '';
        if (igSubmit)    igSubmit.style.display    = isTranslate ? 'none' : '';
      });
    });

    // Traduzir Imagem
    setupUpload('ig-tr-input', 'ig-tr-preview', 'ig-tr-box');
    const igTrLang   = document.getElementById('ig-tr-lang');
    const igTrResult = document.getElementById('ig-tr-result');
    const igTrText   = document.getElementById('ig-tr-text');
    const igTrCopy   = document.getElementById('ig-tr-copy');

    // Botão de traduzir (criado dinamicamente dentro do painel)
    const igTrBtn = document.createElement('button');
    igTrBtn.className = 'submit-btn';
    igTrBtn.textContent = '🌐 Traduzir Imagem';
    igTrBtn.style.marginTop = '16px';
    const igTrPanel = document.getElementById('ig-panel-translate');
    if (igTrPanel) igTrPanel.appendChild(igTrBtn);

    const igTrError = document.createElement('div');
    igTrError.className = 'error-msg'; igTrError.style.display = 'none';
    if (igTrPanel) igTrPanel.appendChild(igTrError);

    if (igTrBtn) igTrBtn.addEventListener('click', async () => {
      const apiKey = igApikeyGoogle?.value.trim() || localStorage.getItem('google_api_key') || '';
      if (!apiKey) { alert('Informe sua API Key do Google AI Studio'); return; }
      const trInput = document.getElementById('ig-tr-input');
      if (!trInput?.files?.[0]) { alert('Selecione uma imagem primeiro'); return; }
      igTrBtn.disabled = true; igTrBtn.textContent = '⏳ Traduzindo...';
      igTrError.style.display = 'none'; if (igTrResult) igTrResult.style.display = 'none';
      const fd = new FormData();
      fd.append('image', trInput.files[0]);
      fd.append('targetLang', igTrLang?.value || 'pt');
      fd.append('apiKey', apiKey);
      try {
        const resp = await fetch(API + '/api/translate-image', { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error);
        if (igTrText)   igTrText.textContent = json.translation || '(sem resultado)';
        if (igTrResult) { igTrResult.style.display = 'block'; igTrResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      } catch (err) {
        igTrError.style.display = 'block'; igTrError.textContent = 'Erro: ' + err.message;
      } finally {
        igTrBtn.disabled = false; igTrBtn.textContent = '🌐 Traduzir Imagem';
      }
    });
    if (igTrCopy) igTrCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(igTrText?.textContent || '');
      igTrCopy.textContent = '✓ Copiado!';
      setTimeout(() => { igTrCopy.textContent = '📋 Copiar tradução'; }, 2000);
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
      const apiKey = igApikeyGoogle?.value.trim() || localStorage.getItem('google_api_key') || '';
      if (!apiKey) { alert('Informe sua API Key do Google AI Studio'); return; }

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, imageModel: selectedModel, apiKey, mode: currentMode, referenceBase64, productBase64 })
        });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        if (json.url) {
          igImg.src = json.url;
          igDown.href = json.url;
          igDown.download = 'imagem-gerada.png';
          igResult.style.display = 'block';
          igResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // show resize tools
          document.getElementById('ig-resize-btn').style.display = 'block';
          document.querySelectorAll('.ig-sz-btn').forEach(b => b.classList.remove('active'));
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

  // ── Image resize presets ──
  document.querySelectorAll('.ig-sz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ig-sz-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isCustom = btn.dataset.w === '0';
      const customEl = document.getElementById('ig-custom-size');
      if (customEl) customEl.style.display = isCustom ? 'block' : 'none';
    });
  });

  document.getElementById('ig-resize-btn')?.addEventListener('click', () => {
    const img = document.getElementById('ig-result-img');
    if (!img || !img.src) return;
    const active = document.querySelector('.ig-sz-btn.active');
    let w = active ? parseInt(active.dataset.w) : 0;
    let h = active ? parseInt(active.dataset.h) : 0;
    if (!w || !h) {
      w = parseInt(document.getElementById('ig-custom-w')?.value) || 0;
      h = parseInt(document.getElementById('ig-custom-h')?.value) || 0;
    }
    if (!w || !h) { alert('Escolha um tamanho ou informe largura e altura'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
    const src = new Image();
    src.crossOrigin = 'anonymous';
    src.onload = () => {
      const sc = Math.min(w/src.width, h/src.height);
      const sw = src.width*sc, sh = src.height*sc;
      ctx.drawImage(src, (w-sw)/2, (h-sh)/2, sw, sh);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'image-' + w + 'x' + h + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    };
    src.src = img.src;
  });
})();

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
    if (dl) { dl.href = API + json.url; dl.download = json.url.split('/').pop(); }
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
    let lastUrl = null;
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
        lastUrl = j.url;
      } catch (e) { errorEl.style.display='block'; errorEl.textContent='Erro no corte '+(i+1)+': '+e.message; }
    }
    if (lastUrl) {
      resultVid.src = API + lastUrl; dlBtn.href = API + lastUrl; dlBtn.download = lastUrl.split('/').pop();
      resultCard.style.display = 'block'; resultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    submitBtn.disabled = false; submitBtn.textContent = '✂ Cortar';
    progressEl.style.display = 'none'; statusEl.textContent = '';
    if (bar) { bar.style.width=''; bar.style.animation=''; }
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

// ── AUMENTAR QUALIDADE ──
let upscaleW = 1280, upscaleH = 720;
document.querySelectorAll('.res-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('rb-active'));
    btn.classList.add('rb-active');
    upscaleW = parseInt(btn.dataset.w); upscaleH = parseInt(btn.dataset.h);
  });
});
makeSimpleTool({
  fileInputId: 'upscale-file-input', dropZoneId: 'upscale-dz', fileNameId: 'upscale-file-name',
  submitBtnId: 'upscale-submit-btn', progressId: 'upscale-progress', statusId: 'upscale-status',
  errorId: 'upscale-error', resultCardId: 'upscale-result-card', resultVideoId: 'upscale-result-video',
  downloadBtnId: 'upscale-download-btn', endpoint: '/api/upscale',
  buildFormData: (file) => {
    const fd = new FormData();
    fd.append('video', file); fd.append('h', upscaleH);
    return fd;
  },
  onResult: (job, file) => {
    const el = document.getElementById('upscale-sizes');
    if (!el) return;
    const orig = job.inputSize || file.size || 0;
    const out  = job.outputSize || 0;
    el.innerHTML = `<span class="size-orig">Original: ${fmtBytes(orig)}</span>` +
      `<span class="size-arrow">→</span>` +
      `<span class="size-new">Saída: ${fmtBytes(out)}</span>`;
  }
});

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

// ── REMOVER FUNDO ──
(function() {
  const fi  = document.getElementById('rembg-file-input');
  const dz  = document.getElementById('rembg-dz');
  const fn  = document.getElementById('rembg-file-name');
  const sub = document.getElementById('rembg-submit-btn');
  const prog = document.getElementById('rembg-progress');
  const err = document.getElementById('rembg-error');
  const rc  = document.getElementById('rembg-result-card');
  const ri  = document.getElementById('rembg-result-img');
  const dl  = document.getElementById('rembg-download-btn');
  if (!fi || !sub) return;
  let file = null;
  function setFile(f) {
    file = f;
    if (fn) fn.textContent = '✓ ' + f.name;
    if (dz) dz.classList.add('has-file');
    sub.disabled = false; sub.textContent = '▶ Remover Fundo';
  }
  fi.addEventListener('change', () => { if (fi.files[0]) setFile(fi.files[0]); });
  if (dz) {
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => e.preventDefault());
    dz.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  }
  sub.addEventListener('click', async () => {
    if (!file) return;
    sub.disabled = true; sub.textContent = '⏳ Processando…';
    if (prog) prog.style.display = 'block';
    if (err) err.style.display = 'none';
    if (rc) rc.style.display = 'none';
    try {
      const fd = new FormData(); fd.append('image', file);
      const resp = await fetch(API + '/api/rembg', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Erro ' + resp.status);
      if (ri) ri.src = API + json.url;
      if (dl) { dl.href = API + json.url; dl.download = 'sem-fundo.png'; }
      if (rc) { rc.style.display = 'block'; rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    } catch (e) {
      if (err) { err.style.display = 'block'; err.textContent = 'Erro: ' + e.message; }
    } finally {
      sub.disabled = false; sub.textContent = '▶ Remover Fundo';
      if (prog) prog.style.display = 'none';
    }
  });
})();
