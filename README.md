# Watermark Cleaner (scaffold)

Projeto inicial para remover legendas/logos de vídeos.

Stack:
- Backend: Node.js 18 + Express + ffmpeg
- Frontend: estático (upload/status/download)
- CLI: Node.js script para operações locais e upload
- Docker: `Dockerfile` para backend + `docker-compose.yml`

Quick start (local):

1. Backend

```bash
cd "h:\\projeto novo"/backend
npm install
node index.js
```

2. CLI

```bash
cd "h:\\projeto novo"/cli
npm install
node index.js upload ../videos/exemplo.mp4
```

Para deploy: build Docker image e subir na sua VPS (já com Docker).
