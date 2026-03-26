#!/usr/bin/env bash
# deploy.sh — executa no VPS para atualizar o projeto do GitHub
# Uso: bash deploy.sh

set -e

echo "==> Baixando atualizações do GitHub..."
git pull origin main

echo "==> Reconstruindo e reiniciando container..."
docker compose down
docker compose up -d --build

echo "==> Limpando imagens antigas..."
docker image prune -f

echo "==> Verificando saúde da aplicação..."
sleep 3
curl -sf http://localhost:3000/api/health && echo " OK" || echo " FALHOU — verifique: docker compose logs"

echo "==> Deploy concluído!"
