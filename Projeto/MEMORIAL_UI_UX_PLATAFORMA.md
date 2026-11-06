# Memorial — UI/UX e superfície da plataforma (AtlasSwitch)

Documento de **âmbito**, **princípios** e **roadmap** para alinhar marketing, autenticação, área logada, ajuda e manuais.  
Complementa os memoriais funcionais (ex.: Taskflow) sem os substituir.

---

## 1. Diagnóstico resumido

| Área | Rota(s) | Situação típica |
|------|---------|------------------|
| Marketing / entrada | `/`, `/pricing`, `/help` | Conteúdo útil, mas **sem sistema visual único** com a app (tipografia, espaçamento, herói, prova social, CTAs). |
| Autenticação | `/sign-in`, `/sign-up`, `/forgot-password`, reset | Fluxos funcionais; **UX emocional e consistência** com o resto da marca são fracas. |
| App logada | `/dashboard/*` | Menu lateral **rolava com a página** (árvore flex sem altura limitada); **mobile** sem overlay de fecho claro. |
| Manuais | `/manual/*` | Estrutura com `ManualHeader` + cards POP, mas **pouca profundidade** (integrações entre módulos, papel da IA, troubleshooting). |

**Nota sobre `/pricing`:** é **demonstração** do modelo de cobrança/planos; o memorial assume que continuará explícito (“ambiente de demonstração” ou “valores ilustrativos”) para não confundir com produção legal/fiscal.

---

## 2. Princípios de produto (recursividade da ferramenta)

1. **Um atlas visual** — Mesma família tipográfica, escala de cinzas, violeta/indigo como acento, cantos e sombras coerentes com `atlas-surface` / `ModuleHeader`.
2. **Três camadas** — (A) Público/marketing, (B) Auth, (C) App. Cada camada tem **um layout-mãe**; páginas só compõem conteúdo.
3. **Mobile-first na app** — Navegação primária: gaveta + overlay; conteúdo: uma coluna, `min-w-0`, áreas de toque ≥ 44px.
4. **Manuais = operação real** — Cada manual cobre: objetivo, pré-requisitos, fluxo diário, **interação com outros módulos**, **o que a IA faz / não faz** naquele módulo, limites de permissão, erros comuns.
5. **Acessibilidade** — Contraste, foco visível, rótulos em formulários, mensagens de erro acionáveis.
6. **Papéis na cópia** — Em marketing, `/help` e manuais, **não** misturar **dono do time** (`owner` em `team_members`, governa o seu tenant) com **operador da instância** (`platform_admin` em `users.role`, Control Center, planos globais, Integrações globais, Central de IA). Ver `MEMORIAL_GOVERNANCA_SAAS_MULTITENANT.md`.

---

## 3. Roadmap sugerido (fases)

Os `[x]` abaixo marcam **primeira entrega** no repositório; a **barra de qualidade comercial** (polimento, encantamento, mobile real, manuais densos) segue no **§7** até fecho explícito com o produto.

### Fase A — Fundações (rápida, alto impacto)

- [x] Shell `/dashboard/*`: viewport fixa (`h-dvh`), **só o `<main>` rola**; menu lateral estável em desktop.
- [x] Mobile: **overlay** ao abrir o menu (fechar ao tocar fora).
- [x] Componentes reutilizáveis: `AuthShellSplit` / `AuthShellCard` (`components/shells/auth-shell.tsx`); `PublicSiteHeader` + `MarketingStandaloneLayout` + `SiteFooter` (`components/shells/*`); `ThemeToggleButton` partilhado.

### Fase B — Autenticação e recuperação

- [x] `/sign-in`, `/sign-up` (`login.tsx` + `AuthShellSplit`), `/forgot-password`, `/reset-password`, `/invite/password` (`AuthShellCard`): fundo em gradiente alinhado ao dashboard, cartão `atlas-surface`, rodapé de confiança com ligações a início / ajuda / login.
- [x] Microcopy revisado (confiança, opt-in IA, sem jargão de memorial nas strings).

### Fase C — Marketing e ajuda

- [x] `/` — Herói com selo, gradiente no título, prova social (faixa numérica), CTAs (conta + preços demo), `SiteFooter` embutido.
- [x] `/pricing` — Faixa **Demonstração** sempre visível; aviso Stripe quando aplicável; `SiteFooter`; texto do `ModuleHeader` alinhado ao modo demo.
- [x] `/help` — Layout autónomo com o mesmo cabeçalho público que a marca; hero; secção **IA na plataforma** (local vs Central de IA vs integrações); ligação ao índice `/manual`.

### Fase D — Manuais (`/manual/*`)

Para **cada** manual, modelo mínimo de secções:

1. **Resumo** — Para que serve o módulo em uma frase.  
2. **Papéis e permissões** — O que cada perfil vê ou deixa de ver.  
3. **Fluxo operacional (POP)** — Passo a passo numerado (já existente; **expandir**).  
4. **Integrações com outros módulos** — Ex.: Taskflow ↔ Chronos (prazo), Taskflow ↔ Reunify (ações), Projectus ↔ Taskflow, etc.  
5. **Inteligência artificial** — Onde há heurísticas/insights, opt-in, dados que **não** saem para terceiros; onde há modelos (Central de IA) e requisitos de `.env`.  
6. **Resolução de problemas** — Erros frequentes, quem contactar, links para `/help`.

**Prioridade de escrita:** Taskflow → Chronos → Reunify → Control Center / Integrações → restantes.

### Fase E — Governança

- [ ] Checklist de revisão antes de release (contraste, Lighthouse a11y básico, smoke em mobile 375px).
- [ ] Atualizar este memorial quando fechar fases ou alterar decisões de UX.

