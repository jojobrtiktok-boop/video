export type OverlayStyle = 'title_card' | 'subtitle' | 'lower_third' | 'caption' | 'none';

export interface Scene {
  id: string;
  start: number;   // segundos
  end: number;     // segundos
  title: string;
  description: string;
  text_overlay: string;
  style: OverlayStyle;
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
