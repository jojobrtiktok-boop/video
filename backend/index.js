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

// Gera nome amigável para download: "meu video sem marca d'agua.mp4"
function friendlyFilename(originalname, suffix, forceExt) {
  const origExt = path.extname(originalname);
  const ext = forceExt || origExt || '.mp4';
  const base = path.basename(originalname, origExt);
  return suffix ? base + ' ' + suffix + ext : base + ext;
}

const app = express();

const _p = process.platform === 'win32';
const FFMPEG  = process.env.FFMPEG_BIN  || (_p ? 'Z:\\ffmpeg\\bin\\ffmpeg.exe'  : 'ffmpeg');
const FFPROBE = process.env.FFPROBE_BIN || (_p ? 'Z:\\ffmpeg\\bin\\ffprobe.exe' : 'ffprobe');
const PYTHON  = process.env.PYTHON_BIN  || (process.platform === 'win32' ? 'python' : 'python3');

// ── JOBS ASSÍNCRONOS (delogo/sora) ─────────────────────────────────────────
const processJobs = {};

// ── JOBS SIMPLES (compress/upscale/mirror com progresso real) ───────────────
const simpleJobs = {};

function getVideoDuration(inputPath) {
  return new Promise(resolve => {
    exec(`"${FFPROBE}" -v quiet -print_format json -show_entries format=duration "${inputPath}"`, (e, out) => {
      try { resolve(parseFloat(JSON.parse(out).format.duration) || 0); }
      catch { resolve(0); }
    });
  });
}

function spawnFfmpegWithProgress(jobId, ffmpegArgs, input, output, duration, expiry, libType, libLabel) {
  const proc = spawn(FFMPEG, ffmpegArgs);
  let stdoutBuf = '', stderrBuf = '';

  proc.stdout.on('data', chunk => {
    stdoutBuf += chunk.toString();
    if (duration > 0) {
      const m = stdoutBuf.match(/out_time_ms=(\d+)/g);
      if (m) {
        const ms = parseInt(m[m.length - 1].split('=')[1]);
        simpleJobs[jobId].progress = Math.min(95, Math.round(ms / 1000 / duration * 100));
      }
    }
    if (stdoutBuf.length > 2000) stdoutBuf = stdoutBuf.slice(-1000);
  });
  proc.stderr.on('data', chunk => {
    stderrBuf += chunk.toString();
    if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-1000);
  });
  proc.on('close', code => {
    fs.unlink(input, () => {});
    if (code !== 0) {
      simpleJobs[jobId].status = 'error';
      simpleJobs[jobId].error = stderrBuf.slice(-500) || 'FFmpeg falhou';
      return;
    }
    let outSize = 0;
    try { outSize = fs.statSync(output).size; } catch {}
    simpleJobs[jobId].status = 'done';
    simpleJobs[jobId].progress = 100;
    simpleJobs[jobId].url = '/uploads/' + path.basename(output);
    simpleJobs[jobId].outputSize = outSize;
    scheduleDelete(output, expiry);
    addToLibrary({ id: jobId, type: libType, label: libLabel, url: simpleJobs[jobId].url, createdAt: Date.now(), expiresAt: Date.now() + expiry, friendlyName: simpleJobs[jobId].friendlyName });
  });
}

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
  const _origName = req.file.originalname;

  if (mode === 'sora') {
    const jobId  = Date.now().toString() + Math.random().toString(36).slice(2);
    const expiry = Date.now() + 60 * 60 * 1000;
    const _soraN = friendlyFilename(_origName, "sem marca d'agua (Sora)");
    processJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, expiresAt: expiry, friendlyName: _soraN };
    const libEntry = { id: jobId, type: 'watermark', label: '🎵 Sora', url: null, status: 'processing', progress: 0, createdAt: Date.now(), expiresAt: expiry, friendlyName: _soraN };
    addToLibrary(libEntry);
    res.json({ id: jobId, status: 'processing', friendlyName: _soraN });
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
          createdAt: Date.now(), expiresAt: expiry,
          friendlyName: friendlyFilename(_origName, "sem marca d'agua (HeyGen)")
        };
        addToLibrary(libEntry);
        return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id, friendlyName: libEntry.friendlyName });
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
      const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'watermark', label: '🌫️ Blur', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000, friendlyName: friendlyFilename(_origName, "sem marca d'agua") };
      addToLibrary(libEntry);
      return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id, friendlyName: libEntry.friendlyName });
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
        const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'watermark', label: '⚡ Remoção Simples', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000, friendlyName: friendlyFilename(_origName, "sem marca d'agua") };
        addToLibrary(libEntry);
        return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id, friendlyName: libEntry.friendlyName });
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
    const _delogoN = friendlyFilename(_origName, "sem marca d'agua");
    processJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, expiresAt: expiry, friendlyName: _delogoN };
    const libEntry = { id: jobId, type: 'watermark', label: '✨ Remoção Limpa', url: null, status: 'processing', progress: 0, createdAt: Date.now(), expiresAt: expiry, friendlyName: _delogoN };
    addToLibrary(libEntry);
    res.json({ id: jobId, status: 'processing', friendlyName: _delogoN });
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
  const _lipN      = friendlyFilename(videoFile.originalname, 'lipsync');

  // Inicializa progresso
  lipsyncProgress[lipsyncId] = {
    status: 'processing',
    progress: 0,
    url: null,
    error: null,
    expiresAt: null,
    friendlyName: _lipN
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
      expiresAt: Date.now() + 60*60*1000,
      friendlyName: _lipN
    });
    return res.json({ url: `/uploads/${outputName}`, id: lipsyncId, friendlyName: _lipN });
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

