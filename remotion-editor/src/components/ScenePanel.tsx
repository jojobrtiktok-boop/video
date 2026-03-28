import React, { useState } from 'react';
import type { Scene, StyleVariant, AnimationType } from '../types';
import { STYLE_COLORS, STYLE_LABELS } from '../types';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

interface Props {
  scenes: Scene[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (updated: Scene) => void;
  isPortrait?: boolean;
}

const STYLE_OPTIONS: StyleVariant[] = [
  'hook', 'bold_claim', 'question',
  'problem', 'agitation', 'story',
  'solution', 'proof', 'urgency', 'cta',
  'subtitle', 'lower_third', 'caption',
  'word_subtitle', 'image_bg', 'none',
];

const ANIM_OPTIONS: AnimationType[] = ['zoom', 'slide_up', 'slide_left', 'slide_right', 'shake', 'typewriter', 'fade', 'none'];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ScenePanel: React.FC<Props> = ({ scenes, selectedId, onSelect, onChange, isPortrait = true }) => {
  const [imgLoading, setImgLoading] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  const hasFalKey = true; // backend valida; se não tiver, retorna erro

  const generateImage = async (sc: Scene) => {
    const imagePrompt = sc.description || sc.title || sc.text_overlay || 'cinematic video scene';
    setImgLoading(sc.id);
    setImgError(null);
    try {
      const res = await fetch(`${BACKEND}/api/generate-scene-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          sceneId: sc.id,
          orientation: isPortrait ? 'portrait' : 'landscape',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar imagem');
      onChange({ ...sc, image_url: data.url, style: sc.style === 'none' ? 'image_bg' : sc.style });
    } catch (e: unknown) {
      setImgError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgLoading(null);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>Cenas ({scenes.length})</div>
      <div style={styles.list}>
        {scenes.map((sc) => {
          const isSelected = sc.id === selectedId;
          return (
            <div
              key={sc.id}
              onClick={() => onSelect(sc.id)}
              style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}
            >
              {/* Card header com color dot do estilo */}
              <div style={styles.cardTop}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: STYLE_COLORS[sc.style] || '#444',
                  }} />
                  <span style={styles.cardTitle}>{sc.title}</span>
                </div>
                <span style={styles.cardTime}>{formatTime(sc.start)} → {formatTime(sc.end)}</span>
              </div>
              {/* Badge do estilo */}
              <div style={{ paddingLeft: 14, paddingBottom: isSelected ? 0 : 4 }}>
                <span style={{
                  fontSize: 10, color: STYLE_COLORS[sc.style] || '#666',
                  fontWeight: 700, letterSpacing: 0.5,
                }}>
                  {sc.style.toUpperCase()}
                </span>
              </div>

              {isSelected && (
                <div style={styles.editor} onClick={(e) => e.stopPropagation()}>
                  <label style={styles.label}>Texto na tela <span style={{ color: '#555', fontWeight: 400 }}>(máx 45 chars)</span></label>
                  <input
                    style={styles.input}
                    value={sc.text_overlay}
                    onChange={(e) => onChange({ ...sc, text_overlay: e.target.value })}
                    placeholder="Texto impactante ou vazio"
                    maxLength={55}
                  />
                  <div style={{ fontSize: 10, color: sc.text_overlay.length > 45 ? '#f87171' : '#555', textAlign: 'right', marginTop: -4 }}>
                    {sc.text_overlay.length}/45
                  </div>

                  <label style={styles.label}>Emoji <span style={{ color: '#555', fontWeight: 400 }}>(1 emoji, opcional)</span></label>
                  <input
                    style={{ ...styles.input, width: 60 }}
                    value={sc.emoji || ''}
                    onChange={(e) => onChange({ ...sc, emoji: e.target.value })}
                    placeholder="🔥"
                    maxLength={4}
                  />

                  <label style={styles.label}>Estilo VSL</label>
                  <select
                    style={styles.select}
                    value={sc.style}
                    onChange={(e) => onChange({ ...sc, style: e.target.value as StyleVariant })}
                  >
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STYLE_LABELS[s as StyleVariant] || s}</option>
                    ))}
                  </select>

                  <label style={styles.label}>Animação de entrada</label>
                  <select
                    style={styles.select}
                    value={sc.animation || 'fade'}
                    onChange={(e) => onChange({ ...sc, animation: e.target.value as AnimationType })}
                  >
                    {ANIM_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>

                  <label style={styles.label}>Cor de destaque</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={sc.accent_color || STYLE_COLORS[sc.style] || '#7c71ff'}
                      onChange={(e) => onChange({ ...sc, accent_color: e.target.value })}
                      style={{ width: 36, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      value={sc.accent_color || ''}
                      onChange={(e) => onChange({ ...sc, accent_color: e.target.value })}
                      placeholder={STYLE_COLORS[sc.style] || '#7c71ff'}
                    />
                  </div>

                  {/* Imagem IA por cena */}
                  <label style={styles.label}>
                    Imagem IA <span style={{ color: '#555', fontWeight: 400 }}>(FLUX Schnell)</span>
                  </label>
                  {sc.image_url && (
                    <div style={{ position: 'relative', marginBottom: 4 }}>
                      <img
                        src={sc.image_url}
                        alt="Cena IA"
                        style={{ width: '100%', borderRadius: 6, display: 'block', maxHeight: 120, objectFit: 'cover' }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); onChange({ ...sc, image_url: null }); }}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4,
                          color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '2px 6px',
                        }}
                        title="Remover imagem"
                      >✕</button>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); generateImage(sc); }}
                    disabled={imgLoading === sc.id}
                    style={{
                      width: '100%', padding: '7px 10px',
                      background: imgLoading === sc.id ? '#1a1a1a' : 'rgba(124,113,255,0.15)',
                      border: '1px solid rgba(124,113,255,0.35)',
                      borderRadius: 4, color: imgLoading === sc.id ? '#555' : '#a89fff',
                      fontSize: 12, fontWeight: 600, cursor: imgLoading === sc.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', marginBottom: 2,
                    }}
                  >
                    {imgLoading === sc.id ? '⏳ Gerando…' : sc.image_url ? '🔄 Regerar Imagem' : '🎨 Gerar Imagem IA'}
                  </button>
                  {imgError && imgLoading !== sc.id && (
                    <div style={{ fontSize: 10, color: '#f87171', marginBottom: 4 }}>{imgError}</div>
                  )}

                  <label style={styles.label}>Título interno da cena</label>
                  <input
                    style={styles.input}
                    value={sc.title}
                    onChange={(e) => onChange({ ...sc, title: e.target.value })}
                    placeholder="Nome interno da cena"
                  />

                  <label style={styles.label}>Descrição</label>
                  <textarea
                    style={styles.textarea}
                    value={sc.description}
                    onChange={(e) => onChange({ ...sc, description: e.target.value })}
                    rows={2}
                  />

                  <div style={styles.timings}>
                    <div>
                      <label style={styles.label}>Início (s)</label>
                      <input
                        style={{ ...styles.input, width: 80 }}
                        type="number"
                        step="0.1"
                        value={sc.start}
                        onChange={(e) => onChange({ ...sc, start: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Fim (s)</label>
                      <input
                        style={{ ...styles.input, width: 80 }}
                        type="number"
                        step="0.1"
                        value={sc.end}
                        onChange={(e) => onChange({ ...sc, end: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: 300,
    minWidth: 280,
    background: '#161616',
    borderLeft: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    fontWeight: 700,
    fontSize: 13,
    color: '#aaa',
    borderBottom: '1px solid #2a2a2a',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    overflowY: 'auto',
    flex: 1,
  },
  card: {
    padding: '10px 14px',
    borderBottom: '1px solid #222',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  cardSelected: {
    background: '#1e2a3a',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardTime: {
    fontSize: 11,
    color: '#666',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  editor: {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 11,
    color: '#777',
    marginBottom: 2,
    display: 'block',
  },
  input: {
    width: '100%',
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: 4,
    padding: '5px 8px',
    color: '#e0e0e0',
    fontSize: 12,
    outline: 'none',
  },
  select: {
    width: '100%',
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: 4,
    padding: '5px 8px',
    color: '#e0e0e0',
    fontSize: 12,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: 4,
    padding: '5px 8px',
    color: '#e0e0e0',
    fontSize: 12,
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },
  timings: {
    display: 'flex',
    gap: 12,
  },
};
