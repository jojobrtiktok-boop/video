import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import type { Scene, OverlayStyle } from '../types';

interface Props {
  videoSrc: string;
  scenes: Scene[];
}

const overlayStyles: Record<OverlayStyle, React.CSSProperties | null> = {
  title_card: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.72)',
    color: '#fff',
    padding: '20px 40px',
    borderRadius: 10,
    fontSize: 52,
    fontWeight: 700,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    maxWidth: '80%',
    lineHeight: 1.2,
  },
  subtitle: {
    position: 'absolute',
    bottom: '8%',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    padding: '10px 32px',
    borderRadius: 4,
    fontSize: 34,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    maxWidth: '82%',
  },
  lower_third: {
    position: 'absolute',
    bottom: '12%',
    left: '5%',
    background: 'rgba(0,70,180,0.92)',
    color: '#fff',
    padding: '12px 24px',
    fontSize: 30,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    borderLeft: '5px solid #00aaff',
    maxWidth: '60%',
    borderRadius: '0 6px 6px 0',
  },
  caption: {
    position: 'absolute',
    bottom: '4%',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 24,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    textShadow: '1px 1px 4px rgba(0,0,0,0.95)',
    maxWidth: '90%',
  },
  none: null,
};

export const VideoComposition: React.FC<Props> = ({ videoSrc, scenes }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {videoSrc && <OffthreadVideo src={videoSrc} />}
      {scenes.map((scene) => {
        if (scene.style === 'none' || !scene.text_overlay.trim()) return null;
        const fromFrame = Math.round(scene.start * fps);
        const durationFrames = Math.max(1, Math.round((scene.end - scene.start) * fps));
        const style = overlayStyles[scene.style];
        if (!style) return null;
        return (
          <Sequence key={scene.id} from={fromFrame} durationInFrames={durationFrames}>
            <div style={style}>{scene.text_overlay}</div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
