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
import { noise2D } from '@remotion/noise';
import type { Scene, AnimationType } from '../types';

interface Props {
  videoSrc: string;
  scenes: Scene[];
}

const FONT = "'Helvetica Neue', 'Inter', 'Segoe UI', Arial, sans-serif";

// ── Core animation hook ──────────────────────────────────────────────────────
function useEntrance(animation: AnimationType, durationFrames: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 115, mass: 0.7 },
    durationInFrames: Math.min(22, Math.max(6, durationFrames * 0.35)),
  });

  const exitStart = Math.max(2, durationFrames - 10);
  const exitOpacity = interpolate(frame, [exitStart, durationFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const opacity = entrance * exitOpacity;

  // Organic noise-based shake
  const shakeX = animation === 'shake' ? noise2D('sx', frame * 0.14, 0) * 11 : 0;
  const shakeY = animation === 'shake' ? noise2D('sy', frame * 0.14, 1) * 5  : 0;

  const translateY = animation === 'slide_up'
    ? interpolate(entrance, [0, 1], [58, 0])
    : shakeY;
  const translateX = animation === 'slide_left'
    ? interpolate(entrance, [0, 1], [-72, 0])
    : animation === 'slide_right'
    ? interpolate(entrance, [0, 1], [72, 0])
    : shakeX;
  const scale = animation === 'zoom'
    ? interpolate(entrance, [0, 1], [0.78, 1])
    : 1;

  return {
    opacity,
    transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scale})`,
    entrance,
  };
}

// ── Typewriter effect ────────────────────────────────────────────────────────
function useTypewriter(text: string, durationFrames: number) {
  const frame = useCurrentFrame();
  const revealFrames = Math.min(durationFrames * 0.55, 38);
  const visibleChars = Math.round(
    interpolate(frame, [0, revealFrames], [0, text.length], { extrapolateRight: 'clamp' })
  );
  return text.slice(0, visibleChars);
}

// ── Number counter (animates numbers up from 0) ───────────────────────────────
function animatedNumber(text: string, entrance: number): string {
  return text.replace(/[\d]+/g, (match) => {
    const target = parseInt(match, 10);
    const current = Math.round(interpolate(entrance, [0, 1], [0, target], { extrapolateRight: 'clamp' }));
    return current.toLocaleString('pt-BR');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** HOOK — Pattern interrupt. Abertura poderosa. */
function HookOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const lineW = interpolate(entrance, [0, 1], [0, 64]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 45%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '13%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', width: '84%',
      }}>
        <div style={{ width: lineW, height: 4, background: accent, borderRadius: 99, margin: '0 auto 20px' }} />
        <div style={{
          fontSize: 74, fontWeight: 900, color: '#fff', lineHeight: 1.04,
          fontFamily: FONT, textShadow: '0 2px 32px rgba(0,0,0,0.95)',
          letterSpacing: '-1.5px',
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** BOLD CLAIM — Declaração audaciosa. Tela toda. */
function BoldClaimOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const bgO = interpolate(entrance, [0, 1], [0, 0.58]);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${bgO})` }} />
      <div style={{ opacity, transform, textAlign: 'center', width: '78%', position: 'relative' }}>
        <div style={{
          fontSize: 82, fontWeight: 900, color: '#fff', lineHeight: 1.04,
          fontFamily: FONT, letterSpacing: '-2px',
          textShadow: '0 0 80px rgba(255,255,255,0.12)',
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** QUESTION — Curiosity gap com efeito typewriter + cursor piscando. */
function QuestionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fullText = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const visible = useTypewriter(fullText, dur);
  const accent = scene.accent_color || '#60a5fa';

  const exitStart = Math.max(2, dur - 10);
  const opacity = interpolate(frame, [exitStart, dur - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const cursorOn = Math.floor(frame / (fps * 0.45)) % 2 === 0;
  const showCursor = visible.length < fullText.length;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: '10%', left: '50%',
        transform: 'translateX(-50%)', opacity, width: '82%', textAlign: 'center',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.84)', border: `2px solid ${accent}55`,
          borderRadius: 18, padding: '22px 32px',
          boxShadow: `0 0 50px ${accent}18`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 2.5, marginBottom: 12, textTransform: 'uppercase' }}>
            VOCÊ SABIA?
          </div>
          <div style={{
            fontSize: 46, fontWeight: 700, color: '#fff', lineHeight: 1.28,
            fontFamily: FONT, minHeight: 52,
          }}>
            {visible}{showCursor && cursorOn ? <span style={{ color: accent }}>|</span> : ''}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** PROBLEM — Dor do público. Barra vermelha esquerda. */
function ProblemOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#ef4444';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', bottom: '8%', left: 0, right: 0, padding: '0 26px', opacity, transform }}>
        <div style={{
          background: 'rgba(0,0,0,0.84)', borderLeft: `5px solid ${accent}`,
          borderRadius: '0 14px 14px 0', padding: '18px 26px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 2.5, marginBottom: 9, textTransform: 'uppercase' }}>
            O PROBLEMA
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', fontFamily: FONT, lineHeight: 1.22 }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** AGITATION — Amplifica a dor. Shake orgânico + vermelho intenso. */
function AgitationOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform } = useEntrance('shake', dur);
  const frame = useCurrentFrame();
  const accent = scene.accent_color || '#dc2626';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const flicker = interpolate(noise2D('fl', frame * 0.28, 0), [-1, 1], [0.88, 1]);
  const bgPulse = interpolate(noise2D('bg', frame * 0.1, 2), [-1, 1], [0.05, 0.18]);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(150,0,0,${bgPulse})` }} />
      <div style={{ position: 'absolute', bottom: '8%', left: 0, right: 0, padding: '0 26px', opacity: opacity * flicker, transform }}>
        <div style={{
          background: 'rgba(100,0,0,0.88)', border: `2px solid ${accent}`,
          borderRadius: 14, padding: '18px 26px',
        }}>
          <div style={{ fontSize: 46, fontWeight: 900, color: '#fff', fontFamily: FONT, lineHeight: 1.2, textShadow: `0 0 22px ${accent}90` }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** STORY — Conexão emocional. Itálico suave, gradiente suave. */
function StoryOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '80%',
      }}>
        <div style={{
          fontSize: 38, fontWeight: 500, color: '#fff', fontFamily: FONT,
          lineHeight: 1.45, fontStyle: 'italic',
          textShadow: '0 1px 14px rgba(0,0,0,0.95)',
        }}>
          "{text}"
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SOLUTION — Apresenta a solução. Barra verde animada. */
function SolutionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'slide_left', dur);
  const accent = scene.accent_color || '#22c55e';
  const barW = interpolate(entrance, [0, 1], [0, 100]);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', bottom: '9%', left: 0, right: 0, padding: '0 26px', opacity, transform }}>
        <div style={{
          background: 'rgba(0,0,0,0.84)', border: `1px solid ${accent}44`,
          borderRadius: 16, padding: '20px 28px',
          boxShadow: `0 0 55px ${accent}22`,
        }}>
          <div style={{ width: `${barW}%`, height: 3, background: accent, borderRadius: 99, marginBottom: 14 }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 2.5, marginBottom: 9, textTransform: 'uppercase' }}>
            A SOLUÇÃO
          </div>
          <div style={{ fontSize: 46, fontWeight: 800, color: '#fff', fontFamily: FONT, lineHeight: 1.2 }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** PROOF — Prova social / estatísticas. Counter animado. */
function ProofOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const accent = scene.accent_color || '#f59e0b';
  const rawText = scene.text_overlay;
  const displayText = (scene.emoji ? scene.emoji + ' ' : '') + animatedNumber(rawText, entrance);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: '8%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', minWidth: 260, maxWidth: '80%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.90)', border: `2px solid ${accent}`,
          borderRadius: 16, padding: '18px 38px',
          boxShadow: `0 4px 55px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: 2.5, marginBottom: 10, textTransform: 'uppercase' }}>
            ⭐ RESULTADO REAL
          </div>
          <div style={{
            fontSize: 62, fontWeight: 900, color: '#fff', fontFamily: FONT, lineHeight: 1.08,
            textShadow: `0 0 35px ${accent}55`,
          }}>
            {displayText}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** URGENCY — Escassez / oferta. Laranja pulsante. */
function UrgencyOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#f97316';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const pulse = interpolate(Math.sin(frame / fps * Math.PI * 2.4), [-1, 1], [0.97, 1.03]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        transform: `translateX(-50%) ${transform} scale(${pulse})`,
        opacity, textAlign: 'center', width: '86%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.92)', border: `2px solid ${accent}`,
          borderRadius: 14, padding: '17px 30px',
          boxShadow: `0 0 45px ${accent}55`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: accent, letterSpacing: 3, marginBottom: 9, textTransform: 'uppercase' }}>
            ⚡ ATENÇÃO — AGORA
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', fontFamily: FONT, lineHeight: 1.2, textShadow: `0 0 22px ${accent}55` }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** CTA — Call to action. Botão roxo com pulse e glow. */
function CtaOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const pulse = interpolate(Math.sin(frame / fps * Math.PI * 1.7), [-1, 1], [0.96, 1.04]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '44%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        transform: `translateX(-50%) ${transform} scale(${pulse})`,
        opacity, textAlign: 'center',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}c0)`,
          borderRadius: 16, padding: '20px 54px',
          boxShadow: `0 4px 55px ${accent}70, 0 0 110px ${accent}22`,
          border: `1px solid ${accent}99`,
        }}>
          <div style={{
            fontSize: 46, fontWeight: 900, color: '#fff', fontFamily: FONT,
            lineHeight: 1.14, textShadow: '0 2px 14px rgba(0,0,0,0.5)',
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SUBTITLE — Narração contínua. Pill bottom com blur. */
function SubtitleOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '5%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '86%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.82)', borderRadius: 8, padding: '10px 28px',
          backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: FONT, lineHeight: 1.3 }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** LOWER THIRD — Info / apresentação. Strip deslizando da esquerda. */
function LowerThirdOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'slide_left', dur);
  const accent = scene.accent_color || '#7c71ff';
  const barH = interpolate(entrance, [0, 1], [0, 52]);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '11%', left: 0, maxWidth: '74%',
        opacity, transform, display: 'flex',
      }}>
        <div style={{ width: 6, background: accent, height: barH, alignSelf: 'center', borderRadius: '0 3px 3px 0' }} />
        <div style={{
          background: 'rgba(8,11,20,0.92)', border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: 'none', borderRadius: '0 14px 14px 0',
          padding: '14px 24px 14px 16px', backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', fontFamily: FONT, lineHeight: 1.25 }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** CAPTION — Comentário sutil. Texto flutuante com sombra. */
function CaptionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '3%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '90%',
      }}>
        <div style={{
          fontSize: 26, fontWeight: 500, color: 'rgba(255,255,255,0.86)', fontFamily: FONT,
          lineHeight: 1.4, textShadow: '0 1px 10px rgba(0,0,0,0.95)',
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
function SceneOverlay({ scene, fps }: { scene: Scene; fps: number }) {
  if (scene.style === 'none' || !scene.text_overlay?.trim()) return null;
  const dur = Math.max(4, Math.round((scene.end - scene.start) * fps));
  const p = { scene, dur };
  switch (scene.style) {
    case 'hook':        return <HookOverlay        {...p} />;
    case 'bold_claim':  return <BoldClaimOverlay   {...p} />;
    case 'question':    return <QuestionOverlay     {...p} />;
    case 'problem':     return <ProblemOverlay      {...p} />;
    case 'agitation':   return <AgitationOverlay    {...p} />;
    case 'story':       return <StoryOverlay        {...p} />;
    case 'solution':    return <SolutionOverlay     {...p} />;
    case 'proof':       return <ProofOverlay        {...p} />;
    case 'urgency':     return <UrgencyOverlay      {...p} />;
    case 'cta':         return <CtaOverlay          {...p} />;
    case 'subtitle':    return <SubtitleOverlay     {...p} />;
    case 'lower_third': return <LowerThirdOverlay   {...p} />;
    case 'caption':     return <CaptionOverlay      {...p} />;
    default:            return null;
  }
}

// ── Main composition ──────────────────────────────────────────────────────────
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
        const dur = Math.max(4, Math.round((scene.end - scene.start) * fps));
        return (
          <Sequence key={scene.id} from={fromFrame} durationInFrames={dur}>
            <SceneOverlay scene={scene} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
