# Chave SSH e script de atualização no servidor

## 1. Adicionar a chave SSH no GitHub

A chave pública do servidor é:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBmNFm0cnPVQspwz/qRGGB4iL8rqgHYRyj8ajpCxsisr atlas-switch@atlas-switch-Lab-Teste
```

### Passos no GitHub

1. Acesse **https://github.com/settings/keys**
2. Clique em **"New SSH key"**
3. **Title:** `atlas-switch-Lab-Teste` (ou outro nome para identificar o servidor)
4. **Key type:** Authentication Key
5. **Key:** cole a chave inteira (a linha acima, começando em `ssh-ed25519` e terminando em `atlas-switch-Lab-Teste`)
6. Clique em **"Add SSH key"**

---

## 2. No servidor Linux – usar SSH para o repositório

Se o projeto foi clonado com HTTPS, troque para SSH para não pedir senha:

```bash
cd ~/Projeto/atlas-switch
git remote set-url origin git@github.com:Scopel2022/atlas-switch.git
git remote -v
```

A partir daí, `git pull` e `git push` usam a chave SSH.

---

## 3. .env só UMA VEZ (nunca mais mexer a cada deploy)

No servidor, crie **um único arquivo** fora do projeto. O script de atualização usa esse arquivo a cada vez; você **não mexe mais no .env** dentro da pasta do projeto.

```bash
cd ~/Projeto/atlas-switch
cp .env.server.example ~/Projeto/.env.atlas-switch
nano ~/Projeto/.env.atlas-switch
```

Preencha **uma vez** (POSTGRES_URL, BASE_URL com o IP do servidor, AUTH_SECRET, etc.), salve e pronto. Em todo `./scripts/atualizar-servidor.sh` o script copia esse arquivo para o projeto.

## 4. Script de atualização

No servidor, para puxar as últimas alterações e rebuildar:

```bash
cd ~/Projeto/atlas-switch
chmod +x scripts/atualizar-servidor.sh
./scripts/atualizar-servidor.sh
```

Depois, reinicie a aplicação:

- Com PM2: `pm2 restart atlas-switch`

---

## Resumo

| Onde | O que fazer |
|------|-------------|
| **GitHub** | Settings → SSH and GPG keys → New SSH key → colar a chave |
| **Servidor** | `git remote set-url origin git@github.com:Scopel2022/atlas-switch.git` |
| **.env (uma vez)** | `cp .env.server.example ~/Projeto/.env.atlas-switch` e editar; o script aplica a cada atualização |
| **Atualizar** | `./scripts/atualizar-servidor.sh` e depois `pm2 restart atlas-switch` |
