FROM node:18-bullseye

# Install ffmpeg from apt (available as 'ffmpeg' command in PATH)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install Node deps first (better layer caching)
COPY backend/package.json ./backend/
RUN cd backend && npm install --production

# Copy source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /usr/src/app/backend
EXPOSE 3000
CMD ["node", "index.js"]