app.get('/api/job/:id', (req, res) => {
  const job = simpleJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json(job);
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

  const animation  = req.body.animation || 'none';
  const uppercase  = req.body.uppercase === '1';

  const STYLES = {
    classico:    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,${align},10,10,50,1`,
    amarelo:     `Style: Default,Arial,${fontSize},&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,${align},10,10,50,1`,
    caixa:       `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,10,0,${align},20,20,50,1`,
    neon:        `Style: Default,Arial,${fontSize},&H0041FF00,&H0041FF00,&H00003200,&H00000000,-1,0,0,0,100,100,0,0,1,2,4,${align},10,10,50,1`,
    capcut:      `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
    tiktok:      `Style: Default,Arial Black,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,2,0,1,5,0,${align},10,10,50,1`,
    cinema:      `Style: Default,Arial,${Math.round(fontSize*0.85)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H88000000,0,-1,0,0,100,100,1,0,3,0,3,${align},30,30,60,1`,
    fire:        `Style: Default,Arial,${fontSize},&H000045FF,&H000045FF,&H000000AA,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,${align},10,10,50,1`,
    roxo:        `Style: Default,Arial,${fontSize},&H00FF71C2,&H00FF71C2,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
    branco_puro: `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0.5,0,1,2,0,${align},10,10,50,1`,
    karaoke:     `Style: Default,Arial Black,${fontSize},&H0000FFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
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

  function getAnimTag(anim) {
    if (anim === 'fade')     return '{\\fad(200,200)}';
    if (anim === 'pop')      return '{\\fscx0\\fscy0\\t(0,200,\\fscx100\\fscy100)}';
    if (anim === 'slide_up') return '{\\move(%PX%,%PY_OFF%,%PX%,%PY%)}'; // handled below
    return '';
  }

  // Apply uppercase transformation to source subs
  if (uppercase) subs = subs.map(s => ({ ...s, text: String(s.text).toUpperCase() }));

  // Karaoke mode: pair words 2-at-a-time with \k timing tags
  if (preset === 'karaoke') {
    const styleStr = STYLES.karaoke;
    const posTag = (posX !== null && posY !== null) ? `{\pos(${posX},${posY})}` : '';
    const karaokeDialogues = [];
    subs.forEach(sub => {
      const words = String(sub.text).trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const startS = timeStrToSecs(sub.start);
      const endS   = timeStrToSecs(sub.end);
      const dur    = Math.max(0.1, endS - startS);
      const perW   = dur / words.length;
      for (let i = 0; i < words.length; i += 2) {
        const w1 = words[i];
        const w2 = words[i + 1];
        const pairStart = startS + i * perW;
        const pairEnd   = startS + (Math.min(i + 2, words.length)) * perW;
        const cs1 = Math.round(perW * 100);
        const cs2 = w2 ? Math.round(perW * 100) : 0;
        // First word active (yellow via \k), second word white (\c resets to secondary)
        let text;
        if (w2) {
          text = `{\\k${cs1}}${w1} {\\c&H00FFFFFF&\\k${cs2}}${w2}`;
        } else {
          text = `{\\k${cs1}}${w1}`;
        }
        karaokeDialogues.push(`Dialogue: 0,${secsToAssTime(pairStart)},${secsToAssTime(pairEnd)},Default,,0,0,0,,${posTag}${text}`);
      }
    });
    const assContent = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      styleStr, '', '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      karaokeDialogues.join('\n'), ''
    ].join('\n');
    const input2    = req.file.path;
    const assPath2  = input2 + '.ass';
    const outputName2 = 'sub-' + path.basename(input2);
    const output2   = path.join(UPLOAD_DIR, outputName2);
    fs.writeFileSync(assPath2, assContent, 'utf8');
    const assEsc2 = assPath2.replace(/\\/g, '/').replace(':', '\\:');
    const cmd2 = `"${FFMPEG}" -y -i "${input2}" -vf "ass='${assEsc2}'" -c:a copy "${output2}"`;
    exec(cmd2, (err2, _s2, stderr2) => {
      fs.unlink(input2, () => {});
      fs.unlink(assPath2, () => {});
      if (err2) return res.status(500).json({ error: String(err2), stderr: stderr2 });
      scheduleDelete(output2, 30 * 60 * 1000);
      const libEntry2 = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'subtitle', label: '💬 Legenda', url: `/uploads/${path.basename(output2)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000, friendlyName: friendlyFilename(req.file.originalname, 'com legenda') };
      addToLibrary(libEntry2);
      return res.json({ url: `/uploads/${path.basename(output2)}`, id: libEntry2.id, friendlyName: libEntry2.friendlyName });
    });
    return; // Early return — karaoke handled above
  }

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
  const posTag = (posX !== null && posY !== null) ? `{\pos(${posX},${posY})}` : '';

  let animPrefix = '';
  if (animation === 'fade')          animPrefix = '{\fad(200,200)}';
  else if (animation === 'pop')      animPrefix = '{\fscx0\fscy0\t(0,200,\fscx100\fscy100)}';
  else if (animation === 'slide_up') {
    const ay = posY !== null ? posY : 980;
    const ax = posX !== null ? posX : 960;
    animPrefix = `{\move(${ax},${ay + 60},${ax},${ay})}`;
  }

  function typewriterText(text, durationSecs) {
    const chars = String(text).split('');
    const centisecs = Math.round(durationSecs * 100);
    const perChar = Math.max(1, Math.round(centisecs / chars.length));
    return chars.map(c => `{\k${perChar}}${c === ',' ? '{\,}' : c}`).join('');
  }

  const dialogues = finalSubs.map(sub => {
    const startS = timeStrToSecs(sub.start);
    const endS   = timeStrToSecs(sub.end);
    const text = animation === 'typewriter'
      ? typewriterText(sub.text, endS - startS)
      : String(sub.text).replace(/\n/g, '\N').replace(/,/g, '{\,}');
    return `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${posTag}${animPrefix}${text}`;
  }).join('\n');

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
    const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'subtitle', label: '💬 Legenda', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000, friendlyName: friendlyFilename(req.file.originalname, 'com legenda') };
    addToLibrary(libEntry);
    return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id, friendlyName: libEntry.friendlyName });
  });
});

// ── SUBTITLE AUTO: transcribe + burn with style ───────────────────────────────
app.post('/api/subtitle/auto', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const input    = req.file.path;
  const lang     = req.body.lang    || 'pt';
  const model    = req.body.model   || 'small';
  const preset     = req.body.preset  || 'classico';
  const fontSize   = Math.max(24, Math.min(120, parseInt(req.body.fontsize) || 72));
  const wordByWord = req.body.wordbyword === '1';
  const posX       = parseInt(req.body.posX) || null;
  const posY       = parseInt(req.body.posY) || null;
  const align      = posX !== null ? 5 : 2;
  const animation  = req.body.animation || 'none';
  const uppercase  = req.body.uppercase === '1';
  // Sync offset: medium model tends to lag slightly behind audio
  const syncOffset = model === 'medium' ? -0.15 : (model === 'large' ? -0.2 : 0);

  const python = PYTHON;
  const script = path.join(__dirname, 'transcribe.py');
  // Usa modo word_timestamps (arg "1") para timing exato por palavra
  const transcribeCmd = `"${python}" "${script}" "${input}" "${model}" "${lang}" "1"`;

  exec(transcribeCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err) {
      fs.unlink(input, () => {});
      return res.status(500).json({ error: 'Transcricao falhou: ' + (stderr || err.message) });
    }
    const raw = stdout.trim();
    if (!raw) {
      fs.unlink(input, () => {});
      return res.status(500).json({ error: 'Nenhuma fala detectada no video.' });
    }

    // Parse JSON com word timestamps
    let wordData = [];
    try { wordData = JSON.parse(raw); } catch (_) {}

    // Flatten: lista global de todas as palavras com start/end exatos
    const allWords = [];
    for (const seg of wordData) {
      for (const w of (seg.words || [])) {
        if (w.word && w.word.trim()) {
          allWords.push({
            word:  uppercase ? w.word.trim().toUpperCase() : w.word.trim(),
            start: Math.max(0, w.start + syncOffset),
            end:   Math.max(0, w.end   + syncOffset),
          });
        }
      }
    }

    // Fallback: se não veio word data, usa os segmentos inteiros
    const segments = [];
    if (!allWords.length) {
      for (const seg of wordData) {
        const s0 = Math.max(0, seg.start + syncOffset);
        const e0 = Math.max(s0 + 0.05, seg.end + syncOffset);
        segments.push({ start: secsToAssTime(s0), end: secsToAssTime(e0), text: uppercase ? String(seg.text).toUpperCase() : String(seg.text) });
      }
      if (!segments.length) {
        fs.unlink(input, () => {});
        return res.status(500).json({ error: 'Nenhuma fala detectada.' });
      }
    }

    // Forward to /api/subtitle logic inline
    const STYLES = {
      classico:    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,${align},10,10,50,1`,
      amarelo:     `Style: Default,Arial,${fontSize},&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,${align},10,10,50,1`,
      caixa:       `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,10,0,${align},20,20,50,1`,
      neon:        `Style: Default,Arial,${fontSize},&H0041FF00,&H0041FF00,&H00003200,&H00000000,-1,0,0,0,100,100,0,0,1,2,4,${align},10,10,50,1`,
      capcut:      `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
      tiktok:      `Style: Default,Arial Black,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,2,0,1,5,0,${align},10,10,50,1`,
      cinema:      `Style: Default,Arial,${Math.round(fontSize*0.85)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H88000000,0,-1,0,0,100,100,1,0,3,0,3,${align},30,30,60,1`,
      fire:        `Style: Default,Arial,${fontSize},&H000045FF,&H000045FF,&H000000AA,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,${align},10,10,50,1`,
      roxo:        `Style: Default,Arial,${fontSize},&H00FF71C2,&H00FF71C2,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
      branco_puro: `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0.5,0,1,2,0,${align},10,10,50,1`,
      karaoke:     `Style: Default,Arial Black,${fontSize},&H0000FFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
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

    // ── Karaoke: usa timestamps exatos por palavra com \k tags ──
    // Funciona para preset===karaoke OU wordByWord em qualquer preset
    // No karaoke: mostra 2 palavras por linha, a ativa fica amarela
    // No wordByWord capcut-style: cada palavra aparece sozinha com destaque em amarelo

    function buildKaraokeASS(wordsArr, style, posTag) {
      // Agrupa palavras em pares para o modo karaoke (2 por linha)
      const dialogues = [];
      for (let i = 0; i < wordsArr.length; i += 2) {
        const w1 = wordsArr[i];
        const w2 = wordsArr[i + 1];
        const lineStart = w1.start;
        const lineEnd   = w2 ? w2.end : w1.end;
        const cs1 = Math.max(1, Math.round((w1.end - w1.start) * 100));
        const cs2 = w2 ? Math.max(1, Math.round((w2.end - w2.start) * 100)) : 0;
        // \k<cs> → palavra fica na cor Secondary até ser "cantada", depois vai para Primary
        // Primary = amarelo (ativo), Secondary = branco (aguardando)
        let text;
        if (w2) {
          text = `{\\k${cs1}}${w1.word.replace(/,/g,'{\\,}')} {\\c&H00FFFFFF&\\k${cs2}}${w2.word.replace(/,/g,'{\\,}')}`;
        } else {
          text = `{\\k${cs1}}${w1.word.replace(/,/g,'{\\,}')}`;
        }
        dialogues.push(`Dialogue: 0,${secsToAssTime(lineStart)},${secsToAssTime(lineEnd)},Default,,0,0,0,,${posTag}${text}`);
      }
      return dialogues;
    }

    function buildWordByWordASS(wordsArr, style, posTag, animPrefix) {
      // Cada palavra como linha separada com seu timing exato
      return wordsArr.map(w => {
        const text = w.word.replace(/,/g, '{\\,}');
        return `Dialogue: 0,${secsToAssTime(w.start)},${secsToAssTime(w.end)},Default,,0,0,0,,${posTag}${animPrefix}${text}`;
      });
    }

    // Helper: agrupa palavras em blocos de N palavras mantendo timing coerente
    function groupWords(wordsArr, groupSize) {
      const groups = [];
      for (let i = 0; i < wordsArr.length; i += groupSize) {
        const chunk = wordsArr.slice(i, i + groupSize);
        groups.push({
          start: secsToAssTime(chunk[0].start),
          end:   secsToAssTime(chunk[chunk.length - 1].end),
          text:  chunk.map(w => w.word).join(' ')
        });
      }
      return groups;
    }

    const styleStr = STYLES[preset] || STYLES.classico;
    const posTag = (posX !== null && posY !== null) ? `{\\pos(${posX},${posY})}` : '';

    let animPrefix = '';
    if (animation === 'fade')          animPrefix = '{\\fad(200,200)}';
    else if (animation === 'pop')      animPrefix = '{\\fscx0\\fscy0\\t(0,200,\\fscx100\\fscy100)}';
    else if (animation === 'slide_up') {
      const ay = posY !== null ? posY : 980;
      const ax = posX !== null ? posX : 960;
      animPrefix = `{\\move(${ax},${ay + 60},${ax},${ay})}`;
    }

    let dialogues;

    if (preset === 'karaoke' && allWords.length) {
      // Karaoke com timing exato – 2 palavras por tela, destaque amarelo sincronizado
      dialogues = buildKaraokeASS(allWords, STYLES.karaoke, posTag).join('\n');
    } else if (wordByWord && allWords.length) {
      // Palavra por palavra com timing exato (CapCut style)
      dialogues = buildWordByWordASS(allWords, styleStr, posTag, animPrefix).join('\n');
    } else {
      // Modo padrão: segmentos inteiros
      let finalSubs = segments.length ? segments : groupWords(allWords, 6);

      function typewriterText(text, durationSecs) {
        const chars = String(text).split('');
        const centisecs = Math.round(durationSecs * 100);
        const perChar = Math.max(1, Math.round(centisecs / chars.length));
        return chars.map(c => `{\\k${perChar}}${c === ',' ? '{\\,}' : c}`).join('');
      }

      dialogues = finalSubs.map(sub => {
        const startS = timeStrToSecs(sub.start);
        const endS   = timeStrToSecs(sub.end);
        const text = animation === 'typewriter'
          ? typewriterText(sub.text, endS - startS)
          : String(sub.text).replace(/\n/g, '\\N').replace(/,/g, '{\\,}');
        return `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${posTag}${animPrefix}${text}`;
      }).join('\n');
    }

    const assContent = [
      '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'ScaledBorderAndShadow: yes', '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      (preset === 'karaoke' ? STYLES.karaoke : styleStr), '', '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      dialogues, ''
    ].join('\n');

    const assPath    = input + '.ass';
    const outputName = 'autosub-' + path.basename(input);
    const output     = path.join(UPLOAD_DIR, outputName);

    fs.writeFileSync(assPath, assContent, 'utf8');
    const assEsc = assPath.replace(/\\/g, '/').replace(':', '\\:');

    const ffmpegProc = spawn(FFMPEG, ['-y', '-i', input, '-vf', `ass='${assEsc}'`, '-c:a', 'copy', output]);
    let burnStderr = '';
    ffmpegProc.stderr.on('data', d => { burnStderr += d.toString(); });
    ffmpegProc.on('close', code => {
      fs.unlink(input, () => {});
      fs.unlink(assPath, () => {});
      if (code !== 0) return res.status(500).json({ error: 'ffmpeg falhou: ' + burnStderr.slice(-500) });
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${path.basename(output)}`, friendlyName: friendlyFilename(req.file.originalname, 'com legenda auto') });
    });
    ffmpegProc.on('error', err => {
      fs.unlink(input, () => {});
      fs.unlink(assPath, () => {});
      res.status(500).json({ error: 'ffmpeg não encontrado: ' + err.message });
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
  const cmdAV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterAV}" -map "[outv]" -map "[outa]" -c:v libx264 -preset ultrafast -crf 26 -c:a aac "${output}"`;

  exec(cmdAV, { timeout: 120000 }, (err) => {
    if (!err) {
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${outputName}` });
    }
    const filterV = `[0:v]${scale}[v0];[1:v]${scale}[v1];[v0][v1]concat=n=2:v=1:a=0[outv]`;
    const cmdV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterV}" -map "[outv]" -c:v libx264 -preset ultrafast -crf 26 -an "${output}"`;
    exec(cmdV, { timeout: 120000 }, (err2, _out, stderr2) => {
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
    return res.json({ url: `/uploads/${outputName}`, friendlyName: friendlyFilename(req.file.originalname, '(somente video)') });
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
    return res.json({ url: `/uploads/${outputName}`, friendlyName: friendlyFilename(videoFile.originalname, '(audio substituido)') });
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
    return res.json({ url: `/uploads/${outputName}`, type: 'audio', friendlyName: friendlyFilename(req.file.originalname, '', '.mp3') });
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
      // Se corpo vazio, aguarda próxima iteração
      if (!statusResp.body) continue;
      const body = statusResp.body;
      const status = body.status || body.finish_reason || '';
      // Check for failure
      if (status === 'failed' || status === 'error') {
        return res.status(500).json({ error: 'Geracao falhou: ' + (body.error || status) });
      }
      // Check for completion (handles both "status":"completed" and "finish_reason":"complete")
      if (status === 'completed' || status === 'complete') {
        // Check if URL is directly in the response
        const directUrl = body.url || body.video_url || (body.data && body.data[0] && body.data[0].url);
        if (directUrl) {
          const dl = await orDownload(directUrl);
          if (dl.status !== 200 || !dl.buffer.length) {
            return res.status(500).json({ error: 'Nao foi possivel baixar o video gerado.' });
          }
          const outName = `vg-${jobId}.mp4`;
          const outPath = path.join(UPLOAD_DIR, outName);
          fs.writeFileSync(outPath, dl.buffer);
          scheduleDelete(outPath, 3600000);
          return res.json({ url: `/uploads/${outName}` });
        }
        // 3) Download video via content endpoint
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
    const url = '/uploads/' + path.basename(output);
    const _trimN = friendlyFilename(req.file.originalname, 'cortado');
    addToLibrary({ id: Date.now().toString(36), type: 'trim', label: 'Cortado', url, createdAt: Date.now(), expiresAt: Date.now() + EXPIRY, friendlyName: _trimN });
    res.json({ url, friendlyName: _trimN });
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
    const url = '/uploads/' + path.basename(output);
    const _resizeN = friendlyFilename(req.file.originalname, 'redimensionado');
    addToLibrary({ id: Date.now().toString(36), type: 'resize', label: 'Redimensionado', url, createdAt: Date.now(), expiresAt: Date.now() + EXPIRY, friendlyName: _resizeN });
    res.json({ url, friendlyName: _resizeN });
  });
});

// ── COMPRIMIR ──────────────────────────────────────────────────────────────
app.post('/api/compress', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const crf = Math.min(51, Math.max(18, parseInt(req.body.crf) || 26));
  const output = path.join(UPLOAD_DIR, `compress_${Date.now()}.mp4`);
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  simpleJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, inputSize: req.file.size || 0, outputSize: 0, friendlyName: friendlyFilename(req.file.originalname, 'comprimido') };
  res.json({ id: jobId });
  const duration = await getVideoDuration(input);
  spawnFfmpegWithProgress(jobId,
    ['-y', '-i', input, '-progress', 'pipe:1', '-nostats', '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-c:a', 'copy', output],
    input, output, duration, 3600000, 'compress', 'Comprimido');
});

// ── AUMENTAR QUALIDADE ─────────────────────────────────────────────────────
app.post('/api/upscale', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const h = parseInt(req.body.h) || 1080;
  const output = path.join(UPLOAD_DIR, `upscale_${Date.now()}.mp4`);
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  simpleJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, inputSize: req.file.size || 0, outputSize: 0, friendlyName: friendlyFilename(req.file.originalname, 'qualidade aumentada') };
  res.json({ id: jobId });
  const duration = await getVideoDuration(input);
  // scale=-2:h mantém proporção (aspect ratio)
  spawnFfmpegWithProgress(jobId,
    ['-y', '-i', input, '-progress', 'pipe:1', '-nostats', '-vf', `scale=-2:${h}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'copy', output],
    input, output, duration, 3600000, 'upscale', `Qualidade ${h}p`);
});

// ── ESPELHAR ───────────────────────────────────────────────────────────────
app.post('/api/mirror', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  const input = req.file.path;
  const flip = (req.body.flip || 'hflip').replace(/[^a-z,]/g, '');
  const output = path.join(UPLOAD_DIR, `mirror_${Date.now()}.mp4`);
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  simpleJobs[jobId] = { status: 'processing', progress: 0, url: null, error: null, inputSize: req.file.size || 0, outputSize: 0, friendlyName: friendlyFilename(req.file.originalname, 'espelhado') };
  res.json({ id: jobId });
  const duration = await getVideoDuration(input);
  spawnFfmpegWithProgress(jobId,
    ['-y', '-i', input, '-progress', 'pipe:1', '-nostats', '-vf', flip, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'copy', output],
    input, output, duration, 3600000, 'mirror', 'Espelhado');
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
    const url = '/uploads/' + path.basename(output);
    const _rembgN = path.basename(req.file.originalname, path.extname(req.file.originalname)) + ' sem fundo.png';
    addToLibrary({ id: Date.now().toString(36), type: 'rembg', label: 'Fundo Removido', mediaType: 'image', url, createdAt: Date.now(), expiresAt: Date.now() + EXPIRY, friendlyName: _rembgN });
    res.json({ url, friendlyName: _rembgN });
  });
});

// ── AUTO EDITOR (Whisper + Claude + Remotion) ──────────────────────────────
const autoEditJobs = {};

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.post('/api/auto-edit', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'ANTHROPIC_API_KEY não configurada no .env' });

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const input = req.file.path;
  const model = (req.body.model || 'small').replace(/[^a-z0-9_-]/g, '');
  const language = (req.body.language || 'pt').replace(/[^a-z]/g, '');

  autoEditJobs[jobId] = { status: 'normalizing', progress: 5, result: null, error: null };
  res.json({ id: jobId });

  (async () => {
    try {
      // Passo 0: Normalização — converte HEVC/outros para H.264 30fps (compatibilidade browser)
      let processPath = input;
      try {
        const normName = 'norm_' + path.basename(input);
        const normPath = path.join(UPLOAD_DIR, normName);
        await new Promise(resolve => {
          const cmd = `"${FFMPEG}" -y -i "${input}" -c:v libx264 -preset fast -crf 22 -r 30 -pix_fmt yuv420p -c:a aac "${normPath}"`;
          exec(cmd, { timeout: 5 * 60 * 1000 }, (err) => {
            try {
              if (!err && fs.existsSync(normPath) && fs.statSync(normPath).size > 1024) {
                fs.unlink(input, () => {});
                processPath = normPath;
                console.log('[auto-edit] Normalizado H.264:', normName);
              } else {
                fs.unlink(normPath, () => {});
              }
            } catch (_) {}
            resolve();
          });
        });
      } catch (e) {
        console.warn('[auto-edit] Normalização pulada:', e.message);
      }

      // Passo 1: Transcrição com Whisper
      autoEditJobs[jobId].status = 'transcribing';
      autoEditJobs[jobId].progress = 12;
      const transcription = await new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'transcribe_json.py');
        exec(`"${PYTHON}" "${scriptPath}" "${processPath}" "${model}" "${language}"`,
          { maxBuffer: 20 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            try { resolve(JSON.parse(stdout)); }
            catch { reject(new Error('Transcrição inválida: ' + stdout.slice(0, 300))); }
          }
        );
      });

      autoEditJobs[jobId].progress = 42;
      autoEditJobs[jobId].status = 'analyzing';

      // Passo 2: Info do vídeo via ffprobe
      const videoInfo = await new Promise((resolve) => {
        exec(`"${FFPROBE}" -v quiet -print_format json -show_streams -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration "${processPath}"`,
          (err, stdout) => {
            try {
              const data = JSON.parse(stdout);
              const stream = data.streams?.[0] || {};
              const fpsStr = stream.r_frame_rate || '30/1';
              const [num, den] = fpsStr.split('/').map(Number);
              resolve({
                fps: Math.round(num / (den || 1)) || 30,
                duration: parseFloat(data.format?.duration || transcription.duration || 0),
                videoWidth: stream.width || 1080,
                videoHeight: stream.height || 1920
              });
            } catch { resolve({ fps: 30, duration: transcription.duration || 0, videoWidth: 1080, videoHeight: 1920 }); }
          }
        );
      });

      autoEditJobs[jobId].progress = 50;

      // Passo 3: Claude analisa e gera cenas
      const segmentsText = transcription.segments
        .map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: ${s.text}`)
        .join('\n');

      const isPortrait = videoInfo.videoHeight > videoInfo.videoWidth;

      const userStyle = (req.body.style || '').trim().slice(0, 600);

      // ── Sistema de cores emocionais VSL ───────────────────────────────────
      const VSL_COLORS = {
        hook:        '#7c71ff',
        bold_claim:  '#ffffff',
        question:    '#60a5fa',
        problem:     '#ef4444',
        agitation:   '#dc2626',
        story:       '#a78bfa',
        solution:    '#22c55e',
        proof:       '#f59e0b',
        urgency:     '#f97316',
        cta:         '#7c71ff',
        subtitle:    '#94a3b8',
        lower_third: '#7c71ff',
        caption:     '#6b7280',
      };

      const defaultVSLGuide = isPortrait
        ? `FORMATO: TikTok/Reels/Shorts VERTICAL (9:16) — Conteúdo nativo de redes sociais
ESTRATÉGIA DE HOOK TIKTOK (primeiros 3 segundos = decisivo):
  - Fórmula 1 BOLD CLAIM: Declaração que desafia o senso comum
  - Fórmula 2 QUESTION: Pergunta com curiosity gap que exige resposta
  - Fórmula 3 PROOF-FIRST: Resultado/número imediato que cria autoridade
  - Fórmula 4 PATTERN INTERRUPT: Algo inesperado que quebra o scroll
PACING: Cena a cada 2-4 segundos. Dinamismo alto. Linguagem jovem e direta.
ESTRUTURA SUGERIDA: hook → problem → agitation → solution → proof → cta`
        : `FORMATO: YouTube/Cinema HORIZONTAL (16:9) — VSL estruturado
ESTRUTURA VSL DE 7 ESTÁGIOS (com timing proporcional à duração):
  1. HOOK/ATENÇÃO (0-15%): Pattern interrupt ou bold claim — prende nos primeiros 3s
  2. PROBLEMA (15-30%): Dor real do público, específica e relatable
  3. AGITAÇÃO (30-40%): Amplifica a dor — o que acontece se não resolver?
  4. STORY (40-50%): Conexão emocional, narrativa de transformação
  5. SOLUÇÃO (50-65%): Apresentação da solução, subtle, não agressiva
  6. PROVA (65-80%): Números, resultados, depoimentos reais
  7. URGÊNCIA + CTA (80-100%): Escassez + ação clara e única`;

      const styleGuide = userStyle
        ? `ESTILO PERSONALIZADO DO USUÁRIO:\n"${userStyle}"\n\nSiga rigorosamente este estilo, adaptando os tipos de overlay e animações para expressar essa identidade visual.`
        : `ESTILO PADRÃO: VSL Marketing Digital de Alta Conversão\n\n${defaultVSLGuide}`;

      const prompt = `Você é um copywriter de direct response e editor de vídeo especializado em marketing digital de alta conversão. Analise a transcrição e crie overlays que amplificam o impacto de cada momento — sem clichês, sem rótulos genéricos, só copy que converte.

━━━ VÍDEO ━━━
Duração: ${videoInfo.duration.toFixed(1)}s | ${isPortrait ? 'Vertical 9:16 (TikTok/Reels/Shorts)' : 'Horizontal 16:9 (YouTube/VSL)'} | ${videoInfo.videoWidth}×${videoInfo.videoHeight} | Idioma: ${transcription.language || language}

━━━ ESTRATÉGIA DE EDIÇÃO ━━━
${styleGuide}

━━━ PRINCÍPIOS DE COPY QUE CONVERTE ━━━
• Hook: quebre o padrão nos primeiros 3s — pergunta provocadora, número surpreendente, afirmação controversa
• Dor: seja específico, não genérico — "você perde R$X todo mês" > "você perde dinheiro"
• Desejo: pinte o resultado, não o processo — "acorde sem alarme" > "tenha liberdade"
• Prova: números reais animam do zero — use-os para credibilidade instantânea
• CTA: um único verbo de ação, urgente e claro — "Acessa agora", "Salva esse vídeo"
• Nunca copie a transcrição — contraste, amplifique, surpreenda
• Máximo 45 caracteres por overlay — cada palavra no limite tem mais força

━━━ TRANSCRIÇÃO ━━━
${segmentsText}

━━━ ESTILOS DISPONÍVEIS ━━━
hook        → Abertura, texto grande centralizado com linha de cor | zoom | ${VSL_COLORS.hook}
bold_claim  → Declaração enorme no centro, sem fundo | zoom | ${VSL_COLORS.bold_claim}
question    → Typewriter + cursor piscando no topo, caixa com borda | fade | ${VSL_COLORS.question}
problem     → Caixa com borda esquerda colorida, slide rodapé | slide_up | ${VSL_COLORS.problem}
agitation   → Tremor orgânico, fundo avermelhado pulsante | shake | ${VSL_COLORS.agitation}
story       → Texto itálico suave, gradiente no rodapé | fade | ${VSL_COLORS.story}
solution    → Barra animada no topo, caixa com borda verde | slide_left | ${VSL_COLORS.solution}
proof       → Caixa com borda âmbar, número conta do zero | zoom | ${VSL_COLORS.proof}
urgency     → Caixa laranja pulsante, borda neon | slide_up | ${VSL_COLORS.urgency}
cta         → Botão gradiente com glow pulsante — só para o CTA final | slide_up | ${VSL_COLORS.cta}
subtitle    → Pill escuro transparente no rodapé, texto limpo | fade | ${VSL_COLORS.subtitle}
lower_third → Strip lateral esquerdo com barra vertical | slide_left | ${VSL_COLORS.lower_third}
caption     → Texto flutuante com outline — comentário ou dado extra | fade | ${VSL_COLORS.caption}
none        → Pausa visual intencional, sem overlay

━━━ ANIMAÇÕES ━━━
zoom | slide_up | slide_left | slide_right | shake | typewriter | fade | none

━━━ REGRAS ━━━
1. Cubra 100% da duração sem lacunas
2. Não repita o mesmo estilo mais de 2× seguidos
3. Para proof: use números reais do vídeo ou estimativas crentes
4. Emojis: máximo 1 por scene, só se potencializar (não decorar)
5. CTA: único, no final, verbo imperativo direto

━━━ JSON EXIGIDO ━━━
Retorne APENAS um objeto JSON com EXATAMENTE esta estrutura:
{
  "narrative_type": "vsl",
  "palette": ["#7c71ff", "#22c55e", "#f59e0b"],
  "scenes": [
    {
      "id": "scene_1",
      "start": 0.0,
      "end": 4.5,
      "title": "Nome interno curto",
      "description": "O que acontece nesta cena",
      "text_overlay": "Copy direto aqui (máx 45 chars)",
      "style": "hook",
      "animation": "zoom",
      "position": "bottom_center",
      "accent_color": "#7c71ff",
      "emoji": "🔥"
    }
  ]
}

narrative_type: um de — vsl | tutorial | storytelling | review | depoimento | educacional | produto | motivacional
palette: 3 cores hex que se complementam e combinam com o tom emocional do vídeo

Zero markdown. Zero explicação. Zero texto fora do objeto JSON.`;

      const claudeResponse = await callClaude(prompt);
      autoEditJobs[jobId].progress = 85;

      // Parse da resposta do Claude — suporta objeto {narrative_type, palette, scenes} ou array legado
      let scenes, narrativeType = 'vsl', palette = ['#7c71ff', '#22c55e', '#f59e0b'];
      try {
        // Tenta objeto JSON primeiro, depois array
        const objMatch = claudeResponse.match(/\{[\s\S]*\}/)?.[0];
        const arrMatch = claudeResponse.match(/\[[\s\S]*\]/)?.[0];
        const jsonStr = objMatch || arrMatch || claudeResponse;
        const raw = JSON.parse(jsonStr);
        if (Array.isArray(raw)) {
          scenes = raw;
        } else {
          scenes = raw.scenes || [];
          narrativeType = raw.narrative_type || narrativeType;
          if (Array.isArray(raw.palette) && raw.palette.length >= 2) palette = raw.palette;
        }
      } catch {
        throw new Error('Claude retornou JSON inválido: ' + claudeResponse.slice(0, 300));
      }

      const videoUrl = '/uploads/' + path.basename(processPath);
      scheduleDelete(processPath, 7200000); // 2h

      autoEditJobs[jobId].status = 'done';
      autoEditJobs[jobId].progress = 100;
      autoEditJobs[jobId].result = {
        videoUrl,
        duration: videoInfo.duration,
        fps: videoInfo.fps,
        videoWidth: videoInfo.videoWidth,
        videoHeight: videoInfo.videoHeight,
        scenes,
        segments: transcription.segments,
        language: transcription.language,
        narrativeType,
        palette,
      };

    } catch (err) {
      fs.unlink(processPath || input, () => {});
      autoEditJobs[jobId].status = 'error';
      autoEditJobs[jobId].error = err.message;
      console.error('[auto-edit] Erro:', err.message);
    }
  })();
});

