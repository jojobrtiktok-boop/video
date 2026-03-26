const API = '';

// DOM: Ferramenta Marca D'Agua
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

// DOM: Lipsync
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

// Troca de ferramenta
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

// Estado
let selectedFile = null, selectedMode = 'blur', videoEl = null;
let previewW = 0, previewH = 0, videoW = 0, videoH = 0;
let selRect = null, dragMode = null, activeHandle = null;
let dragStart = null, dragOrigRect = null;
const HANDLE_SIZE = 10, HANDLE_HALF = 5;
let animFrame = null, lipVideoFile = null, lipAudioFile = null;
let isPaused = false, isSeeking = false;

function formatTime(s) {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

// Descricoes de modos
const modeDesc = {
  blur:   'Blur gaussiano com bordas suaves — rapido, funciona em qualquer tipo de fundo.',
  delogo: 'Reconstroi pixels da regiao usando arredores — otimo para fundos uniformes.',
  ai:     'Inpainting com IA — em breve neste servidor.'
};

// Botoes de modo
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    if (modeDescEl) modeDescEl.textContent = modeDesc[selectedMode] || '';
  });
});

// Selecao de arquivo (marca d'agua)
function setFile(file) {
  if (!file || !file.type.startsWith('video/')) { showError('Arquivo invalido. Selecione um video.'); return; }
  selectedFile = file;
  const name = file.name.length > 50 ? file.name.substring(0, 47) + '...' : file.name;
  fileNameEl.textContent = '✓ ' + name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  dropZone.classList.add('has-file');
  submitBtn.disabled = false;
  submitBtn.textContent = '▶ Processar Video';
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

// Loop de video no canvas
function startVideoLoop() {
  if (animFrame) cancelAnimationFrame(animFrame);
  isPaused = false;
  isSeeking = false;
  videoEl.loop = true;
  videoEl.playbackRate = vcSpeed ? parseFloat(vcSpeed.value) : 1;
  videoEl.play().catch(() => {});
  if (vcPlay) vcPlay.textContent = '\u23F8';
  if (vcSeek) vcSeek.value = 0;
  if (vcTime) vcTime.textContent = '0:00 / 0:00';
  function loop() { drawFrame(); animFrame = requestAnimationFrame(loop); }
  animFrame = requestAnimationFrame(loop);
}

function loadVideoPreview(file) {
  selRect = null; dragMode = null;
  regionInfo.innerHTML = 'Nenhuma regiao selecionada — arraste para marcar';
  videoEl = document.createElement('video');
  videoEl.muted = true; videoEl.playsInline = true; videoEl.preload = 'auto';
  videoEl.src = URL.createObjectURL(file); videoEl.currentTime = 0.1;
  videoEl.addEventListener('seeked', function onS() {
    videoEl.removeEventListener('seeked', onS);
    videoW = videoEl.videoWidth; videoH = videoEl.videoHeight;
    previewSect.style.display = 'block';
    requestAnimationFrame(() => { updateCanvasSize(); startVideoLoop(); });
  });
}

// Desenho do canvas
function drawFrame() {
  if (!videoEl) return;
  // Update seek bar and time
  if (!isSeeking && vcSeek && vcTime) {
    const dur = videoEl.duration || 0;
    vcSeek.value = dur ? Math.round((videoEl.currentTime / dur) * 1000) : 0;
    vcTime.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(dur);
  }
  ctx.clearRect(0, 0, previewW, previewH);
  ctx.drawImage(videoEl, 0, 0, previewW, previewH);
  if (!selRect || selRect.w < 2 || selRect.h < 2) return;
  const { x, y, w, h } = selRect;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, previewW, previewH);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(videoEl, 0, 0, previewW, previewH); ctx.restore();
  ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
  ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  getSelHandles().forEach(h2 => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(h2.x - HANDLE_HALF, h2.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(h2.x - HANDLE_HALF, h2.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
  });
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
  resizeTimer = setTimeout(() => { if (videoEl) { updateCanvasSize(); if (!animFrame) drawFrame(); } }, 120);
});

