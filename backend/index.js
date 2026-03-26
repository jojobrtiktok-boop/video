require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const https = require('https');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

fs.readdirSync(UPLOAD_DIR).forEach(f => {
  try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (_) {}
});
console.log('uploads/ limpo no boot');

function scheduleDelete(filePath, delayMs) {
  setTimeout(() => {
    fs.unlink(filePath, err => {
      if (!err) console.log('Auto-deletado:', path.basename(filePath));
    });
  }, delayMs);
}

const app = express();

const FFMPEG  = process.env.FFMPEG_BIN  || (process.platform === 'win32' ? 'Z:\\ffmpeg\\bin\\ffmpeg.exe'  : 'ffmpeg');
const FFPROBE = process.env.FFPROBE_BIN || (process.platform === 'win32' ? 'Z:\\ffmpeg\\bin\\ffprobe.exe' : 'ffprobe');
const PYTHON  = process.env.PYTHON_BIN  || (process.platform === 'win32' ? 'python' : 'python3');

// ── JOBS ASSÍNCRONOS (delogo/sora) ─────────────────────────────────────────
const processJobs = {};

function spawnJob(jobId, args, input, output, expiry, libEntry) {
  const [cmd, ...cmdArgs] = args;
  const proc = spawn(cmd, cmdArgs);
  let stdoutBuf = '';
  proc.stdout.on('data', chunk => {
    stdoutBuf += chunk.toString();
    const m = stdoutBuf.match(/PROGRESS:(\d+)/g);
    if (m) {
      const pct = parseInt(m[m.length - 1].split(':')[1]);
      processJobs[jobId].progress = pct;
      const li = videoLibrary.find(i => i.id === jobId);
      if (li) li.progress = pct;
    }
  });
  proc.on('close', code => {
    fs.unlink(input, () => {});
    const li = videoLibrary.find(i => i.id === jobId);
    if (code !== 0) {
      processJobs[jobId].status = 'error';
      processJobs[jobId].error  = 'Processamento falhou (código ' + code + ')';
      if (li) { li.status = 'error'; li.progress = 0; }
    } else {
      scheduleDelete(output, expiry - Date.now());
      processJobs[jobId].status   = 'done';
      processJobs[jobId].progress = 100;
      processJobs[jobId].url      = `/uploads/${path.basename(output)}`;
      if (li) { li.status = 'done'; li.progress = 100; li.url = processJobs[jobId].url; }
    }
  });
}

