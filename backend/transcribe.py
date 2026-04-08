#!/usr/bin/env python3
"""
Transcreve vídeo/áudio com faster-whisper e retorna SRT no stdout.
Uso: python3 transcribe.py <arquivo> [modelo] [idioma] [word_timestamps]
  modelo:  tiny | base | small (padrão) | medium | large-v3
  idioma:  pt | en | auto (padrão = pt)
  word_timestamps: 1 para retornar JSON com timestamps por palavra
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

    video_path      = sys.argv[1]
    model_size      = sys.argv[2] if len(sys.argv) > 2 else "small"
    language        = sys.argv[3] if len(sys.argv) > 3 else "pt"
    word_ts_mode    = sys.argv[4] == "1" if len(sys.argv) > 4 else False

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
    segments, info = model.transcribe(
        video_path,
        beam_size=5,
        language=language,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        word_timestamps=True  # sempre ativa — sem custo extra
    )

    if word_ts_mode:
        # Retorna JSON com palavras e seus timestamps exatos
        result = []
        for seg in segments:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word":  w.word.strip(),
                        "start": round(w.start, 3),
                        "end":   round(w.end,   3)
                    })
            if words:
                result.append({
                    "start": round(seg.start, 3),
                    "end":   round(seg.end,   3),
                    "text":  seg.text.strip(),
                    "words": words
                })
        print(json.dumps(result, ensure_ascii=False))
    else:
        # Modo SRT padrão (compatibilidade)
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

    main()