app.get('/api/auto-edit/:id', (req, res) => {
  const job = autoEditJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json(job);
});

// ── REFINAR CENAS VIA CLAUDE ────────────────────────────────────────────────
app.post('/api/refine-scenes', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'ANTHROPIC_API_KEY não configurada' });
  const { scenes, request: userRequest, videoInfo } = req.body;
  if (!scenes || !userRequest) return res.status(400).json({ error: 'scenes e request são obrigatórios' });

  try {
    const prompt = `Você é um copywriter de direct response e editor de vídeo especializado em marketing digital. Refine as cenas conforme o pedido do usuário.

━━━ VÍDEO ━━━
Duração: ${videoInfo?.duration || 0}s | ${videoInfo?.videoWidth || 1080}×${videoInfo?.videoHeight || 1920} | Idioma: ${videoInfo?.language || 'pt'}

━━━ CENAS ATUAIS ━━━
${JSON.stringify(scenes, null, 2)}

━━━ PEDIDO ━━━
"${userRequest}"

━━━ ESTILOS VÁLIDOS ━━━
hook, bold_claim, question, problem, agitation, story, solution, proof, urgency, cta, subtitle, lower_third, caption, none

━━━ ANIMAÇÕES VÁLIDAS ━━━
zoom, slide_up, slide_left, slide_right, shake, typewriter, fade, none

━━━ REGRAS ━━━
1. Execute EXATAMENTE o que foi pedido — nem mais, nem menos
2. Mantenha inalteradas todas as cenas não mencionadas
3. text_overlay: máximo 45 chars — copy direto, sem rótulos genéricos, sem clichês
4. Para proof: números animam de 0 até o valor — use dados reais ou estimativas crentes
5. accent_color deve ser hex válido (#rrggbb)
6. Copy que converte: específico, verbos de ação, contraste com a transcrição

RETORNE APENAS O JSON ARRAY COMPLETO. Zero markdown. Zero explicação.`;

    const response = await callClaude(prompt);
    const jsonStr = response.match(/\[[\s\S]*\]/)?.[0] || response;
    const updatedScenes = JSON.parse(jsonStr);
    res.json({ scenes: updatedScenes });
  } catch (err) {
    console.error('[refine-scenes] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GERAR IMAGEM IA POR CENA via fal.ai FLUX Schnell ─────────────────────────
app.post('/api/generate-scene-image', express.json(), async (req, res) => {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return res.status(400).json({ error: 'FAL_API_KEY não configurada no .env' });

  const { prompt, sceneId, orientation } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório.' });

  const isPortrait = (orientation || 'portrait') === 'portrait';
  // 9:16 portrait ≈ 576×1024 | 16:9 landscape ≈ 1024×576 (baixa resolução = mais barato e rápido)
  const imageSize = isPortrait
    ? { width: 576, height: 1024 }
    : { width: 1024, height: 576 };

  const payload = JSON.stringify({
    prompt,
    image_size: imageSize,
    num_inference_steps: 4,
    num_images: 1,
    enable_safety_checker: true,
    sync_mode: true,
  });

  try {
    const falResult = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'fal.run',
        path: '/fal-ai/flux/schnell',
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (resp) => {
        let raw = '';
        resp.on('data', c => raw += c);
        resp.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (resp.statusCode >= 400) return reject(new Error(json.detail || json.error || `fal.ai HTTP ${resp.statusCode}`));
            resolve(json);
          } catch { reject(new Error('Resposta inválida do fal.ai')); }
        });
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    const imageUrl = falResult.images?.[0]?.url;
    if (!imageUrl) return res.status(500).json({ error: 'Imagem não retornada.', raw: falResult });

    // Baixa e salva localmente para que o Remotion Player possa carregar
    const dlBuffer = await new Promise((resolve, reject) => {
      const parsed = new URL(imageUrl);
      const lib = parsed.protocol === 'https:' ? https : require('http');
      lib.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search }, (resp) => {
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const imgName = `scene-img-${sceneId || 's'}-${Date.now()}.jpg`;
    const imgPath = path.join(UPLOAD_DIR, imgName);
    fs.writeFileSync(imgPath, dlBuffer);
    scheduleDelete(imgPath, 2 * 60 * 60 * 1000); // 2h

    return res.json({ url: `/uploads/${imgName}` });
  } catch (err) {
    console.error('[scene-image] Erro:', err.message);
    return res.status(500).json({ error: 'Erro ao gerar imagem: ' + err.message });
  }
});

// ── TRADUÇÃO DE VÍDEO ─────────────────────────────────────────────────────────
// Paso 1: transcreve + traduz → retorna segmentos para revisão
app.post('/api/translate/analyze', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const input      = req.file.path;
  const fromLang   = req.body.from_lang || 'auto';
  const toLang     = req.body.to_lang   || 'en';
  const apiKey     = req.body.api_key;   // Anthropic/OpenRouter key para tradução
  const apiModel   = req.body.api_model || 'claude-3-5-haiku-20241022';
  const apiBase    = req.body.api_base  || 'https://api.anthropic.com';

  if (!apiKey) return res.status(400).json({ error: 'api_key obrigatória para tradução' });

  // Guarda referência do arquivo original para o passo generate
  const tempId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const tempMeta = path.join(UPLOAD_DIR, tempId + '.meta.json');
  fs.writeFileSync(tempMeta, JSON.stringify({ input, originalname: req.file.originalname, toLang }));
  scheduleDelete(input, 60 * 60 * 1000);      // 1h para expirar
  scheduleDelete(tempMeta, 60 * 60 * 1000);

  // Transcrição com Whisper
  const whisperModel = req.body.whisper_model || 'small';
  const detectLang   = fromLang === 'auto' ? 'auto' : fromLang;
  const script = path.join(__dirname, 'transcribe.py');
  const transcribeCmd = `"${PYTHON}" "${script}" "${input}" "${whisperModel}" "${detectLang}"`;

  exec(transcribeCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 }, async (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: 'Transcrição falhou: ' + (stderr || err.message) });
    const srtContent = stdout.trim();
    if (!srtContent) return res.status(500).json({ error: 'Nenhuma fala detectada.' });

    // Parse SRT
    const segments = [];
    const blocks = srtContent.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      const match = lines[1].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
      if (!match) continue;
      const text = lines.slice(2).join(' ').trim();
      if (!text) continue;
      segments.push({ id: segments.length, start: match[1].replace(',','.'), end: match[2].replace(',','.'), original: text, translated: '' });
    }
    if (!segments.length) return res.status(500).json({ error: 'Nenhuma fala detectada.' });

    // Tradução via Anthropic (ou OpenRouter com mesmo formato)
    const allText = segments.map((s, i) => `[${i}] ${s.original}`).join('\n');
    const toLangLabel = toLang === 'es-419' ? 'Español latinoamericano (variedade latino-americana, evitar expressões da Espanha)' : toLang;
    const customInstructions = (req.body.custom_instructions || '').trim();
    const customBlock = customInstructions ? `\n\nInstruções adicionais que DEVEM ser seguidas:\n${customInstructions}` : '';
    const prompt = `Você é um tradutor profissional. Traduza cada linha numerada do idioma de origem para "${toLangLabel}". Mantenha EXATAMENTE o mesmo número de linhas e a mesma numeração. Retorne SOMENTE as linhas traduzidas com os mesmos índices, sem explicações.${customBlock}\n\n${allText}`;

    try {
      // Suporta Anthropic direto ou via OpenRouter
      const isOpenRouter = apiBase.includes('openrouter');
      const reqBody = isOpenRouter
        ? JSON.stringify({ model: apiModel, messages: [{ role: 'user', content: prompt }], max_tokens: 4096 })
        : JSON.stringify({ model: apiModel, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] });

      const url = new URL(isOpenRouter ? '/api/v1/chat/completions' : '/v1/messages', apiBase);
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      if (!isOpenRouter) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        delete headers['Authorization'];
      }

      const translationRaw = await new Promise((resolve, reject) => {
        const data = Buffer.from(reqBody);
        const options = { hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { ...headers, 'Content-Length': data.length } };
        const req2 = https.request(options, r => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const text = isOpenRouter
                ? parsed.choices?.[0]?.message?.content
                : parsed.content?.[0]?.text;
              if (!text) return reject(new Error('Resposta vazia da API: ' + body.slice(0, 300)));
              resolve(text);
            } catch (e) { reject(e); }
          });
        });
        req2.on('error', reject);
        req2.write(data);
        req2.end();
      });

      // Parse resposta: "[0] texto" ou "0. texto" ou só linhas na ordem
      const lines = translationRaw.trim().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const m = line.match(/^\[?(\d+)\]?[.\s]+(.+)/);
        if (m) {
          const idx = parseInt(m[1]);
          if (segments[idx]) segments[idx].translated = m[2].trim();
        }
      });
      // Fallback: se não parsou nenhum, atribui em ordem
      const unparsed = segments.filter(s => !s.translated);
      if (unparsed.length === segments.length) {
        lines.forEach((l, i) => { if (segments[i]) segments[i].translated = l.trim(); });
      }

      return res.json({ tempId, originalname: req.file.originalname, segments });
    } catch (e) {
      return res.status(500).json({ error: 'Tradução falhou: ' + e.message });
    }
  });
});