// ── BIBLIOTECA GERAL DE VÍDEOS ─────────────────────────────────────────────
const videoLibrary = [];
function addToLibrary(entry) {
  videoLibrary.push(entry);
  // Mantém só os últimos 100 itens
  if (videoLibrary.length > 100) videoLibrary.splice(0, videoLibrary.length - 100);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, Date.now() + '-' + base + ext);
  }
});
const upload = multer({ storage });
const uploadFields = multer({ storage }).fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 1 }]);
const multiUpload = multer({ storage }).fields([{ name: 'hooks', maxCount: 20 }, { name: 'bodies', maxCount: 20 }]);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── PROCESS: blur / delogo ────────────────────────────────────────────────────
app.post('/api/process', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const mode = req.body.mode || 'blur';
  const input = req.file.path;
  const outputName = 'processed-' + path.basename(input);
  const output = path.join(UPLOAD_DIR, outputName);

  if (mode === 'sora') {
    const jobId  = Date.now().toString() + Math.random().toString(36).slice(2);
    const expiry = Date.now() + 60 * 60 * 1000;
    processJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, expiresAt: expiry };
    const libEntry = { id: jobId, type: 'watermark', label: '🎵 Sora', url: null, status: 'processing', progress: 0, createdAt: Date.now(), expiresAt: expiry };
    addToLibrary(libEntry);
    res.json({ id: jobId, status: 'processing' });
    const soraScript = path.join(__dirname, 'remove_sora_watermark.py');
    spawnJob(jobId, [PYTHON, soraScript, input, output, FFMPEG], input, output, expiry, libEntry);
    return;
  }

  if (mode === 'heygen') {
    // HeyGen: watermark ESTÁTICA — delogo no canto inferior direito
    const probeCmd = `"${FFPROBE}" -v quiet -print_format json -show_streams "${input}"`;
    exec(probeCmd, (probeErr, probeOut) => {
      let vw = 1080, vh = 1920;
      if (!probeErr) {
        try {
          const info = JSON.parse(probeOut);
          const vs = info.streams.find(s => s.codec_type === 'video');
          if (vs) { vw = vs.width; vh = vs.height; }
        } catch (_) {}
      }
      function clampDelogo(x, y, w, h) {
        const M = 3;
        x = Math.max(M, x);
        y = Math.max(M, y);
        if (x + w >= vw - M) w = vw - M - x;
        if (y + h >= vh - M) h = vh - M - y;
        return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
      }
      const h0 = Math.round(vh * 0.13);
      const w0 = Math.round(vw * 0.38);
      const { x, y, w, h } = clampDelogo(vw - w0, vh - h0, w0, h0);
      const c = `"${FFMPEG}" -y -i "${input}" -vf "delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0" -c:a copy "${output}"`;
      exec(c, (err, stdout, stderr) => {
        fs.unlink(input, () => {});
        if (err) return res.status(500).json({ error: String(err), stderr });
        const expiry = Date.now() + 60 * 60 * 1000;
        scheduleDelete(output, expiry - Date.now());
        const libEntry = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          type: 'watermark', label: '🤖 HeyGen',
          url: `/uploads/${path.basename(output)}`,
          createdAt: Date.now(), expiresAt: expiry
        };
        addToLibrary(libEntry);
        return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id });
      });
    });
    return;
  }

  if (mode === 'blur') {
    const x  = parseInt(req.body.x) || 0;
    const y  = parseInt(req.body.y) || -1;
    const w  = parseInt(req.body.w) || 0;
    const h  = parseInt(req.body.h) || 60;
    const cw = w > 0 ? w : 'iw';
    const cy = y >= 0 ? y : `ih-${h}`;
    const oy = y >= 0 ? y : `main_h-${h}`;
    const cwNum = w > 0 ? w : null; // numeric for geq, null if full width

    // Feathered blur using filter_complex_script to avoid shell escaping issues
    // geq uses built-in W,H variables for the cropped region dimensions
    const FEATHER = 20;
    const filterScript = [
      `[0:v]split[bg][tmp];`,
      `[tmp]crop=${cw}:${h}:${x}:${cy},gblur=sigma=25[blurred];`,
      `[blurred]format=rgba,`,
      `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':`,
      `a='255*min(min(min(X+1,W-X),${FEATHER})/${FEATHER},min(min(Y+1,H-Y),${FEATHER})/${FEATHER})'`,
      `[faded];`,
      `[bg][faded]overlay=${x}:${oy}`
    ].join('');

    const filterFile = input + '.filter';
    fs.writeFileSync(filterFile, filterScript, 'utf8');
    const cmd = `"${FFMPEG}" -y -i "${input}" -filter_complex_script "${filterFile}" -c:a copy "${output}"`;
    exec(cmd, (err, stdout, stderr) => {
      fs.unlink(input, () => {});
      fs.unlink(filterFile, () => {});
      if (err) return res.status(500).json({ error: String(err), stderr });
      scheduleDelete(output, 30 * 60 * 1000);
      const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'watermark', label: '🌫️ Blur', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000 };
      addToLibrary(libEntry);
      return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id });
    });
    return;
  }

  if (mode === 'simple') {
    const M = 3;
    let x = Math.max(M, parseInt(req.body.x) || 0);
    let y = Math.max(M, parseInt(req.body.y) || 0);
    let w = parseInt(req.body.w) || 100;
    let h = parseInt(req.body.h) || 60;
    // Precisamos do tamanho real do vídeo para o clamp direito
    exec(`"${FFPROBE}" -v quiet -print_format json -show_streams "${input}"`, (pe, po) => {
      let vw = 9999, vh = 9999;
      if (!pe) { try { const vs = JSON.parse(po).streams.find(s => s.codec_type === 'video'); if (vs) { vw = vs.width; vh = vs.height; } } catch(_){} }
      if (x + w >= vw - M) w = vw - M - x;
      if (y + h >= vh - M) h = vh - M - y;
      w = Math.max(1, w); h = Math.max(1, h);
      const cmd = `"${FFMPEG}" -y -i "${input}" -vf "delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0" -c:a copy "${output}"`;
      exec(cmd, (err, stdout, stderr) => {
        fs.unlink(input, () => {});
        if (err) return res.status(500).json({ error: String(err), stderr });
        scheduleDelete(output, 30 * 60 * 1000);
        const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'watermark', label: '⚡ Remoção Simples', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000 };
        addToLibrary(libEntry);
        return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id });
      });
    });
    return;
  }
  if (mode === 'delogo') {
    const x = parseInt(req.body.x) || 0;
    const y = parseInt(req.body.y) || 0;
    const w = parseInt(req.body.w) || 100;
    const h = parseInt(req.body.h) || 60;
    const jobId  = Date.now().toString() + Math.random().toString(36).slice(2);
    const expiry = Date.now() + 30 * 60 * 1000;
    processJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, expiresAt: expiry };
    const libEntry = { id: jobId, type: 'watermark', label: '✨ Remoção Limpa', url: null, status: 'processing', progress: 0, createdAt: Date.now(), expiresAt: expiry };
    addToLibrary(libEntry);
    res.json({ id: jobId, status: 'processing' });
    const scriptPath = path.join(__dirname, 'inpaint_video.py');
    spawnJob(jobId, [PYTHON, scriptPath, input, output, String(x), String(y), String(w), String(h), FFMPEG], input, output, expiry, libEntry);
    return;
  }

  if (mode === 'ai') {
    fs.copyFileSync(input, output);
    fs.unlink(input, () => {});
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${path.basename(output)}`, note: 'AI mode placeholder' });
  }

  return res.status(400).json({ error: 'unknown mode' });
});
// Progresso lipsync: { [id]: { status, progress, url, error, expiresAt } }
const lipsyncProgress = {};

// ── LIPSYNC via Wav2Lip ───────────────────────────────────────────────────────
app.post('/api/lipsync', uploadFields, (req, res) => {
  const videoFile = req.files && req.files.video && req.files.video[0];
  const audioFile = req.files && req.files.audio && req.files.audio[0];
  if (!videoFile || !audioFile) {
    if (videoFile) fs.unlink(videoFile.path, () => {});
    if (audioFile) fs.unlink(audioFile.path, () => {});
    return res.status(400).json({ error: 'Envie o video e o audio.' });
  }

  const lipsyncId = Date.now().toString() + Math.floor(Math.random()*10000).toString();
  const outputName = 'lipsync-' + lipsyncId + '.mp4';
  const output     = path.join(UPLOAD_DIR, outputName);
  const python     = PYTHON;
  const runner     = path.join(__dirname, 'wav2lip_runner.py');

  // Inicializa progresso
  lipsyncProgress[lipsyncId] = {
    status: 'processing',
    progress: 0,
    url: null,
    error: null,
    expiresAt: null
  };

  // Simula progresso incremental (mock, pois wav2lip_runner.py não reporta progresso real)
  let fakeProgress = 0;
  const fakeInterval = setInterval(() => {
    if (lipsyncProgress[lipsyncId] && lipsyncProgress[lipsyncId].status === 'processing') {
      fakeProgress = Math.min(95, fakeProgress + Math.floor(Math.random()*7)+2);
      lipsyncProgress[lipsyncId].progress = fakeProgress;
    } else {
      clearInterval(fakeInterval);
    }
  }, 1200);

  const cmd = `"${python}" "${runner}" "${videoFile.path}" "${audioFile.path}" "${output}"`;

  exec(cmd, { timeout: 15 * 60 * 1000 }, (err, stdout, stderr) => {
    fs.unlink(videoFile.path, () => {});
    fs.unlink(audioFile.path, () => {});
    clearInterval(fakeInterval);
    if (err) {
      lipsyncProgress[lipsyncId].status = 'error';
      lipsyncProgress[lipsyncId].error = 'Wav2Lip falhou: ' + (stderr || err.message);
      return res.status(500).json({ error: lipsyncProgress[lipsyncId].error, id: lipsyncId });
    }
    if (!fs.existsSync(output)) {
      lipsyncProgress[lipsyncId].status = 'error';
      lipsyncProgress[lipsyncId].error = 'Video nao gerado. ' + stderr;
      return res.status(500).json({ error: lipsyncProgress[lipsyncId].error, id: lipsyncId });
    }
    scheduleDelete(output, 60 * 60 * 1000);
    lipsyncProgress[lipsyncId].status = 'done';
    lipsyncProgress[lipsyncId].progress = 100;
    lipsyncProgress[lipsyncId].url = `/uploads/${outputName}`;
    lipsyncProgress[lipsyncId].expiresAt = Date.now() + 60*60*1000;
    addToLibrary({
      id: lipsyncId,
      type: 'lipsync',
      label: '💋 Lipsync',
      url: `/uploads/${outputName}`,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60*60*1000
    });
    return res.json({ url: `/uploads/${outputName}`, id: lipsyncId });
  });
});

// Endpoint para consultar progresso/status
app.get('/api/lipsync-status/:id', (req, res) => {
  const id = req.params.id;
  const prog = lipsyncProgress[id];
  if (!prog) return res.status(404).json({ error: 'ID não encontrado' });
  // Se expirou, remove do objeto
  if (prog.expiresAt && Date.now() > prog.expiresAt) {
    delete lipsyncProgress[id];
    return res.status(404).json({ error: 'Expirado' });
  }
  res.json(prog);
});

// Endpoint para listar TODOS os vídeos gerados (biblioteca geral)
app.get('/api/process-status/:id', (req, res) => {
  const job = processJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json({ id: req.params.id, ...job });
});

app.get('/api/video-library', (req, res) => {
  const now = Date.now();
  const items = videoLibrary
    .filter(item => !item.expiresAt || item.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ items });
});

// Endpoint para listar todos os vídeos lipsync gerados (para biblioteca)
app.get('/api/lipsync-library', (req, res) => {
  const now = Date.now();
  const list = Object.entries(lipsyncProgress)
    .filter(([id, job]) => !job.expiresAt || job.expiresAt > now)
    .map(([id, job]) => ({
      id,
      status: job.status,
      progress: job.progress,
      url: job.url,
      error: job.error,
      expiresAt: job.expiresAt
    }));
  res.json({ items: list });
});

// ── SUBTITLE: burns ASS subtitles into video ─────────────────────────────────
app.post('/api/subtitle', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  let subs;
  try { subs = JSON.parse(req.body.subs || '[]'); } catch (_) { return res.status(400).json({ error: 'subs invalido' }); }
  if (!subs.length) return res.status(400).json({ error: 'nenhuma legenda enviada' });

  const preset     = req.body.preset   || 'classico';
  const fontSize   = Math.max(24, Math.min(120, parseInt(req.body.fontsize) || 72));
  const wordByWord = req.body.wordbyword === '1';
  // Custom position via \pos(x,y) — posX/posY in 1920x1080 space
  const posX = parseInt(req.body.posX) || null;
  const posY = parseInt(req.body.posY) || null;
  const align = posX !== null ? 5 : (req.body.position === 'top' ? 8 : 2);

  const STYLES = {
    classico: `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,${align},10,10,50,1`,
    amarelo:  `Style: Default,Arial,${fontSize},&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,${align},10,10,50,1`,
    caixa:    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,10,0,${align},20,20,50,1`,
    neon:     `Style: Default,Arial,${fontSize},&H0041FF00,&H0041FF00,&H00003200,&H00000000,-1,0,0,0,100,100,0,0,1,2,4,${align},10,10,50,1`,
    capcut:   `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
  };

  function timeStrToSecs(t) {
    const parts = String(t).trim().split(':').map(s => parseFloat(s) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
  function secsToAssTime(totalSecs) {
    const h  = Math.floor(totalSecs / 3600);
    const m  = Math.floor((totalSecs % 3600) / 60);
    const s  = totalSecs % 60;
    const cs = Math.round((s % 1) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(Math.floor(s)).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }
  function toAssTime(t) { return secsToAssTime(timeStrToSecs(t)); }

  let finalSubs = subs;
  if (wordByWord) {
    finalSubs = [];
    subs.forEach(sub => {
      const words = String(sub.text).trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const startS = timeStrToSecs(sub.start);
      const endS   = timeStrToSecs(sub.end);
      const dur    = Math.max(0.1, endS - startS);
      const perW   = dur / words.length;
      words.forEach((word, i) => {
        finalSubs.push({
          start: secsToAssTime(startS + i * perW),
          end:   secsToAssTime(startS + (i + 1) * perW),
          text:  word
        });
      });
    });
  }

  const styleStr = STYLES[preset] || STYLES.classico;
  const posTag = (posX !== null && posY !== null) ? `{\\pos(${posX},${posY})}` : '';
  const dialogues = finalSubs.map(sub =>
    `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${posTag}${String(sub.text).replace(/\n/g, '\\N').replace(/,/g, '{\\,}')}`
  ).join('\n');

  const assContent = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleStr,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    dialogues,
    ''
  ].join('\n');

  const input     = req.file.path;
  const assPath   = input + '.ass';
  const outputName = 'sub-' + path.basename(input);
  const output    = path.join(UPLOAD_DIR, outputName);

  fs.writeFileSync(assPath, assContent, 'utf8');
  const assEsc = assPath.replace(/\\/g, '/').replace(':', '\\:');
  const cmd = `"${FFMPEG}" -y -i "${input}" -vf "ass='${assEsc}'" -c:a copy "${output}"`;

  exec(cmd, (err, _stdout, stderr) => {
    fs.unlink(input, () => {});
    fs.unlink(assPath, () => {});
    if (err) return res.status(500).json({ error: String(err), stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'subtitle', label: '💬 Legenda', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000 };
    addToLibrary(libEntry);
    return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id });
  });
});

// ── SUBTITLE AUTO: transcribe + burn with style ───────────────────────────────
app.post('/api/subtitle/auto', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const input    = req.file.path;
  const lang     = req.body.lang    || 'pt';
  const model    = req.body.model   || 'small';
  const preset   = req.body.preset  || 'classico';
  const fontSize = Math.max(24, Math.min(120, parseInt(req.body.fontsize) || 72));
  const wordByWord = req.body.wordbyword === '1';
  const posX     = parseInt(req.body.posX) || null;
  const posY     = parseInt(req.body.posY) || null;
  const align    = posX !== null ? 5 : 2;

  const python = PYTHON;
  const script = path.join(__dirname, 'transcribe.py');
  const transcribeCmd = `"${python}" "${script}" "${input}" "${model}" "${lang}"`;

  exec(transcribeCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err) {
      fs.unlink(input, () => {});
      return res.status(500).json({ error: 'Transcricao falhou: ' + (stderr || err.message) });
    }
    const srtContent = stdout.trim();
    if (!srtContent) {
      fs.unlink(input, () => {});
      return res.status(500).json({ error: 'Nenhuma fala detectada no video.' });
    }

    // Parse SRT into segments
    const segments = [];
    const blocks = srtContent.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      const timeLine = lines[1];
      const match = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
      if (!match) continue;
      const text = lines.slice(2).join(' ').trim();
      if (!text) continue;
      segments.push({ start: match[1].replace(',', '.'), end: match[2].replace(',', '.'), text });
    }

    if (!segments.length) {
      fs.unlink(input, () => {});
      return res.status(500).json({ error: 'Nenhuma fala detectada.' });
    }

    // Forward to /api/subtitle logic inline
    const STYLES = {
      classico: `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,${align},10,10,50,1`,
      amarelo:  `Style: Default,Arial,${fontSize},&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,${align},10,10,50,1`,
      caixa:    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,10,0,${align},20,20,50,1`,
      neon:     `Style: Default,Arial,${fontSize},&H0041FF00,&H0041FF00,&H00003200,&H00000000,-1,0,0,0,100,100,0,0,1,2,4,${align},10,10,50,1`,
      capcut:   `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
    };

    function timeStrToSecs(t) {
      const parts = String(t).replace(',', '.').trim().split(':').map(s => parseFloat(s) || 0);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return 0;
    }
    function secsToAssTime(totalSecs) {
      const h  = Math.floor(totalSecs / 3600);
      const m  = Math.floor((totalSecs % 3600) / 60);
      const s  = totalSecs % 60;
      const cs = Math.round((s % 1) * 100);
      return `${h}:${String(m).padStart(2,'0')}:${String(Math.floor(s)).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    }
    function toAssTime(t) { return secsToAssTime(timeStrToSecs(t)); }

    let finalSubs = segments;
    if (wordByWord) {
      finalSubs = [];
      segments.forEach(sub => {
        const words = String(sub.text).trim().split(/\s+/).filter(Boolean);
        if (!words.length) return;
        const startS = timeStrToSecs(sub.start);
        const endS   = timeStrToSecs(sub.end);
        const dur    = Math.max(0.1, endS - startS);
        const perW   = dur / words.length;
        words.forEach((word, i) => {
          finalSubs.push({
            start: secsToAssTime(startS + i * perW),
            end:   secsToAssTime(startS + (i + 1) * perW),
            text:  word
          });
        });
      });
    }

    const styleStr = STYLES[preset] || STYLES.classico;
    const posTag = (posX !== null && posY !== null) ? `{\\pos(${posX},${posY})}` : '';
    const dialogues = finalSubs.map(sub =>
      `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${posTag}${String(sub.text).replace(/\n/g, '\\N').replace(/,/g, '{\\,}')}`
    ).join('\n');

    const assContent = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      styleStr, '', '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      dialogues, ''
    ].join('\n');

    const assPath    = input + '.ass';
    const outputName = 'autosub-' + path.basename(input);
    const output     = path.join(UPLOAD_DIR, outputName);

    fs.writeFileSync(assPath, assContent, 'utf8');
    const assEsc = assPath.replace(/\\/g, '/').replace(':', '\\:');
    const cmd = `"${FFMPEG}" -y -i "${input}" -vf "ass='${assEsc}'" -c:a copy "${output}"`;

    exec(cmd, { timeout: 10 * 60 * 1000 }, (burnErr, _stdout, burnStderr) => {
      fs.unlink(input, () => {});
      fs.unlink(assPath, () => {});
      if (burnErr) return res.status(500).json({ error: 'ffmpeg falhou: ' + burnStderr });
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${path.basename(output)}` });
    });
  });
});

// ── CREATIVE COMBINER ─────────────────────────────────────────────────────────
app.post('/api/combine/stage', multiUpload, (req, res) => {
  const hookF = (req.files && req.files.hooks)  || [];
  const bodyF = (req.files && req.files.bodies) || [];
  if (!hookF.length || !bodyF.length) {
    [...hookF, ...bodyF].forEach(f => fs.unlink(f.path, () => {}));
    return res.status(400).json({ error: 'Envie pelo menos 1 hook e 1 corpo.' });
  }
  [...hookF, ...bodyF].forEach(f => scheduleDelete(f.path, 2 * 60 * 60 * 1000));
  return res.json({
    hookIds:   hookF.map(f => path.basename(f.path)),
    hookNames: hookF.map(f => f.originalname),
    bodyIds:   bodyF.map(f => path.basename(f.path)),
    bodyNames: bodyF.map(f => f.originalname),
  });
});

app.post('/api/concat/run', (req, res) => {
  const { hookId, bodyId } = req.body || {};
  const safeRe = /^[\w.\-]+$/;
  if (!hookId || !bodyId || !safeRe.test(hookId) || !safeRe.test(bodyId))
    return res.status(400).json({ error: 'IDs invalidos.' });

  const hookPath = path.join(UPLOAD_DIR, hookId);
  const bodyPath = path.join(UPLOAD_DIR, bodyId);
  if (!fs.existsSync(hookPath) || !fs.existsSync(bodyPath))
    return res.status(404).json({ error: 'Arquivo nao encontrado. Faca o upload novamente.' });

  const outputName = 'combo-' + Date.now() + '.mp4';
  const output = path.join(UPLOAD_DIR, outputName);
  const scale = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,setpts=PTS-STARTPTS';
  const filterAV = `[0:v]${scale}[v0];[1:v]${scale}[v1];[0:a]aresample=44100[a0];[1:a]aresample=44100[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
  const cmdAV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterAV}" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -crf 23 -c:a aac "${output}"`;

  exec(cmdAV, (err) => {
    if (!err) {
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${outputName}` });
    }
    const filterV = `[0:v]${scale}[v0];[1:v]${scale}[v1];[v0][v1]concat=n=2:v=1:a=0[outv]`;
    const cmdV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterV}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -an "${output}"`;
    exec(cmdV, (err2, _out, stderr2) => {
      if (err2) return res.status(500).json({ error: String(err2), stderr: stderr2 });
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${outputName}` });
    });
  });
});

// ── EXTRAIR ───────────────────────────────────────────────────────────────────
app.post('/api/extract/video', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  const input = req.file.path;
  const outputName = 'video-' + Date.now() + '.mp4';
  const output = path.join(UPLOAD_DIR, outputName);
  const cmd = `"${FFMPEG}" -y -i "${input}" -an -c:v copy "${output}"`;
  exec(cmd, (err, _out, stderr) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: String(err), stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${outputName}` });
  });
});

const extractMergeUpload = multer({ storage }).fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);
app.post('/api/extract/merge', extractMergeUpload, (req, res) => {
  const videoFile = req.files && req.files.video && req.files.video[0];
  const audioFile = req.files && req.files.audio && req.files.audio[0];
  if (!videoFile || !audioFile) {
    if (videoFile) fs.unlink(videoFile.path, () => {});
    if (audioFile) fs.unlink(audioFile.path, () => {});
    return res.status(400).json({ error: 'Envie o video e o audio.' });
  }
  const outputName = 'merged-' + Date.now() + '.mp4';
  const output = path.join(UPLOAD_DIR, outputName);
  const cmd = `"${FFMPEG}" -y -i "${videoFile.path}" -i "${audioFile.path}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${output}"`;
  exec(cmd, (err, _out, stderr) => {
    fs.unlink(videoFile.path, () => {});
    fs.unlink(audioFile.path, () => {});
    if (err) return res.status(500).json({ error: String(err), stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${outputName}` });
  });
});

// Transcrever via faster-whisper local (sem OpenAI API)
app.post('/api/extract/transcribe', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  const input  = req.file.path;
  const lang   = req.body.lang  || 'pt';
  const model  = req.body.model || 'small';
  const python = PYTHON;
  const script = path.join(__dirname, 'transcribe.py');
  const transcribeCmd = `"${python}" "${script}" "${input}" "${model}" "${lang}"`;
  exec(transcribeCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: 'Transcricao falhou: ' + (stderr || err.message) });
    const srtContent = stdout.trim();
    if (!srtContent) return res.status(500).json({ error: 'Nenhuma fala detectada no video.' });
    const text = srtContent
      .split('\n')
      .filter(l => l.trim() && !/^\d+$/.test(l.trim()) && !/^\d{2}:\d{2}/.test(l.trim()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return res.json({ text, srt: srtContent });
  });
});

// ── EXTRAIR ÁUDIO ─────────────────────────────────────────────────────────────
app.post('/api/extract/audio', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  const input      = req.file.path;
  const outputName = 'audio-' + Date.now() + '.mp3';
  const output     = path.join(UPLOAD_DIR, outputName);
  const cmd = `"${FFMPEG}" -y -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}"`;
  exec(cmd, (err, _out, stderr) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: String(err), stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${outputName}`, type: 'audio' });
  });
});

// ── TRADUZIR IMAGEM via Gemini Vision ─────────────────────────────────────────
const imgUpload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
app.post('/api/translate-image', imgUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
  const { targetLang, apiKey } = req.body || {};
  if (!apiKey) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: 'Informe a API Key do Google AI Studio.' }); }

  const langNames = { pt: 'Português', en: 'Inglês', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano', ja: 'Japonês', ko: 'Coreano', zh: 'Chinês' };
  const lang = langNames[targetLang] || targetLang || 'Português';

  let imageBase64, mimeType;
  try {
    imageBase64 = fs.readFileSync(req.file.path).toString('base64');
    mimeType    = req.file.mimetype || 'image/jpeg';
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao ler imagem.' });
  } finally {
    fs.unlink(req.file.path, () => {});
  }

  const prompt = `Analise esta imagem e encontre TODO o texto visível nela.
Traduza cada trecho de texto para ${lang}.
Responda em formato organizado:

**Texto encontrado e traduzido para ${lang}:**
[liste cada texto original → tradução, um por linha]

Se houver vários blocos de texto separados, numere-os.
Se não houver texto legível, escreva: "Nenhum texto encontrado na imagem."`;

  const body = JSON.stringify({
    contents: [{ parts: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: prompt }
    ]}]
  });

  const model  = 'gemini-2.0-flash';
  const apiUrl = `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: apiUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  const apiReq = https.request(options, apiRes => {
    let raw = '';
    apiRes.on('data', c => raw += c);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(raw);
        if (json.error) return res.status(400).json({ error: json.error.message });
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.json({ translation: text });
      } catch (e) {
        return res.status(500).json({ error: 'Resposta inválida do Gemini.' });
      }
    });
  });
  apiReq.on('error', e => res.status(500).json({ error: e.message }));
  apiReq.write(body);
  apiReq.end();
});

// ── GENERATE VIDEO via OpenRouter Alpha ───────────────────────────────────────
app.post('/api/generate-video', express.json(), async (req, res) => {
  const { prompt, videoModel, duration, apiKey } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt e obrigatorio.' });
  if (!apiKey)  return res.status(400).json({ error: 'Informe sua API key da OpenRouter.' });

  function orRequest(method, alphaPath, body) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://videoforge.app',
        'X-Title': 'VideoForge'
      };
      if (data) headers['Content-Length'] = Buffer.byteLength(data);
      const req2 = https.request({
        hostname: 'openrouter.ai',
        path: `/api/alpha${alphaPath}`,
        method,
        headers
      }, resp => {
        let raw = '';
        resp.on('data', c => { raw += c; });
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ status: resp.statusCode, body: { raw } }); }
        });
      });
      req2.on('error', reject);
      if (data) req2.write(data);
      req2.end();
    });
  }

  function orDownload(url, hops = 0) {
    if (hops > 5) return Promise.reject(new Error('Too many redirects downloading video'));
    return new Promise((resolve, reject) => {
      const parsedUrl = url.startsWith('http') ? new URL(url) : new URL(`https://openrouter.ai/api/alpha${url}`);
      const lib = parsedUrl.protocol === 'https:' ? https : require('http');
      lib.get({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'Authorization': `Bearer ${apiKey}` }
      }, resp => {
        if (resp.statusCode === 301 || resp.statusCode === 302 || resp.statusCode === 307 || resp.statusCode === 308) {
          return orDownload(resp.headers.location, hops + 1).then(resolve).catch(reject);
        }
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => resolve({ status: resp.statusCode, buffer: Buffer.concat(chunks) }));
      }).on('error', reject);
    });
  }

  try {
    const selectedVideoModel = videoModel || 'google/veo-3.1';
    const videoDuration = Math.max(4, Math.min(60, parseInt(duration) || 8));

    // 1) Submit generation job
    const submitResp = await orRequest('POST', '/videos', {
      model: selectedVideoModel,
      prompt,
      duration: videoDuration
    });

    if (submitResp.status !== 200 && submitResp.status !== 202) {
      return res.status(500).json({
        error: 'Falha ao iniciar geracao: ' + (submitResp.body.error?.message || JSON.stringify(submitResp.body))
      });
    }

    const jobId = submitResp.body.id;
    if (!jobId) {
      return res.status(500).json({ error: 'API nao retornou job ID.', raw: submitResp.body });
    }

    // 2) Poll until completed (max 5 min)
    const maxWait = 300000;
    const poll = 6000;
    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, poll));
      const statusResp = await orRequest('GET', `/videos/${jobId}`, null);
      // 4xx = erro real; 202/200/outros = ainda processando
      if (statusResp.status >= 400) {
        return res.status(500).json({ error: 'Erro ao verificar status: HTTP ' + statusResp.status, raw: statusResp.body });
      }
      // Se corpo vazio ou sem status, aguarda próxima iteração
      if (!statusResp.body || !statusResp.body.status) continue;
      const { status } = statusResp.body;
      if (status === 'failed' || status === 'error') {
        return res.status(500).json({ error: 'Geracao falhou: ' + (statusResp.body.error || status) });
      }
      if (status === 'completed' || status === 'complete') {
        // 3) Download video and serve locally
        const dl = await orDownload(`/videos/${jobId}/content?index=0`);  // follows redirects
        if (dl.status !== 200 || !dl.buffer.length) {
          return res.status(500).json({ error: 'Nao foi possivel baixar o video gerado.' });
        }
        const outName = `vg-${jobId}.mp4`;
        const outPath = path.join(UPLOAD_DIR, outName);
        fs.writeFileSync(outPath, dl.buffer);
        scheduleDelete(outPath, 3600000); // delete after 1h
        return res.json({ url: `/uploads/${outName}` });
      }
      // still processing — continue polling
    }

    return res.status(504).json({ error: 'Tempo limite atingido (5 min). Tente um prompt mais curto ou menor duracao.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro: ' + err.message });
  }
});

