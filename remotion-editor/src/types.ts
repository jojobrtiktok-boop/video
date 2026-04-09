export type AnimationType =
  | 'fade'
  | 'slide_up'
  | 'slide_left'
  | 'slide_right'
  | 'zoom'
  | 'shake'
  | 'typewriter'
  | 'none';

export type PositionType =
  | 'top_center'
  | 'center'
  | 'bottom_center'
  | 'bottom_left'
  | 'bottom_right';

// VSL stages + TikTok patterns
export type StyleVariant =
  | 'hook'          // Abertura — pattern interrupt, bold centered
  | 'bold_claim'    // Declaração controvérsia — texto enorme no centro
  | 'question'      // Curiosity gap — typewriter com cursor
  | 'problem'       // Dor/frustração — barra vermelha lateral
  | 'agitation'     // Amplifica dor — shake + vermelho intenso
  | 'story'         // Conexão emocional — itálico suave
  | 'solution'      // Apresenta solução — verde + barra top
  | 'proof'         // Prova social/stats — counter animado âmbar
  | 'urgency'       // Escassez/oferta — laranja pulsante
  | 'cta'           // Call to action — botão roxo com glow
  | 'subtitle'      // Narração contínua — pill bottom
  | 'lower_third'   // Info/apresentação — strip lateral
  | 'caption'       // Comentário sutil — texto flutuante
  | 'word_subtitle' // TikTok karaoke — palavra por palavra animada
  | 'image_bg'      // Imagem IA como fundo da cena
  | 'none';

// Cor emocional de cada estágio VSL
export const STYLE_COLORS: Record<StyleVariant, string> = {
  hook:          '#7c71ff',
  bold_claim:    '#ffffff',
  question:      '#60a5fa',
  problem:       '#ef4444',
  agitation:     '#dc2626',
  story:         '#a78bfa',
  solution:      '#22c55e',
  proof:         '#f59e0b',
  urgency:       '#f97316',
  cta:           '#7c71ff',
  subtitle:      '#94a3b8',
  lower_third:   '#7c71ff',
  caption:       '#6b7280',
  word_subtitle: '#ffffff',
  image_bg:      '#a78bfa',
  none:          '#374151',
};

export const STYLE_LABELS: Record<StyleVariant, string> = {
  hook:          'Hook — Abertura impactante',
  bold_claim:    'Bold Claim — Declaração audaciosa',
  question:      'Question — Pergunta com typewriter',
  problem:       'Problem — Dor/frustração',
  agitation:     'Agitation — Amplifica a dor',
  story:         'Story — Conexão emocional',
  solution:      'Solution — Apresenta a solução',
  proof:         'Proof — Prova social / stats',
  urgency:       'Urgency — Escassez / oferta',
  cta:           'CTA — Call to action',
  subtitle:      'Subtitle — Narração contínua',
  lower_third:   'Lower Third — Info / apresentação',
  caption:       'Caption — Comentário sutil',
  word_subtitle: 'Word Subtitle — TikTok karaoke',
  image_bg:      'Image BG — Imagem IA como fundo',
  none:          'None — Sem overlay',
};

export interface Scene {
  id: string;
  start: number;
  end: number;
  title: string;
  description: string;
  text_overlay: string;
  style: StyleVariant;
  animation?: AnimationType;
  position?: PositionType;
  accent_color?: string | null;
  emoji?: string;
  image_url?: string | null; // URL de imagem IA gerada via fal.ai
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface AutoEditResult {
  videoUrl: string;
  duration: number;
  fps: number;
  videoWidth: number;
  videoHeight: number;
  scenes: Scene[];
  segments: TranscriptSegment[];
  language: string;
  narrativeType?: string;  // Ex: 'vsl', 'tutorial', 'storytelling', 'review'
  palette?: string[];      // 3 cores coesas geradas pelo Claude para o vídeo
}

export interface AutoEditJob {
  status: 'transcribing' | 'analyzing' | 'done' | 'error';
  progress: number;
  result: AutoEditResult | null;
  error: string | null;
}
