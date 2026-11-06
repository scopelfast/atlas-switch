import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualHeader } from '@/components/ui/manual-header';

export default function ActivityManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Auditoria e rastreio das ações realizadas no time."
        backHref="/dashboard/activity"
        backLabel="Voltar ao registro"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Leitura diária</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Abra o painel de atividades.</li>
              <li>Verifique as ações mais recentes.</li>
              <li>Identifique acessos incomuns.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Auditoria semanal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Revise a quantidade total de eventos.</li>
              <li>Cheque IPs únicos e padrões de acesso.</li>
              <li>Registre ocorrências suspeitas no Control Center.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Audite acessos sempre que houver troca de equipe.</li>
              <li>Use o painel como histórico oficial.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
