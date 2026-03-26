const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Limpa sobras de sessÃµes anteriores no boot
fs.readdirSync(UPLOAD_DIR).forEach(f => {
  try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (_) {}
});
console.log('uploads/ limpo no boot');

// Agenda deleÃ§Ã£o automÃ¡tica de um arquivo apÃ³s delay (ms)
function scheduleDelete(filePath, delayMs) {
  setTimeout(() => {
    fs.unlink(filePath, err => {
      if (!err) console.log('Auto-deletado:', path.basename(filePath));
    });
  }, delayMs);
}

const app = express();

// ffmpeg binary: env var â†’ auto-detect OS â†’ default
// On Linux/Docker: apt installs ffmpeg at /usr/bin/ffmpeg (command = 'ffmpeg')
// On Windows dev: set FFMPEG_BIN=Z:\ffmpeg\bin\ffmpeg.exe  or leave as auto
const FFMPEG = process.env.FFMPEG_BIN
  || (process.platform === 'win32' ? 'Z:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage });
const uploadFields = multer({ storage }).fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 1 }]);
const multiUpload = multer({ storage }).fields([{ name: 'hooks', maxCount: 20 }, { name: 'bodies', maxCount: 20 }]);

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Process endpoint: accepts mode=blur or mode=ai (ai placeholder)
app.post('/api/process', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const mode = req.body.mode || 'blur';
  const input = req.file.path;
  const outputName = 'processed-' + path.basename(input);
  const output = path.join(UPLOAD_DIR, outputName);

  if (mode === 'blur') {
    // Blur a region specified by x,y,w,h (defaults: full-width bottom 60px)
    const x  = parseInt(req.body.x) || 0;
    const y  = parseInt(req.body.y) || -1; // -1 = auto: video_height - h
    const w  = parseInt(req.body.w) || 0;  // 0 = iw (full width)
    const h  = parseInt(req.body.h) || 60;
    const cw = w > 0 ? w : 'iw';
    // crop uses ih (valid in crop), overlay must use main_h in ffmpeg 8+
    const cy = y >= 0 ? y : `ih-${h}`;
    const oy = y >= 0 ? y : `main_h-${h}`;

    const blurFilter = `[0:v]split[main][tmp];[tmp]crop=${cw}:${h}:${x}:${cy},gblur=sigma=20[blurred];[main][blurred]overlay=${x}:${oy}`;
    const cmd = `"${FFMPEG}" -y -i "${input}" -filter_complex "${blurFilter}" -c:a copy "${output}"`;
    exec(cmd, (err, stdout, stderr) => {
      fs.unlink(input, () => {});
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

  // AI mode placeholder: currently returns same file and marks TODO
  if (mode === 'ai') {
    fs.copyFileSync(input, output);
    fs.unlink(input, () => {});
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${path.basename(output)}`, note: 'AI mode placeholder - integrate inpainting API' });
  }

  return res.status(400).json({ error: 'unknown mode' });
});

// Lipsync endpoint (placeholder â€” integrar Wav2Lip futuramente)
app.post('/api/lipsync', uploadFields, (req, res) => {
  const videoFile = req.files && req.files.video && req.files.video[0];
  const audioFile = req.files && req.files.audio && req.files.audio[0];
  if (videoFile) fs.unlink(videoFile.path, () => {});
  if (audioFile) fs.unlink(audioFile.path, () => {});
  return res.status(501).json({ error: 'Lipsync (Wav2Lip) ainda nao instalado neste servidor. Integre o modelo para ativar.' });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SUBTITLE endpoint â€” burns ASS subtitles into video
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/subtitle', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  let subs;
  try { subs = JSON.parse(req.body.subs || '[]'); } catch (_) { return res.status(400).json({ error: 'subs invalido' }); }
  if (!subs.length) return res.status(400).json({ error: 'nenhuma legenda enviada' });

  const preset      = req.body.preset   || 'classico';
  const position    = req.body.position || 'bottom';
  const fontSize    = Math.max(24, Math.min(120, parseInt(req.body.fontsize) || 72));
  const wordByWord  = req.body.wordbyword === '1';
  const align       = position === 'top' ? 8 : 2; // ASS alignment: 2=bottom-center, 8=top-center

  // ASS colors: &HAABBGGRR (AA=alpha 00=opaque, then B G R bytes)
  // Presets inspired by CapCut popular styles
  const STYLES = {
    classico: `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,${align},10,10,50,1`,
    amarelo:  `Style: Default,Arial,${fontSize},&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,${align},10,10,50,1`,
    caixa:    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,10,0,${align},20,20,50,1`,
    neon:     `Style: Default,Arial,${fontSize},&H0041FF00,&H0041FF00,&H00003200,&H00000000,-1,0,0,0,100,100,0,0,1,2,4,${align},10,10,50,1`,
    capcut:   `Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${align},10,10,50,1`,
  };

  // Parse "M:SS" / "MM:SS" / "H:MM:SS" â†’ total seconds (float)
  function timeStrToSecs(t) {
    const parts = String(t).trim().split(':').map(s => parseFloat(s) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  // Total seconds â†’ ASS time "H:MM:SS.CC"
  function secsToAssTime(totalSecs) {
    const h  = Math.floor(totalSecs / 3600);
    const m  = Math.floor((totalSecs % 3600) / 60);
    const s  = totalSecs % 60;
    const cs = Math.round((s % 1) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(Math.floor(s)).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  // Backwards-compat wrapper (accepts "M:SS" string)
  function toAssTime(t) { return secsToAssTime(timeStrToSecs(t)); }

  // Expand subs: word-by-word mode splits each entry into one Dialogue per word
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
  const dialogues = finalSubs.map(sub =>
    `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${String(sub.text).replace(/\n/g, '\\N').replace(/,/g, '{\\,}')}`
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

  // Escape for ffmpeg filter: forward slashes + escape drive-letter colon
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CREATIVE COMBINER â€” stage + run endpoints
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Stage: upload all hooks + bodies, return their server IDs
app.post('/api/combine/stage', multiUpload, (req, res) => {
  const hookF = (req.files && req.files.hooks)  || [];
  const bodyF = (req.files && req.files.bodies) || [];
  if (!hookF.length || !bodyF.length) {
    [...hookF, ...bodyF].forEach(f => fs.unlink(f.path, () => {}));
    return res.status(400).json({ error: 'Envie pelo menos 1 hook e 1 corpo.' });
  }
  // 2h window â€” gives time for NÃ—M sequential processing
  [...hookF, ...bodyF].forEach(f => scheduleDelete(f.path, 2 * 60 * 60 * 1000));
  return res.json({
    hookIds:   hookF.map(f => path.basename(f.path)),
    hookNames: hookF.map(f => f.originalname),
    bodyIds:   bodyF.map(f => path.basename(f.path)),
    bodyNames: bodyF.map(f => f.originalname),
  });
});

// Run: concatenate one hook + one body into a combined video
app.post('/api/concat/run', (req, res) => {
  const { hookId, bodyId } = req.body || {};
  const safeRe = /^[\w.\-]+$/;
  if (!hookId || !bodyId || !safeRe.test(hookId) || !safeRe.test(bodyId))
    return res.status(400).json({ error: 'IDs invÃ¡lidos.' });

  const hookPath = path.join(UPLOAD_DIR, hookId);
  const bodyPath = path.join(UPLOAD_DIR, bodyId);
  if (!fs.existsSync(hookPath) || !fs.existsSync(bodyPath))
    return res.status(404).json({ error: 'Arquivo nÃ£o encontrado. FaÃ§a o upload novamente.' });

  const outputName = 'combo-' + Date.now() + '.mp4';
  const output = path.join(UPLOAD_DIR, outputName);

  // Scale both inputs to 720Ã—1280 (Reels/TikTok/Shorts portrait format)
  const scale = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,setpts=PTS-STARTPTS';

  // Try with audio first; fall back to video-only if a stream is missing
  const filterAV = `[0:v]${scale}[v0];[1:v]${scale}[v1];[0:a]aresample=44100[a0];[1:a]aresample=44100[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
  const cmdAV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterAV}" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -crf 23 -c:a aac "${output}"`;

  exec(cmdAV, (err) => {
    if (!err) {
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${outputName}` });
    }
    // Fallback: no audio
    const filterV = `[0:v]${scale}[v0];[1:v]${scale}[v1];[v0][v1]concat=n=2:v=1:a=0[outv]`;
    const cmdV = `"${FFMPEG}" -y -i "${hookPath}" -i "${bodyPath}" -filter_complex "${filterV}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -an "${output}"`;
    exec(cmdV, (err2, _out, stderr2) => {
      if (err2) return res.status(500).json({ error: String(err2), stderr: stderr2 });
      scheduleDelete(output, 30 * 60 * 1000);
      return res.json({ url: `/uploads/${outputName}` });
    });
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EXTRAIR endpoints
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 1. Extrair VÃ­deo â€” remove audio stream, keep video only
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

// 2. Juntar â€” replace audio in video with a new audio file
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
    return res.status(400).json({ error: 'Envie o vÃ­deo e o Ã¡udio.' });
  }
  const outputName = 'merged-' + Date.now() + '.mp4';
  const output = path.join(UPLOAD_DIR, outputName);
  // -map 0:v takes video from input 0, -map 1:a takes audio from input 1, -shortest trims to shorter
  const cmd = `"${FFMPEG}" -y -i "${videoFile.path}" -i "${audioFile.path}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${output}"`;
  exec(cmd, (err, _out, stderr) => {
    fs.unlink(videoFile.path, () => {});
    fs.unlink(audioFile.path, () => {});
    if (err) return res.status(500).json({ error: String(err), stderr });
    scheduleDelete(output, 30 * 60 * 1000);
    return res.json({ url: `/uploads/${outputName}` });
  });
});

// 3. Transcrever â€” extract audio then transcribe via OpenAI Whisper API
app.post('/api/extract/transcribe', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fs.unlink(req.file.path, () => {});
    return res.status(503).json({ error: 'TranscriÃ§Ã£o requer a variÃ¡vel de ambiente OPENAI_API_KEY configurada no servidor.' });
  }
  const input = req.file.path;
  const audioName = 'audio-' + Date.now() + '.mp3';
  const audioPath = path.join(UPLOAD_DIR, audioName);
  // Extract audio as MP3 (16kHz mono for best Whisper accuracy)
  const extractCmd = `"${FFMPEG}" -y -i "${input}" -vn -ar 16000 -ac 1 -c:a libmp3lame -q:a 4 "${audioPath}"`;
  exec(extractCmd, (err, _out, stderr) => {
    fs.unlink(input, () => {});
    if (err) return res.status(500).json({ error: 'Falha ao extrair Ã¡udio: ' + String(err), stderr });

    // Send to OpenAI Whisper API via multipart form
    const audioData = fs.readFileSync(audioPath);
    fs.unlink(audioPath, () => {});

    const boundary = '----FormBoundary' + Date.now().toString(16);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
      audioData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const https = require('https');
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    };
    const apiReq = https.request(options, apiResp => {
      let data = '';
      apiResp.on('data', chunk => { data += chunk; });
      apiResp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return res.status(500).json({ error: json.error.message || JSON.stringify(json.error) });
          return res.json({ text: json.text || '' });
        } catch (_) {
          return res.status(500).json({ error: 'Resposta invÃ¡lida da API: ' + data.substring(0, 200) });
        }
      });
    });
    apiReq.on('error', e => res.status(500).json({ error: 'Erro de rede com a API: ' + e.message }));
    apiReq.write(body);
    apiReq.end();
  });
});

// ── LEGENDAS AUTOMÁTICAS (faster-whisper local) ──────────────────────────────
const captionUpload = multer({ storage }).single('video');

app.post('/api/caption', (req, res) => {
  captionUpload(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no file' });

    const input    = req.file.path;
    const mode     = req.body.mode || 'srt';      // 'srt' ou 'burn'
    const lang     = req.body.lang || 'pt';        // 'pt', 'en', 'auto'
    const model    = req.body.model || 'small';    // 'tiny','base','small','medium'
    const fontSize = parseInt(req.body.fontSize) || 18;
    const fontColor= (req.body.fontColor || 'white').replace(/[^a-zA-Z0-9]/g, '');

    const srtPath  = input + '.srt';
    const python   = process.env.PYTHON_BIN || 'python3';
    const script   = path.join(__dirname, 'transcribe.py');

    const transcribeCmd = `"${python}" "${script}" "${input}" "${model}" "${lang}"`;

    exec(transcribeCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) {
        fs.unlink(input, () => {});
        return res.status(500).json({ error: 'Transcrição falhou: ' + (stderr || err.message) });
      }

      const srtContent = stdout.trim();
      if (!srtContent) {
        fs.unlink(input, () => {});
        return res.status(500).json({ error: 'Nenhuma fala detectada no vídeo.' });
      }

      if (mode === 'srt') {
        // Retorna o SRT como download
        fs.unlink(input, () => {});
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="legendas.srt"');
        return res.send(srtContent);
      }

      // mode === 'burn': queima legendas no vídeo com ffmpeg
      fs.writeFile(srtPath, srtContent, 'utf8', writeErr => {
        if (writeErr) {
          fs.unlink(input, () => {});
          return res.status(500).json({ error: 'Erro ao salvar SRT: ' + writeErr.message });
        }

        const outputName = 'captioned-' + path.basename(input);
        const output = path.join(UPLOAD_DIR, outputName);
        // Escape path separators for ffmpeg subtitles filter
        const srtEscaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        const burnCmd = `"${FFMPEG}" -y -i "${input}" -vf "subtitles='${srtEscaped}':force_style='FontSize=${fontSize},PrimaryColour=&H00ffffff&,OutlineColour=&H00000000&,BorderStyle=3,Outline=1'" -c:a copy "${output}"`;

        exec(burnCmd, { timeout: 10 * 60 * 1000 }, (burnErr, _stdout, burnStderr) => {
          fs.unlink(input, () => {});
          fs.unlink(srtPath, () => {});
          if (burnErr) return res.status(500).json({ error: 'ffmpeg falhou: ' + burnStderr });
          scheduleDelete(output, 30 * 60 * 1000);
          return res.json({ url: `/uploads/${path.basename(output)}` });
        });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
