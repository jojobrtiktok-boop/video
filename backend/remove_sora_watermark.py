#!/usr/bin/env python3
"""
remove_sora_watermark.py — detecta e remove marca d'água do Sora/TikTok
usando diferença temporal entre frames + parallelização com threads.

Lógica:
  1. Amostra N frames espalhados e calcula a MEDIANA da faixa inferior.
     Como a marca muda de posição, ela NÃO aparece na mediana.
  2. Carrega todos os frames em RAM.
  3. Para cada frame (em paralelo), subtrai a mediana → detecta e inpainta a marca.

Usage: python3 remove_sora_watermark.py <input> <output> [ffmpeg_bin]
"""
import sys, os, subprocess, tempfile
from threading import Thread
from queue import Queue
from multiprocessing import cpu_count
import cv2
import numpy as np

STRIP_FRAC   = 0.40    # busca nos últimos 40% do frame (altura)
N_SAMPLES    = 60      # frames amostrados para calcular background
DIFF_THRESH  = 10      # sensibilidade (menor = mais sensível, pega marcas sutis)
MIN_AREA     = 50      # área mínima do blob para considerar marca
MAX_W_FRAC   = 0.92    # ignora blobs mais largos que 92% (ruído de cena)
PAD          = 12      # padding ao redor do blob
INPAINT_R    = 21      # raio do inpainting

def remove_sora(input_path, output_path, ffmpeg='ffmpeg'):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f'ERROR: cannot open {input_path}', file=sys.stderr)
        sys.exit(1)

    fps    = cap.get(cv2.CAP_PROP_FPS) or 30
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    strip_start = int(height * (1.0 - STRIP_FRAC))
    print(f'Vídeo: {width}x{height} @ {fps:.1f}fps  total={total}  strip_y={strip_start}', flush=True)
    print('PROGRESS:2', flush=True)

    # ── FASE 1: calcular mediana do background ─────────────────────────────────
    print(f'Fase 1: amostrando {N_SAMPLES} frames para background…', flush=True)

    # Conta frames reais se CAP_PROP_FRAME_COUNT for 0
    if total <= 0:
        print('  total desconhecido, contando frames…', flush=True)
        frames_tmp = []
        while True:
            ret, f = cap.read()
            if not ret:
                break
            frames_tmp.append(f)
        total = len(frames_tmp)
        cap.release()
        # Re-abre para leitura normal abaixo
        # Mas já temos os frames em memória — usa direto
        all_frames = frames_tmp
        frames_tmp = None
        use_preloaded = True
    else:
        use_preloaded = False

    n_samples = min(N_SAMPLES, max(total, 1))
    indices   = np.linspace(0, max(total - 1, 0), n_samples, dtype=int)
    samples   = []

    if use_preloaded:
        for idx in indices:
            samples.append(all_frames[int(idx)][strip_start:, :].astype(np.float32))
    else:
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if ret:
                samples.append(frame[strip_start:, :].astype(np.float32))

    if not samples:
        print('ERROR: nenhum frame lido', file=sys.stderr)
        sys.exit(1)

    median_strip = np.median(np.stack(samples), axis=0).astype(np.uint8)
    samples = None  # libera RAM
    print(f'  background OK ({len(indices)} amostras)', flush=True)
    print('PROGRESS:8', flush=True)

    # ── FASE 2: carregar todos os frames em RAM ────────────────────────────────
    if not use_preloaded:
        print('Carregando frames em RAM…', flush=True)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        all_frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            all_frames.append(frame)
        cap.release()
        total = len(all_frames)
    else:
        cap.release()

    print(f'{total} frames em RAM', flush=True)
    print('PROGRESS:12', flush=True)

    # ── FASE 3: detecção + inpainting paralelo ─────────────────────────────────
    n_workers = min(max(cpu_count(), 1), 16)
    print(f'Processando com {n_workers} threads…', flush=True)

    k_close  = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 20))
    k_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 12))
    results  = [None] * total
    task_q   = Queue(maxsize=n_workers * 4)

    def worker():
        while True:
            item = task_q.get()
            if item is None:
                task_q.task_done()
                break
            idx, frame = item
            strip     = frame[strip_start:, :]
            diff      = cv2.absdiff(strip, median_strip)
            diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(diff_gray, DIFF_THRESH, 255, cv2.THRESH_BINARY)
            thresh    = cv2.dilate(thresh, k_dilate, iterations=2)
            thresh    = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k_close)

            mask = np.zeros((height, width), dtype=np.uint8)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            found = False
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < MIN_AREA:
                    continue
                bx, by, bw, bh = cv2.boundingRect(cnt)
                if bw > width * MAX_W_FRAC:
                    continue
                fy1 = max(0,      strip_start + by - PAD)
                fy2 = min(height, strip_start + by + bh + PAD)
                fx1 = max(0,      bx - PAD)
                fx2 = min(width,  bx + bw + PAD)
                mask[fy1:fy2, fx1:fx2] = 255
                found = True

            if found:
                results[idx] = cv2.inpaint(frame, mask, INPAINT_R, cv2.INPAINT_TELEA)
            else:
                results[idx] = frame
            task_q.task_done()

    threads = [Thread(target=worker, daemon=True) for _ in range(n_workers)]
    for t in threads:
        t.start()

    inpaint_cnt = 0
    for i, frame in enumerate(all_frames):
        task_q.put((i, frame))
        if i % 15 == 0 and total > 0:
            pct = 12 + int(i / total * 76)
            print(f'PROGRESS:{pct}', flush=True)

    for _ in threads:
        task_q.put(None)
    task_q.join()
    for t in threads:
        t.join()

    all_frames = None  # libera RAM
    print('PROGRESS:90', flush=True)
    print(f'  processamento concluído', flush=True)

    # ── FASE 4: escrever vídeo temporário ─────────────────────────────────────
    print('Escrevendo frames…', flush=True)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.avi')
    os.close(tmp_fd)
    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))
    for frame in results:
        writer.write(frame)
    writer.release()
    results = None
    print('PROGRESS:93', flush=True)

    # ── FASE 5: re-encode + áudio ─────────────────────────────────────────────
    print('Re-encoding com ffmpeg…', flush=True)
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

    print('PROGRESS:100', flush=True)
    print(f'Concluído: {output_path}', flush=True)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: remove_sora_watermark.py <input> <output> [ffmpeg]')
        sys.exit(1)
    ffmpeg_bin = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('FFMPEG_BIN', 'ffmpeg')
    remove_sora(sys.argv[1], sys.argv[2], ffmpeg_bin)
