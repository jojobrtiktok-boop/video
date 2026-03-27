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

const FONT = "'Inter', 'SF Pro Display', -apple-system, 'Helvetica Neue', Arial, sans-serif";

// ── Responsive scale: base design at 1080px wide ─────────────────────────────
function useScale() {
  const { width, height } = useVideoConfig();
  // Portrait (TikTok/Reels): scale off width; Landscape: scale off height
  return height > width ? width / 1080 : height / 1080;
}

// ── Core animation hook ──────────────────────────────────────────────────────
function useEntrance(animation: AnimationType, durationFrames: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.65 },
    durationInFrames: Math.min(24, Math.max(6, durationFrames * 0.35)),
  });

  const exitStart = Math.max(2, durationFrames - 10);
  const exitOpacity = interpolate(frame, [exitStart, durationFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const opacity = entrance * exitOpacity;

  const shakeX = animation === 'shake' ? noise2D('sx', frame * 0.14, 0) * 11 : 0;
  const shakeY = animation === 'shake' ? noise2D('sy', frame * 0.14, 1) * 5  : 0;

  const translateY = animation === 'slide_up'
    ? interpolate(entrance, [0, 1], [52, 0])
    : shakeY;
  const translateX = animation === 'slide_left'
    ? interpolate(entrance, [0, 1], [-72, 0])
    : animation === 'slide_right'
    ? interpolate(entrance, [0, 1], [72, 0])
    : shakeX;
  const scale = animation === 'zoom'
    ? interpolate(entrance, [0, 1], [0.82, 1])
    : 1;

  return {
    opacity,
    transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scale})`,
    entrance,
  };
}

// ── Typewriter effect ─────────────────────────────────────────────────────────
function useTypewriter(text: string, durationFrames: number) {
  const frame = useCurrentFrame();
  const revealFrames = Math.min(durationFrames * 0.55, 40);
  const visibleChars = Math.round(
    interpolate(frame, [0, revealFrames], [0, text.length], { extrapolateRight: 'clamp' })
  );
  return text.slice(0, visibleChars);
}

// ── Counter animation ─────────────────────────────────────────────────────────
function animatedNumber(text: string, entrance: number): string {
  return text.replace(/[\d]+/g, (match) => {
    const target = parseInt(match, 10);
    const current = Math.round(interpolate(entrance, [0, 1], [0, target], { extrapolateRight: 'clamp' }));
    return current.toLocaleString('pt-BR');
  });
}

// ── Layered text shadow for maximum legibility ────────────────────────────────
function hardShadow(color = 'rgba(0,0,0,0.9)', spread = 8): string {
  return [
    `0 0 ${spread * 0.5}px ${color}`,
    `0 0 ${spread}px ${color}`,
    `0 0 ${spread * 2}px ${color}`,
    `2px 2px ${spread * 0.25}px rgba(0,0,0,0.8)`,
    `-1px -1px ${spread * 0.25}px rgba(0,0,0,0.8)`,
  ].join(', ');
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** HOOK — Pattern interrupt. Abertura poderosa. */
function HookOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const lineW = interpolate(entrance, [0, 1], [0, 72 * s]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 50%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', width: '88%',
      }}>
        <div style={{ width: lineW, height: Math.round(4 * s), background: accent, borderRadius: 99, margin: `0 auto ${Math.round(18 * s)}px` }} />
        <div style={{
          fontSize: Math.round(88 * s),
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1.06,
          fontFamily: FONT,
          letterSpacing: `${-2 * s}px`,
          textShadow: hardShadow('rgba(0,0,0,0.95)', 12 * s),
          WebkitTextStroke: `${Math.round(s)}px rgba(0,0,0,0.3)`,
        }}>
          {text}
        </div>
        {scene.emoji && (
          <div style={{ marginTop: Math.round(10 * s), fontSize: Math.round(18 * s), fontWeight: 700, color: accent, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9 }}>
            ▸ ASSISTA ATÉ O FINAL
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

/** BOLD CLAIM — Declaração audaciosa. Centro total. */
function BoldClaimOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const bgO = interpolate(entrance, [0, 1], [0, 0.62]);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${bgO})` }} />
      <div style={{ opacity, transform, textAlign: 'center', width: '82%', position: 'relative', padding: `0 ${Math.round(16 * s)}px` }}>
        <div style={{
          fontSize: Math.round(100 * s),
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1.0,
          fontFamily: FONT,
          letterSpacing: `${-3 * s}px`,
          textShadow: [
            `0 0 ${40 * s}px rgba(255,255,255,0.08)`,
            `0 4px ${20 * s}px rgba(0,0,0,0.9)`,
            `0 0 ${80 * s}px rgba(0,0,0,0.6)`,
          ].join(', '),
          WebkitTextStroke: `${1.5 * s}px rgba(0,0,0,0.4)`,
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** QUESTION — Curiosity gap com typewriter + cursor piscando. */
function QuestionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fullText = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const visible = useTypewriter(fullText, dur);
  const accent = scene.accent_color || '#60a5fa';

  const exitStart = Math.max(2, dur - 10);
  const opacity = interpolate(frame, [exitStart, dur - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const cursorOn = Math.floor(frame / (fps * 0.42)) % 2 === 0;
  const showCursor = visible.length < fullText.length;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: '12%', left: '50%',
        transform: 'translateX(-50%)', opacity, width: '86%', textAlign: 'center',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.88)',
          border: `${2 * s}px solid ${accent}60`,
          borderRadius: Math.round(20 * s),
          padding: `${Math.round(24 * s)}px ${Math.round(32 * s)}px`,
          boxShadow: `0 0 ${60 * s}px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
          <div style={{
            fontSize: Math.round(14 * s),
            fontWeight: 800,
            color: accent,
            letterSpacing: 3,
            marginBottom: Math.round(14 * s),
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            ✦ VOCÊ SABIA?
          </div>
          <div style={{
            fontSize: Math.round(58 * s),
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.25,
            fontFamily: FONT,
            minHeight: Math.round(58 * s),
            textShadow: hardShadow('rgba(0,0,0,0.7)', 6 * s),
          }}>
            {visible}{showCursor && cursorOn ? <span style={{ color: accent, fontWeight: 300 }}>|</span> : ''}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** PROBLEM — Dor do público. Barra vermelha esquerda. */
function ProblemOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#ef4444';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, padding: `0 ${Math.round(22 * s)}px`, opacity, transform }}>
        <div style={{
          background: 'rgba(0,0,0,0.88)',
          borderLeft: `${Math.round(6 * s)}px solid ${accent}`,
          borderRadius: `0 ${Math.round(16 * s)}px ${Math.round(16 * s)}px 0`,
          padding: `${Math.round(20 * s)}px ${Math.round(28 * s)}px`,
          backdropFilter: 'blur(10px)',
          boxShadow: `inset 0 0 ${60 * s}px rgba(239,68,68,0.06)`,
        }}>
          <div style={{
            fontSize: Math.round(12 * s),
            fontWeight: 800,
            color: accent,
            letterSpacing: 3,
            marginBottom: Math.round(10 * s),
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            O PROBLEMA
          </div>
          <div style={{
            fontSize: Math.round(60 * s),
            fontWeight: 800,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.18,
            textShadow: hardShadow('rgba(0,0,0,0.8)', 8 * s),
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** AGITATION — Amplifica a dor. Shake orgânico + vermelho intenso. */
function AgitationOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform } = useEntrance('shake', dur);
  const frame = useCurrentFrame();
  const accent = scene.accent_color || '#dc2626';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const flicker = interpolate(noise2D('fl', frame * 0.28, 0), [-1, 1], [0.9, 1]);
  const bgPulse = interpolate(noise2D('bg', frame * 0.1, 2), [-1, 1], [0.04, 0.16]);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(160,0,0,${bgPulse})` }} />
      <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, padding: `0 ${Math.round(22 * s)}px`, opacity: opacity * flicker, transform }}>
        <div style={{
          background: 'rgba(90,0,0,0.92)',
          border: `${2 * s}px solid ${accent}`,
          borderRadius: Math.round(16 * s),
          padding: `${Math.round(20 * s)}px ${Math.round(28 * s)}px`,
          boxShadow: `0 0 ${40 * s}px ${accent}40`,
        }}>
          <div style={{
            fontSize: Math.round(62 * s),
            fontWeight: 900,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.16,
            textShadow: `0 0 ${24 * s}px ${accent}80, ${hardShadow('rgba(0,0,0,0.7)', 6 * s)}`,
            WebkitTextStroke: `${s}px rgba(255,0,0,0.15)`,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** STORY — Conexão emocional. Itálico elegante. */
function StoryOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 65%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '84%',
      }}>
        <div style={{
          fontSize: Math.round(54 * s),
          fontWeight: 700,
          color: '#fff',
          fontFamily: FONT,
          lineHeight: 1.38,
          fontStyle: 'italic',
          textShadow: hardShadow('rgba(0,0,0,0.95)', 10 * s),
        }}>
          "{text}"
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SOLUTION — Apresenta a solução. Barra verde animada. */
function SolutionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'slide_left', dur);
  const accent = scene.accent_color || '#22c55e';
  const barW = interpolate(entrance, [0, 1], [0, 100]);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, padding: `0 ${Math.round(22 * s)}px`, opacity, transform }}>
        <div style={{
          background: 'rgba(0,0,0,0.88)',
          border: `1px solid ${accent}40`,
          borderRadius: Math.round(18 * s),
          padding: `${Math.round(22 * s)}px ${Math.round(30 * s)}px`,
          boxShadow: `0 0 ${60 * s}px ${accent}18, inset 0 0 ${40 * s}px rgba(34,197,94,0.04)`,
        }}>
          <div style={{ width: `${barW}%`, height: Math.round(3 * s), background: `linear-gradient(to right, ${accent}, ${accent}88)`, borderRadius: 99, marginBottom: Math.round(16 * s) }} />
          <div style={{
            fontSize: Math.round(12 * s),
            fontWeight: 800,
            color: accent,
            letterSpacing: 3,
            marginBottom: Math.round(10 * s),
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            ✓ A SOLUÇÃO
          </div>
          <div style={{
            fontSize: Math.round(60 * s),
            fontWeight: 800,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.18,
            textShadow: hardShadow('rgba(0,0,0,0.8)', 8 * s),
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** PROOF — Prova social / estatísticas. Counter animado. */
function ProofOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'zoom', dur);
  const accent = scene.accent_color || '#f59e0b';
  const rawText = scene.text_overlay;
  const displayText = (scene.emoji ? scene.emoji + ' ' : '') + animatedNumber(rawText, entrance);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: '12%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', minWidth: Math.round(280 * s), maxWidth: '84%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.92)',
          border: `${2 * s}px solid ${accent}`,
          borderRadius: Math.round(18 * s),
          padding: `${Math.round(22 * s)}px ${Math.round(44 * s)}px`,
          boxShadow: `0 4px ${55 * s}px ${accent}50, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
          <div style={{
            fontSize: Math.round(13 * s),
            fontWeight: 800,
            color: accent,
            letterSpacing: 3,
            marginBottom: Math.round(12 * s),
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            ⭐ RESULTADO REAL
          </div>
          <div style={{
            fontSize: Math.round(84 * s),
            fontWeight: 900,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.04,
            textShadow: `0 0 ${40 * s}px ${accent}55, ${hardShadow('rgba(0,0,0,0.7)', 8 * s)}`,
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
  const s = useScale();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#f97316';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const pulse = interpolate(Math.sin(frame / fps * Math.PI * 2.2), [-1, 1], [0.98, 1.02]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform} scale(${pulse})`,
        opacity, textAlign: 'center', width: '88%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.94)',
          border: `${2 * s}px solid ${accent}`,
          borderRadius: Math.round(16 * s),
          padding: `${Math.round(20 * s)}px ${Math.round(32 * s)}px`,
          boxShadow: `0 0 ${50 * s}px ${accent}55`,
        }}>
          <div style={{
            fontSize: Math.round(12 * s),
            fontWeight: 900,
            color: accent,
            letterSpacing: 3,
            marginBottom: Math.round(10 * s),
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            ⚡ ATENÇÃO — APENAS AGORA
          </div>
          <div style={{
            fontSize: Math.round(60 * s),
            fontWeight: 900,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.16,
            textShadow: `0 0 ${24 * s}px ${accent}55, ${hardShadow('rgba(0,0,0,0.8)', 8 * s)}`,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** CTA — Call to action. Botão gradiente com glow. */
function CtaOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform } = useEntrance(scene.animation || 'slide_up', dur);
  const accent = scene.accent_color || '#7c71ff';
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;
  const pulse = interpolate(Math.sin(frame / fps * Math.PI * 1.6), [-1, 1], [0.97, 1.03]);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform} scale(${pulse})`,
        opacity, textAlign: 'center',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${accent}ee, ${accent}99)`,
          borderRadius: Math.round(18 * s),
          padding: `${Math.round(22 * s)}px ${Math.round(60 * s)}px`,
          boxShadow: `0 4px ${60 * s}px ${accent}70, 0 0 ${120 * s}px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.2)`,
          border: `1px solid ${accent}88`,
        }}>
          <div style={{
            fontSize: Math.round(60 * s),
            fontWeight: 900,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.1,
            textShadow: `0 2px ${16 * s}px rgba(0,0,0,0.5)`,
            letterSpacing: `${-1 * s}px`,
          }}>
            {text}
          </div>
          <div style={{
            marginTop: Math.round(8 * s),
            fontSize: Math.round(13 * s),
            fontWeight: 700,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}>
            CLIQUE AGORA →
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SUBTITLE — Narração. Clean pill com texto de alta legibilidade. */
function SubtitleOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '88%',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.78)',
          borderRadius: Math.round(10 * s),
          padding: `${Math.round(12 * s)}px ${Math.round(32 * s)}px`,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 4px ${20 * s}px rgba(0,0,0,0.5)`,
        }}>
          <div style={{
            fontSize: Math.round(52 * s),
            fontWeight: 800,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.28,
            WebkitTextStroke: `${0.5 * s}px rgba(0,0,0,0.2)`,
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** LOWER THIRD — Info / apresentação. Strip com barra colorida. */
function LowerThirdOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform, entrance } = useEntrance(scene.animation || 'slide_left', dur);
  const accent = scene.accent_color || '#7c71ff';
  const barH = interpolate(entrance, [0, 1], [0, Math.round(56 * s)]);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '20%', left: 0, maxWidth: '78%',
        opacity, transform, display: 'flex',
      }}>
        <div style={{ width: Math.round(7 * s), background: `linear-gradient(to bottom, ${accent}, ${accent}88)`, height: barH, alignSelf: 'center', borderRadius: `0 ${Math.round(3 * s)}px ${Math.round(3 * s)}px 0`, flexShrink: 0 }} />
        <div style={{
          background: 'rgba(8,11,20,0.94)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: 'none',
          borderRadius: `0 ${Math.round(16 * s)}px ${Math.round(16 * s)}px 0`,
          padding: `${Math.round(16 * s)}px ${Math.round(28 * s)}px ${Math.round(16 * s)}px ${Math.round(18 * s)}px`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 4px ${20 * s}px rgba(0,0,0,0.5)`,
        }}>
          <div style={{
            fontSize: Math.round(48 * s),
            fontWeight: 700,
            color: '#fff',
            fontFamily: FONT,
            lineHeight: 1.22,
            textShadow: hardShadow('rgba(0,0,0,0.7)', 6 * s),
          }}>
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** CAPTION — Comentário sutil. Texto limpo com outline. */
function CaptionOverlay({ scene, dur }: { scene: Scene; dur: number }) {
  const s = useScale();
  const { opacity, transform } = useEntrance(scene.animation || 'fade', dur);
  const text = (scene.emoji ? scene.emoji + ' ' : '') + scene.text_overlay;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: `translateX(-50%) ${transform}`,
        opacity, textAlign: 'center', maxWidth: '88%',
      }}>
        <div style={{
          fontSize: Math.round(44 * s),
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          fontFamily: FONT,
          lineHeight: 1.38,
          textShadow: [
            `0 0 ${4 * s}px rgba(0,0,0,1)`,
            `0 0 ${10 * s}px rgba(0,0,0,0.95)`,
            `${2 * s}px ${2 * s}px 0 rgba(0,0,0,0.85)`,
            `-${2 * s}px -${2 * s}px 0 rgba(0,0,0,0.85)`,
            `${2 * s}px -${2 * s}px 0 rgba(0,0,0,0.85)`,
            `-${2 * s}px ${2 * s}px 0 rgba(0,0,0,0.85)`,
          ].join(', '),
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────
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

// ── Main composition ───────────────────────────────────────────────────────────
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
