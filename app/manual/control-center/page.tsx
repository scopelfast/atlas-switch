import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualDocBlock } from '@/components/manual/manual-doc-block';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ControlCenterManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Governança de clientes, planos, módulos e auditoria — visão operacional para equipa de plataforma."
        backHref="/dashboard/control-center"
        backLabel="Voltar ao Control Center"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ManualDocBlock title="Resumo" wide>
          <p>
            O Control Center concentra o que é transversal ao negócio de cada cliente: planos SaaS, limites de lugares,
            módulos ativos, saúde do relacionamento e trilhos de auditoria. Não substitui o dia a dia do Taskflow ou do
            Chronos — define o <em>perímetro</em> em que esses módulos operam.
          </p>
        </ManualDocBlock>

        <ManualDocBlock title="Papéis e permissões">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Operador da plataforma</strong> — papel global{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">platform_admin</code>: acede ao Control
              Center e a decisões que afectam vários clientes ou o catálogo de ofertas.
            </li>
            <li>
              <strong>Administrador de um time</strong> — gere o próprio cliente dentro dos limites do plano; não
              confundir com o operador global (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">platform_admin</code>).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Integrações com outros módulos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Integrações globais</strong> — interruptores e políticas de conectores estão em{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/control-integrations">
                Integrações globais
              </a>
              ; o Control Center alinha o que cada cliente pode pedir à equipa de suporte.
            </li>
            <li>
              <strong>Taskflow / Reunify / Chronos</strong> — ativação de módulos no plano do cliente determina menus
              e limites (ex.: webhooks, portal público, quotas de IA).
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Inteligência artificial neste módulo">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              O Control Center <strong>não</strong> executa modelos; regista se o cliente tem módulos que podem usar IA
              (opt-in por equipa nesses módulos).
            </li>
            <li>
              Para catálogo de modelos e política técnica, ver{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/ai-center">
                Central de IA
              </a>{' '}
              e toggles em Integrações globais.
            </li>
          </ul>
        </ManualDocBlock>

        <ManualDocBlock title="Resolução de problemas" wide>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Módulo não aparece ao cliente</strong> — confirme plano ativo, flags de módulo e papel do
              utilizador no time.
            </li>
            <li>
              <strong>Divergência de limites</strong> — convites pendentes contam para lugares; veja também{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/manual/usuarios">
                Usuários
              </a>
              .
            </li>
            <li>
              Mais orientação em{' '}
              <a className="text-indigo-600 underline dark:text-indigo-400" href="/help">
                Ajuda
              </a>
              .
            </li>
          </ul>
        </ManualDocBlock>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Planos e módulos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Crie ou ajuste planos com limites e módulos.</li>
              <li>Defina preço e ciclo de cobrança.</li>
              <li>Associe o plano a cada time.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Saúde do cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Revise o score de saúde e churn.</li>
              <li>Crie ações corretivas para clientes críticos.</li>
              <li>Registre recomendações e follow-up.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Analise eventos por módulo e criticidade.</li>
              <li>Use filtros para ações sensíveis.</li>
              <li>Guarde logs críticos para compliance.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Revise planos e faturamento mensalmente.</li>
              <li>Mantenha clientes com status atualizado.</li>
              <li>Use o Control Center como fonte oficial de governança.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