// ── Helpers ElevenLabs Voice Cloning ──────────────────────────────────────────
async function elevenLabsCloneVoice(audioPath, elKey) {
  const boundary = 'B' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const audioData = fs.readFileSync(audioPath);
  const voiceName = 'TempClone_' + Date.now();
  const nl = '\r\n';
  const namePart  = Buffer.from(`--${boundary}${nl}Content-Disposition: form-data; name="name"${nl}${nl}${voiceName}${nl}`);
  const fileHead  = Buffer.from(`--${boundary}${nl}Content-Disposition: form-data; name="files"; filename="vocals.mp3"${nl}Content-Type: audio/mpeg${nl}${nl}`);
  const fileFoot  = Buffer.from(`${nl}--${boundary}--${nl}`);
  const body  = Buffer.concat([namePart, fileHead, audioData, fileFoot]);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.elevenlabs.io', port: 443,
      path: '/v1/voices/add', method: 'POST',
      headers: { 'xi-api-key': elKey, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    };
    const r = https.request(opts, res2 => {
      let out = '';
      res2.on('data', c => out += c);
      res2.on('end', () => {
        try { const j = JSON.parse(out); j.voice_id ? resolve(j.voice_id) : reject(new Error('Clone falhou: ' + out)); }
        catch { reject(new Error('Resposta inválida ElevenLabs clone: ' + out)); }
      });
    });
    r.on('error', reject); r.write(body); r.end();
  });
}

