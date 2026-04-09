FROM node:18-bullseye

# Install ffmpeg + Python + faster-whisper
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip fonts-dejavu-core fontconfig && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir faster-whisper
RUN pip3 install --no-cache-dir demucs
RUN pip3 install --no-cache-dir opencv-python-headless "librosa==0.9.2" numpy audioread scipy numba
RUN pip3 install --no-cache-dir rembg pillow
# Torch CPU (para Wav2Lip dentro do container)
RUN pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip3 install --no-cache-dir face_alignment

WORKDIR /usr/src/app

# ── Backend ──────────────────────────────────────────────────────────────────
COPY backend/package.json ./backend/
RUN cd backend && npm install --production

# ── Remotion Editor (build de produção) ──────────────────────────────────────
COPY remotion-editor/package.json ./remotion-editor/
RUN cd remotion-editor && npm install

COPY remotion-editor/ ./remotion-editor/
RUN cd remotion-editor && npm run build

# ── Arquivos finais ───────────────────────────────────────────────────────────
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /usr/src/app/backend
EXPOSE 3000
CMD ["node", "index.js"]