// ── Controles de Vídeo ──
if (vcPlay) {
  vcPlay.addEventListener('click', () => {
    if (!videoEl) return;
    if (isPaused) {
      videoEl.play().catch(() => {});
      isPaused = false;
      vcPlay.textContent = '\u23F8';
      if (!animFrame) {
        function resumeLoop() { drawFrame(); animFrame = requestAnimationFrame(resumeLoop); }
        animFrame = requestAnimationFrame(resumeLoop);
      }
    } else {
      videoEl.pause();
      isPaused = true;
      vcPlay.textContent = '\u25B6';
    }
  });
}
if (vcSeek) {
  vcSeek.addEventListener('mousedown', () => { isSeeking = true; });
  vcSeek.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
  vcSeek.addEventListener('input', () => {
    if (!videoEl || !videoEl.duration) return;
    videoEl.currentTime = (vcSeek.value / 1000) * videoEl.duration;
    if (vcTime) vcTime.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(videoEl.duration);
    drawFrame();
  });
  vcSeek.addEventListener('mouseup', () => { isSeeking = false; });
  vcSeek.addEventListener('touchend', () => { isSeeking = false; });
}
if (vcSpeed) {
  vcSpeed.addEventListener('change', () => {
    if (videoEl) videoEl.playbackRate = parseFloat(vcSpeed.value);
  });
}

// Handles
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

// Mouse/Touch drag
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
  handleDrag(p);
});
canvas.addEventListener('mouseup', () => endDrag());
canvas.addEventListener('mouseleave', () => { if (dragMode) endDrag(); });
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
canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!dragMode) return; handleDrag(canvasPos(e)); }, { passive: false });
canvas.addEventListener('touchend', () => endDrag());

function handleDrag(p) {
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
function endDrag() {
  if (!dragMode) return;
  dragMode = null; activeHandle = null; dragStart = null; dragOrigRect = null;
  finalizeSel();
}
function finalizeSel() {
  if (!selRect || selRect.w < 5 || selRect.h < 5) {
    selRect = null; drawFrame();
    regionInfo.innerHTML = 'Nenhuma regiao selecionada — arraste para marcar'; return;
  }
  const rx = Math.round(selRect.x * videoW / previewW), ry = Math.round(selRect.y * videoH / previewH);
  const rw = Math.round(selRect.w * videoW / previewW), rh = Math.round(selRect.h * videoH / previewH);
  regionInfo.innerHTML = 'Regiao: <span>' + rw + ' x ' + rh + ' px</span> em <span>(' + rx + ', ' + ry + ')</span>';
  drawFrame();
}

// Submit (marca d'agua)
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
  setLoading(true); clearError(); resultCard.style.display = 'none';
  try {
    const resp = await fetch(API + '/api/process', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
    resultVideo.src = API + json.url; downloadBtn.href = API + json.url;
    downloadBtn.download = json.url.split('/').pop();
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) { showError(err.message); }
  finally { setLoading(false); }
});
function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.textContent = on ? '⏳ Processando...' : '▶ Processar Video';
  progressWrap.style.display = on ? 'block' : 'none';
  statusText.textContent = on ? 'Aguarde — o ffmpeg esta processando o video...' : '';
}
function showError(msg) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Erro: ' + msg; }
function clearError() { errorMsg.style.display = 'none'; errorMsg.textContent = ''; }

// Lipsync: selecao de arquivo
lipVideoInput.addEventListener('change', () => {
  if (!lipVideoInput.files[0]) return;
  lipVideoFile = lipVideoInput.files[0];
  lipFileNameEl.textContent = '✓ ' + lipVideoFile.name;
  document.getElementById('lip-drop-zone').classList.add('has-file');
  updateLipSubmit();
});
lipAudioInput.addEventListener('change', () => {
  if (!lipAudioInput.files[0]) return;
  lipAudioFile = lipAudioInput.files[0];
  lipAudioNameEl.textContent = '✓ ' + lipAudioFile.name;
  document.getElementById('lip-audio-drop-zone').classList.add('has-file');
  updateLipSubmit();
});
function updateLipSubmit() {
  if (lipVideoFile && lipAudioFile) { lipSubmitBtn.disabled = false; lipSubmitBtn.textContent = '💋 Sincronizar Labios'; }
  else { lipSubmitBtn.disabled = true; lipSubmitBtn.textContent = 'Selecione o video e o audio'; }
}

