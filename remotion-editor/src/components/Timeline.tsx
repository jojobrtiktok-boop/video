import React, { useRef } from 'react';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
}

const SCENE_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#0891b2', '#ca8a04', '#dc2626',
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const Timeline: React.FC<Props> = ({
  scenes, duration, currentTime, selectedId, onSelect, onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const pct = (t: number) => `${((t / duration) * 100).toFixed(3)}%`;

  return (
    <div style={styles.wrap}>
      {/* Régua de tempo */}
      <div style={styles.ruler}>
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} style={{ ...styles.tick, left: `${i * 10}%` }}>
            {formatTime((duration * i) / 10)}
          </span>
        ))}
      </div>

      {/* Trilha de cenas */}
      <div ref={trackRef} style={styles.track} onClick={handleTrackClick}>
        {scenes.map((sc, idx) => (
          <div
            key={sc.id}
            title={sc.title}
            onClick={(e) => { e.stopPropagation(); onSelect(sc.id); }}
            style={{
              ...styles.sceneBlock,
              left: pct(sc.start),
              width: pct(sc.end - sc.start),
              background: SCENE_COLORS[idx % SCENE_COLORS.length],
              opacity: selectedId === sc.id ? 1 : 0.75,
              outline: selectedId === sc.id ? '2px solid #fff' : 'none',
            }}
          >
            <span style={styles.sceneLabel}>{sc.title}</span>
          </div>
        ))}

        {/* Indicador de posição atual */}
        <div
          style={{
            ...styles.playhead,
            left: pct(currentTime),
          }}
        />
      </div>

      <div style={styles.timeDisplay}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#1a1a1a',
    borderTop: '1px solid #333',
    padding: '8px 12px 4px',
    userSelect: 'none',
  },
  ruler: {
    position: 'relative',
    height: 18,
    marginBottom: 4,
  },
  tick: {
    position: 'absolute',
    fontSize: 11,
    color: '#888',
    transform: 'translateX(-50%)',
  },
  track: {
    position: 'relative',
    height: 40,
    background: '#111',
    borderRadius: 4,
    cursor: 'pointer',
    overflow: 'hidden',
  },
  sceneBlock: {
    position: 'absolute',
    height: '100%',
    borderRadius: 3,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 6,
    overflow: 'hidden',
    transition: 'opacity 0.1s',
  },
  sceneLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    background: '#fff',
    pointerEvents: 'none',
    zIndex: 10,
  },
  timeDisplay: {
    textAlign: 'right',
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
};
