#!/usr/bin/env python3
"""
remove_sora_watermark.py — detecta e remove marca d'água do Sora/TikTok
usando diferença temporal entre frames.

Lógica:
  1. Amostra N frames espalhados pelo vídeo e calcula a MEDIANA da faixa inferior.
     Como a marca muda de posição, ela NÃO aparece na mediana — só o fundo aparece.
  2. Para cada frame, subtrai a mediana → diferença = posição atual da marca.
  3. Aplica OpenCV Telea inpainting apenas na região detectada.

Usage: python3 remove_sora_watermark.py <input> <output> [ffmpeg_bin]
"""
import sys, os, subprocess, tempfile
import cv2
import numpy as np

STRIP_FRAC   = 0.28    # busca marca nos últimos 28% do frame (altura)
N_SAMPLES    = 50      # frames amostrados pra calcular background
DIFF_THRESH  = 22      # sensibilidade de detecção (menor = mais sensível)
MIN_AREA     = 150     # área mínima do blob para considerar marca d'água
MAX_W_FRAC   = 0.88    # ignora blobs mais largos que 88% do frame (ruído de borda)
PAD          = 8       # padding ao redor do blob detectado antes do inpaint
INPAINT_R    = 21      # raio do inpainting

def remove_sora(input_path, output_path, ffmpeg='ffmpeg'):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f'ERROR: cannot open {input_path}', file=sys.stderr)
        sys.exit(1)

    fps         = cap.get(cv2.CAP_PROP_FPS) or 30
    width       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total       = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    strip_start = int(height * (1.0 - STRIP_FRAC))

    print(f'Vídeo: {width}x{height} @ {fps:.1f}fps  total={total}  strip_y={strip_start}', flush=True)

    # ── FASE 1: calcular mediana (background sem marca) ────────────────────────
    print(f'Fase 1: amostrando {N_SAMPLES} frames para calcular background…', flush=True)
    n_samples = min(N_SAMPLES, max(total, 1))
    indices   = np.linspace(0, max(total - 1, 0), n_samples, dtype=int)
    samples   = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret:
            samples.append(frame[strip_start:, :].astype(np.float32))

    if not samples:
        print('ERROR: nenhum frame lido', file=sys.stderr)
        sys.exit(1)

    median_strip = np.median(np.stack(samples), axis=0).astype(np.uint8)
    print(f'  background calculado com {len(samples)} frames.', flush=True)

    # ── FASE 2: processar cada frame ───────────────────────────────────────────
    print('Fase 2: processando frames…', flush=True)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.avi')
    os.close(tmp_fd)
    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))

    k_close  = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 18))
    k_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (18, 10))

    frame_idx   = 0
    inpaint_cnt = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        strip = frame[strip_start:, :]

        # Diferença em relação ao background
        diff      = cv2.absdiff(strip, median_strip)
        diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

        _, thresh = cv2.threshold(diff_gray, DIFF_THRESH, 255, cv2.THRESH_BINARY)

        # Limpar ruído morfologicamente
        thresh = cv2.dilate(thresh, k_dilate, iterations=2)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k_close)

        # Construir máscara de inpainting
        mask = np.zeros((height, width), dtype=np.uint8)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        found = False
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < MIN_AREA:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            if w > width * MAX_W_FRAC:
                continue  # blob full-width → provavelmente ruído da cena
            # coordenadas no frame completo
            fy1 = max(0,      strip_start + y - PAD)
            fy2 = min(height, strip_start + y + h + PAD)
            fx1 = max(0,      x - PAD)
            fx2 = min(width,  x + w + PAD)
            mask[fy1:fy2, fx1:fx2] = 255
            found = True

        result = frame
        if found:
            result = cv2.inpaint(frame, mask, INPAINT_R, cv2.INPAINT_TELEA)
            inpaint_cnt += 1

        writer.write(result)
        frame_idx += 1
        if frame_idx % 60 == 0:
            print(f'  frame {frame_idx}/{total}  inpainted={inpaint_cnt}', flush=True)

    cap.release()
    writer.release()
    print(f'  total frames: {frame_idx}  frames com inpainting: {inpaint_cnt}', flush=True)

    # ── FASE 3: re-encode + copiar áudio ──────────────────────────────────────
    print('Fase 3: re-encoding com ffmpeg…', flush=True)
    cmd = [
        ffmpeg, '-y',
        '-i', tmp_path,
        '-i', input_path,
        '-map', '0:v:0',
        '-map', '1:a?',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'copy',
        output_path
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    os.unlink(tmp_path)

    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        sys.exit(r.returncode)

    print(f'Concluído: {output_path}', flush=True)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: remove_sora_watermark.py <input> <output> [ffmpeg]')
        sys.exit(1)
    ffmpeg_bin = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('FFMPEG_BIN', 'ffmpeg')
    remove_sora(sys.argv[1], sys.argv[2], ffmpeg_bin)