// ─── IMAGE GENERATION ────────────────────────────────────────────────────────
app.post('/api/generate-image', express.json({ limit: '25mb' }), async (req, res) => {
  const { prompt, imageModel, apiKey } = req.body || {};
  if (!prompt)  return res.status(400).json({ error: 'Prompt obrigatório.' });
  if (!apiKey)  return res.status(400).json({ error: 'Informe sua API Key do Google AI Studio.' });

  try {
    const model = imageModel || 'imagen-3.0-generate-001';
    const path  = `/v1beta/models/${model}:predict?key=${encodeURIComponent(apiKey)}`;
    const payload = JSON.stringify({
      instances:  [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1' }
    });

    const gResult = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, resp => {
        let raw = '';
        resp.on('data', c => raw += c);
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(raw) }); }
          catch(_) { resolve({ status: resp.statusCode, body: { raw } }); }
        });
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    if (gResult.status >= 400) {
      const msg = gResult.body?.error?.message || JSON.stringify(gResult.body).slice(0, 300);
      return res.status(500).json({ error: 'Erro Google AI: ' + msg });
    }

    const pred = gResult.body?.predictions?.[0];
    if (!pred?.bytesBase64Encoded) return res.status(500).json({ error: 'Não foi possível gerar a imagem.', raw: gResult.body });
    const imageUrl = `data:${pred.mimeType || 'image/png'};base64,${pred.bytesBase64Encoded}`;
    return res.json({ url: imageUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar imagem: ' + (err.message || err) });
  }
});

