import Link from 'next/link';
import {
  CalendarClock,
  CheckSquare,
  CreditCard,
  FilePenLine,
  FileText,
  Library,
  NotebookPen,
  ShieldCheck,
  UserCog,
  User,
  Video,
  Boxes,
  Briefcase,
  Brain,
  Printer,
  Sparkles,
  Cloud,
  Cpu,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HelpPage() {
  const moduleGuides = [
    {
      title: 'Chronos',
      slug: 'chronos',
      icon: CalendarClock,
      accent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
      glow: 'from-indigo-500/20 via-slate-900/50 to-slate-950',
      description: 'Agenda inteligente e time-blocking.',
      steps: [
        'Crie compromissos com data, horário e duração.',
        'Escolha a visão (dia, semana, lista ou timeline).',
        'Revise alertas de conflitos e tempo de foco.',
        'Use o resumo para ajustar sua semana.',
      ],
      href: '/manual/chronos',
    },
    {
      title: 'Reunify',
      slug: 'reunify',
      icon: Video,
      accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      glow: 'from-emerald-500/20 via-slate-900/50 to-slate-950',
      description: 'Reuniões com pauta, decisões e follow-up.',
      steps: [
        'Cadastre uma reunião com agenda e participantes.',
        'Registre decisões e ações durante o encontro.',
        'Gere follow-up e transforme ações em tarefas.',
        'Finalize com ata e métricas de eficiência.',
      ],
      href: '/manual/reunify',
    },
    {
      title: 'Taskflow',
      slug: 'taskflow',
      icon: CheckSquare,
      accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
      glow: 'from-blue-500/20 via-slate-900/50 to-slate-950',
      description: 'Tarefas com prioridades e automações.',
      steps: [
        'Crie tarefas com prazo e responsável.',
        'Organize no Kanban, lista ou matriz de prioridade.',
        'Use automações para mover tarefas automaticamente.',
        'Revise métricas e gargalos semanalmente.',
      ],
      href: '/manual/taskflow',
    },
    {
      title: 'Projectus',
      slug: 'projectus',
      icon: Briefcase,
      accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
      glow: 'from-amber-500/20 via-slate-900/50 to-slate-950',
      description: 'Projetos, riscos e cronogramas.',
      steps: [
        'Crie o projeto e defina fases e tarefas.',
        'Cadastre marcos, riscos e dependências.',
        'Acompanhe o progresso no painel executivo.',
        'Integre tarefas com Taskflow e agenda com Chronos.',
      ],
      href: '/manual/projectus',
    },
    {
      title: 'ResourceHub',
      slug: 'resourcehub',
      icon: Boxes,
      accent: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
      glow: 'from-cyan-500/20 via-slate-900/50 to-slate-950',
      description: 'Capacidade, alocação e recursos.',
      steps: [
        'Cadastre recursos com capacidade semanal.',
        'Crie alocações por projeto e tarefa.',
        'Revise o heatmap de utilização.',
        'Ajuste cargas para evitar sobrecarga.',
      ],
      href: '/manual/resourcehub',
    },
    {
      title: 'BillTrak',
      slug: 'billtrak',
      icon: CreditCard,
      accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
      glow: 'from-rose-500/20 via-slate-900/50 to-slate-950',
      description: 'Custos, receitas e fluxo de caixa.',
      steps: [
        'Cadastre contas, categorias e lançamentos.',
        'Registre transações e concilie o caixa.',
        'Acompanhe métricas e margens do mês.',
        'Integre custos ao Projectus e ResourceHub.',
      ],
      href: '/manual/billtrak',
    },
    {
      title: 'Bibliotheca',
      slug: 'bibliotheca',
      icon: Library,
      accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
      glow: 'from-violet-500/20 via-slate-900/50 to-slate-950',
      description: 'Documentos, tags e organização.',
      steps: [
        'Envie documentos com tags e categorias.',
        'Vincule arquivos a projetos e tarefas.',
        'Use filtros para localizar conteúdos.',
        'Arquive itens obsoletos regularmente.',
      ],
      href: '/manual/bibliotheca',
    },
    {
      title: 'Notepad Pro',
      slug: 'notepad',
      icon: NotebookPen,
      accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
      glow: 'from-sky-500/20 via-slate-900/50 to-slate-950',
      description: 'Notas inteligentes e conexões.',
      steps: [
        'Crie notas com tags e pastas.',
        'Converta ideias em tarefas quando necessário.',
        'Vincule notas a projetos e documentos.',
        'Revise notas marcadas como “revisar”.',
      ],
      href: '/manual/notepad',
    },
    {
      title: 'Scriptum',
      slug: 'scriptum',
      icon: FilePenLine,
      accent: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
      glow: 'from-orange-500/20 via-slate-900/50 to-slate-950',
      description: 'Escrita profissional por projetos.',
      steps: [
        'Crie o projeto e defina metas de palavras.',
        'Organize capítulos e status de revisão.',
        'Vincule referências da Bibliotheca.',
        'Revise progresso e prazos semanalmente.',
      ],
      href: '/manual/scriptum',
    },
    {
      title: 'Control Center',
      slug: 'control-center',
      icon: ShieldCheck,
      accent: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
      glow: 'from-slate-500/20 via-slate-900/50 to-slate-950',
      description: 'Clientes, planos e auditoria.',
      steps: [
        'Cadastre ou ajuste planos por cliente.',
        'Acompanhe MRR e saúde dos clientes.',
        'Revise auditoria e atividade crítica.',
        'Registre negociações e exceções.',
      ],
      href: '/manual/control-center',
    },
    {
      title: 'Central de IA',
      slug: 'ai-center',
      icon: Brain,
      accent: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300',
      glow: 'from-fuchsia-500/20 via-slate-900/50 to-slate-950',
      description: 'Modelos open source e endpoints.',
      steps: [
        'Cadastre modelos por tipo (LLM, ASR, Embedding).',
        'Defina o modelo padrão para cada uso.',
        'Ative apenas modelos necessários.',
        'Registre ajustes e versões.',
      ],
      href: '/manual/ai-center',
    },
  ];

  const profileGuides = [
    {
      title: 'Owner do time (Proprietário)',
      icon: UserCog,
      description: 'Governa o seu tenant (equipa), não a instância inteira.',
      steps: [
        'Gerir convites e papéis em Usuários no contexto do time.',
        'Acompanhar entregas e prioridades nos módulos (Taskflow, Chronos, Reunify, etc.).',
        'Ajustar opt-ins e definições do time permitidas pelo plano contratado.',
        'Pedir ao operador da plataforma alterações de plano, módulos ou excepções comerciais quando necessário.',
      ],
    },
    {
      title: 'Operador da plataforma (platform_admin)',
      icon: ShieldCheck,
      description: 'Conta da equipa Atlas / parceiro que gere a instância multi-tenant.',
      steps: [
        'Gerir empresas, planos, catálogo e auditoria no Control Center.',
        'Configurar Integrações globais e Central de IA quando aplicável.',
        'Acompanhar saúde dos clientes, MRR e eventos críticos.',
      ],
    },
    {
      title: 'Member (Membro)',
      icon: User,
      description: 'Operação diária dos módulos e entregas.',
      steps: [
        'Executar tarefas e registrar progresso no Taskflow.',
        'Atualizar agenda e reuniões com o time.',
        'Alimentar projetos e registrar resultados no Projectus.',
        'Manter documentos e notas sempre atualizados.',
      ],
    },
  ];

  const printChecklists = [
    {
      title: 'Checklist diário',
      items: [
        'Revisar prioridades no Taskflow.',
        'Checar agenda no Chronos.',
        'Registrar decisões no Reunify.',
        'Atualizar progresso no Projectus.',
        'Validar custos no BillTrak.',
      ],
    },
    {
      title: 'Checklist semanal',
      items: [
        'Revisar metas e gargalos do Taskflow.',
        'Ajustar recursos e capacidade no ResourceHub.',
        'Atualizar status de projetos críticos.',
        'Revisar documentos e notas pendentes.',
        'Operadores: validar saúde dos clientes no Control Center.',
      ],
    },
    {
      title: 'Checklist mensal',
      items: [
        'Operadores: auditar planos, faturamento e churn.',
        'Consolidar aprendizados na Bibliotheca.',
        'Ajustar templates e padrões de reunião.',
        'Revisar uso de IA e modelos ativos.',
      ],
    },
  ];

  const accountGuides = [
    {
      title: 'Configurações gerais',
      description: 'Dados da conta, identidade e avatar.',
      href: '/manual/general',
    },
    {
      title: 'Segurança',
      description: 'Senha, proteção e boas práticas.',
      href: '/manual/security',
    },
    {
      title: 'Usuários',
      description: 'Convites, funções e gestão de acessos.',
      href: '/manual/usuarios',
    },
    {
      title: 'Atividades',
      description: 'Auditoria e histórico de ações.',
      href: '/manual/activity',
    },
    {
      title: 'Control Center',
      description: 'Clientes, planos e governança do SaaS.',
      href: '/manual/control-center',
    },
    {
      title: 'Central de IA',
      description: 'Modelos, endpoints e ativação.',
      href: '/manual/ai-center',
    },
  ];

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-8 dark:border-slate-800/80 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">
              Centro de ajuda
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Operar a AtlasSwitch com confiança
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Primeiros passos, perfis, módulos e ligações entre eles. Cada módulo tem um manual detalhado
              em <Link href="/manual" className="font-medium text-indigo-600 underline dark:text-indigo-400">/manual</Link> — use este
              índice como mapa antes de mergulhar no POP de cada área.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/manual">Índice de manuais</Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard">Ir para o painel</Link>
            </Button>
          </div>
        </div>

        <Card className="atlas-surface border-indigo-200/60 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 dark:border-indigo-500/20 dark:from-indigo-950/40 dark:via-slate-950 dark:to-violet-950/30">
          <CardHeader>
            <CardTitle>Fluxo de valor na plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>
              A narrativa única do produto é{' '}
              <strong>reunião → tarefa → tempo → custo</strong>: no Reunify define-se o que foi decidido; no
              Taskflow executam-se entregas com prazos; no Chronos protege-se foco e compromissos; no BillTrak
              (quando ativo) liga-se esforço a números. O ResourceHub e o Projectus dão capacidade e portfólio por
              cima deste fluxo.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>IA:</strong> heurísticas e insights locais (ex.: rascunho de acções a partir de texto,
              sugestões no quadro) são opt-in por equipa e não enviam dados a terceiros por defeito. Modelos na nuvem
              (OpenAI, Gemini, AssemblyAI, etc.) só correm com chaves e toggles explícitos — ver Integrações globais e
              Central de IA nos manuais.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="atlas-surface">
            <CardHeader>
              <CardTitle>Primeiro acesso (passo a passo)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Entre com sua conta e revise seu perfil.</li>
                <li>
                  Se for <strong>operador da plataforma</strong>: ajuste planos e módulos no Control Center. Caso
                  contrário, confirme com o operador que o plano do time inclui os módulos necessários.
                </li>
                <li>Crie sua primeira tarefa no Taskflow.</li>
                <li>Bloqueie tempo no Chronos para foco.</li>
                <li>Registre a primeira reunião no Reunify.</li>
                <li>Cadastre um projeto no Projectus e vincule tarefas.</li>
                <li>Inclua recursos no ResourceHub e custos no BillTrak.</li>
                <li>Organize documentos na Bibliotheca e notas no Notepad Pro.</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="atlas-surface">
            <CardHeader>
              <CardTitle>Checklist diário</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Revisar prioridades no Taskflow.</li>
                <li>Checar agenda no Chronos.</li>
                <li>Registrar decisões no Reunify.</li>
                <li>Atualizar progresso no Projectus.</li>
                <li>Validar custos no BillTrak.</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className="atlas-surface border-violet-200/60 dark:border-violet-500/20">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>IA na plataforma — o que é local, o que é nuvem</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transparência para donos de time, operadores da plataforma e equipas de operações.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  Heurísticas no produto
                </div>
                <p className="mt-2 text-xs leading-relaxed">
                  Sugestões no quadro Taskflow, insights nos relatórios e rascunhos no Reunify podem correr
                  com lógica local. São opt-in por equipa onde a UI mostra um interruptor — não enviam
                  conteúdo da sua empresa para terceiros por defeito.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  <Cloud className="h-4 w-4 text-sky-500" />
                  Central de IA
                </div>
                <p className="mt-2 text-xs leading-relaxed">
                  O módulo <Link href="/manual/ai-center" className="font-medium text-indigo-600 underline dark:text-indigo-400">Central de IA</Link>{' '}
                  cataloga modelos (LLM, ASR, etc.) e endpoints. Só quando configurar chaves e rotas em
                  <code className="mx-1 rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-900">.env</code>
                  e políticas da organização é que inferência externa entra em jogo.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Integrações globais
                </div>
                <p className="mt-2 text-xs leading-relaxed">
                  Parâmetros de WhatsApp, Google ou Microsoft vivem em{' '}
                  <Link href="/manual/control-integrations" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                    Integrações globais
                  </Link>
                  . São compartilhados pela plataforma; trate-os como segredos de infraestrutura, não como
                  preferências de utilizador.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Em caso de dúvida sobre dados pessoais ou exportação, veja também o documento de LGPD no
              repositório do projeto e o manual de Segurança.
            </p>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Configurar Stripe (POP rápido)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie sua conta Stripe e gere as chaves do ambiente.</li>
              <li>Preencha <strong>STRIPE_SECRET_KEY</strong> e <strong>STRIPE_WEBHOOK_SECRET</strong> no `.env`.</li>
              <li>Defina <strong>BASE_URL</strong> com o domínio da plataforma.</li>
              <li>Crie produtos e preços no Stripe e copie os IDs.</li>
              <li>
                Vincule os IDs no Control Center (Plano → Stripe Product/Price) — apenas contas{' '}
                <strong>platform_admin</strong>.
              </li>
              <li>Teste o checkout em `/pricing` e confirme a assinatura.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP por perfil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-2">
            {profileGuides.map((profile) => {
              const Icon = profile.icon;
              return (
                <div
                  key={profile.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-2xl bg-indigo-500/10 p-3 text-indigo-600 dark:text-indigo-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {profile.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {profile.description}
                      </p>
                    </div>
                  </div>
                  <ol className="mt-3 list-decimal space-y-2 pl-5">
                    {profile.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3" id="checklists">
          <div className="flex items-center justify-between lg:col-span-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Checklists imprimíveis
            </h2>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href="#checklists">
                <Printer className="mr-2 h-4 w-4" />
                Preparar impressão
              </a>
            </Button>
          </div>
          {printChecklists.map((checklist) => (
            <Card key={checklist.title} className="atlas-surface print:border-none">
              <CardHeader>
                <CardTitle>{checklist.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-300">
                <ol className="list-decimal space-y-2 pl-5">
                  {checklist.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
                  Dica: pressione Ctrl+P para imprimir esta seção.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Operação da conta (manuais rápidos)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-2">
            {accountGuides.map((guide) => (
              <div
                key={guide.title}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {guide.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {guide.description}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={guide.href}>Abrir manual</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {moduleGuides.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="atlas-surface">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{module.title}</CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {module.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl bg-indigo-500/10 p-3 text-indigo-600 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 dark:text-slate-300">
                  <div
                    className={`mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${module.glow} p-5 dark:border-slate-800`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${module.accent}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {module.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Prévia visual do módulo
                        </p>
                      </div>
                    </div>
                  </div>
                  <ol className="list-decimal space-y-2 pl-5">
                    {module.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link href={module.href}>Abrir manual</Link>
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <FileText className="h-4 w-4" />
                      Visual do módulo incluído no manual
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
    </section>
  );
}
