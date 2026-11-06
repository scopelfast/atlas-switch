# ADR 0002 — Stack aspiracional (FastAPI, Redis, RabbitMQ, K8s, OAuth2) só pós-MVP

| Campo | Valor |
|-------|--------|
| **Estado** | Aceite |
| **Data** | 2026-04-14 |
| **Âmbito** | Atlas Switch — arquitectura de entrega; memorial **E8.1** (Fase 8) |

## Contexto

O memorial de execução descreve uma **stack aspiracional** para evolução da plataforma: exemplos típicos incluem **API em FastAPI** (ou outro serviço Python separado), **Redis** (cache ou filas), **RabbitMQ** (ou broker equivalente), **Kubernetes** para orquestração de contentores, e **OAuth2** “de plataforma” além do que o produto já usa para convites e sessões.

Essas peças são **úteis** para escala, filas de jobs pesados (IA, webhooks) ou separação de serviços, mas **não** fazem parte do núcleo **M0–M7** nem do critério de **MVP** actual (Next.js, Postgres, e-mail síncrono, jobs leves no mesmo processo quando existirem).

Sem uma decisão explícita, há risco de **misturar** referências aspiracionais com tarefas de entrega imediata, aumentando complexidade operacional e atrasando valor para PME.

## Decisão

1. **O caminho actual do produto** (monólito modular Next.js + Postgres + Drizzle, deploy compatível com Node, variáveis em `.env`, **I8.4** para toggles/segredos de integração) **permanece** a referência para **entregas M0–M7** e para **correcções** no núcleo Taskflow/Chronos/Reunify **sem** obrigar Redis, RabbitMQ, K8s nem um segundo runtime Python em produção.

2. **FastAPI, Redis, RabbitMQ, Kubernetes** e **OAuth2** como **identidade federada / plataforma completa** (ex.: servidor de autorização dedicado, multi-realm) são tratados como **evolução pós-MVP**, descritos no memorial e noutros ADRs quando aplicável — **não** como pré-requisito silencioso de *issues* do núcleo.

3. **Qualquer alteração** que **introduza** uma destas dependências no **caminho crítico** de uma funcionalidade já mapeada a **M0–M7** (ou que a torne impossível de correr num ambiente “Postgres + Node apenas”) **exige um ADR novo** (número sequencial após este), com: contexto, decisão, alternativas, plano de migração e impacto em CI/CD — **antes** de merge para `main` (ou política de branch equivalente).

4. **OAuth2 / OIDC** para **um conector concreto** (ex.: Microsoft Graph, Google Calendar, **E8.12** / **E8.16**) continua a ser avaliado **por funcionalidade**, com segredos em **I8.4** (env); isso **não** por si só viola este ADR — viola se a entrega **obrigar** infraestrutura de broker ou cluster **sem** ADR que o justifique.

## Consequências

### Positivas

- **Clareza** para equipa e revisores: o memorial **E8.1** fica amarrado a um documento versionado.
- **Menos deriva** entre documentação “bonita” e o que realmente se mantém em produção no MVP.

### Negativas / riscos

- Algumas **PME** com requisito explícito de Redis/K8s terão de esperar por **ADR + implementação** ou por **instância dedicada** documentada — não “acoplar” ao MVP genérico sem decisão.

## Alternativas consideradas

| Alternativa | Porque não como regra global |
|--------------|------------------------------|
| **Adoptar já Redis/RabbitMQ** para todas as notificações | Aumenta superfície operacional antes de volume ou SLAs que o justifiquem; quando **E8.5** ou filas de IA precisarem, um ADR pode introduzir fila de forma incremental. |
| **Migrar núcleo API para FastAPI** num único passo | Duplica runtime, auth e modelos de domínio; alto risco de regressão sem ganho imediato para o utilizador final. |
| **Proibir para sempre** FastAPI/Redis/etc. | Demasiado rígido; a decisão é **pós-MVP + ADR**, não veto eterno. |

## Quando rever

- Antes de **E8.5** (webhooks + fila), **E8.13** (orquestração IA) ou cargas que exijam **workers** dedicados — avaliar se um **ADR-0003+** introduz fila/cache de forma mínima.
- Quando a equipa definir **SLA** de disponibilidade ou **multi-região** que exija K8s ou serviços geridos.

## Referências no repositório

- `Projeto/MEMORIAL_TASKFLOW_EXECUCAO.md` — item **E8.1**, secção **Estratégia de IA**, **I8.4** (parâmetros globais).
- `Projeto/ADR-0001-multitenant-team-id.md` — modelo de ADR e multi-tenant.
