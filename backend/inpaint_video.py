#!/usr/bin/env python3
"""
inpaint_video.py — remove watermark usando OpenCV Telea inpainting em batches.
Processa BATCH_SIZE frames por vez para evitar estouro de RAM.
Usage: python3 inpaint_video.py <input> <output> <x> <y> <w> <h> [ffmpeg_bin] [time_ranges_json]
"""
import sys, os, subprocess, tempfile, json
from threading import Thread
from queue import Queue
from multiprocessing import cpu_count
import cv2
import numpy as np

BATCH_SIZE = 50  # frames por batch — limita uso de RAM

def inpaint_video(input_path, output_path, x, y, w, h, ffmpeg='ffmpeg', time_ranges=None):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f'ERROR: cannot open {input_path}', file=sys.stderr)
        sys.exit(1)

    fps          = cap.get(cv2.CAP_PROP_FPS) or 30
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    x = max(0, min(x, width  - 1))
    y = max(0, min(y, height - 1))
    w = max(1, min(w, width  - x))
    h = max(1, min(h, height - y))

    PAD  = 20
    rx1  = max(0,      x - PAD)
    ry1  = max(0,      y - PAD)
    rx2  = min(width,  x + w + PAD)
    ry2  = min(height, y + h + PAD)

    roi_mask         = np.zeros((ry2 - ry1, rx2 - rx1), dtype=np.uint8)
    roi_mask[y - ry1 : y - ry1 + h, x - rx1 : x - rx1 + w] = 255

    def frame_in_range(idx):
        if not time_ranges:
            return True
        t = idx / fps
        return any(r['start'] <= t <= r['end'] for r in time_ranges)

    print('PROGRESS:2', flush=True)
    print(f'Video: {width}x{height} @ {fps:.1f}fps, {total_frames} frames', flush=True)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.avi')
    os.close(tmp_fd)
    fourcc     = cv2.VideoWriter_fourcc(*'MJPG')
    out_writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))

    n_workers   = min(max(cpu_count(), 1), 8)
    frame_count = 0

    while True:
        batch   = []
        indices = []
        for _ in range(BATCH_SIZE):
            ret, frame = cap.read()
            if not ret:
                break
            batch.append(frame)
            indices.append(frame_count)
            frame_count += 1

        if not batch:
            break

        results = [None] * len(batch)
        task_q  = Queue(maxsize=n_workers * 2)

        def worker():
            while True:
                item = task_q.get()
                if item is None:
                    task_q.task_done()
                    break
                bi, frame = item
                if frame_in_range(indices[bi]):
                    roi       = frame[ry1:ry2, rx1:rx2]
                    inpainted = cv2.inpaint(roi, roi_mask, 21, cv2.INPAINT_TELEA)
                    out       = frame.copy()
                    out[ry1:ry2, rx1:rx2] = inpainted
                    results[bi] = out
                else:
                    results[bi] = frame
                task_q.task_done()

        threads = [Thread(target=worker, daemon=True) for _ in range(n_workers)]
        for t in threads:
            t.start()
        for bi, frame in enumerate(batch):
            task_q.put((bi, frame))
        for _ in threads:
            task_q.put(None)
        task_q.join()
        for t in threads:
            t.join()

        for frame in results:
            out_writer.write(frame)

        pct = 5 + int(frame_count / total_frames * 83)
        print(f'PROGRESS:{min(pct, 88)}', flush=True)

    cap.release()
    out_writer.release()
    print('PROGRESS:90', flush=True)

    print('Re-encoding com ffmpeg...', flush=True)
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
    print(f'Saida: {output_path}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) < 7:
        print('Usage: inpaint_video.py <in> <out> <x> <y> <w> <h> [ffmpeg] [time_ranges_json]')
        sys.exit(1)
    inp, outp = sys.argv[1], sys.argv[2]
    rx, ry, rw, rh = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
    ffmpeg_bin = sys.argv[7] if len(sys.argv) > 7 else os.environ.get('FFMPEG_BIN', 'ffmpeg')
    time_ranges_arg = None
    if len(sys.argv) > 8:
        try:
            time_ranges_arg = json.loads(sys.argv[8])
        except Exception:
            pass
    inpaint_video(inp, outp, rx, ry, rw, rh, ffmpeg_bin, time_ranges_arg)
