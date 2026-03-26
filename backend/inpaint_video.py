#!/usr/bin/env python3
"""
inpaint_video.py — remove watermark region using OpenCV Telea inpainting.
Usage: python3 inpaint_video.py <input> <output> <x> <y> <w> <h> [ffmpeg_bin]
"""
import sys, os, subprocess, tempfile
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

    # Clamp region to frame bounds
    x  = max(0, min(x, width  - 1))
    y  = max(0, min(y, height - 1))
    w  = max(1, min(w, width  - x))
    h  = max(1, min(h, height - y))

    # Expand ROI slightly so inpainting has neighbour context
    PAD = 20
    rx1 = max(0,      x - PAD)
    ry1 = max(0,      y - PAD)
    rx2 = min(width,  x + w + PAD)
    ry2 = min(height, y + h + PAD)

    # Build mask inside ROI coords
    roi_mask = np.zeros((ry2 - ry1, rx2 - rx1), dtype=np.uint8)
    mx1 = x - rx1
    my1 = y - ry1
    roi_mask[my1 : my1 + h, mx1 : mx1 + w] = 255

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    # Write video-only to temp file (OpenCV mp4v, then re-encode with ffmpeg)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.avi')
    os.close(tmp_fd)
    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    out = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        roi = frame[ry1:ry2, rx1:rx2]
        inpainted = cv2.inpaint(roi, roi_mask, 21, cv2.INPAINT_TELEA)
        frame[ry1:ry2, rx1:rx2] = inpainted
        out.write(frame)
        frame_count += 1
        if frame_count % 8 == 0 and total_frames > 0:
            pct = min(90, int(frame_count / total_frames * 90))
            print(f'PROGRESS:{pct}', flush=True)

    cap.release()
    out.release()
    print(f'PROGRESS:92', flush=True)
    print(f'Total frames: {frame_count}', flush=True)

    # Re-encode with ffmpeg to get proper mp4 + copy audio
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
    result = subprocess.run(cmd, capture_output=True, text=True)
    os.unlink(tmp_path)

    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)

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
