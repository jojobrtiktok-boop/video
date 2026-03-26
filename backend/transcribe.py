#!/usr/bin/env python3
"""
Transcreve vídeo/áudio com faster-whisper e retorna SRT no stdout.
Uso: python3 transcribe.py <arquivo> [modelo] [idioma]
  modelo:  tiny | base | small (padrão) | medium | large-v3
  idioma:  pt | en | auto (padrão = pt)
"""
import sys
import os
import json

def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Arquivo não informado"}), file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "small"
    language   = sys.argv[3] if len(sys.argv) > 3 else "pt"
    if language == "auto":
        language = None

    if not os.path.exists(video_path):
        print(json.dumps({"error": f"Arquivo não encontrado: {video_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper não instalado. Execute: pip3 install faster-whisper"}), file=sys.stderr)
        sys.exit(1)

    # Carrega modelo (cache em ~/.cache/huggingface)
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        video_path,
        beam_size=5,
        language=language,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    srt_lines = []
    for i, seg in enumerate(segments, 1):
        start = format_time(seg.start)
        end   = format_time(seg.end)
        text  = seg.text.strip()
        if text:
            srt_lines.append(f"{i}\n{start} --> {end}\n{text}\n")

    print("\n".join(srt_lines))

if __name__ == "__main__":
    main()
