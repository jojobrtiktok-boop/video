import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { VideoComposition } from './compositions/VideoComposition';
import { Timeline } from './components/Timeline';
import { ScenePanel } from './components/ScenePanel';
import type { AutoEditJob, AutoEditResult, Scene } from './types';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

// ── Upload e análise ─────────────────────────────────────────────────────────
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

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [result, setResult] = useState<AutoEditResult | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [model, setModel] = useState('small');
  const [language, setLanguage] = useState('pt');

  const playerRef = useRef<PlayerRef>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fps = result?.fps || 30;
  const duration = result?.duration || 0;
  const currentTime = currentFrame / fps;

  // Polling do job
  const startPoll = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(jobId);
        setProgress(job.progress);
        const statusLabel: Record<string, string> = {
          transcribing: 'Transcrevendo com Whisper…',
          analyzing: 'Claude analisando cenas…',
          done: 'Pronto!',
          error: 'Erro',
        };
        setJobStatus(statusLabel[job.status] || job.status);
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
      } catch (e) {
        console.error('poll error', e);
      }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Drag & drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith('video/')) return;
    await handleFile(file);
  }, [model, language]); // eslint-disable-line

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setResult(null);
    setScenes([]);
    setSelectedId(null);
    setProgress(0);
    setJobStatus('uploading');
    try {
      const jobId = await startAutoEdit(file, model, language);
      setJobStatus('Transcrevendo com Whisper…');
      startPoll(jobId);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setJobStatus('error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateScene = (updated: Scene) => {
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSeek = (t: number) => {
    const frame = Math.round(t * fps);
    playerRef.current?.seekTo(frame);
  };

  const durationInFrames = Math.max(1, Math.round(duration * fps));
  const videoSrc = result ? `${BACKEND}${result.videoUrl}` : '';

  // ── Render ───────────────────────────────────────────────────────────────
  const isProcessing = ['uploading', 'Transcrevendo com Whisper…', 'Claude analisando cenas…'].includes(jobStatus);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ color: '#3b82f6' }}>Auto</span> Editor
        </div>
        <div style={styles.headerControls}>
          {!result && (
            <>
              <select style={styles.select} value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="tiny">Whisper tiny (rápido)</option>
                <option value="small">Whisper small</option>
                <option value="medium">Whisper medium</option>
                <option value="large-v3">Whisper large-v3 (preciso)</option>
              </select>
              <select style={styles.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="auto">Auto detectar</option>
              </select>
            </>
          )}
          {result && (
            <button style={styles.btnSecondary} onClick={() => {
              setResult(null); setScenes([]); setJobStatus('idle'); setProgress(0); setErrorMsg(null);
            }}>
              Novo vídeo
            </button>
          )}
        </div>
      </div>

      {/* Área principal */}
      {!result ? (
        <div style={styles.uploadArea}>
          {/* Upload dropzone */}
          <div
            style={{ ...styles.dropzone, ...(isDragging ? styles.dropzoneActive : {}) }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div style={styles.progressWrap}>
                <div style={styles.progressLabel}>{jobStatus}</div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>
                <div style={styles.progressPct}>{progress}%</div>
              </div>
            ) : (
              <>
                <div style={styles.uploadIcon}>🎬</div>
                <div style={styles.uploadTitle}>Arraste seu vídeo aqui</div>
                <div style={styles.uploadSub}>ou clique para escolher</div>
                <label style={styles.btnPrimary}>
                  Selecionar vídeo
                  <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileInput} />
                </label>
                {errorMsg && <div style={styles.error}>{errorMsg}</div>}
              </>
            )}
          </div>

          {/* Como funciona */}
          <div style={styles.howto}>
            <div style={styles.step}><span style={styles.stepNum}>1</span><span>Envie seu vídeo</span></div>
            <div style={styles.arrow}>→</div>
            <div style={styles.step}><span style={styles.stepNum}>2</span><span>Whisper transcreve</span></div>
            <div style={styles.arrow}>→</div>
            <div style={styles.step}><span style={styles.stepNum}>3</span><span>Claude gera cenas</span></div>
            <div style={styles.arrow}>→</div>
            <div style={styles.step}><span style={styles.stepNum}>4</span><span>Edite e exporte</span></div>
          </div>
        </div>
      ) : (
        <div style={styles.editorLayout}>
          {/* Player + Timeline */}
          <div style={styles.centerCol}>
            <div style={styles.playerWrap}>
              <Player
                ref={playerRef}
                component={VideoComposition}
                inputProps={{ videoSrc, scenes }}
                durationInFrames={durationInFrames}
                fps={fps}
                compositionWidth={1920}
                compositionHeight={1080}
                style={{ width: '100%', borderRadius: 8 }}
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

          {/* Painel de cenas */}
          <ScenePanel
            scenes={scenes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={updateScene}
          />
        </div>
      )}
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f0f0f',
    color: '#e0e0e0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid #222',
    background: '#141414',
    flexShrink: 0,
  },
  logo: {
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  headerControls: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  select: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    padding: '6px 10px',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  },
  btnPrimary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 12,
    display: 'inline-block',
  },
  btnSecondary: {
    background: '#1e1e1e',
    color: '#ccc',
    border: '1px solid #333',
    borderRadius: 6,
    padding: '6px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  uploadArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    padding: 40,
  },
  dropzone: {
    width: '100%',
    maxWidth: 560,
    border: '2px dashed #333',
    borderRadius: 16,
    padding: '60px 40px',
    textAlign: 'center',
    transition: 'border-color 0.2s, background 0.2s',
    background: '#141414',
  },
  dropzoneActive: {
    borderColor: '#2563eb',
    background: '#0d1a2e',
  },
  uploadIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ddd',
    marginBottom: 8,
  },
  uploadSub: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  progressLabel: {
    fontSize: 15,
    color: '#93c5fd',
    fontWeight: 600,
  },
  progressBar: {
    width: 320,
    height: 8,
    background: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
    borderRadius: 4,
    transition: 'width 0.4s ease',
  },
  progressPct: {
    fontSize: 13,
    color: '#666',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    marginTop: 14,
    maxWidth: 400,
  },
  howto: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#555',
    fontSize: 13,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#1a1a1a',
    padding: '8px 14px',
    borderRadius: 8,
    color: '#aaa',
  },
  stepNum: {
    background: '#2563eb',
    color: '#fff',
    borderRadius: '50%',
    width: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  arrow: {
    color: '#333',
    fontSize: 18,
  },
  editorLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  centerCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  playerWrap: {
    flex: 1,
    padding: '12px 16px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    background: '#0a0a0a',
  },
};