// Drag-drop nas zonas lipsync
function makeDrop(zoneId, validator, onFile) {
  const zone = document.getElementById(zoneId); let cnt = 0;
  zone.addEventListener('dragenter', e => { e.preventDefault(); cnt++; zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; zone.classList.remove('drag-over'); } });
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault(); cnt = 0; zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f && validator(f)) onFile(f);
  });
}
makeDrop('lip-drop-zone', f => f.type.startsWith('video/'), f => {
  lipVideoFile = f; lipFileNameEl.textContent = '✓ ' + f.name;
  document.getElementById('lip-drop-zone').classList.add('has-file'); updateLipSubmit();
});
makeDrop('lip-audio-drop-zone', f => f.type.startsWith('audio/'), f => {
  lipAudioFile = f; lipAudioNameEl.textContent = '✓ ' + f.name;
  document.getElementById('lip-audio-drop-zone').classList.add('has-file'); updateLipSubmit();
});

// Submit Lipsync
lipSubmitBtn.addEventListener('click', async () => {
  if (!lipVideoFile || !lipAudioFile) return;
  lipSubmitBtn.disabled = true; lipSubmitBtn.textContent = '⏳ Processando...';
  lipProgressWrap.style.display = 'block'; lipStatus.textContent = 'Enviando arquivos...';
  lipErrorMsg.style.display = 'none'; lipResultCard.style.display = 'none';
  const fd = new FormData();
  fd.append('video', lipVideoFile); fd.append('audio', lipAudioFile);
  try {
    const resp = await fetch(API + '/api/lipsync', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
    lipResultVideo.src = API + json.url; lipDownloadBtn.href = API + json.url;
    lipDownloadBtn.download = json.url.split('/').pop();
    lipResultCard.style.display = 'block';
    lipResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    lipErrorMsg.style.display = 'block'; lipErrorMsg.textContent = 'Erro: ' + err.message;
  } finally {
    lipSubmitBtn.disabled = false; lipSubmitBtn.textContent = '💋 Sincronizar Labios';
    lipProgressWrap.style.display = 'none'; lipStatus.textContent = '';
  }
});

// ════════════════════════════════════════════
// SUBTITLE TOOL
// ════════════════════════════════════════════
const subFileInput    = document.getElementById('sub-file-input');
const subFileNameEl   = document.getElementById('sub-file-name');
const subDropZone     = document.getElementById('sub-drop-zone');
const subAddBtn       = document.getElementById('sub-add-btn');
const subEntriesEl    = document.getElementById('sub-entries');
const subEmptyEl      = document.getElementById('sub-empty');
const subCountEl      = document.getElementById('sub-count');
const subSubmitBtn    = document.getElementById('sub-submit-btn');
const subProgressWrap = document.getElementById('sub-progress-wrap');
const subStatusEl     = document.getElementById('sub-status');
const subErrorEl      = document.getElementById('sub-error');
const subResultCard   = document.getElementById('sub-result-card');
const subResultVideo  = document.getElementById('sub-result-video');
const subDownloadBtn  = document.getElementById('sub-download-btn');
const subFontSize     = document.getElementById('sub-fontsize');
const subFontSizeVal  = document.getElementById('sub-fontsize-val');

let subFile = null, subEntries = [], subPreset = 'classico', subPosition = 'bottom', subNextId = 1, subWordByWord = false;

// File selection
function setSubFile(file) {
  if (!file || !file.type.startsWith('video/')) return;
  subFile = file;
  const name = file.name.length > 50 ? file.name.substring(0, 47) + '...' : file.name;
  subFileNameEl.textContent = '✓ ' + name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  subDropZone.classList.add('has-file');
  updateSubSubmit();
}
subFileInput.addEventListener('change', () => { if (subFileInput.files[0]) setSubFile(subFileInput.files[0]); });
makeDrop('sub-drop-zone', f => f.type.startsWith('video/'), setSubFile);

// Style preset selection
document.querySelectorAll('.preset-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('sp-active'));
    card.classList.add('sp-active');
    subPreset = card.dataset.preset;
  });
});

