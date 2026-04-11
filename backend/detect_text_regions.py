#!/usr/bin/env python3
"""
detect_text_regions.py — detecta regioes de watermark/legenda fixa usando OpenCV.
Estrategia: variancia temporal baixa + presenca de borda na media = overlay estatico.
Usage: python3 detect_text_regions.py <video> [max_frames=20]
Output: JSON {"width":W,"height":H,"duration":D,"frames_analyzed":N,"regions":[...]}
"""
import sys, json, traceback
import cv2
import numpy as np

def detect(video_path, max_frames=20):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}", "regions": []}

    total    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    width    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps      = cap.get(cv2.CAP_PROP_FPS) or 30
    duration = total / fps

    step = max(1, total // max_frames)
    frames = []

    for i in range(0, total, step):
        if len(frames) >= max_frames:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            continue
        # Reduzir resolucao para processar mais rapido (max 480p)
        scale = min(1.0, 480.0 / max(height, 1))
        if scale < 1.0:
            fw = int(width * scale)
            fh = int(height * scale)
            frame = cv2.resize(frame, (fw, fh), interpolation=cv2.INTER_AREA)
        frames.append(frame.astype(np.float32))

    cap.release()

    if not frames:
        return {"error": "No frames processed", "regions": [], "width": width, "height": height, "duration": round(duration,2), "frames_analyzed": 0}

    count  = len(frames)
    fh, fw = frames[0].shape[:2]

    # ── 1. Variancia temporal por pixel ────────────────────────────────────────
    # Watermark = regiao que NAO muda entre frames (variancia baixa)
    # Conteudo do video = muda bastante (variancia alta)
    stack = np.stack(frames, axis=0)          # (N, H, W, 3)
    mean_f = np.mean(stack, axis=0)           # (H, W, 3)
    std_f  = np.std(stack,  axis=0)           # (H, W, 3)
    std_gray = np.mean(std_f, axis=2)         # (H, W) — desvio padrao medio

    # Pixels estaticos: std < 18 (em escala 0-255)
    # Pixels nao-pretos: luminancia media > 8
    mean_lum = np.mean(mean_f, axis=2)
    static_mask = (std_gray < 18) & (mean_lum > 8)

    # ── 2. Bordas na frame mediana (watermarks tem bordas internas) ────────────
    mean_bgr = np.clip(mean_f, 0, 255).astype(np.uint8)
    mean_gray_img = cv2.cvtColor(mean_bgr, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(mean_gray_img, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(mean_gray_img, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx**2 + gy**2)
    # Normalizar para 0-255
    gmax = float(grad_mag.max()) or 1.0
    grad_norm = (grad_mag / gmax * 255).astype(np.uint8)
    edge_mask = grad_norm > 20   # threshold baixo para nao perder texto suave

    # ── 3. Combinar: estatico E tem borda = overlay ────────────────────────────
    combined = (static_mask & edge_mask).astype(np.uint8) * 255

    # ── 4. Dilatar para juntar pixels proximos ─────────────────────────────────
    k1 = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 8))
    dilated = cv2.dilate(combined, k1, iterations=2)

    # Fechar buracos internos
    k2 = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 15))
    closed = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, k2)

    # Remover ruido pequeno
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, k3)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Area minima 0.05% e maxima 40% do frame
    min_area = fw * fh * 0.0005
    max_area = fw * fh * 0.40

    # Escala de volta para resolucao original
    sx = width  / fw
    sy = height / fh

    regions = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        if area < min_area or area > max_area:
            continue
        # Escalar para resolucao original e adicionar padding
        pad = 8
        rx = max(0, int(x * sx) - pad)
        ry = max(0, int(y * sy) - pad)
        rw = min(width  - rx, int(w * sx) + pad * 2)
        rh = min(height - ry, int(h * sy) + pad * 2)
        regions.append({"x": rx, "y": ry, "w": max(4, rw), "h": max(4, rh)})

    regions.sort(key=lambda r: r["w"] * r["h"], reverse=True)
    regions = regions[:8]

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
    max_f = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    try:
        result = detect(sys.argv[1], max_f)
    except Exception as e:
        result = {"error": str(e), "trace": traceback.format_exc(), "regions": []}
    print(json.dumps(result))
