import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualHeader } from '@/components/ui/manual-header';

export default function GeneralManualPage() {
  return (
    <section className="w-full min-w-0">
      <ManualHeader
        title="Manual"
        description="Guia rápido para ajustar dados básicos da conta."
        backHref="/dashboard/general"
        backLabel="Voltar às configurações"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Dados da conta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Acesse <strong>Configurações gerais</strong> no menu.</li>
              <li>Atualize nome e e-mail do responsável.</li>
              <li>Salve as alterações e confirme a mensagem de sucesso.</li>
              <li>Revise o resumo da conta para validar os dados.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>POP — Avatar e identidade</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Selecione uma imagem (PNG/JPG até 2MB).</li>
              <li>Envie o avatar e aguarde a confirmação.</li>
              <li>Verifique o avatar no topo do painel.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="atlas-surface">
          <CardHeader>
            <CardTitle>Boas práticas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Mantenha o e-mail sempre atualizado para recuperação.</li>
              <li>Use nome oficial do time para padronização.</li>
              <li>Atualize a identidade do time a cada semestre.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