// Position selection
document.querySelectorAll('.pos-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('pp-active'));
    btn.classList.add('pp-active');
    subPosition = btn.dataset.pos;
  });
});

// Animation mode selection
document.querySelectorAll('.anim-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('pa-active'));
    btn.classList.add('pa-active');
    subWordByWord = btn.dataset.anim === 'word';
  });
});

// Font size slider
if (subFontSize) {
  subFontSize.addEventListener('input', () => { subFontSizeVal.textContent = subFontSize.value; });
}

// Time helpers
function advanceTime(t, secs) {
  const parts = String(t).split(':').map(Number);
  let total = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts[0]*60 + (parts[1] || 0);
  total += secs;
  const m = Math.floor(total / 60), s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function getLastEndTime() {
  return subEntries.length ? subEntries[subEntries.length - 1].end : '0:00';
}

// Render entry list
function renderEntries() {
  subEntriesEl.innerHTML = '';
  subEmptyEl.style.display = subEntries.length === 0 ? 'block' : 'none';
  subCountEl.textContent = subEntries.length;
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
      renderEntries();
      updateSubSubmit();
    });
    subEntriesEl.appendChild(div);
  });
}

subAddBtn.addEventListener('click', () => {
  const lastEnd = getLastEndTime();
  const newEnd = advanceTime(lastEnd, 3);
  subEntries.push({ id: subNextId++, start: lastEnd, end: newEnd, text: '' });
  renderEntries();
  const inputs = subEntriesEl.querySelectorAll('.sub-text-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
  updateSubSubmit();
});

function updateSubSubmit() {
  if (!subFile) { subSubmitBtn.disabled = true; subSubmitBtn.textContent = 'Selecione um vídeo'; return; }
  const hasText = subEntries.some(e => e.text.trim().length > 0);
  if (!subEntries.length || !hasText) { subSubmitBtn.disabled = true; subSubmitBtn.textContent = 'Adicione ao menos uma legenda'; return; }
  subSubmitBtn.disabled = false;
  subSubmitBtn.textContent = '💬 Gravar Legendas no Vídeo';
}

// ════════════════════════════════════════════
// CREATIVE COMBINER
// ════════════════════════════════════════════
const hookInput        = document.getElementById('hook-input');
const bodyInput        = document.getElementById('body-input');
const hookListEl       = document.getElementById('hook-list');
const hookCountEl      = document.getElementById('hook-count');
const bodyListEl       = document.getElementById('body-list');
const bodyCountEl      = document.getElementById('body-count');
const combineFormulaEl = document.getElementById('combine-formula');
const combineMatrixEl  = document.getElementById('combine-matrix');
const combineBtn       = document.getElementById('combine-btn');
const combineProgEl    = document.getElementById('combine-prog');
const combineStatusEl  = document.getElementById('combine-status');
const combineDetEl     = document.getElementById('combine-det');
const combineErrorEl   = document.getElementById('combine-error');
const combineResultsEl = document.getElementById('combine-results');
const combineGridEl    = document.getElementById('combine-result-grid');
const combineDoneN     = document.getElementById('combine-done-n');

let hookFiles = [], bodyFiles = [];

// Multi-file drag-drop
function makeMultiDrop(zoneId, onFiles) {
  const zone = document.getElementById(zoneId); let cnt = 0;
  zone.addEventListener('dragenter', e => { e.preventDefault(); cnt++; zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; zone.classList.remove('drag-over'); } });
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault(); cnt = 0; zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length) onFiles(files);
  });
}