// ── CORTAR VÍDEO ───────────────────────────────────────────────────────────
app.post('/api/trim', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input  = req.file.path;
  const start  = req.body.start || '0:00:00';
  const end    = req.body.end   || '0:00:10';
  const output = path.join(UPLOAD_DIR, `trim_${Date.now()}.mp4`);
  const EXPIRY = 3600000;
  const cmd = `"${FFMPEG}" -y -i "${input}" -ss ${start} -to ${end} -c copy "${output}"`;
  exec(cmd, (err, _so, se) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: se || err.message });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

// ── REDIMENSIONAR ──────────────────────────────────────────────────────────
app.post('/api/resize', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const w = parseInt(req.body.w) || 1080;
  const h = parseInt(req.body.h) || 1920;
  const pad = req.body.pad || 'black';
  const mode = req.body.mode || 'fit';
  const cropXn = Math.max(0, Math.min(1, parseFloat(req.body.cropX) || 0));
  const cropYn = Math.max(0, Math.min(1, parseFloat(req.body.cropY) || 0));
  const output = path.join(UPLOAD_DIR, `resize_${Date.now()}.mp4`);
  const EXPIRY = 3600000;

  let vf;
  if (mode === 'crop') {
    // Scale to fill target (both dims >= target), then crop at normalized offset
    vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,` +
         `crop=${w}:${h}:(in_w-out_w)*${cropXn.toFixed(4)}:(in_h-out_h)*${cropYn.toFixed(4)}`;
  } else if (pad === 'blur') {
    // Blurred background (fill+crop) with sharp letterboxed foreground centered on top
    vf = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
         `crop=${w}:${h},boxblur=luma_radius=40:luma_power=3[bg];` +
         `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];` +
         `[bg][fg]overlay=(W-overlay_w)/2:(H-overlay_h)/2[out]`;
  } else {
    const color = pad === 'white' ? 'white' : 'black';
    vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
         `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${color}`;
  }

  // blur uses filtergraph (needs -filter_complex), others use -vf
  const useComplex = pad === 'blur' && mode !== 'crop';
  const filterFlag = useComplex ? `-filter_complex "${vf}" -map "[out]" -map 0:a?` : `-vf "${vf}"`;
  const cmd = `"${FFMPEG}" -y -i "${input}" ${filterFlag} -c:v libx264 -preset fast -crf 18 -c:a copy "${output}"`;

  exec(cmd, (err, _so, se) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: se || err.message });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

// ── COMPRIMIR ──────────────────────────────────────────────────────────────
app.post('/api/compress', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const crf = Math.min(51, Math.max(18, parseInt(req.body.crf) || 26));
  const output = path.join(UPLOAD_DIR, `compress_${Date.now()}.mp4`);
  const EXPIRY = 3600000;
  const cmd = `"${FFMPEG}" -y -i "${input}" -c:v libx264 -preset fast -crf ${crf} -c:a copy "${output}"`;
  exec(cmd, (err, _so, se) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: se || err.message });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

// ── AUMENTAR QUALIDADE ─────────────────────────────────────────────────────
app.post('/api/upscale', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const w = parseInt(req.body.w) || 1920;
  const h = parseInt(req.body.h) || 1080;
  const output = path.join(UPLOAD_DIR, `upscale_${Date.now()}.mp4`);
  const EXPIRY = 3600000;
  const cmd = `"${FFMPEG}" -y -i "${input}" -vf "scale=${w}:${h}:flags=lanczos" -c:v libx264 -preset fast -crf 18 -c:a copy "${output}"`;
  exec(cmd, (err, _so, se) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: se || err.message });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

// ── ESPELHAR ───────────────────────────────────────────────────────────────
app.post('/api/mirror', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const flip = (req.body.flip || 'hflip').replace(/[^a-z,]/g, '');
  const vf = flip.split(',').join(',');
  const output = path.join(UPLOAD_DIR, `mirror_${Date.now()}.mp4`);
  const EXPIRY = 3600000;
  const cmd = `"${FFMPEG}" -y -i "${input}" -vf "${vf}" -c:v libx264 -preset fast -crf 18 -c:a copy "${output}"`;
  exec(cmd, (err, _so, se) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: se || err.message });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

// ── REMOVER FUNDO DE IMAGEM ────────────────────────────────────────────────
const uploadImg = multer({ dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 } });
app.post('/api/rembg', uploadImg.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  const input  = req.file.path;
  const output = path.join(UPLOAD_DIR, `rembg_${Date.now()}.png`);
  const EXPIRY = 3600000;
  const script = `
import sys
from rembg import remove
from PIL import Image
img = Image.open(sys.argv[1])
result = remove(img)
result.save(sys.argv[2])
print('done')
`.trim();
  const tmpScript = path.join(UPLOAD_DIR, `rembg_${Date.now()}.py`);
  fs.writeFileSync(tmpScript, script);
  exec(`"${PYTHON.replace(/"/g,'')}" "${tmpScript}" "${input}" "${output}"`, (err, _so, se) => {
    fs.unlink(input, () => {}); fs.unlink(tmpScript, () => {});
    if (err) return res.status(500).json({ error: (se || err.message) + '\n(pip install rembg pillow)' });
    scheduleDelete(output, EXPIRY);
    res.json({ url: '/uploads/' + path.basename(output) });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
