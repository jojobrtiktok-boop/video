import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { VideoComposition } from './compositions/VideoComposition';
import { Timeline } from './components/Timeline';
import { ScenePanel } from './components/ScenePanel';
import type { AutoEditJob, AutoEditResult, Scene } from './types';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

async function startAutoEdit(file: File, model: string, language: string): Promise<string> {
  const fd = new FormData();
  fd.append('video', file);
  fd.append('model', model);
  fd.append('language', language);
  const r = await fetch(`${BACKEND}/api/auto-edit`, { method: 'POST', body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro ao iniciar');
  return j.id as string;
}

async function pollJob(id: string): Promise<AutoEditJob> {
  const r = await fetch(`${BACKEND}/api/auto-edit/${id}`);
  return r.json();
}

export default function App() {
  const [result, setResult]         = useState<AutoEditResult | null>(null);
  const [scenes, setScenes]         = useState<Scene[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobStatus, setJobStatus]   = useState<string>('idle');
  const [progress, setProgress]     = useState(0);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [model, setModel]           = useState('small');
  const [language, setLanguage]     = useState('pt');

  const playerRef = useRef<PlayerRef>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const fps      = result?.fps || 30;
  const duration = result?.duration || 0;
  const currentTime = currentFrame / fps;

  const startPoll = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(jobId);
        setProgress(job.progress);
        const labels: Record<string, string> = {
          transcribing: 'Transcrevendo com Whisper…',
          analyzing:    'Claude analisando cenas…',
          done:         'Pronto!',
          error:        'Erro',
        };
        setJobStatus(labels[job.status] || job.status);
        if (job.status === 'done' && job.result) {
          clearInterval(pollRef.current!);
          setResult(job.result);
          setScenes(job.result.scenes);
          setSelectedId(job.result.scenes[0]?.id || null);
          setJobStatus('done');
        } else if (job.status === 'error') {
          clearInterval(pollRef.current!);
          setErrorMsg(job.error || 'Erro desconhecido');
          setJobStatus('error');
        }
      } catch (e) { console.error('poll error', e); }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFile = async (file: File) => {
    setErrorMsg(null); setResult(null); setScenes([]);
    setSelectedId(null); setProgress(0); setJobStatus('uploading');
    try {
      const jobId = await startAutoEdit(file, model, language);
      setJobStatus('Transcrevendo com Whisper…');
      startPoll(jobId);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setJobStatus('error');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) handleFile(file);
  }, [model, language]); // eslint-disable-line

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateScene = (updated: Scene) =>
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  const handleSeek = (t: number) => playerRef.current?.seekTo(Math.round(t * fps));

  const durationInFrames = Math.max(1, Math.round(duration * fps));
  const videoSrc = result ? `${BACKEND}${result.videoUrl}` : '';
  const isProcessing = ['uploading', 'Transcrevendo com Whisper…', 'Claude analisando cenas…'].includes(jobStatus);

  return (
    <>
      {/* Google Fonts — Inter (igual ao app principal) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={s.root}>
        {/* ── Header igual ao QuickEdit ── */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            {/* Botão voltar */}
            <a href="/editor.html" style={s.backBtn} title="Voltar ao editor">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </a>

            {/* Logo idêntica ao app */}
            <img
              src="https://i.postimg.cc/G34drN65/Chat-GPT-Image-26-de-mar-de-2026-12-07-24-removebg-preview.png"
              alt="QuickEdit"
              style={s.logoImg}
            />
            <span style={s.logoText}>QuickEdit</span>
            <span style={s.logoDivider}>/</span>
            <span style={s.logoSub}>Auto Editor IA</span>
          </div>

          <div style={s.headerRight}>
            {!result && (
              <>
                <select style={s.select} value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="tiny">Whisper tiny (rápido)</option>
                  <option value="small">Whisper small</option>
                  <option value="medium">Whisper medium</option>
                  <option value="large-v3">Whisper large-v3 (preciso)</option>
                </select>
                <select style={s.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="pt">Português</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="auto">Auto detectar</option>
                </select>
              </>
            )}
            {result && (
              <button style={s.btnSecondary} onClick={() => {
                setResult(null); setScenes([]); setJobStatus('idle');
                setProgress(0); setErrorMsg(null);
              }}>
                Novo vídeo
              </button>
            )}
          </div>
        </header>

        {/* ── Conteúdo ── */}
        {!result ? (
          <div style={s.uploadArea}>
            <div
              style={{ ...s.dropzone, ...(isDragging ? s.dropzoneActive : {}) }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div style={s.progressWrap}>
                  <div style={s.progressLabel}>{jobStatus}</div>
                  <div style={s.progressBar}>
                    <div style={{ ...s.progressFill, width: `${progress}%` }} />
                  </div>
                  <div style={s.progressPct}>{progress}%</div>
                </div>
              ) : (
                <>
                  <div style={s.uploadIcon}>🎬</div>
                  <div style={s.uploadTitle}>Arraste seu vídeo aqui</div>
                  <div style={s.uploadSub}>ou clique para selecionar</div>
                  <label style={s.btnPrimary}>
                    Selecionar vídeo
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileInput} />
                  </label>
                  {errorMsg && <div style={s.error}>{errorMsg}</div>}
                </>
              )}
            </div>

            {/* Como funciona */}
            <div style={s.howto}>
              {(['Envie o vídeo', 'Whisper transcreve', 'Claude gera cenas', 'Edite na timeline'] as const).map((label, i) => (
                <React.Fragment key={i}>
                  <div style={s.step}>
                    <span style={s.stepNum}>{i + 1}</span>
                    <span style={s.stepLabel}>{label}</span>
                  </div>
                  {i < 3 && <span style={s.arrow}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div style={s.editorLayout}>
            <div style={s.centerCol}>
              <div style={s.playerWrap}>
                <Player
                  ref={playerRef}
                  component={VideoComposition}
                  inputProps={{ videoSrc, scenes }}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  compositionWidth={1920}
                  compositionHeight={1080}
                  style={{ width: '100%', borderRadius: 10 }}
                  controls
                  loop={false}
                  onFrameUpdate={(f) => setCurrentFrame(f)}
                />
              </div>
              <Timeline
                scenes={scenes}
                duration={duration}
                currentTime={currentTime}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onSeek={handleSeek}
              />
            </div>
            <ScenePanel
              scenes={scenes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={updateScene}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Estilos — paleta idêntica ao QuickEdit ────────────────────────────────────
const BG       = '#080b14';
const SURFACE  = '#0d1117';
const SURFACE2 = '#111827';
const BORDER   = 'rgba(255,255,255,0.07)';
const ACCENT   = '#7c71ff';
const ACCENT_DIM = 'rgba(124,113,255,0.13)';
const TEXT     = '#e2e8f2';
const MUTED    = '#6b7280';
const DIM      = '#9ca3af';

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: BG, color: TEXT,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    overflow: 'hidden',
    backgroundImage: `linear-gradient(rgba(124,113,255,0.025) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(124,113,255,0.025) 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', height: 56, flexShrink: 0,
    background: '#080b14', borderBottom: `1px solid ${BORDER}`,
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    background: SURFACE2, border: `1px solid ${BORDER}`,
    color: DIM, textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    flexShrink: 0,
  },
  logoImg: {
    width: 32, height: 32, objectFit: 'contain',
    filter: 'drop-shadow(0 0 8px rgba(124,113,255,0.35))',
  },
  logoText: {
    fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #fff 20%, #7c71ff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  logoDivider: {
    color: BORDER, fontSize: '1.2rem', fontWeight: 300,
  },
  logoSub: {
    fontSize: '0.82rem', fontWeight: 600, color: ACCENT,
  },
  headerRight: {
    display: 'flex', gap: 10, alignItems: 'center',
  },
  select: {
    background: SURFACE2, border: `1px solid ${BORDER}`,
    borderRadius: 8, color: DIM, padding: '6px 10px',
    fontSize: 13, cursor: 'pointer', outline: 'none',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: ACCENT, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 26px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    marginTop: 14, display: 'inline-block',
    boxShadow: `0 0 28px rgba(124,113,255,0.35)`,
    fontFamily: 'inherit',
  },
  btnSecondary: {
    background: SURFACE2, color: DIM,
    border: `1px solid ${BORDER}`, borderRadius: 8,
    padding: '6px 16px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  uploadArea: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 40, padding: 40,
  },
  dropzone: {
    width: '100%', maxWidth: 540,
    border: `1.5px dashed ${BORDER}`, borderRadius: 16,
    padding: '56px 40px', textAlign: 'center',
    background: SURFACE, transition: 'border-color 0.2s, background 0.2s',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  dropzoneActive: {
    borderColor: ACCENT, background: ACCENT_DIM,
  },
  uploadIcon: { fontSize: 52, marginBottom: 16 },
  uploadTitle: { fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8, letterSpacing: '-0.3px' },
  uploadSub: { fontSize: 13, color: MUTED, marginBottom: 4 },
  progressWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  progressLabel: { fontSize: 15, color: '#a89fff', fontWeight: 600 },
  progressBar: { width: 320, height: 6, background: SURFACE2, borderRadius: 99, overflow: 'hidden' },
  progressFill: {
    height: '100%', borderRadius: 99,
    background: `linear-gradient(90deg, ${ACCENT}, #b89bff)`,
    transition: 'width 0.4s ease',
  },
  progressPct: { fontSize: 12, color: MUTED },
  error: { color: '#f87171', fontSize: 13, marginTop: 14, maxWidth: 400 },
  howto: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  step: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: SURFACE, border: `1px solid ${BORDER}`,
    padding: '8px 14px', borderRadius: 10, color: DIM, fontSize: 13,
  },
  stepNum: {
    background: `linear-gradient(135deg, ${ACCENT}, #b89bff)`,
    color: '#fff', borderRadius: '50%',
    width: 20, height: 20, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  stepLabel: { fontWeight: 500 },
  arrow: { color: BORDER, fontSize: 16 },
  editorLayout: { flex: 1, display: 'flex', overflow: 'hidden' },
  centerCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  playerWrap: {
    flex: 1, padding: '12px 16px 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 0, background: '#050709',
  },
};
