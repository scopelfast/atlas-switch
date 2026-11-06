# Compartilhar AtlasSwitch para testes externos (ngrok)

Guia para expor o app rodando na sua máquina e permitir que pessoas externas acessem.

---

## Pré-requisito (uma vez)

1. **Conta ngrok** (gratuita): [ngrok.com](https://ngrok.com) → Sign up
2. **Authtoken**: no painel do ngrok, copie seu token
3. **Configurar** (PowerShell ou CMD):
   ```bash
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```

---

## Como usar (cada sessão de teste)

### Passo 1 – Subir o app
```bash
pnpm dev
```
Deixe rodando no terminal.

### Passo 2 – Abrir um **novo** terminal e iniciar o túnel
```bash
cd c:\gitHub\atlas-switch
pnpm tunnel
```
(Ou use direto: `ngrok http 3003` — porta por defeito do `pnpm dev` neste repositório; use `3000` só se alterar o script.)

### Passo 3 – Copiar o link público
O ngrok exibirá algo como:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3003
```
Copie o `https://...ngrok-free.app` (ou `.io`).

### Passo 4 – Ajustar o BASE_URL
Edite o `.env` e altere:
```
BASE_URL=https://abc123.ngrok-free.app
```
(substitua pelo link que você copiou)

### Passo 5 – Reiniciar o app
No terminal do `pnpm dev`, pressione `Ctrl+C` e rode novamente:
```bash
pnpm dev
```
(O login e os cookies dependem do BASE_URL correto.)

### Passo 6 – Compartilhar o link
Envie o link `https://abc123.ngrok-free.app` para os testadores.

---

## Importante

- **App + túnel ligados**: o app (`pnpm dev`) e o ngrok (`pnpm tunnel`) precisam estar rodando ao mesmo tempo.
- **URL gratuita muda**: em cada nova sessão o ngrok gera um URL diferente; repita os passos 3, 4 e 5 quando abrir de novo.
- **Sua internet**: sua máquina e conexão devem estar ligadas para os testadores acessarem.

---

## Atalhos rápidos

| Ação            | Comando        |
|-----------------|----------------|
| Subir o app     | `pnpm dev`     |
| Abrir túnel     | `pnpm tunnel`  |
