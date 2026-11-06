import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualHeader } from '@/components/ui/manual-header';

export default function SecurityManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Procedimentos para proteger a conta e o time."
        backHref="/dashboard/security"
        backLabel="Voltar à segurança"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Troca de senha</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Digite a senha atual.</li>
              <li>Informe a nova senha e confirme.</li>
              <li>Salve e aguarde a confirmação.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Exclusão de conta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Revise os impactos com o responsável do time.</li>
              <li>Digite a senha para confirmação.</li>
              <li>Finalize somente quando tiver backup dos dados.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Troque a senha a cada semestre.</li>
              <li>Não reutilize senhas em outras plataformas.</li>
              <li>Em caso de suspeita, avise o gestor imediatamente.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
