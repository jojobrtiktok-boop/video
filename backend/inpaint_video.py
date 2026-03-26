#!/usr/bin/env python3
"""
inpaint_video.py — remove watermark usando OpenCV Telea inpainting paralelo.
Carrega todos os frames em RAM e processa em múltiplas threads simultaneamente.
Usage: python3 inpaint_video.py <input> <output> <x> <y> <w> <h> [ffmpeg_bin]
"""
import sys, os, subprocess, tempfile
from threading import Thread
from queue import Queue
from multiprocessing import cpu_count
import cv2
import numpy as np

def inpaint_video(input_path, output_path, x, y, w, h, ffmpeg='ffmpeg'):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f'ERROR: cannot open {input_path}', file=sys.stderr)
        sys.exit(1)

    fps    = cap.get(cv2.CAP_PROP_FPS) or 30
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    x = max(0, min(x, width  - 1))
    y = max(0, min(y, height - 1))
    w = max(1, min(w, width  - x))
    h = max(1, min(h, height - y))

    PAD = 20
    rx1 = max(0,      x - PAD)
    ry1 = max(0,      y - PAD)
    rx2 = min(width,  x + w + PAD)
    ry2 = min(height, y + h + PAD)

    roi_mask = np.zeros((ry2 - ry1, rx2 - rx1), dtype=np.uint8)
    mx1 = x - rx1
    my1 = y - ry1
    roi_mask[my1 : my1 + h, mx1 : mx1 + w] = 255

    # ── Fase 1: carregar todos os frames em RAM ────────────────────────────────
    print('PROGRESS:2', flush=True)
    print('Carregando frames em RAM…', flush=True)
    all_frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        all_frames.append(frame)
    cap.release()

    total_frames = len(all_frames)
    print(f'{total_frames} frames carregados ({width}x{height} @ {fps:.1f}fps)', flush=True)
    print('PROGRESS:5', flush=True)

    # ── Fase 2: inpainting paralelo com threads ────────────────────────────────
    n_workers  = min(max(cpu_count(), 1), 16)
    results    = [None] * total_frames
    submitted  = [0]
    task_q     = Queue(maxsize=n_workers * 4)

    print(f'Inpainting com {n_workers} threads…', flush=True)

    def worker():
        while True:
            item = task_q.get()
            if item is None:
                task_q.task_done()
                break
            idx, frame = item
            roi       = frame[ry1:ry2, rx1:rx2]
            inpainted = cv2.inpaint(roi, roi_mask, 21, cv2.INPAINT_TELEA)
            out       = frame.copy()
            out[ry1:ry2, rx1:rx2] = inpainted
            results[idx] = out
            task_q.task_done()

    threads = [Thread(target=worker, daemon=True) for _ in range(n_workers)]
    for t in threads:
        t.start()

    for i, frame in enumerate(all_frames):
        task_q.put((i, frame))
        submitted[0] = i + 1
        if i % 15 == 0 and total_frames > 0:
            pct = 5 + int(i / total_frames * 83)
            print(f'PROGRESS:{pct}', flush=True)

    for _ in threads:
        task_q.put(None)
    task_q.join()
    for t in threads:
        t.join()

    all_frames = None  # libera RAM dos originais
    print('PROGRESS:90', flush=True)

    # ── Fase 3: escrever saída em arquivo temporário ───────────────────────────
    print('Escrevendo frames…', flush=True)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.avi')
    os.close(tmp_fd)
    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    out_writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))
    for frame in results:
        out_writer.write(frame)
    out_writer.release()
    results = None  # libera RAM
    print('PROGRESS:93', flush=True)

    # ── Fase 4: re-encode + áudio ─────────────────────────────────────────────
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
    print(f'Saída: {output_path}', flush=True)

if __name__ == '__main__':
    if len(sys.argv) < 7:
        print('Usage: inpaint_video.py <in> <out> <x> <y> <w> <h> [ffmpeg]')
        sys.exit(1)
    inp, outp = sys.argv[1], sys.argv[2]
    rx, ry, rw, rh = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
    ffmpeg_bin = sys.argv[7] if len(sys.argv) > 7 else os.environ.get('FFMPEG_BIN', 'ffmpeg')
    inpaint_video(inp, outp, rx, ry, rw, rh, ffmpeg_bin)