async function elevenLabsDeleteVoice(voiceId, elKey) {
  return new Promise(resolve => {
    const opts = { hostname: 'api.elevenlabs.io', port: 443, path: `/v1/voices/${voiceId}`, method: 'DELETE', headers: { 'xi-api-key': elKey } };
    const r = https.request(opts, res2 => { res2.resume(); res2.on('end', resolve); });
    r.on('error', () => resolve()); r.end();
  });
}

// Paso 2: gera vídeo traduzido com os segmentos aprovados (editados pelo usuário)
app.post('/api/translate/generate', express.json({ limit: '200kb' }), async (req, res) => {
  const { tempId, segments, elevenlabs_key, voice_id, with_lipsync } = req.body;
  if (!tempId || !segments || !elevenlabs_key || !voice_id)
    return res.status(400).json({ error: 'tempId, segments, elevenlabs_key e voice_id são obrigatórios' });

  const metaPath = path.join(UPLOAD_DIR, tempId + '.meta.json');
  if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Sessão expirada, faça o upload novamente.' });

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const input = meta.input;
  const toLang = meta.toLang || '';
  if (!fs.existsSync(input)) return res.status(404).json({ error: 'Arquivo original expirado.' });

  function srtTimeToSecs(t) {
    const p = t.replace(',','.').split(':').map(parseFloat);
    return p[0]*3600 + p[1]*60 + p[2];
  }

  try {
    // 1. Extrair áudio do vídeo
    const audioRaw = input + '_raw.wav';
    await new Promise((resolve, reject) => {
      exec(`"${FFMPEG}" -y -i "${input}" -vn -ar 44100 -ac 2 "${audioRaw}"`, (e, _, se) => e ? reject(new Error(se||e.message)) : resolve());
    });

    // 2. Separar vocais do fundo com Demucs
    const demucsOut = input + '_demucs';
    const sepScript = path.join(__dirname, 'separate_vocals.py');
    const sepOut = await new Promise((resolve, reject) => {
      exec(`"${PYTHON}" "${sepScript}" "${audioRaw}" "${demucsOut}"`, { timeout: 10 * 60 * 1000 }, (e, out, se) => {
        if (e) return reject(new Error('Demucs falhou: ' + (se || e.message)));
        resolve(out.trim());
      });
    });

    let noVocalsPath = null;
    let vocalsPath = null;
    for (const line of sepOut.split('\n')) {
      if (line.startsWith('no_vocals:')) noVocalsPath = line.slice(10).trim();
      if (line.startsWith('vocals:')) vocalsPath = line.slice(7).trim();
    }
    if (!noVocalsPath || !fs.existsSync(noVocalsPath)) {
      // Fallback: sem separação, usa áudio original com volume reduzido
      noVocalsPath = null;
    }

    // 3. Clonar voz (se solicitado) / definir voice_id efetivo
    let actualVoiceId = voice_id;
    let clonedVoiceId = null;
    if (voice_id === '__clone__') {
      trGenerateStatus && void 0; // só para IDE
      const cloneSrc = (vocalsPath && fs.existsSync(vocalsPath)) ? vocalsPath : audioRaw;
      clonedVoiceId = await elevenLabsCloneVoice(cloneSrc, elevenlabs_key);
      actualVoiceId = clonedVoiceId;
    }

    // 4. Gerar TTS via ElevenLabs para cada segmento
    const ttsDir = input + '_tts';
    fs.mkdirSync(ttsDir, { recursive: true });

    async function generateTTS(text, idx) {
      const outPath = path.join(ttsDir, `seg_${idx}.mp3`);
      const body = JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } });
      const data = Buffer.from(body);
      await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.elevenlabs.io', port: 443,
          path: `/v1/text-to-speech/${actualVoiceId}`,
          method: 'POST',
          headers: { 'xi-api-key': elevenlabs_key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg', 'Content-Length': data.length }
        };
        const req3 = https.request(options, r => {
          const chunks = [];
          r.on('data', c => chunks.push(c));
          r.on('end', () => {
            fs.writeFileSync(outPath, Buffer.concat(chunks));
            resolve();
          });
        });
        req3.on('error', reject);
        req3.write(data);
        req3.end();
      });
      return outPath;
    }

    // Gerar todos os TTS (em paralelo, máx 3 por vez)
    async function pLimit(tasks, concurrency) {
      const results = [];
      for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency).map(t => t());
        results.push(...(await Promise.all(batch)));
      }
      return results;
    }
    const ttsTasks = segments.map((seg, i) => () => generateTTS(seg.translated || seg.original, i));
    const ttsPaths = await pLimit(ttsTasks, 3);

    // Deletar clone temporário após gerar todos os áudios
    if (clonedVoiceId) {
      elevenLabsDeleteVoice(clonedVoiceId, elevenlabs_key).catch(() => {});
      clonedVoiceId = null;
    }

    // 5. Ajustar duração de cada clipe TTS para caber no slot de tempo original
    const ttsAdjDir = input + '_tts_adj';
    fs.mkdirSync(ttsAdjDir, { recursive: true });

    async function getAudioDuration(file) {
      return new Promise(resolve => {
        exec(`"${FFPROBE}" -v quiet -print_format json -show_entries format=duration "${file}"`, (e, out) => {
          try { resolve(parseFloat(JSON.parse(out).format.duration) || 0); }
          catch { resolve(0); }
        });
      });
    }

    const adjustedPaths = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const slotDur = Math.max(0.2, srtTimeToSecs(seg.end) - srtTimeToSecs(seg.start));
      const ttsDur  = await getAudioDuration(ttsPaths[i]);
      const adjPath = path.join(ttsAdjDir, `seg_${i}.wav`);

      if (ttsDur > 0 && Math.abs(ttsDur - slotDur) > 0.05) {
        let rate = ttsDur / slotDur;
        // Clamp: atempo aceita 0.5–2.0; para fora disso encadeamos filtros
        let filterStr = '';
        if (rate < 0.5) {
          filterStr = `atempo=0.5,atempo=${(rate/0.5).toFixed(4)}`;
        } else if (rate > 2.0) {
          filterStr = `atempo=2.0,atempo=${(rate/2.0).toFixed(4)}`;
        } else {
          filterStr = `atempo=${rate.toFixed(4)}`;
        }
        await new Promise((resolve, reject) => {
          exec(`"${FFMPEG}" -y -i "${ttsPaths[i]}" -af "${filterStr}" "${adjPath}"`, (e, _, se) => e ? reject(new Error(se)) : resolve());
        });
      } else {
        // Apenas converte para wav sem ajuste
        await new Promise((resolve, reject) => {
          exec(`"${FFMPEG}" -y -i "${ttsPaths[i]}" "${adjPath}"`, (e, _, se) => e ? reject(new Error(se)) : resolve());
        });
      }
      adjustedPaths.push(adjPath);
    }

    // 5. Montar trilha de áudio traduzido: silêncio base + sobrepor cada clipe no timestamp correto
    //    Obtém duração total do vídeo
    const vidDur = await getAudioDuration(audioRaw);
    const silencePath = path.join(ttsDir, 'silence.wav');
    await new Promise((resolve, reject) => {
      exec(`"${FFMPEG}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${vidDur} "${silencePath}"`, (e,_,se) => e ? reject(new Error(se)) : resolve());
    });

    // Overlay iterativo: adiciona cada clipe no timestamp correto sobre a faixa base
    let mixBase = silencePath;
    for (let i = 0; i < segments.length; i++) {
      const delay = Math.round(srtTimeToSecs(segments[i].start) * 1000); // ms
      const mixOut = path.join(ttsDir, `mix_${i}.wav`);
      await new Promise((resolve, reject) => {
        const cmd = `"${FFMPEG}" -y -i "${mixBase}" -i "${adjustedPaths[i]}" -filter_complex "[1]adelay=${delay}|${delay}[a];[0][a]amix=inputs=2:duration=longest,volume=2" "${mixOut}"`;
        exec(cmd, { timeout: 60000 }, (e,_,se) => e ? reject(new Error(se)) : resolve());
      });
      mixBase = mixOut;
    }
    const translatedVoice = mixBase;

    // 6. Mixar voz traduzida com fundo original
    const finalAudio = input + '_final_audio.wav';
    if (noVocalsPath) {
      await new Promise((resolve, reject) => {
        const cmd = `"${FFMPEG}" -y -i "${noVocalsPath}" -i "${translatedVoice}" -filter_complex "[0][1]amix=inputs=2:duration=longest,volume=2" "${finalAudio}"`;
        exec(cmd, (e,_,se) => e ? reject(new Error(se)) : resolve());
      });
    } else {
      fs.copyFileSync(translatedVoice, finalAudio);
    }

    // 7. Substituir áudio no vídeo
    const outputName = 'traducao-' + path.basename(input);
    const output = path.join(UPLOAD_DIR, outputName);
    await new Promise((resolve, reject) => {
      exec(`"${FFMPEG}" -y -i "${input}" -i "${finalAudio}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${output}"`, (e,_,se) => e ? reject(new Error(se)) : resolve());
    });

    // 8. Limpeza de temporários
    [audioRaw, finalAudio].forEach(f => fs.unlink(f, () => {}));
    [ttsDir, ttsAdjDir, demucsOut].forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} });

    scheduleDelete(output, 30 * 60 * 1000);
    const fn = friendlyFilename(meta.originalname, `traduzido ${toLang || ''}`);
    const libEntry = { id: Date.now().toString() + Math.random().toString(36).slice(2), type: 'translate', label: '🌐 Tradução', url: `/uploads/${path.basename(output)}`, createdAt: Date.now(), expiresAt: Date.now() + 30*60*1000, friendlyName: fn };
    addToLibrary(libEntry);
    return res.json({ url: `/uploads/${path.basename(output)}`, id: libEntry.id, friendlyName: fn });

  } catch (e) {
    if (clonedVoiceId) elevenLabsDeleteVoice(clonedVoiceId, elevenlabs_key).catch(() => {});
    return res.status(500).json({ error: e.message });
  }
});

