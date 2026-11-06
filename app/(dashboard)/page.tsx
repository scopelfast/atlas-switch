import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Database,
  Sparkles,
  CalendarClock,
  Video,
  CheckSquare,
  Briefcase,
  Boxes,
  Library,
  NotebookPen,
  FilePenLine
} from 'lucide-react';
import { Terminal } from './terminal';
import { SiteFooter } from '@/components/shells/site-footer';

export default function HomePage() {
  return (
    <main className="bg-slate-50 dark:bg-slate-950">
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-200">
                Plataforma modular · um login
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-slate-50">
                AtlasSwitch
                <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-300">
                  Controlo total do seu SaaS
                </span>
              </h1>
              <p className="mt-3 text-base text-slate-600 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl dark:text-slate-300">
                Agenda, tarefas, reuniões, projetos e finanças no mesmo atlas visual — com manuais
                operacionais e camadas de IA com opt-in por equipa.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" className="text-lg w-full sm:w-auto">
                    <a href="/sign-up">
                      Criar minha conta
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="text-lg w-full sm:w-auto"
                  >
                    <a href="/sign-in">Entrar na plataforma</a>
                  </Button>
                </div>
                <div className="mt-6 flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    Módulos integrados: tarefas, projetos, recursos e finanças com a mesma linguagem
                    visual.
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    Central de IA para catalogar modelos; insights locais onde o produto já oferece
                    opt-in.
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    Governança: auditoria, equipas e planos — documentado em{' '}
                    <a href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                      Ajuda
                    </a>
                    .
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <div className="atlas-surface p-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-500 text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">
                  Plataforma completa
                </h2>
                <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
                  Todos os módulos integrados com governança e métricas.
                </p>
              </div>
            </div>

            <div className="atlas-surface mt-10 p-6 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-500 text-white">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">
                  Base de dados robusta
                </h2>
                <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
                  Postgres + Drizzle para evoluir sem perder performance.
                </p>
              </div>
            </div>

            <div className="atlas-surface mt-10 p-6 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-500 text-white">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">
                  Cobrança e planos
                </h2>
                <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
                  Planos por cliente e faturamento projetado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white/60 dark:bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-indigo-500">
              Módulos AtlasSwitch
            </p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Módulos integrados
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Uma visão completa do ecossistema que opera o seu SaaS.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Chronos',
                tag: 'Produtividade pessoal',
                text: 'Agenda inteligente e time-blocking.',
                icon: CalendarClock,
                accent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
              },
              {
                title: 'Reunify',
                tag: 'Reuniões eficientes',
                text: 'Reuniões com pauta, decisões e follow-up.',
                icon: Video,
                accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
              },
              {
                title: 'Taskflow',
                tag: 'Operações ágeis',
                text: 'Kanban, prioridades e automações.',
                icon: CheckSquare,
                accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
              },
              {
                title: 'Projectus',
                tag: 'Gestão estratégica',
                text: 'Projetos, riscos e cronogramas.',
                icon: Briefcase,
                accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
              },
              {
                title: 'ResourceHub',
                tag: 'Capacidade em ordem',
                text: 'Capacidade, alocação e recursos.',
                icon: Boxes,
                accent: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
              },
              {
                title: 'BillTrak',
                tag: 'Finanças SaaS',
                text: 'Custos, receitas e caixa.',
                icon: CreditCard,
                accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
              },
              {
                title: 'Bibliotheca',
                tag: 'Conhecimento organizado',
                text: 'Documentos, tags e organização.',
                icon: Library,
                accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
              },
              {
                title: 'Notepad Pro',
                tag: 'Notas conectadas',
                text: 'Notas inteligentes e conexões.',
                icon: NotebookPen,
                accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
              },
              {
                title: 'Scriptum',
                tag: 'Conteúdo estruturado',
                text: 'Escrita profissional por projetos.',
                icon: FilePenLine,
                accent: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="atlas-surface p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${item.accent}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.tag}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white/50 py-14 dark:border-slate-800/80 dark:bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Confiança em produto
          </p>
          <div className="mt-6 grid gap-8 text-center sm:grid-cols-3">
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">12+</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                módulos e áreas operacionais no mesmo painel
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">1</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                fluxo de autenticação e políticas de equipa alinhadas
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">∞</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                extensibilidade via integrações e documentação viva
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-slate-50">
                Pronto para operar com controlo total?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
                Planos configuráveis, auditoria, camadas de IA e módulos integrados — da primeira
                sessão ao dia a dia da equipa.
              </p>
            </div>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:mt-0 lg:flex-col lg:items-end">
              <Button asChild size="lg" className="text-lg w-full sm:w-auto">
                <a href="/sign-up">
                  Criar a minha conta
                  <ArrowRight className="ml-3 h-6 w-6" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg w-full sm:w-auto">
                <a href="/pricing">Ver preços (demonstração)</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter embedded />
    </main>
  );
}
