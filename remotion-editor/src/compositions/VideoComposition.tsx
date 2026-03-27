import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
} from 'remotion';
import type { Scene, StyleVariant, AnimationType } from '../types';

interface Props {
  videoSrc: string;
  scenes: Scene[];
}

// ── Animation hook ──────────────────────────────────────────────────────────
function useSceneAnimation(animation: AnimationType, durationFrames: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.75 },
    durationInFrames: Math.min(20, durationFrames * 0.4),
  });

  const exitOpacity = interpolate(
    frame,
    [Math.max(0, durationFrames - 10), durationFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = entrance * exitOpacity;
  const translateY = animation === 'slide_up' ? interpolate(entrance, [0, 1], [60, 0]) : 0;
  const translateX = animation === 'slide_left' ? interpolate(entrance, [0, 1], [-80, 0]) : 0;
  const scale = animation === 'zoom' ? interpolate(entrance, [0, 1], [0.82, 1]) : 1;

  return {
    opacity,
    transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scale})`,
  };
}

// ── Individual overlay styles ─────────────────────────────────────────────
const FONT = "'Helvetica Neue', 'Inter', 'Segoe UI', Arial, sans-serif";

function HookOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'zoom', durationFrames);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      {/* Bottom gradient for readability */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)',
      }} />
      {/* Main hook text */}
      <div style={{
        position: 'absolute', bottom: '15%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', width: '88%',
      }}>
        {/* Accent line above */}
        <div style={{
          width: 60, height: 4, background: accent,
          borderRadius: 99, margin: '0 auto 16px',
        }} />
        <div style={{
          fontSize: 68, fontWeight: 900, color: '#fff',
          lineHeight: 1.08, fontFamily: FONT,
          textShadow: '0 2px 24px rgba(0,0,0,0.9)',
          letterSpacing: '-1px',
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ProblemOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'slide_up', durationFrames);
  const accent = scene.accent_color || '#ef4444';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '10%', left: 0, right: 0,
        padding: '0 32px', opacity, transform,
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.78)',
          borderLeft: `5px solid ${accent}`,
          borderRadius: '0 12px 12px 0',
          padding: '18px 24px',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            fontSize: 42, fontWeight: 800, color: '#fff',
            fontFamily: FONT, lineHeight: 1.2,
            textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SolutionOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'slide_left', durationFrames);
  const accent = scene.accent_color || '#22c55e';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '12%', left: 0, right: 0,
        padding: '0 32px', opacity, transform,
      }}>
        <div style={{
          background: `linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.6))`,
          border: `2px solid ${accent}40`,
          borderRadius: 16,
          padding: '20px 28px',
          boxShadow: `0 0 40px ${accent}30`,
        }}>
          {/* Green top accent bar */}
          <div style={{
            width: '100%', height: 3, background: accent,
            borderRadius: 99, marginBottom: 14,
          }} />
          <div style={{
            fontSize: 44, fontWeight: 800, color: '#fff',
            fontFamily: FONT, lineHeight: 1.2,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ProofOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'fade', durationFrames);
  const accent = scene.accent_color || '#f59e0b';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: '8%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', minWidth: 320, maxWidth: '80%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          border: `2px solid ${accent}`,
          borderRadius: 14,
          padding: '16px 32px',
          boxShadow: `0 4px 40px ${accent}40`,
        }}>
          <div style={{
            fontSize: 20, fontWeight: 700, color: accent,
            fontFamily: FONT, textTransform: 'uppercase',
            letterSpacing: 2, marginBottom: 8,
          }}>
            ⭐ PROVA
          </div>
          <div style={{
            fontSize: 38, fontWeight: 900, color: '#fff',
            fontFamily: FONT, lineHeight: 1.2,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CtaOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform } = useSceneAnimation(scene.animation || 'slide_up', durationFrames);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  // Pulse effect on the CTA
  const pulse = interpolate(Math.sin(frame / fps * Math.PI * 2), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        transform: `translateX(-50%) ${transform} scale(${pulse})`,
        opacity, textAlign: 'center',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          borderRadius: 14,
          padding: '18px 48px',
          boxShadow: `0 4px 40px ${accent}80, 0 0 80px ${accent}30`,
          border: `1px solid ${accent}88`,
        }}>
          <div style={{
            fontSize: 44, fontWeight: 900, color: '#fff',
            fontFamily: FONT, lineHeight: 1.15,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SubtitleOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'fade', durationFrames);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '6%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '85%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.78)',
          borderRadius: 8,
          padding: '10px 28px',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            fontSize: 36, fontWeight: 700, color: '#fff',
            fontFamily: FONT, lineHeight: 1.3,
            textShadow: '0 1px 6px rgba(0,0,0,0.8)',
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function LowerThirdOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'slide_left', durationFrames);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '12%', left: 0,
        maxWidth: '75%', opacity, transform,
      }}>
        <div style={{
          background: 'rgba(8,11,20,0.88)',
          borderLeft: `6px solid ${accent}`,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 12px 12px 0',
          padding: '14px 28px 14px 20px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            fontSize: 32, fontWeight: 700, color: '#fff',
            fontFamily: FONT, lineHeight: 1.2,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CaptionOverlay({ scene, durationFrames }: { scene: Scene; durationFrames: number }) {
  const { opacity, transform } = useSceneAnimation(scene.animation || 'fade', durationFrames);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '4%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '90%',
      }}>
        <div style={{
          fontSize: 26, fontWeight: 500, color: 'rgba(255,255,255,0.88)',
          fontFamily: FONT, lineHeight: 1.4,
          textShadow: '0 1px 6px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.8)',
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene overlay dispatcher ───────────────────────────────────────────────
function SceneOverlay({ scene, fps }: { scene: Scene; fps: number }) {
  if (scene.style === 'none' || !scene.text_overlay?.trim()) return null;
  const durationFrames = Math.max(2, Math.round((scene.end - scene.start) * fps));

  switch (scene.style) {
    case 'hook':       return <HookOverlay       scene={scene} durationFrames={durationFrames} />;
    case 'problem':    return <ProblemOverlay     scene={scene} durationFrames={durationFrames} />;
    case 'solution':   return <SolutionOverlay    scene={scene} durationFrames={durationFrames} />;
    case 'proof':      return <ProofOverlay       scene={scene} durationFrames={durationFrames} />;
    case 'cta':        return <CtaOverlay         scene={scene} durationFrames={durationFrames} />;
    case 'subtitle':   return <SubtitleOverlay    scene={scene} durationFrames={durationFrames} />;
    case 'lower_third':return <LowerThirdOverlay  scene={scene} durationFrames={durationFrames} />;
    case 'caption':    return <CaptionOverlay     scene={scene} durationFrames={durationFrames} />;
    default:           return null;
  }
}

// ── Main composition ───────────────────────────────────────────────────────
export const VideoComposition: React.FC<Props> = ({ videoSrc, scenes }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {videoSrc && (
        <OffthreadVideo
          src={videoSrc}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
        />
      )}
      {scenes.map((scene) => {
        if (scene.style === 'none' || !scene.text_overlay?.trim()) return null;
        const fromFrame = Math.round(scene.start * fps);
        const durationFrames = Math.max(2, Math.round((scene.end - scene.start) * fps));
        return (
          <Sequence key={scene.id} from={fromFrame} durationInFrames={durationFrames}>
            <SceneOverlay scene={scene} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
