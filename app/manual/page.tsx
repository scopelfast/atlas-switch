import Link from 'next/link';
import { ManualHeader } from '@/components/ui/manual-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const links: { href: string; title: string; description: string }[] = [
  { href: '/manual/taskflow', title: 'Taskflow', description: 'Kanban, prazos, portal público e exportações.' },
  { href: '/manual/chronos', title: 'Chronos', description: 'Agenda, bloqueios de tempo e ligação a tarefas.' },
  { href: '/manual/reunify', title: 'Reunify', description: 'Reuniões, decisões e acções para o Taskflow.' },
  { href: '/manual/projectus', title: 'Projectus', description: 'Portfólio, Gantt, custos, Taskflow e Chronos — manual completo.' },
  { href: '/manual/resourcehub', title: 'ResourceHub', description: 'Capacidade e alocação de recursos.' },
  { href: '/manual/billtrak', title: 'BillTrak', description: 'Lançamentos, transações, métricas e centavos na UI.' },
  { href: '/manual/bibliotheca', title: 'Bibliotheca', description: 'Upload, Projectus, APIs e manual completo.' },
  { href: '/manual/notepad', title: 'Notepad Pro', description: 'Notas, Markdown, Projectus e filtros — manual completo.' },
  { href: '/manual/scriptum', title: 'Scriptum', description: 'Metas, capítulos, Bibliotheca e Notepad.' },
  { href: '/manual/control-center', title: 'Control Center', description: 'Operador da instância: clientes, planos e auditoria.' },
  { href: '/manual/control-integrations', title: 'Integrações globais', description: 'Só operador da plataforma: toggles e política de conectores.' },
  { href: '/manual/ai-center', title: 'Central de IA', description: 'Só operador da plataforma: catálogo de modelos.' },
  { href: '/manual/usuarios', title: 'Usuários', description: 'Convites, papéis e hierarquia.' },
  { href: '/manual/general', title: 'Definições gerais', description: 'Perfil e identidade da conta.' },
  { href: '/manual/security', title: 'Segurança', description: 'Senha e boas práticas.' },
  { href: '/manual/activity', title: 'Atividade', description: 'Auditoria e histórico.' },
];

export default function ManualIndexPage() {
  return (
    <div className="space-y-8">
      <ManualHeader
        backHref="/help"
        backLabel="Ajuda"
        title="Manuais"
        description="Índice de todos os manuais operacionais: fluxos, permissões, integrações entre módulos e IA."
      />
      <Card className="atlas-surface border-violet-200/50 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-500/20 dark:from-violet-950/35 dark:to-slate-950">
        <CardHeader>
          <CardTitle className="text-lg">Como usar este índice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            Cada manual segue o mesmo esqueleto: <strong>resumo</strong>, <strong>papéis</strong>,{' '}
            <strong>fluxo operacional</strong>, <strong>ligações a outros módulos</strong>,{' '}
            <strong>papel da IA</strong> (local vs nuvem) e <strong>resolução de problemas</strong>. Comece por
            Taskflow, Chronos e Reunify no dia a dia; manuais do Control Center, Integrações globais e Central de IA
            destinam-se a quem <strong>opera a instância</strong> (conta com permissão de operador da plataforma), não
            ao dono típico de um time cliente.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O <Link href="/help" className="font-medium text-indigo-600 underline dark:text-indigo-400">Centro de ajuda</Link>{' '}
            explica perfis, checklists e o mapa de valor entre módulos.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <Card key={item.href} className="atlas-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Link href={item.href} className="text-indigo-600 hover:underline dark:text-indigo-400">
                  {item.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">{item.description}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
