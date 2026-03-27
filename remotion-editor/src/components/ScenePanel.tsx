import React from 'react';
import type { Scene, OverlayStyle } from '../types';

interface Props {
  scenes: Scene[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (updated: Scene) => void;
}

const STYLE_OPTIONS: OverlayStyle[] = ['subtitle', 'title_card', 'lower_third', 'caption', 'none'];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ScenePanel: React.FC<Props> = ({ scenes, selectedId, onSelect, onChange }) => {
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
              <div style={styles.cardTop}>
                <span style={styles.cardTitle}>{sc.title}</span>
                <span style={styles.cardTime}>{formatTime(sc.start)} → {formatTime(sc.end)}</span>
              </div>

              {isSelected && (
                <div style={styles.editor} onClick={(e) => e.stopPropagation()}>
                  <label style={styles.label}>Título da cena</label>
                  <input
                    style={styles.input}
                    value={sc.title}
                    onChange={(e) => onChange({ ...sc, title: e.target.value })}
                    placeholder="Título da cena"
                  />

                  <label style={styles.label}>Texto exibido na tela</label>
                  <input
                    style={styles.input}
                    value={sc.text_overlay}
                    onChange={(e) => onChange({ ...sc, text_overlay: e.target.value })}
                    placeholder="Deixe vazio para sem texto"
                  />

                  <label style={styles.label}>Estilo do texto</label>
                  <select
                    style={styles.select}
                    value={sc.style}
                    onChange={(e) => onChange({ ...sc, style: e.target.value as OverlayStyle })}
                  >
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

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
