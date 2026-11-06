Integrações externas – Stripe & SMTP
====================================

Objetivo: definir como habilitar (ou desabilitar com segurança) as integrações financeiras e de e-mail durante os testes.

Stripe
------

- **Variáveis obrigatórias**:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - (opcional) `STRIPE_ENABLED` – qualquer valor diferente de `'true'` desliga o Stripe.
- **Comportamento quando não configurado**:
  - Se `STRIPE_SECRET_KEY` estiver ausente ou `STRIPE_ENABLED` for `'false'`, o SDK não é carregado.
  - Rotas/actions que dependem do Stripe redirecionam para `/pricing?stripe=disabled`.
  - `/pricing` exibe banner informando que os planos estão em modo demonstração.
  - Webhooks respondem 503 para sinalizar que o ambiente está sem Stripe.
- **Ambiente de teste**:
  1. Instalar Stripe CLI (`stripe login`).
  2. Em `pnpm db:setup`, informar secret key de teste e capturar o webhook secret (`stripe listen --print-secret`).
  3. Preencher os campos no `.env`.
  4. Rodar `stripe listen --forward-to localhost:3003/api/stripe/webhook` durante os testes de checkout (porta alinhada a `pnpm dev` no `package.json`; ajuste se usar outra).
- **Fallback (sem Stripe)**:
  - Definir `STRIPE_ENABLED=false` ou simplesmente não preencher as chaves.
  - Testar apenas exibição de planos. Checkout e portal ficarão desabilitados.

SMTP
----

- **Variáveis necessárias**:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- **Comportamento quando não configurado**:
  - Funções de envio detectam a ausência de configuração e apenas registram um `console.warn`, sem lançar erro.
  - Convites de time são criados no banco normalmente; a mensagem retorna o link para compartilhamento manual.
  - Notificações do Taskflow são ignoradas silenciosamente (com aviso no log).
- **Ambiente de teste**:
  - Recomenda-se usar um SMTP de sandbox (Mailtrap, etc.).
  - Preencher variáveis e validar envio de convite ou notificação de tarefa.
- **Fallback**:
  - Deixar variáveis em branco. Convites/notificações continuam funcionando dentro da aplicação e exibem aviso amigável.

Checklist rápido
----------------
1. Conferir `.env`:
   - Stripe configurado? Sim/Não.
   - SMTP configurado? Sim/Não.
2. Se **não** configurado:
   - Confirmar que banner em `/pricing` aparece e testadores entendem o modo demonstração.
   - Ao enviar convite de usuário, garantir que a resposta mostra o link manual.
3. Se configurado:
   - Executar um checkout de teste (Stripe) e revisar e-mail enviado (SMTP).