function renderClipList(files, listId, countId, onRemove) {
  const listEl = document.getElementById(listId);
  const countEl = document.getElementById(countId);
  listEl.innerHTML = '';
  if (countEl) countEl.textContent = files.length;
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
  renderClipList(hookFiles, 'hook-list', 'hook-count', i => {
    hookFiles.splice(i, 1); renderHookList(); updateCombinePreview();
  });
}
function renderBodyList() {
  renderClipList(bodyFiles, 'body-list', 'body-count', i => {
    bodyFiles.splice(i, 1); renderBodyList(); updateCombinePreview();
  });
}

function updateCombinePreview() {
  const nH = hookFiles.length, nB = bodyFiles.length, total = nH * nB;
  const previewCard = document.getElementById('combine-preview');
  if (previewCard) previewCard.style.display = (nH > 0 || nB > 0) ? 'block' : 'none';
  if (combineFormulaEl) {
    combineFormulaEl.innerHTML =
      '<span class="cn">' + nH + '</span> hooks × <span class="cn">' + nB + '</span> corpos = <span class="cn">' + total + '</span> vídeo' + (total !== 1 ? 's' : '');
  }
  if (combineMatrixEl) {
    combineMatrixEl.innerHTML = '';
    if (total > 0 && total <= 50) {
      hookFiles.forEach((h, hi) => {
        bodyFiles.forEach((b, bi) => {
          const tag = document.createElement('span');
          tag.className = 'combo-tag';
          tag.textContent = 'H' + (hi + 1) + '+C' + (bi + 1);
          combineMatrixEl.appendChild(tag);
        });
      });
    } else if (total > 50) {
      combineMatrixEl.textContent = total + ' combinações';
    }
  }
  if (combineBtn) combineBtn.disabled = (nH === 0 || nB === 0);
}

// File input change listeners
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

// Drag-drop for hook/body zones
makeMultiDrop('hook-dz', files => {
  hookFiles = hookFiles.concat(files); renderHookList(); updateCombinePreview();
});
makeMultiDrop('body-dz', files => {
  bodyFiles = bodyFiles.concat(files); renderBodyList(); updateCombinePreview();
});

// Initialize preview state
updateCombinePreview();

// Combiner submit
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

    // Step 1: Stage all files
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
      combineErrorEl.textContent = 'Erro ao enviar arquivos: ' + err.message;
      combineBtn.disabled = false;
      return;
    }

    // Step 2: Create placeholder cards
    const total = hookIds.length * bodyIds.length;
    combineResultsEl.style.display = 'block';
    if (combineDoneN) combineDoneN.textContent = '0 / ' + total;
    const cards = [];
    hookIds.forEach((hId, hi) => {
      bodyIds.forEach((bId, bi) => {
        const card = document.createElement('div');
        card.className = 'combo-card combo-processing';
        card.innerHTML =
          '<div class="combo-card-info">' +
          '<span class="combo-card-label">H' + (hi + 1) + ' + C' + (bi + 1) + '</span>' +
          '<span class="combo-card-label" style="opacity:.6;font-size:11px">' +
          (hookNames[hi] || hId) + ' + ' + (bodyNames[bi] || bId) + '</span>' +
          '<span style="opacity:.5">⏳ gerando...</span>' +
          '</div>';
        combineGridEl.appendChild(card);
        cards.push({ card, hId, bId, hi, bi });
      });
    });

    // Step 3: Run sequentially
    let done = 0;
    for (const { card, hId, bId, hi, bi } of cards) {
      combineStatusEl.textContent = 'Gerando vídeo ' + (done + 1) + ' de ' + total + '...';
      combineDetEl.textContent = 'H' + (hi + 1) + ' + C' + (bi + 1) + ': ' + (hookNames[hi] || hId) + ' + ' + (bodyNames[bi] || bId);
      try {
        const resp = await fetch(API + '/api/concat/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookId: hId, bodyId: bId })
        });
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        const url = API + json.url;
        const label = 'H' + (hi + 1) + '+C' + (bi + 1);
        const fname = 'combo-h' + (hi + 1) + '-c' + (bi + 1) + '.mp4';
        card.className = 'combo-card';
        card.innerHTML =
          '<video src="' + url + '" controls muted playsinline></video>' +
          '<div class="combo-card-info">' +
          '<span class="combo-card-label">' + label + '</span>' +
          '<a class="combo-dl" href="' + url + '" download="' + fname + '">⬇ Baixar</a>' +
          '</div>';
      } catch (err) {
        card.className = 'combo-card combo-err';
        card.innerHTML =
          '<div class="combo-card-info" style="padding:1rem">' +
          '<span class="combo-card-label" style="color:#ff6b6b">H' + (hi + 1) + '+C' + (bi + 1) + ' — Erro</span>' +
          '<span style="font-size:12px;opacity:.7">' + err.message + '</span>' +
          '</div>';
      }
      done++;
      if (combineDoneN) combineDoneN.textContent = done + ' / ' + total;
    }

    combineProgEl.style.display = 'none';
    combineStatusEl.textContent = '';
    combineDetEl.textContent = '';
    combineBtn.disabled = false;
  });
}

