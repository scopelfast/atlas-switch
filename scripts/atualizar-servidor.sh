#!/bin/bash
# AtlasSwitch - Atualizar projeto no servidor (pull + build)
# O .env é aplicado a partir de ~/Projeto/.env.atlas-switch (configure UMA VEZ só).
# Uso: ./scripts/atualizar-servidor.sh   ou   bash scripts/atualizar-servidor.sh

set -e
cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"
ENV_MASTER="$HOME/Projeto/.env.atlas-switch"

echo "=========================================="
echo "  AtlasSwitch - Atualização no servidor"
echo "=========================================="
echo "Diretório: $PROJECT_DIR"
echo ""

# Usar .env "mestre" fora do repo: configure UMA VEZ em ~/Projeto/.env.atlas-switch
if [ -f "$ENV_MASTER" ]; then
  cp "$ENV_MASTER" "$PROJECT_DIR/.env"
  echo "[.env] Aplicado a partir de ~/Projeto/.env.atlas-switch (não precisa mexer no projeto)."
else
  echo "[.env] Dica: crie ~/Projeto/.env.atlas-switch (copie de .env.server.example) e preencha UMA VEZ; o script aplicará automaticamente a cada atualização."
fi
echo ""

echo "[1/3] Git pull..."
git pull origin main

# Garantir .env de novo após o pull (nunca usar .env vindo do git)
if [ -f "$ENV_MASTER" ]; then
  cp "$ENV_MASTER" "$PROJECT_DIR/.env"
fi
echo ""

echo "[2/3] pnpm install..."
pnpm install

echo ""
echo "[3/3] pnpm build..."
pnpm build

echo ""
echo "=========================================="
echo "  Atualização concluída."
echo "  Reinicie: pm2 restart atlas-switch"
echo "=========================================="