// Traduz um único bloco de texto (usado pelo botão re-traduzir por segmento)
app.post('/api/translate/text', express.json({ limit: '20kb' }), async (req, res) => {
  const { text, api_key: apiKey, api_base: apiBase = 'https://api.anthropic.com', api_model: apiModel = 'openai/gpt-4o-mini', to_lang: toLang = 'en', custom_instructions: customInstructions = '' } = req.body;
  if (!text || !apiKey) return res.status(400).json({ error: 'text e api_key são obrigatórios' });
  const toLangLabel = toLang === 'es-419' ? 'Español latinoamericano (variedade latino-americana, evitar expressões da Espanha)' : toLang;
  const customBlock = customInstructions.trim() ? `\n\nInstruções adicionais que DEVEM ser seguidas:\n${customInstructions}` : '';
  const prompt = `Traduza o seguinte texto para "${toLangLabel}". Retorne SOMENTE o texto traduzido, sem explicações.${customBlock}\n\n${text}`;
  try {
    const isOpenRouter = (apiBase || '').includes('openrouter');
    const reqBody = isOpenRouter
      ? JSON.stringify({ model: apiModel, messages: [{ role: 'user', content: prompt }], max_tokens: 1024 })
      : JSON.stringify({ model: apiModel, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
    const url = new URL(isOpenRouter ? '/api/v1/chat/completions' : '/v1/messages', apiBase);
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    if (!isOpenRouter) { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; delete headers['Authorization']; }
    const translated = await new Promise((resolve, reject) => {
      const data = Buffer.from(reqBody);
      const options = { hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { ...headers, 'Content-Length': data.length } };
      const r = https.request(options, r2 => {
        let body = '';
        r2.on('data', c => body += c);
        r2.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const t = isOpenRouter ? parsed.choices?.[0]?.message?.content : parsed.content?.[0]?.text;
            if (!t) return reject(new Error('Resposta vazia: ' + body.slice(0, 200)));
            resolve(t.trim());
          } catch (e) { reject(e); }
        });
      });
      r.on('error', reject); r.write(data); r.end();
    });
    return res.json({ translated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Serve o Remotion Editor (build de produção)
const editorDist = path.join(__dirname, '..', 'remotion-editor', 'dist');
if (fs.existsSync(editorDist)) {
  app.use('/editor', express.static(editorDist));
  app.get('/editor/*', (_req, res) => res.sendFile(path.join(editorDist, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