---

## 4. Referência técnica (ficheiros)

| Tema | Ficheiros |
|------|-----------|
| Cabeçalho global (dashboard group) | `app/(dashboard)/layout.tsx` |
| Sidebar + main | `app/(dashboard)/dashboard/layout.tsx` |
| Landing | `app/(dashboard)/page.tsx` |
| Auth | `app/(login)/login.tsx`, `sign-up`, `forgot-password`, `reset-password`, `invite/password` |
| Shells partilhados | `components/shells/auth-shell.tsx`, `public-site-header.tsx`, `marketing-standalone-layout.tsx`, `site-footer.tsx`, `theme-toggle-button.tsx` |
| Ajuda | `app/help/layout.tsx`, `app/help/page.tsx` |
| Preços | `app/(dashboard)/pricing/page.tsx` |
| Manual genérico | `components/ui/manual-header.tsx`, `app/manual/page.tsx` (índice), `app/manual/**/page.tsx` |

---

## 5. O que já foi feito neste memorial (changelog)

- **2026-04-23** — Princípio **§2.6 (papéis na cópia)** e alinhamento de `/help` (POP por perfil, primeiro acesso, checklists) à separação **operador da instância** (`platform_admin`) vs **dono do time**; manuais `ai-center` com nota explícita em papéis.
- **2026-04-23** — Índice `/manual` e mensagens «Acesso restrito» / ajudas rápidas em Control Center, Integrações globais, IA, planos, catálogo, perfis, empresas, menu e Chronos (OAuth) com vocabulário de **operador da plataforma** ou **infraestrutura**, evitando «administrador» ambíguo.
- **2026-04-16** — Shell de altura fixa para rotas `/dashboard/*` + wrapper `min-h-0` na grelha da app; overlay em mobile para fechar o menu; este documento criado.
- **2026-04-16** — Fases A–C (primeira entrega): `AuthShell*` em fluxos de auth; `MarketingStandaloneLayout` em `/help`; `SiteFooter` na landing e preços; faixa de demonstração em `/pricing`; secção de IA em `/help`; índice `app/manual/page.tsx`.
- **2026-04-17** — Fase D (prioridade Taskflow → Chronos → Reunify → Control / Integrações / Central de IA): componente `components/manual/manual-doc-block.tsx`; manuais `taskflow`, `chronos`, `reunify`, `control-center`, `control-integrations`, `ai-center` com secções 1, 2, 4–6 do modelo mínimo + POP ou boas práticas existentes; índice `app/manual/page.tsx` com cartão «Como usar este índice» e ligação explícita a `/help`.

---

## 6. Resposta direta às tuas perguntas

- **“É demonstração o pricing?”** — Trata-se de **UI e fluxo de exemplo**; até haver contratos/Stripe em produção legalmente vinculados, mantém-se como **demonstração** e deve dizer‑lo na página.  
- **“Recursiva?”** — Neste contexto interpreta‑se como **coerência end‑to‑end** (mesma linguagem visual e documental em todas as entradas). O roadmap acima materializa isso em fases.  
- **Memorial** — Este ficheiro **é** o memorial de UI/UX da plataforma; os memoriais por módulo (ex. Taskflow) continuam a detalhar **regras de negócio**; aqui ficam **decisões de superfície e priorização**.

Quando quiseres avançar **Fase B ou C**, indica por onde começar (ex.: “só auth” ou “só landing + pricing”) para se manterem PRs revistáveis.

---

## 7. Backlog de refinamento (pedido produto — Abr/2026)

Critério explícito do cliente: **aspecto moderno e profissional**, **UX que encante**, **mobile sem “porcaria”**, **help e manuais muito ricos** (interação entre módulos + papel da IA em cada um), **tudo no mesmo padrão visual**.

As fases A–C acima registam uma **primeira entrega** de shells e conteúdo; este backlog **não** assume que a percepção de qualidade já fechou. Itens a rever / aprofundar (sem ordem rígida):

| Área | Rota(s) | O que falta tipicamente |
|------|---------|-------------------------|
| Entrada / marca | `/` | Segunda passada de hierarquia visual, prova social, performance de hero, micro-interacções. |
| Auth | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, convites | Polimento fino (ritmo, estados vazios, ilustração leve, copy por persona); testes em viewports reais. |
| Ajuda | `/help` | Mais profundidade operacional (cenários, vídeos ou GIFs futuros, FAQ por módulo); ligações ainda mais explícitas a cada manual. |
| Preços | `/pricing` | Manter **demonstração** explícita; alinhar ritmo visual ao resto da marca; eventual preços reais quando houver produto comercial. |
| App | `/dashboard/*` | Auditoria mobile (375/390): gaveta, scroll do `main`, tabelas largas, formulários; regressões de shell. |
| Manuais | `/manual/*` | **Fase D:** Taskflow, Chronos, Reunify, Control Center, Integrações globais e Central de IA com modelo mínimo (`ManualDocBlock` + POP onde já existia); índice `/manual` com guia de uso. **Segue:** Projectus, ResourceHub, BillTrak, Bibliotheca, Notepad, Scriptum, Usuários, Definições gerais, Segurança, Atividade, Zapier/Make — mesmo esqueleto; segunda passada de texto com revisão de produto. |

**Governança:** manter a Fase E (checklist pré-release + smoke mobile); acrescentar revisão visual “por rota” quando fechar blocos deste backlog.

**Registo no memorial de execução:** ver `MEMORIAL_TASKFLOW_EXECUCAO.md` — Apêndice A e «Registo de alterações».
