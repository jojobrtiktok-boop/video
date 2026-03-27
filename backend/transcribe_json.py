#!/usr/bin/env python3
"""
Transcreve vídeo/áudio com faster-whisper e retorna JSON com segmentos e timestamps.
Uso: python3 transcribe_json.py <arquivo> [modelo] [idioma]
  modelo:  tiny | base | small (padrão) | medium | large-v3
  idioma:  pt | en | auto (padrão = pt)
"""
import sys
import os
import json


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

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments_gen, info = model.transcribe(
        video_path,
        beam_size=5,
        language=language,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    segments = []
    duration = 0.0
    for i, seg in enumerate(segments_gen, 1):
        text = seg.text.strip()
        if text:
            segments.append({
                "id": i,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text
            })
        duration = max(duration, seg.end)

    detected_lang = getattr(info, "language", None) or (language or "auto")

    print(json.dumps({
        "segments": segments,
        "duration": round(duration, 2),
        "language": detected_lang
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
