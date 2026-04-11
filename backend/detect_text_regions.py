#!/usr/bin/env python3
"""
detect_text_regions.py — detecta regioes de watermark/texto usando OpenCV.
Tres estrategias combinadas (OR) para maxima cobertura:
  A) std temporal < 28 + borda na media  (logos completamente estaticos)
  B) Bordas persistentes em >30% frames  (texto semi-estatico)
  C) Contraste local quasi-estatico      (logos semitransparentes)
Usage: python3 detect_text_regions.py <video> [max_frames=24]
Output: JSON {"width":W,"height":H,"duration":D,"frames_analyzed":N,"regions":[...]}
"""
import sys, json, traceback
import cv2
import numpy as np

def detect(video_path, max_frames=24):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}", "regions": []}

    total    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    width    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps      = cap.get(cv2.CAP_PROP_FPS) or 30
    duration = total / fps

    step = max(1, total // max_frames)
    frames_raw = []

    for i in range(0, total, step):
        if len(frames_raw) >= max_frames:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            continue
        # Reduzir resolucao para 480p no lado maior
        scale = min(1.0, 480.0 / max(height, width, 1))
        if scale < 1.0:
            frame = cv2.resize(frame, (int(width*scale), int(height*scale)), interpolation=cv2.INTER_AREA)
        frames_raw.append(frame)

    cap.release()

    if not frames_raw:
        return {"error": "No frames processed", "regions": [], "width": width, "height": height,
                "duration": round(duration, 2), "frames_analyzed": 0}

    count  = len(frames_raw)
    fh, fw = frames_raw[0].shape[:2]
    frames = np.stack([f.astype(np.float32) for f in frames_raw], axis=0)

    mean_f   = np.mean(frames, axis=0)
    std_f    = np.std(frames,  axis=0)
    std_gray = np.mean(std_f,  axis=2)
    mean_lum = np.mean(mean_f, axis=2)

    # Helper: magnitude de Sobel normalizada (0-255 uint8)
    def edge_mag(gray_u8):
        gx = cv2.Sobel(gray_u8, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray_u8, cv2.CV_32F, 0, 1, ksize=3)
        mag = np.sqrt(gx**2 + gy**2)
        return (mag / (float(mag.max()) or 1.0) * 255).astype(np.uint8)

    mean_bgr  = np.clip(mean_f, 0, 255).astype(np.uint8)
    mean_gray = cv2.cvtColor(mean_bgr, cv2.COLOR_BGR2GRAY)
    mean_edges = edge_mag(mean_gray)

    # ══ A: completamente estatico (std<28) + borda na media (>12) ══════════════
    mask_A = ((std_gray < 28) & (mean_lum > 6) & (mean_edges > 12)).astype(np.uint8) * 255

    # ══ B: bordas persistentes em >30% dos frames amostrados ══════════════════
    edge_acc = np.zeros((fh, fw), dtype=np.float32)
    for f in frames_raw:
        gf = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        edge_acc += (edge_mag(gf) > 25).astype(np.float32)
    # Borda presente em >30% frames E variancia moderada (<45)
    mask_B = ((edge_acc / count > 0.30) & (std_gray < 45)).astype(np.uint8) * 255

    # ══ C: contraste local quasi-estatico (logos semitransparentes) ════════════
    mean_blur = cv2.GaussianBlur(mean_gray, (5, 5), 0)
    local_contrast = cv2.absdiff(mean_gray, mean_blur)
    mask_C = ((local_contrast > 8) & (std_gray < 35) & (mean_lum > 5)).astype(np.uint8) * 255

    # ══ Unir as tres mascaras (OR) ═════════════════════════════════════════════
    combined = cv2.bitwise_or(mask_A, cv2.bitwise_or(mask_B, mask_C))

    # Dilatar para conectar pixels vizinhos
    k1 = cv2.getStructuringElement(cv2.MORPH_RECT, (18, 9))
    dilated = cv2.dilate(combined, k1, iterations=2)

    # Fechar buracos internos (palavras, linhas de texto)
    k2 = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 16))
    closed = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, k2)

    # Remover ruido isolado
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (6, 4))
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, k3)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Area: minimo 0.03% e maximo 42% do frame
    min_area = fw * fh * 0.0003
    max_area = fw * fh * 0.42

    sx = width  / fw
    sy = height / fh

    regions = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w * h < min_area or w * h > max_area:
            continue
        pad = 10
        rx = max(0, int(x * sx) - pad)
        ry = max(0, int(y * sy) - pad)
        rw = min(width  - rx, int(w * sx) + pad * 2)
        rh = min(height - ry, int(h * sy) + pad * 2)
        regions.append({"x": rx, "y": ry, "w": max(4, rw), "h": max(4, rh)})

    regions.sort(key=lambda r: r["w"] * r["h"], reverse=True)
    regions = regions[:10]

    return {
        "width":           width,
        "height":          height,
        "duration":        round(duration, 2),
        "frames_analyzed": count,
        "regions":         regions
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: detect_text_regions.py <video> [max_frames]", "regions": []}))
        sys.exit(1)
    max_f = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    try:
        result = detect(sys.argv[1], max_f)
    except Exception as e:
        result = {"error": str(e), "trace": traceback.format_exc(), "regions": []}
    print(json.dumps(result))
