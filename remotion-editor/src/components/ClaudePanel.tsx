import React, { useState } from 'react';
import type { Scene, AutoEditResult } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  result: AutoEditResult;
  onScenesUpdated: (scenes: Scene[]) => void;
}

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

const BG = '#080b14';
const SURFACE = '#0d1117';
const SURFACE2 = '#111827';
const BORDER = 'rgba(255,255,255,0.07)';
const ACCENT = '#7c71ff';
const TEXT = '#e2e8f2';
const MUTED = '#6b7280';
const DIM = '#9ca3af';
const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

const SUGGESTIONS = [
  'Deixa os textos mais curtos e impactantes',
  'Adiciona um CTA mais forte no final',
  'Muda o estilo da primeira cena para hook mais agressivo',
  'Coloca mais emojis nos textos',
  'Deixa o estilo mais formal/profissional',
  'Muda as cores de destaque para vermelho',
];

export const ClaudePanel: React.FC<Props> = ({ isOpen, onClose, scenes, result, onScenesUpdated }) => {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/refine-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          request: request.trim(),
          videoInfo: {
            duration: result.duration,
            videoWidth: result.videoWidth,
            videoHeight: result.videoHeight,
            language: result.language,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao refinar');
      onScenesUpdated(data.scenes);
      setLastMsg(`✓ Claude atualizou ${data.scenes.length} cenas`);
      setRequest('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 100, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 56, bottom: 0, width: 380,
        background: BG, borderLeft: `1px solid ${BORDER}`,
        zIndex: 101, display: 'flex', flexDirection: 'column',
        fontFamily: FONT,
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>
              ✨ Pedir ao Claude
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              Descreva as alterações que quer fazer
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8,
              color: DIM, padding: '4px 10px', cursor: 'pointer', fontSize: 18,
              fontFamily: FONT,
            }}
          >×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Suggestions */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Sugestões rápidas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setRequest(s)}
                  style={{
                    background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
                    padding: '8px 12px', color: DIM, cursor: 'pointer',
                    textAlign: 'left', fontSize: 13, fontFamily: FONT,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Current scenes summary */}
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Cenas atuais ({scenes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {scenes.slice(0, 8).map((sc) => (
              <div key={sc.id} style={{
                background: SURFACE, borderRadius: 6, padding: '6px 10px',
                fontSize: 12, color: DIM, border: `1px solid ${BORDER}`,
              }}>
                <span style={{ color: ACCENT, fontWeight: 600 }}>{sc.id}</span>
                {' · '}
                <span style={{ color: '#888', fontSize: 11 }}>{sc.style}</span>
                {' · '}
                {sc.text_overlay || '(sem texto)'}
              </div>
            ))}
            {scenes.length > 8 && (
              <div style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>
                +{scenes.length - 8} cenas...
              </div>
            )}
          </div>

          {lastMsg && (
            <div style={{
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80', marginBottom: 12,
            }}>
              {lastMsg}
            </div>
          )}
          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ padding: 16, borderTop: `1px solid ${BORDER}` }}>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Ex: Deixa a primeira cena com um hook mais agressivo e coloca emojis de fogo..."
            rows={4}
            style={{
              width: '100%', background: SURFACE2, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '10px 12px', color: TEXT,
              fontSize: 13, fontFamily: FONT, resize: 'none', outline: 'none',
              marginBottom: 10,
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSend(); }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !request.trim()}
            style={{
              width: '100%', padding: '12px',
              background: loading || !request.trim() ? SURFACE2 : `linear-gradient(135deg, ${ACCENT}, #b89bff)`,
              border: `1px solid ${loading || !request.trim() ? BORDER : ACCENT}`,
              borderRadius: 10, color: loading || !request.trim() ? MUTED : '#fff',
              fontSize: 14, fontWeight: 700, cursor: loading || !request.trim() ? 'not-allowed' : 'pointer',
              fontFamily: FONT, transition: 'all 0.2s',
              boxShadow: loading || !request.trim() ? 'none' : `0 0 20px ${ACCENT}40`,
            }}
          >
            {loading ? '⏳ Claude está editando...' : '✨ Pedir ao Claude · ⌘Enter'}
          </button>
        </div>
      </div>
    </>
  );
};