// ════════════════════════════════════════════
// EXTRAIR TOOL
// ════════════════════════════════════════════
const extrVideoInput   = document.getElementById('extr-video-input');
const extrAudioInput   = document.getElementById('extr-audio-input');
const extrDz           = document.getElementById('extr-dz');
const extrAdz          = document.getElementById('extr-adz');
const extrFileNameEl   = document.getElementById('extr-file-name');
const extrAudioNameEl  = document.getElementById('extr-audio-name');
const extrAudioZone    = document.getElementById('extr-audio-zone');
const extrSubmitBtn    = document.getElementById('extr-submit-btn');
const extrProgress     = document.getElementById('extr-progress');
const extrStatusEl     = document.getElementById('extr-status');
const extrErrorEl      = document.getElementById('extr-error');
const extrResultCard   = document.getElementById('extr-result-card');
const extrResultVideo  = document.getElementById('extr-result-video');
const extrDownloadBtn  = document.getElementById('extr-download-btn');
const extrTransWrap    = document.getElementById('extr-transcript-wrap');
const extrTransText    = document.getElementById('extr-transcript-text');
const extrCopyBtn      = document.getElementById('extr-copy-btn');

let extrMode = 'video', extrVideoFile = null, extrAudioFile = null;

// Mode card selection
document.querySelectorAll('.extr-mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.extr-mode-card').forEach(c => c.classList.remove('em-active'));
    card.classList.add('em-active');
    extrMode = card.dataset.mode;
    if (extrAudioZone) extrAudioZone.classList.toggle('show', extrMode === 'merge');
    updateExtrSubmit();
  });
});

// File inputs
extrVideoInput.addEventListener('change', () => {
  if (!extrVideoInput.files[0]) return;
  extrVideoFile = extrVideoInput.files[0];
  const n = extrVideoFile.name;
  extrFileNameEl.textContent = '✓ ' + (n.length > 50 ? n.substring(0, 47) + '...' : n);
  extrDz.classList.add('has-file');
  updateExtrSubmit();
});
extrAudioInput.addEventListener('change', () => {
  if (!extrAudioInput.files[0]) return;
  extrAudioFile = extrAudioInput.files[0];
  const n = extrAudioFile.name;
  extrAudioNameEl.textContent = '✓ ' + (n.length > 50 ? n.substring(0, 47) + '...' : n);
  extrAdz.classList.add('has-file');
  updateExtrSubmit();
});

// Drag-drop for video zone
makeDrop('extr-dz', f => f.type.startsWith('video/'), f => {
  extrVideoFile = f;
  const n = f.name;
  extrFileNameEl.textContent = '✓ ' + (n.length > 50 ? n.substring(0, 47) + '...' : n);
  extrDz.classList.add('has-file');
  updateExtrSubmit();
});

