export type AnimationType = 'fade' | 'slide_up' | 'slide_left' | 'zoom' | 'none';
export type PositionType = 'top_center' | 'center' | 'bottom_center' | 'bottom_left' | 'bottom_right';
export type StyleVariant = 'hook' | 'problem' | 'solution' | 'proof' | 'cta' | 'subtitle' | 'lower_third' | 'caption' | 'none';

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
}

export interface AutoEditJob {
  status: 'transcribing' | 'analyzing' | 'done' | 'error';
  progress: number;
  result: AutoEditResult | null;
  error: string | null;
}
