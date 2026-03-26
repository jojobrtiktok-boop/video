const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
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

const FFMPEG = process.env.FFMPEG_BIN
  || (process.platform === 'win32' ? 'Z:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
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
      return res.json({ url: `/uploads/${path.basename(output)}` });
    });
    return;
  }

  if (mode === 'delogo') {
    const x = parseInt(req.body.x) || 0;
    const y = parseInt(req.body.y) || 0;
    const w = parseInt(req.body.w) || 100;
    const h = parseInt(req.body.h) || 60;
    const cmd = `"${FFMPEG}" -y -i "${input}" -vf "delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0" -c:a copy "${output}"`;
    exec(cmd, (err, stdout, stderr) => {
      fs.unlink(input, () => {});
      if (err) return res.status(500).json({ error: String(err), stderr });
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${path.basename(output)}` });
    });
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

// ── LIPSYNC via Wav2Lip ───────────────────────────────────────────────────────
app.post('/api/lipsync', uploadFields, (req, res) => {
  const videoFile = req.files && req.files.video && req.files.video[0];
  const audioFile = req.files && req.files.audio && req.files.audio[0];
  if (!videoFile || !audioFile) {
    if (videoFile) fs.unlink(videoFile.path, () => {});
    if (audioFile) fs.unlink(audioFile.path, () => {});
    return res.status(400).json({ error: 'Envie o video e o audio.' });
  }

  const outputName = 'lipsync-' + Date.now() + '.mp4';
  const output     = path.join(UPLOAD_DIR, outputName);
  const python     = process.env.PYTHON_BIN || 'python3';
  const runner     = path.join(__dirname, 'wav2lip_runner.py');

  const cmd = `"${python}" "${runner}" "${videoFile.path}" "${audioFile.path}" "${output}"`;

  exec(cmd, { timeout: 15 * 60 * 1000 }, (err, stdout, stderr) => {
    fs.unlink(videoFile.path, () => {});
    fs.unlink(audioFile.path, () => {});
    if (err) return res.status(500).json({ error: 'Wav2Lip falhou: ' + (stderr || err.message) });
    if (!fs.existsSync(output)) return res.status(500).json({ error: 'Video nao gerado. ' + stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${outputName}` });
  });
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
    return res.json({ url: `/uploads/${path.basename(output)}` });
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

  const python = process.env.PYTHON_BIN || 'python3';
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
  const python = process.env.PYTHON_BIN || 'python3';
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

// ── GENERATE VIDEO via OpenRouter ─────────────────────────────────────────────
app.post('/api/generate-video', express.json(), async (req, res) => {
  const { prompt, videoModel, hookModel, duration, apiKey } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt e obrigatorio.' });
  if (!apiKey)  return res.status(400).json({ error: 'Informe sua API key da OpenRouter.' });

  const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

  function openrouterFetch(endpoint, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const options = {
        hostname: 'openrouter.ai',
        path: `/api/v1/${endpoint}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'HTTP-Referer': 'https://videoforge.app',
          'X-Title': 'VideoForge'
        }
      };
      const req2 = https.request(options, resp => {
        let raw = '';
        resp.on('data', c => { raw += c; });
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ status: resp.statusCode, body: { raw } }); }
        });
      });
      req2.on('error', reject);
      req2.write(data);
      req2.end();
    });
  }

  try {
    // Step 1: Hook specialist AI refines prompt
    const hookSystemMsg = 'Voce e um especialista em hooks virais para video. Transforme a ideia do usuario em um prompt visual otimizado para geracao de video. Foque em: abertura visual forte, acao dinamica, sujeito claro, iluminacao, angulo de camera, mood. Maximo 250 caracteres. Responda APENAS com o prompt de video, sem explicacoes.';
    const selectedHookModel = hookModel || 'google/gemini-flash-1.5';

    const hookResp = await openrouterFetch('chat/completions', {
      model: selectedHookModel,
      messages: [
        { role: 'system', content: hookSystemMsg },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300
    });

    if (hookResp.status !== 200 || hookResp.body.error) {
      return res.status(500).json({ error: 'Hook AI falhou: ' + (hookResp.body.error?.message || JSON.stringify(hookResp.body)) });
    }

    const refinedPrompt = hookResp.body.choices?.[0]?.message?.content?.trim() || prompt;

    // Step 2: Generate video
    const selectedVideoModel = videoModel || 'google/veo-3-flash';
    const videoDuration = Math.max(4, Math.min(60, parseInt(duration) || 8));

    const videoResp = await openrouterFetch('images/generations', {
      model: selectedVideoModel,
      prompt: refinedPrompt,
      duration: videoDuration,
      n: 1
    });

    if (videoResp.status !== 200 || videoResp.body.error) {
      return res.status(500).json({
        error: 'Geracao de video falhou: ' + (videoResp.body.error?.message || JSON.stringify(videoResp.body)),
        refinedPrompt
      });
    }

    const videoUrl = videoResp.body.data?.[0]?.url;
    if (!videoUrl) {
      return res.status(500).json({ error: 'API nao retornou URL do video.', raw: videoResp.body, refinedPrompt });
    }

    return res.json({ url: videoUrl, refinedPrompt });
  } catch (err) {
    return res.status(500).json({ error: 'Erro: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