// Drag-drop for audio zone (accepts audio or video files as audio source)
makeDrop('extr-adz', f => f.type.startsWith('audio/') || f.type.startsWith('video/'), f => {
  extrAudioFile = f;
  const n = f.name;
  extrAudioNameEl.textContent = '✓ ' + (n.length > 50 ? n.substring(0, 47) + '...' : n);
  extrAdz.classList.add('has-file');
  updateExtrSubmit();
});

function updateExtrSubmit() {
  if (!extrVideoFile) {
    extrSubmitBtn.disabled = true;
    extrSubmitBtn.textContent = 'Selecione um vídeo';
    return;
  }
  if (extrMode === 'merge' && !extrAudioFile) {
    extrSubmitBtn.disabled = true;
    extrSubmitBtn.textContent = 'Selecione o áudio também';
    return;
  }
  extrSubmitBtn.disabled = false;
  const labels = { video: '🎬 Extrair Vídeo Sem Áudio', transcribe: '📝 Transcrever Vídeo', merge: '🔗 Juntar Vídeo + Áudio' };
  extrSubmitBtn.textContent = labels[extrMode] || 'Processar';
}

// Submit
extrSubmitBtn.addEventListener('click', async () => {
  if (!extrVideoFile) return;
  if (extrMode === 'merge' && !extrAudioFile) return;

  extrSubmitBtn.disabled = true;
  extrSubmitBtn.textContent = '⏳ Processando...';
  extrProgress.style.display = 'block';
  extrErrorEl.style.display = 'none';
  extrResultCard.style.display = 'none';
  extrTransWrap.style.display = 'none';

  const statusMap = {
    video: 'Removendo áudio do vídeo...',
    transcribe: 'Extraindo áudio e transcrevendo — pode levar alguns instantes...',
    merge: 'Juntando vídeo com o novo áudio...'
  };
  extrStatusEl.textContent = statusMap[extrMode] || 'Processando...';

  const fd = new FormData();
  fd.append('video', extrVideoFile);
  if (extrMode === 'merge') fd.append('audio', extrAudioFile);

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
      extrResultVideo.src = url;
      extrDownloadBtn.href = url;
      extrDownloadBtn.download = json.url.split('/').pop();
      extrResultCard.style.display = 'block';
      extrResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    extrErrorEl.style.display = 'block';
    extrErrorEl.textContent = 'Erro: ' + err.message;
  } finally {
    extrSubmitBtn.disabled = false;
    extrProgress.style.display = 'none';
    extrStatusEl.textContent = '';
    updateExtrSubmit();
  }
});

// Copy transcript
if (extrCopyBtn) {
  extrCopyBtn.addEventListener('click', () => {
    const text = extrTransText.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      extrCopyBtn.textContent = '✓ Copiado!';
      setTimeout(() => { extrCopyBtn.textContent = '📋 Copiar texto'; }, 2000);
    }).catch(() => {
      // fallback for browsers without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      extrCopyBtn.textContent = '✓ Copiado!';
      setTimeout(() => { extrCopyBtn.textContent = '📋 Copiar texto'; }, 2000);
    });
  });
}

