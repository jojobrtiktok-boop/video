#!/usr/bin/env python3
"""
detect_text_regions.py — detecta regioes de texto/watermark usando OpenCV.
Analisa frames amostrados e encontra regioes com alta persistencia de bordas.
Usage: python3 detect_text_regions.py <video> [max_frames=15]
Output: JSON {"width":W,"height":H,"duration":D,"regions":[{"x","y","w","h"},...]}
"""
import sys, json
import cv2
import numpy as np

def detect(video_path, max_frames=15):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open {video_path}"}

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS) or 30
    duration = total / fps

    step = max(1, total // max_frames)
    presence = np.zeros((height, width), dtype=np.float32)
    count = 0

    for i in range(0, total, step):
        if count >= max_frames:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Gradient magnitude — texto tem bordas fortes e localizadas
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        mag = np.sqrt(gx**2 + gy**2)
        mag = (mag / (mag.max() + 1e-6) * 255).astype(np.uint8)

        _, binary = cv2.threshold(mag, 55, 255, cv2.THRESH_BINARY)

        # Dilatar para conectar pixels proximos do mesmo texto
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 4))
        dilated = cv2.dilate(binary, k, iterations=2)

        presence += dilated.astype(np.float32)
        count += 1

    cap.release()
    if count == 0:
        return {"error": "No frames processed", "regions": []}

    # Normaliza
    norm = presence / count

    # Regioes presentes em >45% dos frames sao consideradas persistentes (overlay)
    threshold = 0.45 * 255
    persistent = (norm > threshold).astype(np.uint8) * 255

    # Fechar buracos e remover ruido
    k2 = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 12))
    cleaned = cv2.morphologyEx(persistent, cv2.MORPH_CLOSE, k2)
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, k3)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = width * height * 0.0008  # minimo 0.08% do frame
    max_area = width * height * 0.45    # maximo 45% do frame

    regions = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w * h < min_area or w * h > max_area:
            continue
        # Padding para envolver bem o texto
        pad = 10
        x = max(0, x - pad)
        y = max(0, y - pad)
        w = min(width - x, w + pad * 2)
        h = min(height - y, h + pad * 2)
        regions.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h)})

    # Ordenar por area desc, limitar a 8 regioes
    regions.sort(key=lambda r: r["w"] * r["h"], reverse=True)
    regions = regions[:8]

    return {
        "width": width,
        "height": height,
        "duration": round(duration, 2),
        "frames_analyzed": count,
        "regions": regions
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: detect_text_regions.py <video> [max_frames]"}))
        sys.exit(1)
    max_f = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    result = detect(sys.argv[1], max_f)
    print(json.dumps(result))