// Submit subtitle
subSubmitBtn.addEventListener('click', async () => {
  if (!subFile) return;
  const valid = subEntries.filter(e => e.text.trim());
  if (!valid.length) return;
  subSubmitBtn.disabled = true; subSubmitBtn.textContent = '⏳ Processando...';
  subProgressWrap.style.display = 'block';
  subStatusEl.textContent = 'Gerando arquivo de legendas...';
  subErrorEl.style.display = 'none'; subResultCard.style.display = 'none';
  const fd = new FormData();
  fd.append('video', subFile);
  fd.append('subs', JSON.stringify(valid.map(e => ({ start: e.start, end: e.end, text: e.text.trim() }))));
  fd.append('preset', subPreset);
  fd.append('position', subPosition);
  fd.append('fontsize', subFontSize ? subFontSize.value : '72');
  fd.append('wordbyword', subWordByWord ? '1' : '0');
  try {
    const resp = await fetch(API + '/api/subtitle', { method: 'POST', body: fd });
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

// ══════════════════════════════════════════════════════
// LEGENDAS AUTOMÁTICAS
// ══════════════════════════════════════════════════════
(function () {
  const capDz         = document.getElementById('cap-dz');
  const capInput      = document.getElementById('cap-video-input');
  const capFileName   = document.getElementById('cap-file-name');
  const capSubmitBtn  = document.getElementById('cap-submit-btn');
  const capProgress   = document.getElementById('cap-progress');
  const capStatus     = document.getElementById('cap-status');
  const capError      = document.getElementById('cap-error');
  const capResultCard = document.getElementById('cap-result-card');
  const capResultVid  = document.getElementById('cap-result-video');
  const capDownBtn    = document.getElementById('cap-download-btn');
  const capLang       = document.getElementById('cap-lang');
  const capModel      = document.getElementById('cap-model');
  const capFontSize   = document.getElementById('cap-font-size');
  const capFontColor  = document.getElementById('cap-font-color');
  const capFontsizeWrap  = document.getElementById('cap-fontsize-wrap');
  const capFontcolorWrap = document.getElementById('cap-fontcolor-wrap');

  if (!capDz) return;

  let capFile = null;
  let capMode = 'burn';

  document.querySelectorAll('.cap-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cap-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      capMode = btn.dataset.capmode;
      const showBurn = capMode === 'burn';
      if (capFontsizeWrap) capFontsizeWrap.style.display = showBurn ? '' : 'none';
      if (capFontcolorWrap) capFontcolorWrap.style.display = showBurn ? '' : 'none';
      updateCapSubmit();
    });
  });

  makeDrop(capDz, capInput, f => {
    capFile = f;
    capFileName.textContent = f.name;
    updateCapSubmit();
  });

  capInput.addEventListener('change', () => {
    if (capInput.files[0]) {
      capFile = capInput.files[0];
      capFileName.textContent = capFile.name;
      updateCapSubmit();
    }
  });

  function updateCapSubmit() {
    if (!capFile) { capSubmitBtn.disabled = true; capSubmitBtn.textContent = 'Selecione um vídeo'; return; }
    capSubmitBtn.disabled = false;
    capSubmitBtn.textContent = capMode === 'burn' ? '💬 Gerar Vídeo com Legendas' : '📄 Baixar SRT';
  }

  capSubmitBtn.addEventListener('click', async () => {
    if (!capFile) return;
    capSubmitBtn.disabled = true;
    capError.style.display = 'none';
    capResultCard.style.display = 'none';
    capProgress.style.display = 'block';
    capStatus.textContent = '⏳ Transcrevendo com IA local… pode levar alguns minutos';

    const fd = new FormData();
    fd.append('video', capFile);
    fd.append('mode', capMode);
    fd.append('lang', capLang.value);
    fd.append('model', capModel.value);
    fd.append('fontSize', capFontSize ? capFontSize.value : 18);
    fd.append('fontColor', capFontColor ? capFontColor.value : 'white');

    try {
      const resp = await fetch(API + '/api/caption', { method: 'POST', body: fd });

      if (capMode === 'srt') {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || 'HTTP ' + resp.status);
        }
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'legendas.srt'; a.click();
        URL.revokeObjectURL(url);
        capStatus.textContent = '✅ SRT baixado!';
      } else {
        const json = await resp.json();
        if (!resp.ok || json.error) throw new Error(json.error || 'HTTP ' + resp.status);
        capResultVid.src = API + json.url;
        capDownBtn.href = API + json.url;
        capDownBtn.download = json.url.split('/').pop();
        capResultCard.style.display = 'block';
        capResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        capStatus.textContent = '✅ Pronto!';
      }
    } catch (err) {
      capError.style.display = 'block';
      capError.textContent = 'Erro: ' + err.message;
    } finally {
      capSubmitBtn.disabled = false;
      updateCapSubmit();
      setTimeout(() => { capProgress.style.display = 'none'; }, 2000);
    }
  });
})();
